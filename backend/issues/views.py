import math
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from .auto_assign import find_best_worker
from .models import Issue, IssueComment, IssueTimeline, IssueUpvote
from .serializers import IssueSerializer, IssueCreateSerializer, IssueCommentSerializer

User = get_user_model()


def _haversine_km(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def issue_list_create(request):
    if request.method == 'GET':
        qs = Issue.objects.select_related('reported_by', 'assigned_to').prefetch_related('comments', 'timeline', 'upvote_records')

        # Only admins see all issues; citizens/workers see public ones
        if request.user.role == 'citizen':
            qs = qs.filter(is_public=True)

        # Filters
        ward = request.query_params.get('ward')
        status_f = request.query_params.get('status')
        category = request.query_params.get('category')
        search = request.query_params.get('search')
        if ward:
            qs = qs.filter(ward=ward)
        if status_f:
            qs = qs.filter(status=status_f)
        if category:
            qs = qs.filter(category=category)
        if search:
            qs = qs.filter(title__icontains=search)

        serializer = IssueSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)

    # POST — citizen creates issue
    if request.user.role not in ('citizen', 'admin'):
        return Response({'detail': 'Only citizens can report issues.'}, status=403)

    serializer = IssueCreateSerializer(data=request.data)
    if serializer.is_valid():
        issue = serializer.save(reported_by=request.user)
        # Timeline entry for submission
        IssueTimeline.objects.create(issue=issue, status='Submitted', note='Issue reported by citizen.')

        # Auto-assign to best available worker
        worker = find_best_worker(issue.category, issue.ward)
        if worker:
            Issue.objects.filter(pk=issue.pk).update(
                assigned_to=worker,
                assigned_at=timezone.now(),
                status='Assigned',
            )
            IssueTimeline.objects.create(
                issue=issue,
                status='Assigned',
                note=f'Auto-assigned to {worker.get_full_name() or worker.username} based on category and workload.',
            )
            issue.refresh_from_db()

        full = IssueSerializer(issue, context={'request': request})
        return Response(full.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def issue_detail(request, pk):
    try:
        issue = Issue.objects.select_related('reported_by', 'assigned_to').prefetch_related('comments', 'timeline', 'upvote_records').get(pk=pk)
    except Issue.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=404)

    if request.method == 'GET':
        return Response(IssueSerializer(issue, context={'request': request}).data)

    # PATCH
    user = request.user
    old_status = issue.status
    admin_priority_override = None

    # Worker: can only update status + completion photo on their assigned issue
    if user.role == 'worker':
        if issue.assigned_to_id != user.id:
            return Response({'detail': 'Not your task.'}, status=403)
        allowed = {}
        if 'status' in request.data:
            allowed['status'] = request.data['status']
        if 'completion_photo' in request.FILES:
            allowed['completion_photo'] = request.FILES['completion_photo']
        for field, value in allowed.items():
            setattr(issue, field, value)

    # Admin: can update anything
    elif user.role == 'admin':
        for field in ['status', 'priority', 'assigned_to']:
            if field in request.data:
                if field == 'assigned_to':
                    try:
                        worker = User.objects.get(pk=request.data['assigned_to'], role='worker')
                        issue.assigned_to = worker
                        issue.assigned_at = timezone.now()
                        if issue.status == 'Submitted':
                            issue.status = 'Assigned'
                    except User.DoesNotExist:
                        return Response({'detail': 'Worker not found.'}, status=400)
                elif field == 'priority':
                    admin_priority_override = request.data['priority']
                else:
                    setattr(issue, field, request.data[field])
    else:
        return Response({'detail': 'Forbidden.'}, status=403)

    # Handle status transitions
    new_status = issue.status
    if new_status != old_status:
        if new_status in ('Resolved', 'Closed') and not issue.resolved_at:
            issue.resolved_at = timezone.now()
        IssueTimeline.objects.create(issue=issue, status=new_status, note=f"Status changed to {new_status}.")

    issue.save()
    issue.refresh_from_db()  # ensure file fields and all updates are reflected

    # Apply admin priority override AFTER save (save() auto-computes priority)
    if user.role == 'admin' and admin_priority_override:
        Issue.objects.filter(pk=issue.pk).update(priority=admin_priority_override)
        issue.priority = admin_priority_override

    # Trigger AI verification if worker just uploaded completion_photo
    if user.role == 'worker' and 'completion_photo' in request.FILES:
        _trigger_ai_verify(issue)
        issue.refresh_from_db()  # pick up ai_completion_score/verdict written by AI

    return Response(IssueSerializer(issue, context={'request': request}).data)


def _trigger_ai_verify(issue):
    """Run AI completion verification and persist the result."""
    try:
        from ai.services import verify_completion
        result = verify_completion(issue)
        if result:
            Issue.objects.filter(pk=issue.pk).update(
                ai_completion_score=result.get('completion_score'),
                ai_completion_verdict=result.get('verdict', ''),
            )
    except Exception:
        pass  # AI failure should never block the main response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_issues(request):
    """Citizen: their own reported issues."""
    if request.user.role != 'citizen':
        return Response({'detail': 'Citizens only.'}, status=403)
    qs = Issue.objects.filter(reported_by=request.user).prefetch_related('comments', 'timeline', 'upvote_records')
    return Response(IssueSerializer(qs, many=True, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def assigned_issues(request):
    """Worker: their assigned tasks."""
    if request.user.role != 'worker':
        return Response({'detail': 'Workers only.'}, status=403)
    qs = Issue.objects.filter(assigned_to=request.user).prefetch_related('comments', 'timeline', 'upvote_records')
    return Response(IssueSerializer(qs, many=True, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def nearby_issues(request):
    """Public feed filtered by proximity."""
    try:
        lat = float(request.query_params.get('lat', 16.6944))
        lng = float(request.query_params.get('lng', 74.4615))
        radius_km = float(request.query_params.get('radius_km', 2.0))
    except ValueError:
        return Response({'detail': 'Invalid lat/lng/radius.'}, status=400)

    qs = Issue.objects.filter(
        is_public=True,
        location_lat__isnull=False,
        location_lng__isnull=False,
    ).select_related('reported_by', 'assigned_to').prefetch_related('upvote_records')

    results = []
    for issue in qs:
        dist = _haversine_km(lat, lng, issue.location_lat, issue.location_lng)  # type: ignore[arg-type]
        if dist <= radius_km:
            d = IssueSerializer(issue, context={'request': request}).data
            d['distance_km'] = round(dist, 2)
            results.append(d)

    results.sort(key=lambda x: x['distance_km'])
    return Response(results)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upvote_issue(request, pk):
    try:
        issue = Issue.objects.get(pk=pk)
    except Issue.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=404)

    obj, created = IssueUpvote.objects.get_or_create(issue=issue, user=request.user)
    if created:
        Issue.objects.filter(pk=pk).update(upvotes=issue.upvotes + 1)
        return Response({'upvoted': True, 'upvotes': issue.upvotes + 1})
    else:
        obj.delete()
        Issue.objects.filter(pk=pk).update(upvotes=max(issue.upvotes - 1, 0))
        return Response({'upvoted': False, 'upvotes': max(issue.upvotes - 1, 0)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_comment(request, pk):
    try:
        issue = Issue.objects.get(pk=pk)
    except Issue.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=404)

    text = request.data.get('text', '').strip()
    if not text:
        return Response({'detail': 'Comment text is required.'}, status=400)

    comment = IssueComment.objects.create(issue=issue, user=request.user, text=text)
    return Response(IssueCommentSerializer(comment).data, status=status.HTTP_201_CREATED)

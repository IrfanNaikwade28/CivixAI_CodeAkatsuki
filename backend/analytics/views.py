from django.contrib.auth import get_user_model
from django.db.models import Count, Avg, F, Q, ExpressionWrapper, DurationField
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from issues.models import Issue

User = get_user_model()


def _admin_only(request):
    return request.user.role == 'admin'


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    total = Issue.objects.count()
    resolved = Issue.objects.filter(status__in=['Resolved', 'Closed']).count()
    pending = Issue.objects.filter(status__in=['Submitted', 'Assigned', 'In Progress']).count()
    active_workers = User.objects.filter(role='worker').count()
    high_priority = Issue.objects.filter(priority='High', status__in=['Submitted', 'Assigned', 'In Progress']).count()

    return Response({
        'total_issues': total,
        'resolved': resolved,
        'pending': pending,
        'active_workers': active_workers,
        'high_priority_open': high_priority,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ward_stats(request):
    if not _admin_only(request):
        return Response({'detail': 'Forbidden'}, status=403)

    wards = Issue.objects.values('ward').annotate(
        total_issues=Count('id'),
        resolved=Count('id', filter=Q(status__in=['Resolved', 'Closed'])),
        pending=Count('id', filter=Q(status__in=['Submitted', 'Assigned', 'In Progress'])),
    ).order_by('ward')

    data = []
    for w in wards:
        data.append({
            'ward': w['ward'],
            'total_issues': w['total_issues'],
            'resolved': w['resolved'],
            'pending': w['pending'],
        })
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def category_trend(request):
    if not _admin_only(request):
        return Response({'detail': 'Forbidden'}, status=403)

    categories = ['Road', 'Water', 'Electricity', 'Garbage', 'Traffic', 'Public Facilities']

    qs = Issue.objects.annotate(month=TruncMonth('reported_at')).values('month', 'category').annotate(count=Count('id')).order_by('month', 'category')

    # Pivot into {month: {category: count}}
    pivot = {}
    for row in qs:
        m = row['month'].strftime('%b %Y') if row['month'] else 'Unknown'
        pivot.setdefault(m, {})
        pivot[m][row['category']] = row['count']

    result = []
    for month, cats in pivot.items():
        entry = {'month': month}
        for cat in categories:
            entry[cat] = cats.get(cat, 0)
        result.append(entry)

    return Response(result)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def resolution_trend(request):
    if not _admin_only(request):
        return Response({'detail': 'Forbidden'}, status=403)

    qs = Issue.objects.filter(
        resolved_at__isnull=False
    ).annotate(
        month=TruncMonth('reported_at')
    ).values('month').annotate(
        avg_hours=Avg(
            ExpressionWrapper(
                F('resolved_at') - F('reported_at'),
                output_field=DurationField()
            )
        )
    ).order_by('month')

    result = []
    for row in qs:
        avg_td = row['avg_hours']
        avg_h = round(avg_td.total_seconds() / 3600, 1) if avg_td else 0
        result.append({
            'month': row['month'].strftime('%b %Y') if row['month'] else 'Unknown',
            'avg_hours': avg_h,
        })
    return Response(result)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def activity_log(request):
    if not _admin_only(request):
        return Response({'detail': 'Forbidden'}, status=403)

    # Build a synthetic activity log from recent timeline entries
    from issues.models import IssueTimeline
    entries = IssueTimeline.objects.select_related('issue').order_by('-changed_at')[:20]

    TYPE_MAP = {
        'Submitted': 'submit',
        'Assigned': 'assign',
        'In Progress': 'update',
        'Resolved': 'resolve',
        'Closed': 'close',
    }

    data = []
    for e in entries:
        data.append({
            'id': e.id,
            'action': f"{e.issue.display_id}: {e.note or e.status}",
            'time': e.changed_at,
            'type': TYPE_MAP.get(e.status, 'update'),
        })
    return Response(data)

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .services import detect_issue, verify_completion, verify_completion_from_bytes


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def detect_issue_view(request):
    """
    POST /api/ai/detect-issue/
    Multipart: image=<file>
    Returns: {category, title, confidence}
    """
    if 'image' not in request.FILES:
        return Response({'detail': 'image file is required.'}, status=400)

    image_file = request.FILES['image']
    result = detect_issue(image_file)

    if result is None:
        # Fallback when AI fails — let citizen fill manually
        return Response({
            'category': 'Public Facilities',
            'title': '',
            'confidence': 0.0,
            'ai_available': False,
        })

    return Response({**result, 'ai_available': True})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def trigger_verify_view(request, issue_id):
    """
    POST /api/ai/verify-completion/<issue_id>/
    Manually trigger AI verification (admin use). Auto-triggered on worker upload too.
    Returns: {completion_score, verdict}
    """
    if request.user.role not in ('admin', 'worker'):
        return Response({'detail': 'Forbidden.'}, status=403)

    from issues.models import Issue
    try:
        issue = Issue.objects.get(pk=issue_id)
    except Issue.DoesNotExist:
        return Response({'detail': 'Issue not found.'}, status=404)

    if not issue.completion_photo:
        return Response({'detail': 'No completion photo uploaded yet.'}, status=400)

    result = verify_completion(issue)
    if result is None:
        return Response({'detail': 'AI verification failed. Check server logs.'}, status=500)

    Issue.objects.filter(pk=issue.pk).update(
        ai_completion_score=result['completion_score'],
        ai_completion_verdict=result['verdict'],
    )
    return Response(result)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def preview_completion_view(request, issue_id):
    """
    POST /api/ai/preview-completion/<issue_id>/
    Multipart: completion_photo=<file>
    Scores the worker's photo against the before-image WITHOUT saving anything.
    Returns: {completion_score, verdict}
    Worker can review the AI assessment before deciding to submit & resolve.
    """
    if request.user.role != 'worker':
        return Response({'detail': 'Workers only.'}, status=403)

    if 'completion_photo' not in request.FILES:
        return Response({'detail': 'completion_photo is required.'}, status=400)

    from issues.models import Issue
    try:
        issue = Issue.objects.get(pk=issue_id)
    except Issue.DoesNotExist:
        return Response({'detail': 'Issue not found.'}, status=404)

    if issue.assigned_to_id != request.user.id:
        return Response({'detail': 'Not your task.'}, status=403)

    if not issue.image:
        # No before-photo — still score with just the after photo context
        return Response({
            'completion_score': 50,
            'verdict': 'No before-photo available for comparison. Score estimated.',
            'ai_available': False,
        })

    after_bytes = request.FILES['completion_photo'].read()
    after_mime = request.FILES['completion_photo'].content_type or 'image/jpeg'

    result = verify_completion_from_bytes(issue, after_bytes, after_mime)
    if result is None:
        return Response({'detail': 'AI preview failed.'}, status=500)

    return Response({**result, 'ai_available': True})

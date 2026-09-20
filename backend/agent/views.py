from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from issues.models import Issue
from agent.models import AgentTrace
from agent.orchestrator import process_complaint
from agent.monitoring import monitor_complaints
from agent.serializers import (
    AgentTraceSerializer,
    AgentProcessResultSerializer,
    AgentStatusSerializer,
)


def _can_access_issue(user, issue):
    """Check if a user is authorized to access an issue's agent data."""
    if user.role == 'admin':
        return True
    if user.role == 'worker' and issue.assigned_to_id == user.id:
        return True
    if user.role == 'citizen' and issue.reported_by_id == user.id:
        return True
    return False


def _can_process_issue(user, issue):
    """Check if a user can trigger agent processing on an issue."""
    if user.role == 'admin':
        return True
    if user.role == 'worker' and issue.assigned_to_id == user.id:
        return True
    return False


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def process_complaint_view(request, issue_id):
    """POST /api/agent/process-complaint/<issue_id>/"""
    try:
        issue = Issue.objects.get(pk=issue_id)
    except Issue.DoesNotExist:
        return Response(
            {'success': False, 'message': 'Issue not found'},
            status=status.HTTP_404_NOT_FOUND,
        )

    if not _can_process_issue(request.user, issue):
        return Response(
            {'success': False, 'message': 'You do not have permission to process this issue'},
            status=status.HTTP_403_FORBIDDEN,
        )

    result = process_complaint(issue)
    http_status = status.HTTP_200_OK if result.get('success') else status.HTTP_400_BAD_REQUEST
    return Response(result, status=http_status)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def agent_trace_view(request, issue_id):
    """GET /api/agent/trace/<issue_id>/"""
    try:
        issue = Issue.objects.get(pk=issue_id)
    except Issue.DoesNotExist:
        return Response(
            {'success': False, 'message': 'Issue not found'},
            status=status.HTTP_404_NOT_FOUND,
        )

    if not _can_access_issue(request.user, issue):
        return Response(
            {'success': False, 'message': 'You do not have permission to access this issue'},
            status=status.HTTP_403_FORBIDDEN,
        )

    traces = AgentTrace.objects.filter(issue=issue).order_by('timestamp')
    serializer = AgentTraceSerializer(traces, many=True)
    return Response({
        'issue_id': issue_id,
        'traces': serializer.data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def agent_status_view(request, issue_id):
    """GET /api/agent/status/<issue_id>/"""
    try:
        issue = Issue.objects.get(pk=issue_id)
    except Issue.DoesNotExist:
        return Response(
            {'success': False, 'message': 'Issue not found'},
            status=status.HTTP_404_NOT_FOUND,
        )

    if not _can_access_issue(request.user, issue):
        return Response(
            {'success': False, 'message': 'You do not have permission to access this issue'},
            status=status.HTTP_403_FORBIDDEN,
        )

    traces = AgentTrace.objects.filter(issue=issue).order_by('timestamp')
    trace_count = traces.count()
    latest_action = traces.first().action if trace_count > 0 else None
    active_actions = {'RECEIVED', 'UNDERSTAND', 'ANALYZED', 'DECIDED'}
    agent_processing = latest_action in active_actions if latest_action else False

    assigned_worker = None
    if issue.assigned_to:
        assigned_worker = {
            'id': issue.assigned_to_id,
            'display_id': issue.assigned_to.display_id,
        }

    data = {
        'issue_id': issue_id,
        'issue_status': issue.status,
        'priority': issue.priority,
        'assigned_worker': assigned_worker,
        'latest_agent_action': latest_action,
        'agent_processing': agent_processing,
        'trace_count': trace_count,
    }
    serializer = AgentStatusSerializer(data)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def monitor_view(request):
    """POST /api/agent/monitor/"""
    if request.user.role != 'admin':
        return Response(
            {'success': False, 'message': 'Admin access required'},
            status=status.HTTP_403_FORBIDDEN,
        )

    result = monitor_complaints()
    return Response(result)

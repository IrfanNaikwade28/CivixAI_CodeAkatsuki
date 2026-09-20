"""
CivixAI Follow-up Logic.

Deterministic follow-up rules for unresolved complaints.
No Gemini calls — pure backend conditions.

Follow-up occurs before escalation for issues that are assigned/in-progress
but have not been resolved within a shorter threshold.
"""

FOLLOWUP_HOURS = 12


def _hours_since(dt):
    """Return hours elapsed since a datetime, or 0 if None."""
    if dt is None:
        return 0
    from django.utils import timezone
    delta = timezone.now() - dt
    return delta.total_seconds() / 3600


def _already_followed_up_since(issue, since):
    """Check if FOLLOW_UP_INITIATED trace exists after `since`."""
    from agent.models import AgentTrace
    qs = AgentTrace.objects.filter(
        issue=issue,
        action='FOLLOW_UP_INITIATED',
    )
    if since:
        qs = qs.filter(timestamp__gte=since)
    return qs.exists()


def should_follow_up(issue):
    """
    Determine if an issue should receive a follow-up.

    Follow-up applies to assigned/in-progress issues that have exceeded
    the follow-up threshold without resolution.

    Returns (bool, reason | None).
    """
    if issue.status in ('Resolved', 'Closed'):
        return False, None

    if issue.status not in ('Assigned', 'In Progress'):
        return False, None

    elapsed = _hours_since(issue.assigned_at or issue.reported_at)
    if elapsed < FOLLOWUP_HOURS:
        return False, None

    # Duplicate protection
    since = issue.assigned_at or issue.reported_at
    if _already_followed_up_since(issue, since):
        return False, None

    reason = f"Assigned/in-progress issue unresolved beyond {FOLLOWUP_HOURS}h threshold ({elapsed:.1f}h elapsed)"
    return True, reason


def follow_up_complaint(issue):
    """
    Initiate follow-up for a complaint and create an AgentTrace record.

    Returns a structured result dict.
    """
    if issue.status in ('Resolved', 'Closed'):
        return {
            'success': False,
            'action': 'FOLLOW_UP',
            'message': 'Issue already resolved',
        }

    elapsed = _hours_since(issue.assigned_at or issue.reported_at)
    reason = f"Follow-up initiated: {issue.status} issue unresolved beyond {FOLLOWUP_HOURS}h threshold ({elapsed:.1f}h elapsed)"

    from agent.tools import log_agent_action

    log_agent_action(
        issue,
        action='FOLLOW_UP_INITIATED',
        decision={
            'issue_id': issue.pk,
            'current_status': issue.status,
            'priority': issue.priority,
            'elapsed_hours': round(elapsed, 1),
            'reason': reason,
        },
    )

    return {
        'success': True,
        'action': 'FOLLOW_UP',
        'message': 'Follow-up initiated',
        'issue_id': issue.pk,
    }

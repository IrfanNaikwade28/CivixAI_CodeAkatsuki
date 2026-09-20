"""
CivixAI Escalation Logic.

Deterministic escalation rules for unresolved complaints.
No Gemini calls — pure backend conditions.

Escalation takes precedence over follow-up.
"""

HIGH_PRIORITY_ESCALATION_HOURS = 24
MEDIUM_PRIORITY_ESCALATION_HOURS = 48
LOW_PRIORITY_ESCALATION_HOURS = 72

ESCALATION_THRESHOLDS = {
    'High': HIGH_PRIORITY_ESCALATION_HOURS,
    'Medium': MEDIUM_PRIORITY_ESCALATION_HOURS,
    'Low': LOW_PRIORITY_ESCALATION_HOURS,
}


def _hours_since(dt):
    """Return hours elapsed since a datetime, or 0 if None."""
    if dt is None:
        return 0
    from django.utils import timezone
    delta = timezone.now() - dt
    return delta.total_seconds() / 3600


def _already_escalated_since(issue, since):
    """Check if ESCALATION_INITIATED trace exists after `since`."""
    from agent.models import AgentTrace
    qs = AgentTrace.objects.filter(
        issue=issue,
        action='ESCALATION_INITIATED',
    )
    if since:
        qs = qs.filter(timestamp__gte=since)
    return qs.exists()


def should_escalate(issue):
    """
    Determine if an issue should be escalated.

    Returns (bool, reason | None).
    """
    if issue.status in ('Resolved', 'Closed'):
        return False, None

    threshold_hours = ESCALATION_THRESHOLDS.get(issue.priority)
    if threshold_hours is None:
        return False, None

    elapsed = _hours_since(issue.reported_at)
    if elapsed < threshold_hours:
        return False, None

    # Duplicate protection: skip if already escalated since issue was reported
    if _already_escalated_since(issue, issue.reported_at):
        return False, None

    reason = f"{issue.priority} priority unresolved beyond {threshold_hours}h threshold ({elapsed:.1f}h elapsed)"
    return True, reason


def escalate_complaint(issue, reason=None):
    """
    Escalate a complaint and create an AgentTrace record.

    Returns a structured result dict.
    """
    if issue.status in ('Resolved', 'Closed'):
        return {
            'success': False,
            'action': 'ESCALATE',
            'message': 'Issue already resolved',
        }

    if reason is None:
        threshold_hours = ESCALATION_THRESHOLDS.get(issue.priority, 0)
        elapsed = _hours_since(issue.reported_at)
        reason = f"{issue.priority} priority unresolved beyond {threshold_hours}h threshold ({elapsed:.1f}h elapsed)"

    from agent.tools import log_agent_action
    from django.utils import timezone

    elapsed = _hours_since(issue.reported_at)
    threshold_hours = ESCALATION_THRESHOLDS.get(issue.priority, 0)

    log_agent_action(
        issue,
        action='ESCALATION_INITIATED',
        decision={
            'issue_id': issue.pk,
            'priority': issue.priority,
            'status': issue.status,
            'reason': reason,
            'escalation_threshold_hours': threshold_hours,
            'elapsed_hours': round(elapsed, 1),
        },
    )

    return {
        'success': True,
        'action': 'ESCALATE',
        'message': 'Escalation initiated',
        'issue_id': issue.pk,
        'reason': reason,
    }

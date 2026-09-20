"""
CivixAI Monitoring Service.

Scans unresolved complaints and decides whether to follow up or escalate.
Uses deterministic backend rules — no Gemini calls.

Each issue is processed independently so one failure does not stop the rest.
"""
import logging

from issues.models import Issue
from agent.tools import log_agent_action
from agent.escalation import should_escalate, escalate_complaint
from agent.followup import should_follow_up, follow_up_complaint

logger = logging.getLogger('ai')

UNRESOLVED_STATUSES = ['Submitted', 'Assigned', 'In Progress']


def monitor_complaints():
    """
    Run one monitoring cycle over all unresolved complaints.

    Returns a summary dict.
    """
    issues = list(Issue.objects.filter(status__in=UNRESOLVED_STATUSES))

    summary = {
        'success': True,
        'processed': 0,
        'followups': 0,
        'escalations': 0,
        'skipped': 0,
        'errors': 0,
    }

    if issues:
        log_agent_action(
            issues[0],
            action='MONITOR_STARTED',
            input_data={'unresolved_count': len(issues)},
        )

    for issue in issues:
        try:
            # Escalation takes precedence over follow-up
            escalate, esc_reason = should_escalate(issue)
            if escalate:
                result = escalate_complaint(issue, reason=esc_reason)
                if result.get('success'):
                    summary['escalations'] += 1
                summary['processed'] += 1
                continue

            followup, fu_reason = should_follow_up(issue)
            if followup:
                result = follow_up_complaint(issue)
                if result.get('success'):
                    summary['followups'] += 1
                summary['processed'] += 1
                continue

            summary['skipped'] += 1
            summary['processed'] += 1

        except Exception as e:
            logger.error(f"monitor_complaints failed for issue {issue.pk}: {e}")
            summary['errors'] += 1
            summary['processed'] += 1

    # Final trace for the cycle
    if issues:
        log_agent_action(
            issues[0],
            action='MONITOR_COMPLETED',
            output_data=summary,
        )

    return summary

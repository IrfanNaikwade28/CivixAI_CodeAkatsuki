"""
CivixAI Agent Orchestrator.

Coordinates the full complaint-processing pipeline:

    UNDERSTAND → ANALYZE → DECIDE → ACT → TRACE

Gemini intelligence comes from agent.analysis.analyze_complaint().
Database mutations come from agent.tools.
The orchestrator itself only coordinates the workflow.
"""
import logging

from agent.analysis import analyze_complaint
from agent.tools import (
    assign_worker,
    apply_analysis,
    log_agent_action,
)

logger = logging.getLogger('ai')

TERMINAL_STATUSES = {'Resolved', 'Closed'}


def process_complaint(issue):
    """
    Run the CivixAI agent pipeline for a single complaint.

    Returns a structured result dict that is always safe to serialize.
    Never raises — any failure is captured and returned.
    """
    issue_id = issue.pk

    # ── IDEMPOTENCY: skip already-resolved issues ──
    if issue.status in TERMINAL_STATUSES:
        return {
            'success': True,
            'issue_id': issue_id,
            'message': 'Issue already resolved or closed',
            'skipped': True,
        }

    # ── IDEMPOTENCY: skip if already processed (RECEIVED trace exists) ──
    from agent.models import AgentTrace as _AT
    if _AT.objects.filter(issue_id=issue_id, action='RECEIVED').exists():
        return {
            'success': True,
            'issue_id': issue_id,
            'message': 'Issue already processed by agent',
            'skipped': True,
        }

    # ════════════════════════════════════════════════
    # STEP 1 — RECEIVE
    # ════════════════════════════════════════════════
    log_agent_action(
        issue,
        action='RECEIVED',
        input_data={
            'issue_id': issue_id,
            'category': issue.category,
            'title': issue.title,
            'ward': issue.ward,
            'location': issue.location_text or None,
        },
    )

    # ════════════════════════════════════════════════
    # STEP 2 — UNDERSTAND
    # ════════════════════════════════════════════════
    log_agent_action(
        issue,
        action='UNDERSTAND',
        input_data={
            'issue_id': issue_id,
            'description': issue.description or None,
            'has_image': bool(issue.image),
            'status': issue.status,
            'priority': issue.priority,
        },
    )

    # ════════════════════════════════════════════════
    # STEP 3 — ANALYZE
    # ════════════════════════════════════════════════
    analysis = analyze_complaint(issue)

    if analysis is None:
        log_agent_action(
            issue,
            action='ANALYSIS_FAILED',
            decision={'stage': 'ANALYZE', 'reason': 'Gemini analysis returned None'},
        )
        return {
            'success': False,
            'issue_id': issue_id,
            'stage': 'ANALYZE',
            'message': 'Complaint analysis failed',
        }

    log_agent_action(
        issue,
        action='ANALYZED',
        decision={
            'classification': analysis.get('classification'),
            'severity': analysis.get('severity'),
            'priority': analysis.get('priority'),
            'department': analysis.get('department'),
            'recommended_action': analysis.get('recommended_action'),
            'reasoning': analysis.get('reasoning'),
        },
    )

    # ════════════════════════════════════════════════
    # STEP 4 — APPLY DECISION (update issue fields)
    # ════════════════════════════════════════════════
    apply_result = apply_analysis(issue, analysis)

    if not apply_result.get('success'):
        log_agent_action(
            issue,
            action='DECISION_FAILED',
            decision={'stage': 'APPLY_ANALYSIS', 'error': apply_result.get('message')},
        )
        return {
            'success': False,
            'issue_id': issue_id,
            'stage': 'APPLY_ANALYSIS',
            'message': f"Failed to apply analysis: {apply_result.get('message')}",
        }

    # ════════════════════════════════════════════════
    # STEP 5 — DECIDE NEXT ACTION
    # ════════════════════════════════════════════════
    recommended = analysis.get('recommended_action', 'REVIEW')

    log_agent_action(
        issue,
        action='DECIDED',
        decision={
            'recommended_action': recommended,
            'reason': analysis.get('reasoning'),
            'severity': analysis.get('severity'),
            'priority': analysis.get('priority'),
            'department': analysis.get('department'),
        },
    )

    # ════════════════════════════════════════════════
    # STEP 6 — EXECUTE ACTION
    # ════════════════════════════════════════════════
    result = {
        'success': True,
        'issue_id': issue_id,
        'action': recommended,
        'analysis': analysis,
        'execution': {},
    }

    if recommended == 'ASSIGN_WORKER':
        exec_result = assign_worker(issue)
        result['execution'] = exec_result

        trace_action = 'WORKER_ASSIGNED' if exec_result.get('success') else 'ASSIGNMENT_FAILED'
        log_agent_action(
            issue,
            action=trace_action,
            output_data=exec_result,
        )

    elif recommended == 'REVIEW':
        result['execution'] = {
            'success': True,
            'message': 'Human review required',
        }
        log_agent_action(
            issue,
            action='REVIEW_REQUIRED',
            output_data={'message': 'Issue left for human/admin review'},
        )

    elif recommended == 'FOLLOW_UP':
        result['execution'] = {
            'success': True,
            'message': 'Follow-up required',
        }
        log_agent_action(
            issue,
            action='FOLLOW_UP_REQUIRED',
            decision={
                'reason': analysis.get('reasoning'),
                'priority': analysis.get('priority'),
                'severity': analysis.get('severity'),
            },
            output_data={'message': 'Follow-up pending future workflow handling'},
        )

    elif recommended == 'ESCALATE':
        result['execution'] = {
            'success': True,
            'message': 'Escalation required',
        }
        log_agent_action(
            issue,
            action='ESCALATION_REQUIRED',
            decision={
                'reason': analysis.get('reasoning'),
                'priority': analysis.get('priority'),
                'severity': analysis.get('severity'),
            },
            output_data={'message': 'Escalation pending future workflow handling'},
        )

    else:
        result['execution'] = {
            'success': True,
            'message': f'Unhandled action: {recommended}',
        }
        log_agent_action(
            issue,
            action='UNKNOWN_ACTION',
            decision={'recommended_action': recommended},
        )

    # ════════════════════════════════════════════════
    # STEP 7 — FINAL TRACE
    # ════════════════════════════════════════════════
    issue.refresh_from_db()
    log_agent_action(
        issue,
        action='COMPLETED',
        output_data={
            'action': recommended,
            'execution_success': result['execution'].get('success', False),
            'final_status': issue.status,
            'assigned_to': issue.assigned_to_id,
        },
    )

    return result

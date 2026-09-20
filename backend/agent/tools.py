"""
CivixAI Agent Action Tools.

Safe Django functions that execute validated agent decisions.
The Agent Orchestrator calls these after receiving analysis from Gemini.

Gemini NEVER directly modifies the database.
These tools bridge structured AI decisions to Django database mutations.
"""
import logging

from django.utils import timezone

logger = logging.getLogger('ai')

VALID_STATUSES = {'Submitted', 'Assigned', 'In Progress', 'Resolved', 'Closed'}
VALID_CATEGORIES = {'Road', 'Water', 'Electricity', 'Garbage', 'Traffic', 'Public Facilities'}
VALID_PRIORITIES = {'High', 'Medium', 'Low'}


def assign_worker(issue):
    """
    Assign the best available worker to an issue.

    Reuses the existing assignment logic from issues/auto_assign.py.
    Returns a structured result dict.
    """
    from issues.auto_assign import find_best_worker
    from issues.models import Issue, IssueTimeline

    try:
        worker = find_best_worker(issue.category, issue.ward)

        if worker is None:
            return {
                'success': False,
                'action': 'ASSIGN_WORKER',
                'message': 'No suitable worker available',
            }

        Issue.objects.filter(pk=issue.pk).update(
            assigned_to=worker,
            assigned_at=timezone.now(),
            status='Assigned',
        )
        IssueTimeline.objects.create(
            issue=issue,
            status='Assigned',
            note=f'Agent auto-assigned to {worker.get_full_name() or worker.username}.',
        )
        issue.refresh_from_db()

        return {
            'success': True,
            'action': 'ASSIGN_WORKER',
            'worker_id': worker.pk,
            'worker_display_id': worker.display_id,
            'worker_name': worker.full_name,
            'message': 'Worker assigned successfully',
        }

    except Exception as e:
        logger.error(f"assign_worker failed for issue {issue.pk}: {e}")
        return {
            'success': False,
            'action': 'ASSIGN_WORKER',
            'message': f'Assignment failed: {str(e)}',
        }


def update_issue_status(issue, status, note=None):
    """
    Update the status of an issue.

    Validates against existing status choices.
    Creates an IssueTimeline entry following project conventions.
    Returns a structured result dict.
    """
    from issues.models import Issue, IssueTimeline

    if status not in VALID_STATUSES:
        return {
            'success': False,
            'action': 'UPDATE_STATUS',
            'message': f'Invalid status: {status}. Must be one of: {", ".join(sorted(VALID_STATUSES))}',
        }

    try:
        old_status = issue.status

        if status == old_status:
            return {
                'success': True,
                'action': 'UPDATE_STATUS',
                'status': status,
                'message': f'Status already {status}',
            }

        update_fields = {'status': status}

        if status in ('Resolved', 'Closed') and not issue.resolved_at:
            update_fields['resolved_at'] = timezone.now()

        Issue.objects.filter(pk=issue.pk).update(**update_fields)

        timeline_note = note or f'Status changed to {status}.'
        IssueTimeline.objects.create(
            issue=issue,
            status=status,
            note=timeline_note,
        )

        issue.refresh_from_db()

        return {
            'success': True,
            'action': 'UPDATE_STATUS',
            'status': status,
            'old_status': old_status,
            'message': f'Status updated from {old_status} to {status}',
        }

    except Exception as e:
        logger.error(f"update_issue_status failed for issue {issue.pk}: {e}")
        return {
            'success': False,
            'action': 'UPDATE_STATUS',
            'message': f'Status update failed: {str(e)}',
        }


def apply_analysis(issue, analysis):
    """
    Apply a validated AI analysis result to an Issue.

    Receives the already-validated result from agent.analysis.analyze_complaint().
    Does NOT call Gemini. Only maps safe fields to the Issue model.

    Returns a structured result dict.
    """
    from issues.models import Issue

    if not analysis or not isinstance(analysis, dict):
        return {
            'success': False,
            'action': 'APPLY_ANALYSIS',
            'message': 'Invalid analysis: must be a dict',
        }

    required_keys = {'classification', 'priority', 'complaint'}
    if not required_keys.issubset(analysis.keys()):
        return {
            'success': False,
            'action': 'APPLY_ANALYSIS',
            'message': f'Invalid analysis: missing keys {required_keys - analysis.keys()}',
        }

    classification = analysis.get('classification', {})
    priority_data = analysis.get('priority', {})
    complaint = analysis.get('complaint', {})

    category = classification.get('category', issue.category)
    if category not in VALID_CATEGORIES:
        return {
            'success': False,
            'action': 'APPLY_ANALYSIS',
            'message': f'Invalid category: {category}',
        }

    priority = priority_data.get('level', issue.priority)
    # Normalize uppercase variants (HIGH -> High, medium -> Medium)
    priority_map = {'HIGH': 'High', 'MEDIUM': 'Medium', 'LOW': 'Low'}
    priority = priority_map.get(priority.upper(), priority) if priority else issue.priority
    if priority not in VALID_PRIORITIES:
        return {
            'success': False,
            'action': 'APPLY_ANALYSIS',
            'message': f'Invalid priority: {priority}',
        }

    priority_score = priority_data.get('score', issue.priority_score)
    if priority_score is not None:
        priority_score = max(0, min(100, int(priority_score)))

    try:
        update_fields = {}

        if category != issue.category:
            update_fields['category'] = category

        new_title = complaint.get('title', '').strip()
        if new_title and new_title != issue.title:
            update_fields['title'] = new_title

        new_desc = complaint.get('description', '').strip()
        if new_desc and new_desc != issue.description:
            update_fields['description'] = new_desc

        if priority != issue.priority:
            update_fields['priority'] = priority

        if priority_score is not None and priority_score != issue.priority_score:
            update_fields['priority_score'] = priority_score

        if update_fields:
            # Set flag so save() does not auto-compute over agent's decision
            issue._agent_priority_applied = True
            Issue.objects.filter(pk=issue.pk).update(**update_fields)
            issue.refresh_from_db()

        return {
            'success': True,
            'action': 'APPLY_ANALYSIS',
            'category': issue.category,
            'priority': issue.priority,
            'priority_score': issue.priority_score,
            'title': issue.title,
            'message': 'Analysis applied successfully',
        }

    except Exception as e:
        logger.error(f"apply_analysis failed for issue {issue.pk}: {e}")
        return {
            'success': False,
            'action': 'APPLY_ANALYSIS',
            'message': f'Failed to apply analysis: {str(e)}',
        }


def log_agent_action(issue, action, input_data=None, decision=None,
                     output_data=None, duration_ms=None):
    """
    Create an AgentTrace record.

    Returns the created AgentTrace instance or a safe error result.
    """
    from agent.models import AgentTrace

    try:
        trace = AgentTrace.objects.create(
            issue=issue,
            action=action,
            input_data=input_data,
            decision=decision,
            output_data=output_data,
            duration_ms=duration_ms,
        )
        return trace

    except Exception as e:
        logger.error(f"log_agent_action failed for issue {issue.pk}: {e}")
        return {
            'success': False,
            'action': action,
            'message': f'Failed to log agent action: {str(e)}',
        }

"""
CivixAI AI Analysis Service.

Analyzes civic complaints using Google Gemini and returns structured decisions
for the Agent Orchestrator to act on.

Gemini provides intelligence/decisions.
Django performs validated actions.
"""
import json
import logging

from django.conf import settings

from .prompts import ANALYZE_COMPLAINT_PROMPT

logger = logging.getLogger('ai')

_client = None


def _get_client():
    """Lazy-init Gemini client. Same pattern as ai/services.py."""
    global _client
    current_key = settings.GEMINI_API_KEY
    if _client is None or getattr(_client, '_civixai_api_key', None) != current_key:
        from google import genai
        _client = genai.Client(api_key=current_key)
        _client._civixai_api_key = current_key
    return _client


def _parse_json_response(text: str) -> dict:
    """Extract JSON from Gemini response, tolerating markdown code fences."""
    text = text.strip()
    if text.startswith('```'):
        lines = text.split('\n')
        text = '\n'.join(lines[1:-1] if lines[-1].strip() == '```' else lines[1:])
    return json.loads(text)


def _build_issue_context(issue) -> str:
    """Build a text summary of the issue for the Gemini prompt."""
    parts = []

    parts.append(f"Title: {issue.title}")

    if issue.description:
        parts.append(f"Description: {issue.description}")

    parts.append(f"Category (system-provided): {issue.category}")
    parts.append(f"Ward: {issue.ward}")

    if issue.location_text:
        parts.append(f"Location: {issue.location_text}")

    if issue.location_lat is not None and issue.location_lng is not None:
        parts.append(f"Coordinates: {issue.location_lat}, {issue.location_lng}")

    parts.append(f"Reported at: {issue.reported_at}")

    return "\n".join(parts)


def _validate_analysis(result: dict) -> dict:
    """
    Validate and normalize the Gemini response.
    Ensures all required fields exist with safe defaults.
    """
    valid_categories = [
        'Road', 'Water', 'Electricity', 'Garbage',
        'Traffic', 'Public Facilities',
    ]
    valid_severity = ['LOW', 'MEDIUM', 'HIGH']
    valid_actions = ['ASSIGN_WORKER', 'REVIEW', 'FOLLOW_UP', 'ESCALATE']
    valid_departments = [
        'Infrastructure', 'Sanitation', 'Water Supply',
        'Electrical', 'Traffic Control', 'Maintenance',
    ]

    classification = result.get('classification', {})
    if classification.get('category') not in valid_categories:
        classification['category'] = 'Public Facilities'
    classification['confidence'] = max(0.0, min(1.0, float(classification.get('confidence', 0.5))))

    severity = result.get('severity', {})
    if severity.get('level') not in valid_severity:
        severity['level'] = 'MEDIUM'
    severity['score'] = max(0, min(100, int(severity.get('score', 50))))
    severity['reason'] = severity.get('reason', 'Unable to determine severity from available evidence.')

    priority = result.get('priority', {})
    if priority.get('level') not in valid_severity:
        priority['level'] = 'MEDIUM'
    priority['score'] = max(0, min(100, int(priority.get('score', 50))))
    priority['reason'] = priority.get('reason', 'Unable to determine priority from available evidence.')

    department = result.get('department', {})
    if department.get('name') not in valid_departments:
        department['name'] = 'Maintenance'
    department['reason'] = department.get('reason', 'Default department assignment.')

    complaint = result.get('complaint', {})
    complaint['title'] = complaint.get('title', result.get('complaint', {}).get('title', 'Untitled complaint'))
    complaint['summary'] = complaint.get('summary', 'No summary available.')
    complaint['description'] = complaint.get('description', 'No description available.')

    recommended_action = result.get('recommended_action', 'REVIEW')
    if recommended_action not in valid_actions:
        recommended_action = 'REVIEW'

    reasoning = result.get('reasoning', 'No reasoning provided.')

    return {
        'classification': classification,
        'severity': severity,
        'priority': priority,
        'department': department,
        'complaint': complaint,
        'recommended_action': recommended_action,
        'reasoning': reasoning,
    }


def analyze_complaint(issue) -> dict | None:
    """
    Analyze a civic complaint using Gemini and return structured analysis.

    Args:
        issue: Issue model instance with at minimum title, category, ward.

    Returns:
        Structured analysis dict with classification, severity, priority,
        department, complaint summary, recommended_action, and reasoning.
        Returns None on failure.
    """
    try:
        from google.genai import types

        client = _get_client()

        issue_context = _build_issue_context(issue)

        contents = []

        if issue.image:
            try:
                with open(issue.image.path, 'rb') as f:
                    image_bytes = f.read()
                mime_type = 'image/jpeg'
                contents.append(types.Part.from_bytes(data=image_bytes, mime_type=mime_type))
            except Exception as e:
                logger.warning(f"Could not read issue image: {e}")

        contents.append(f"{ANALYZE_COMPLAINT_PROMPT}\n\n--- ISSUE CONTEXT ---\n{issue_context}")

        response = client.models.generate_content(
            model='gemini-flash-lite-latest',
            contents=contents,
        )

        raw_result = _parse_json_response(response.text)
        return _validate_analysis(raw_result)

    except Exception as e:
        logger.error(f"AI analyze_complaint failed for issue {issue.pk}: {e}", exc_info=True)
        return None

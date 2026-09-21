"""
Gemini AI service layer for CivixAI.
Two features:
  1. detect_issue(image_file)  → {category, title, confidence}
  2. verify_completion(issue)  → {completion_score, verdict}

Uses the google-genai SDK (replaces deprecated google-generativeai).
"""
import io
import json
import logging

from PIL import Image

from django.conf import settings

logger = logging.getLogger(__name__)

_client = None


def _preprocess_image(image_bytes: bytes) -> bytes:
    """Resize and compress an image to reduce payload size for Gemini."""
    image = Image.open(io.BytesIO(image_bytes))
    image = image.convert("RGB")

    max_dimension = 1280
    if max(image.size) > max_dimension:
        image.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)

    output = io.BytesIO()
    image.save(output, format="JPEG", quality=75, optimize=True)
    return output.getvalue()


def _get_client():
    global _client
    # Always re-read the key so a server restart picks up a new .env value.
    # Reset cached client if the key has changed.
    current_key = settings.GEMINI_API_KEY
    if _client is None or getattr(_client, '_civixai_api_key', None) != current_key:
        from google import genai
        from google.genai import types
        _client = genai.Client(
            api_key=current_key,
            http_options=types.HttpOptions(
                timeout=60,
                retry_options=types.HttpRetryOptions(attempts=1),
            ),
        )
        _client._civixai_api_key = current_key
    return _client


def _parse_json_response(text: str) -> dict:
    """Extract JSON from Gemini response, tolerating markdown code fences."""
    text = text.strip()
    if text.startswith('```'):
        lines = text.split('\n')
        text = '\n'.join(lines[1:-1] if lines[-1].strip() == '```' else lines[1:])
    return json.loads(text)


def detect_issue(image_file) -> dict | None:
    """
    Analyze a citizen-uploaded image and return the detected issue category + title.

    Args:
        image_file: Django InMemoryUploadedFile or similar file-like object.

    Returns:
        {'category': str, 'title': str, 'confidence': float}
        or None on failure.
    """
    try:
        from google.genai import types

        client = _get_client()

        image_bytes = image_file.read()
        processed_bytes = _preprocess_image(image_bytes)

        prompt = """You are a municipal issue classifier for Ichalkaranji, Maharashtra, India.
Analyze this image carefully and identify any civic/municipal problems visible.

Respond ONLY with valid JSON in this exact format (no markdown, no extra text):
{
  "category": "<one of: Road, Water, Electricity, Garbage, Traffic, Public Facilities>",
  "title": "<concise 5-10 word issue title describing the specific problem>",
  "description": "<2-3 sentence description of the issue: what is visible, how severe it looks, and what impact it may have on citizens>",
  "confidence": <float between 0.0 and 1.0>
}

If no civic issue is visible, use category "Public Facilities" with low confidence."""

        response = client.models.generate_content(
            model='gemini-flash-lite-latest',
            contents=[
                types.Part.from_bytes(data=processed_bytes, mime_type='image/jpeg'),
                prompt,
            ],
        )

        result = _parse_json_response(response.text)

        valid_categories = ['Road', 'Water', 'Electricity', 'Garbage', 'Traffic', 'Public Facilities']
        if result.get('category') not in valid_categories:
            result['category'] = 'Public Facilities'

        return {
            'category':    result.get('category', 'Public Facilities'),
            'title':       result.get('title', 'Municipal issue detected'),
            'description': result.get('description', ''),
            'confidence':  float(result.get('confidence', 0.5)),
        }

    except Exception as e:
        logger.error(f"AI detect_issue failed: {e}", exc_info=True)
        return None


def verify_completion(issue) -> dict | None:
    """
    Compare before (citizen) and after (worker) images and score completion.

    Args:
        issue: Issue model instance with both .image and .completion_photo set.

    Returns:
        {'completion_score': int 0-100, 'verdict': str}
        or None on failure.
    """
    try:
        if not issue.image or not issue.completion_photo:
            return None

        issue.image.open('rb')
        before_bytes = issue.image.read()
        issue.image.close()

        issue.completion_photo.open('rb')
        after_bytes = issue.completion_photo.read()
        issue.completion_photo.close()

        return verify_completion_from_bytes(issue, after_bytes, 'image/jpeg', before_bytes=before_bytes)

    except Exception as e:
        logger.error(f"AI verify_completion failed for issue {issue.pk}: {e}")
        return None


def verify_completion_from_bytes(issue, after_bytes: bytes, after_mime: str, before_bytes: bytes | None = None) -> dict | None:
    """
    Score a worker's completion photo against the before-image.
    Accepts raw bytes so the after-photo need not be saved to disk yet.

    Args:
        issue:        Issue model instance (used for title/category/before-image path).
        after_bytes:  Raw bytes of the worker's completion photo.
        after_mime:   MIME type of the after photo (e.g. 'image/jpeg').
        before_bytes: Raw bytes of the before photo. If None, read from issue.image.path.

    Returns:
        {'completion_score': int 0-100, 'verdict': str}
        or None on failure.
    """
    try:
        from google.genai import types

        client = _get_client()

        if before_bytes is None:
            if not issue.image:
                return None
            issue.image.open('rb')
            before_bytes = issue.image.read()
            issue.image.close()

        prompt = f"""You are a municipal work verification system for CivixAI, Ichalkaranji.

The FIRST image is the BEFORE photo of a reported issue: "{issue.title}" (Category: {issue.category}).
The SECOND image is the AFTER photo submitted by the field worker claiming the work is done.

Compare both images carefully. Assess:
- How much of the original problem has been resolved?
- Is the work quality acceptable?
- Any remaining issues?

Respond ONLY with valid JSON (no markdown, no extra text):
{{
  "completion_score": <integer 0 to 100, where 100 = fully resolved>,
  "verdict": "<1-2 sentence honest assessment of the work quality and completion>"
}}"""

        response = client.models.generate_content(
            model='gemini-flash-lite-latest',
            contents=[
                types.Part.from_bytes(data=before_bytes, mime_type='image/jpeg'),
                types.Part.from_bytes(data=after_bytes, mime_type=after_mime),
                prompt,
            ],
        )

        result = _parse_json_response(response.text)
        return {
            'completion_score': max(0, min(100, int(result.get('completion_score', 50)))),
            'verdict': result.get('verdict', 'Work completion assessed by AI.'),
        }

    except Exception as e:
        logger.error(f"AI verify_completion_from_bytes failed for issue {issue.pk}: {e}")
        return None

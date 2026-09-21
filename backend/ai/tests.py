from unittest.mock import patch, MagicMock
from django.test import TestCase
from io import BytesIO

from PIL import Image
import io
import json


def _make_jpeg(width=100, height=100):
    """Helper: create valid JPEG bytes."""
    img = Image.new('RGB', (width, height), (255, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format='JPEG')
    return buf.getvalue()


def _gemini_response_payload(text):
    """Build a minimal Gemini REST response dict."""
    return {
        "candidates": [
            {
                "content": {
                    "parts": [{"text": text}]
                }
            }
        ]
    }


class DetectIssueRestTest(TestCase):
    """Tests for detect_issue() using direct httpx REST transport."""

    @patch('ai.services.httpx.post')
    def test_successful_response(self, mock_post):
        """Valid Gemini JSON response is parsed correctly."""
        from ai.services import detect_issue

        gemini_text = json.dumps({
            'category': 'Road',
            'title': 'Pothole on main road',
            'description': 'Large pothole visible.',
            'confidence': 0.9,
        })
        mock_resp = MagicMock()
        mock_resp.json.return_value = _gemini_response_payload(gemini_text)
        mock_resp.raise_for_status = MagicMock()
        mock_post.return_value = mock_resp

        fake_image = BytesIO(_make_jpeg())
        fake_image.content_type = 'image/jpeg'
        result = detect_issue(fake_image)

        self.assertIsNotNone(result)
        self.assertEqual(result['category'], 'Road')
        self.assertEqual(result['title'], 'Pothole on main road')
        self.assertEqual(result['description'], 'Large pothole visible.')
        self.assertAlmostEqual(result['confidence'], 0.9)

    @patch('ai.services.httpx.post')
    def test_markdown_fenced_json(self, mock_post):
        """Gemini response wrapped in ```json fences is parsed correctly."""
        from ai.services import detect_issue

        gemini_text = '```json\n' + json.dumps({
            'category': 'Water',
            'title': 'Water leak',
            'description': 'Pipe leaking.',
            'confidence': 0.8,
        }) + '\n```'
        mock_resp = MagicMock()
        mock_resp.json.return_value = _gemini_response_payload(gemini_text)
        mock_resp.raise_for_status = MagicMock()
        mock_post.return_value = mock_resp

        fake_image = BytesIO(_make_jpeg())
        fake_image.content_type = 'image/jpeg'
        result = detect_issue(fake_image)

        self.assertIsNotNone(result)
        self.assertEqual(result['category'], 'Water')
        self.assertEqual(result['title'], 'Water leak')

    @patch('ai.services.httpx.post')
    def test_http_error_returns_none(self, mock_post):
        """HTTP 4xx/5xx must not crash the worker."""
        from ai.services import detect_issue
        import httpx

        mock_resp = MagicMock()
        mock_resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            message="500 Server Error",
            request=MagicMock(),
            response=MagicMock(status_code=500),
        )
        mock_post.return_value = mock_resp

        fake_image = BytesIO(_make_jpeg())
        fake_image.content_type = 'image/jpeg'
        result = detect_issue(fake_image)

        self.assertIsNone(result)

    @patch('ai.services.httpx.post')
    def test_network_timeout_returns_none(self, mock_post):
        """Network timeout must not crash the worker."""
        from ai.services import detect_issue
        import httpx

        mock_post.side_effect = httpx.ReadTimeout("The read operation timed out")

        fake_image = BytesIO(_make_jpeg())
        fake_image.content_type = 'image/jpeg'
        result = detect_issue(fake_image)

        self.assertIsNone(result)

    @patch('ai.services.httpx.post')
    def test_connect_error_returns_none(self, mock_post):
        """Connection error must not crash the worker."""
        from ai.services import detect_issue
        import httpx

        mock_post.side_effect = httpx.ConnectError("Connection refused")

        fake_image = BytesIO(_make_jpeg())
        fake_image.content_type = 'image/jpeg'
        result = detect_issue(fake_image)

        self.assertIsNone(result)

    @patch('ai.services.httpx.post')
    def test_invalid_category_defaults(self, mock_post):
        """Unknown category should default to Public Facilities."""
        from ai.services import detect_issue

        gemini_text = json.dumps({
            'category': 'UnknownCategory',
            'title': 'Something',
            'description': 'Desc',
            'confidence': 0.5,
        })
        mock_resp = MagicMock()
        mock_resp.json.return_value = _gemini_response_payload(gemini_text)
        mock_resp.raise_for_status = MagicMock()
        mock_post.return_value = mock_resp

        fake_image = BytesIO(_make_jpeg())
        fake_image.content_type = 'image/jpeg'
        result = detect_issue(fake_image)

        self.assertEqual(result['category'], 'Public Facilities')

    @patch('ai.services.httpx.post')
    def test_request_uses_correct_endpoint_and_headers(self, mock_post):
        """Verify the REST request hits the correct endpoint with correct headers."""
        from ai.services import detect_issue

        gemini_text = json.dumps({
            'category': 'Garbage', 'title': 'Trash',
            'description': 'Overflow.', 'confidence': 0.7,
        })
        mock_resp = MagicMock()
        mock_resp.json.return_value = _gemini_response_payload(gemini_text)
        mock_resp.raise_for_status = MagicMock()
        mock_post.return_value = mock_resp

        fake_image = BytesIO(_make_jpeg())
        fake_image.content_type = 'image/jpeg'
        detect_issue(fake_image)

        call_kwargs = mock_post.call_args.kwargs
        self.assertEqual(
            call_kwargs['headers']['content-type'],
            'application/json',
        )
        self.assertIn('x-goog-api-key', call_kwargs['headers'])

        payload = call_kwargs['json']
        parts = payload['contents'][0]['parts']
        self.assertEqual(parts[0]['inline_data']['mime_type'], 'image/jpeg')
        self.assertIn('confidence', parts[1]['text'])

    @patch('ai.services.httpx.post')
    def test_image_is_base64_encoded(self, mock_post):
        """The image bytes must be base64-encoded in the request payload."""
        from ai.services import detect_issue
        import base64

        gemini_text = json.dumps({
            'category': 'Electricity', 'title': 'Downed wire',
            'description': 'Wire on ground.', 'confidence': 0.85,
        })
        mock_resp = MagicMock()
        mock_resp.json.return_value = _gemini_response_payload(gemini_text)
        mock_resp.raise_for_status = MagicMock()
        mock_post.return_value = mock_resp

        fake_image = BytesIO(_make_jpeg(300, 200))
        fake_image.content_type = 'image/jpeg'
        detect_issue(fake_image)

        payload = mock_post.call_args.kwargs['json']
        b64_data = payload['contents'][0]['parts'][0]['inline_data']['data']
        decoded = base64.b64decode(b64_data)
        img = Image.open(io.BytesIO(decoded))
        self.assertEqual(img.format, 'JPEG')
        self.assertLessEqual(max(img.size), 1280)


class VerifyCompletionUnchangedTest(TestCase):
    """Verify completion still uses google-genai SDK — unchanged."""

    @patch('ai.services._get_client')
    def test_verify_completion_timeout_returns_none(self, mock_get_client):
        """Gemini timeout during verify must not crash the worker."""
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = Exception(
            'Gemini request timed out'
        )
        mock_get_client.return_value = mock_client

        from ai.services import verify_completion_from_bytes
        from issues.models import Issue
        from django.contrib.auth import get_user_model

        User = get_user_model()
        user = User.objects.create_user(
            username='timeoutuser', email='to@test.com',
            password='test1234', role='citizen', ward='Ward 1',
        )
        issue = Issue.objects.create(
            title='Test', category='Road', ward='Ward 1',
            reported_by=user,
        )

        result = verify_completion_from_bytes(
            issue, b'\xff\xd8\xff\xe0', 'image/jpeg',
            before_bytes=b'\xff\xd8\xff\xe0',
        )
        self.assertIsNone(result)


class PreprocessImageTest(TestCase):
    def test_output_is_jpeg(self):
        from ai.services import _preprocess_image
        result = _preprocess_image(_make_jpeg())
        img = Image.open(io.BytesIO(result))
        self.assertEqual(img.format, 'JPEG')

    def test_large_image_resized(self):
        from ai.services import _preprocess_image
        result = _preprocess_image(_make_jpeg(3000, 2000))
        img = Image.open(io.BytesIO(result))
        self.assertEqual(max(img.size), 1280)
        self.assertLess(min(img.size), 1280)

    def test_small_image_unchanged(self):
        from ai.services import _preprocess_image
        result = _preprocess_image(_make_jpeg(80, 60))
        img = Image.open(io.BytesIO(result))
        self.assertEqual(img.size, (80, 60))

    def test_output_smaller_than_large_original(self):
        from ai.services import _preprocess_image
        original = _make_jpeg(3000, 2000)
        result = _preprocess_image(original)
        self.assertLess(len(result), len(original))

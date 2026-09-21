from unittest.mock import patch, MagicMock
from django.test import TestCase
from io import BytesIO

from PIL import Image
import io
import json


class DetectIssueTimeoutTest(TestCase):
    @patch('ai.services._get_client')
    def test_gemini_timeout_returns_none(self, mock_get_client):
        """Gemini timeout must not crash the worker — returns None gracefully."""
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = Exception(
            'Gemini request timed out'
        )
        mock_get_client.return_value = mock_client

        from ai.services import detect_issue
        fake_image = BytesIO(_make_jpeg())
        fake_image.content_type = 'image/jpeg'
        fake_image.name = 'test.jpg'

        result = detect_issue(fake_image)
        self.assertIsNone(result)

    @patch('ai.services._get_client')
    def test_gemini_network_error_returns_none(self, mock_get_client):
        """Network failure must not crash the worker."""
        import httpx
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = httpx.ConnectError(
            'Connection refused'
        )
        mock_get_client.return_value = mock_client

        from ai.services import detect_issue
        fake_image = BytesIO(_make_jpeg())
        fake_image.content_type = 'image/jpeg'
        fake_image.name = 'test.jpg'

        result = detect_issue(fake_image)
        self.assertIsNone(result)

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


def _make_jpeg(width=100, height=100):
    """Helper: create valid JPEG bytes."""
    img = Image.new('RGB', (width, height), (255, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format='JPEG')
    return buf.getvalue()


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


class DetectIssuePreprocessTest(TestCase):
    @patch('ai.services._get_client')
    def test_sends_processed_jpeg_to_gemini(self, mock_get_client):
        from ai.services import detect_issue

        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.text = json.dumps({
            'category': 'Road', 'title': 'Pothole',
            'description': 'Big hole.', 'confidence': 0.9,
        })
        mock_client.models.generate_content.return_value = mock_response
        mock_get_client.return_value = mock_client

        fake_image = BytesIO(_make_jpeg(3000, 2000))
        fake_image.content_type = 'image/jpeg'
        result = detect_issue(fake_image)

        self.assertIsNotNone(result)
        call_args = mock_client.models.generate_content.call_args
        contents = call_args.kwargs.get('contents') or call_args[1].get('contents')
        part = contents[0]

        self.assertEqual(part.inline_data.mime_type, 'image/jpeg')
        img = Image.open(io.BytesIO(part.inline_data.data))
        self.assertEqual(max(img.size), 1280)


class GeminiClientConfigTest(TestCase):
    def test_timeout_is_60_seconds(self):
        import ai.services as svc
        svc._client = None
        with patch.object(svc.settings, 'GEMINI_API_KEY', 'test-key'):
            with patch('google.genai.Client') as mock_cls:
                mock_cls.return_value = MagicMock()
                svc._get_client()
                kwargs = mock_cls.call_args.kwargs
                self.assertEqual(kwargs['http_options'].timeout, 60)
        svc._client = None

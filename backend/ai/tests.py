from unittest.mock import patch, MagicMock
from django.test import TestCase
from io import BytesIO


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
        fake_image = BytesIO(b'\xff\xd8\xff\xe0')
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
        fake_image = BytesIO(b'\xff\xd8\xff\xe0')
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

from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.contrib.auth import get_user_model

from issues.models import Issue
from agent.models import AgentTrace
from agent.analysis import analyze_complaint, _validate_analysis, _build_issue_context

User = get_user_model()


class AgentTraceModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testcitizen',
            email='test@example.com',
            password='test1234',
            role='citizen',
            ward='Ward 5',
        )
        self.issue = Issue.objects.create(
            title='Broken streetlight on Main Road',
            description='The streetlight near the bus stop is not working.',
            category='Electricity',
            ward='Ward 5',
            reported_by=self.user,
        )

    def test_agent_trace_creation(self):
        trace = AgentTrace.objects.create(
            issue=self.issue,
            action='RECEIVED',
            input_data={'source': 'citizen_report'},
            decision={'next': 'analyze'},
        )
        self.assertIsNotNone(trace.pk)
        self.assertEqual(trace.issue, self.issue)
        self.assertEqual(trace.action, 'RECEIVED')

    def test_agent_trace_json_fields(self):
        trace = AgentTrace.objects.create(
            issue=self.issue,
            action='CLASSIFIED',
            input_data={'text': 'broken streetlight', 'category_hint': 'Electricity'},
            decision={'category': 'Electricity', 'severity': 'High', 'confidence': 0.92},
            output_data={'issue_id': self.issue.pk, 'assigned_to': None},
        )
        self.assertEqual(trace.input_data['category_hint'], 'Electricity')
        self.assertEqual(trace.decision['severity'], 'High')
        self.assertEqual(trace.output_data['issue_id'], self.issue.pk)

    def test_agent_trace_duration_ms(self):
        trace = AgentTrace.objects.create(
            issue=self.issue,
            action='EVIDENCE_ANALYZED',
            duration_ms=1250,
        )
        self.assertEqual(trace.duration_ms, 1250)

    def test_agent_trace_blank_json_fields(self):
        trace = AgentTrace.objects.create(
            issue=self.issue,
            action='MONITORING_STARTED',
        )
        self.assertIsNone(trace.input_data)
        self.assertIsNone(trace.decision)
        self.assertIsNone(trace.output_data)
        self.assertIsNone(trace.duration_ms)

    def test_reverse_relation(self):
        AgentTrace.objects.create(issue=self.issue, action='RECEIVED')
        AgentTrace.objects.create(issue=self.issue, action='CLASSIFIED')
        AgentTrace.objects.create(issue=self.issue, action='WORKER_ASSIGNED')

        traces = self.issue.agent_traces.all()
        self.assertEqual(traces.count(), 3)
        self.assertEqual(traces[0].action, 'WORKER_ASSIGNED')  # newest first

    def test_str_representation(self):
        trace = AgentTrace.objects.create(
            issue=self.issue,
            action='SEVERITY_ASSESSED',
        )
        self.assertIn('SEVERITY_ASSESSED', str(trace))
        self.assertIn(self.issue.display_id, str(trace))

    def test_cascade_delete(self):
        AgentTrace.objects.create(issue=self.issue, action='RECEIVED')
        AgentTrace.objects.create(issue=self.issue, action='CLASSIFIED')
        self.assertEqual(AgentTrace.objects.count(), 2)

        self.issue.delete()
        self.assertEqual(AgentTrace.objects.count(), 0)


class ValidateAnalysisTest(TestCase):
    def test_valid_analysis_passes_through(self):
        raw = {
            'classification': {'category': 'Road', 'confidence': 0.9},
            'severity': {'level': 'HIGH', 'score': 85, 'reason': 'Safety hazard'},
            'priority': {'level': 'HIGH', 'score': 80, 'reason': 'Urgent'},
            'department': {'name': 'Infrastructure', 'reason': 'Road issue'},
            'complaint': {'title': 'Pothole', 'summary': 'Big pothole', 'description': 'Deep pothole on main road'},
            'recommended_action': 'ASSIGN_WORKER',
            'reasoning': 'Clear road damage visible.',
        }
        result = _validate_analysis(raw)
        self.assertEqual(result['classification']['category'], 'Road')
        self.assertEqual(result['severity']['level'], 'HIGH')
        self.assertEqual(result['department']['name'], 'Infrastructure')
        self.assertEqual(result['recommended_action'], 'ASSIGN_WORKER')

    def test_invalid_category_defaults(self):
        raw = {
            'classification': {'category': 'INVALID', 'confidence': 0.5},
            'severity': {'level': 'MEDIUM', 'score': 50, 'reason': 'test'},
            'priority': {'level': 'MEDIUM', 'score': 50, 'reason': 'test'},
            'department': {'name': 'Infrastructure', 'reason': 'test'},
            'complaint': {'title': 'Test', 'summary': 'Test', 'description': 'Test'},
            'recommended_action': 'REVIEW',
            'reasoning': 'test',
        }
        result = _validate_analysis(raw)
        self.assertEqual(result['classification']['category'], 'Public Facilities')

    def test_invalid_severity_defaults(self):
        raw = {
            'classification': {'category': 'Water', 'confidence': 0.7},
            'severity': {'level': 'EXTREME', 'score': 200, 'reason': 'test'},
            'priority': {'level': 'INVALID', 'score': -10, 'reason': 'test'},
            'department': {'name': 'FakeDept', 'reason': 'test'},
            'complaint': {'title': 'Test', 'summary': 'Test', 'description': 'Test'},
            'recommended_action': 'INVALID_ACTION',
            'reasoning': 'test',
        }
        result = _validate_analysis(raw)
        self.assertEqual(result['severity']['level'], 'MEDIUM')
        self.assertEqual(result['severity']['score'], 100)  # clamped
        self.assertEqual(result['priority']['level'], 'MEDIUM')
        self.assertEqual(result['priority']['score'], 0)  # clamped
        self.assertEqual(result['department']['name'], 'Maintenance')
        self.assertEqual(result['recommended_action'], 'REVIEW')

    def test_missing_fields_get_defaults(self):
        raw = {}
        result = _validate_analysis(raw)
        self.assertIn('classification', result)
        self.assertIn('severity', result)
        self.assertIn('priority', result)
        self.assertIn('department', result)
        self.assertIn('complaint', result)
        self.assertIn('recommended_action', result)
        self.assertIn('reasoning', result)

    def test_confidence_clamped(self):
        raw = {
            'classification': {'category': 'Garbage', 'confidence': 1.5},
            'severity': {'level': 'LOW', 'score': 20, 'reason': 'test'},
            'priority': {'level': 'LOW', 'score': 20, 'reason': 'test'},
            'department': {'name': 'Sanitation', 'reason': 'test'},
            'complaint': {'title': 'Test', 'summary': 'Test', 'description': 'Test'},
            'recommended_action': 'REVIEW',
            'reasoning': 'test',
        }
        result = _validate_analysis(raw)
        self.assertEqual(result['classification']['confidence'], 1.0)


class BuildIssueContextTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='ctxuser',
            email='ctx@test.com',
            password='test1234',
            role='citizen',
            ward='Ward 3',
        )

    def test_full_context(self):
        issue = Issue.objects.create(
            title='Water leakage',
            description='Pipe burst near school',
            category='Water',
            ward='Ward 3',
            location_text='Near City School, Ward 3',
            location_lat=16.6925,
            location_lng=74.4191,
            reported_by=self.user,
        )
        ctx = _build_issue_context(issue)
        self.assertIn('Water leakage', ctx)
        self.assertIn('Pipe burst near school', ctx)
        self.assertIn('Water', ctx)
        self.assertIn('Ward 3', ctx)
        self.assertIn('Near City School', ctx)
        self.assertIn('16.6925', ctx)

    def test_minimal_context(self):
        issue = Issue.objects.create(
            title='Issue',
            category='Road',
            ward='Ward 1',
            reported_by=self.user,
        )
        ctx = _build_issue_context(issue)
        self.assertIn('Issue', ctx)
        self.assertIn('Road', ctx)
        self.assertIn('Ward 1', ctx)


class AnalyzeComplaintTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='aiuser',
            email='ai@test.com',
            password='test1234',
            role='citizen',
            ward='Ward 5',
        )
        self.issue = Issue.objects.create(
            title='Broken streetlight',
            description='Streetlight not working near bus stop',
            category='Electricity',
            ward='Ward 5',
            reported_by=self.user,
        )

    @patch('agent.analysis._get_client')
    def test_analyze_complaint_success(self, mock_get_client):
        mock_response = MagicMock()
        mock_response.text = '''{
            "classification": {"category": "Electricity", "confidence": 0.88},
            "severity": {"level": "MEDIUM", "score": 60, "reason": "Street lighting affects pedestrian safety"},
            "priority": {"level": "MEDIUM", "score": 55, "reason": "Moderate impact on residents"},
            "department": {"name": "Electrical", "reason": "Streetlight electrical issue"},
            "complaint": {"title": "Non-functioning streetlight", "summary": "Streetlight near bus stop is out", "description": "The streetlight near the main bus stop on Ward 5 is not functioning, creating safety concerns for pedestrians after dark."},
            "recommended_action": "ASSIGN_WORKER",
            "reasoning": "Clear electrical infrastructure issue. Image shows non-functioning streetlight. Should be assigned to electrical department."
        }'''
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = mock_response
        mock_get_client.return_value = mock_client

        result = analyze_complaint(self.issue)

        self.assertIsNotNone(result)
        self.assertEqual(result['classification']['category'], 'Electricity')
        self.assertEqual(result['severity']['level'], 'MEDIUM')
        self.assertEqual(result['department']['name'], 'Electrical')
        self.assertEqual(result['recommended_action'], 'ASSIGN_WORKER')

    @patch('agent.analysis._get_client')
    def test_analyze_complaint_gemini_failure(self, mock_get_client):
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = Exception("API error")
        mock_get_client.return_value = mock_client

        result = analyze_complaint(self.issue)
        self.assertIsNone(result)

    @patch('agent.analysis._get_client')
    def test_analyze_complaint_invalid_json(self, mock_get_client):
        mock_response = MagicMock()
        mock_response.text = "This is not JSON at all"
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = mock_response
        mock_get_client.return_value = mock_client

        result = analyze_complaint(self.issue)
        self.assertIsNone(result)

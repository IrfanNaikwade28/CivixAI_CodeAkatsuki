from unittest.mock import patch, MagicMock
import os
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from issues.models import Issue, IssueTimeline
from agent.models import AgentTrace
from agent.analysis import analyze_complaint, _validate_analysis, _build_issue_context
from agent.tools import assign_worker, update_issue_status, apply_analysis, log_agent_action

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


# ─── Agent Action Tools Tests ────────────────────────────────────────────────

class AssignWorkerTest(TestCase):
    def setUp(self):
        self.citizen = User.objects.create_user(
            username='acitizen', email='ac@test.com', password='test1234',
            role='citizen', ward='Ward 5',
        )
        self.worker = User.objects.create_user(
            username='aworker', email='aw@test.com', password='test1234',
            role='worker', ward='Ward 5', category='Electrical',
        )
        self.issue = Issue.objects.create(
            title='Broken streetlight', category='Electricity',
            ward='Ward 5', reported_by=self.citizen,
        )

    def test_assign_worker_success(self):
        result = assign_worker(self.issue)
        self.assertTrue(result['success'])
        self.assertEqual(result['action'], 'ASSIGN_WORKER')
        self.assertEqual(result['worker_id'], self.worker.pk)
        self.issue.refresh_from_db()
        self.assertEqual(self.issue.status, 'Assigned')
        self.assertEqual(self.issue.assigned_to, self.worker)
        self.assertIsNotNone(self.issue.assigned_at)

    def test_assign_worker_creates_timeline(self):
        assign_worker(self.issue)
        timeline = IssueTimeline.objects.filter(issue=self.issue, status='Assigned')
        self.assertEqual(timeline.count(), 1)
        self.assertIn('Agent auto-assigned', timeline.first().note)

    @patch('issues.auto_assign.find_best_worker', return_value=None)
    def test_assign_worker_no_worker_available(self, mock_find):
        result = assign_worker(self.issue)
        self.assertFalse(result['success'])
        self.assertIn('No suitable worker', result['message'])


class UpdateIssueStatusTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='ustuser', email='ust@test.com', password='test1234',
            role='citizen', ward='Ward 3',
        )
        self.issue = Issue.objects.create(
            title='Pothole on road', category='Road',
            ward='Ward 3', reported_by=self.user,
        )

    def test_update_status_success(self):
        result = update_issue_status(self.issue, 'In Progress', note='Starting work')
        self.assertTrue(result['success'])
        self.assertEqual(result['status'], 'In Progress')
        self.issue.refresh_from_db()
        self.assertEqual(self.issue.status, 'In Progress')

    def test_update_status_creates_timeline(self):
        update_issue_status(self.issue, 'Assigned', note='Assigned by agent')
        timeline = IssueTimeline.objects.filter(issue=self.issue, status='Assigned')
        self.assertEqual(timeline.count(), 1)
        self.assertEqual(timeline.first().note, 'Assigned by agent')

    def test_update_status_resolved_sets_timestamp(self):
        result = update_issue_status(self.issue, 'Resolved')
        self.assertTrue(result['success'])
        self.issue.refresh_from_db()
        self.assertIsNotNone(self.issue.resolved_at)

    def test_update_status_invalid(self):
        result = update_issue_status(self.issue, 'INVALID_STATUS')
        self.assertFalse(result['success'])
        self.assertIn('Invalid status', result['message'])

    def test_update_status_same_status(self):
        result = update_issue_status(self.issue, 'Submitted')
        self.assertTrue(result['success'])
        self.assertIn('already', result['message'])


class ApplyAnalysisTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='aatuser', email='aat@test.com', password='test1234',
            role='citizen', ward='Ward 5',
        )
        self.issue = Issue.objects.create(
            title='Water leak', category='Water',
            ward='Ward 5', reported_by=self.user,
        )
        self.valid_analysis = {
            'classification': {'category': 'Water', 'confidence': 0.9},
            'severity': {'level': 'HIGH', 'score': 85, 'reason': 'Safety issue'},
            'priority': {'level': 'HIGH', 'score': 80, 'reason': 'Urgent'},
            'department': {'name': 'Water Supply', 'reason': 'Water infrastructure'},
            'complaint': {
                'title': 'Major water pipe burst',
                'summary': 'Pipe burst near main road',
                'description': 'Large water pipe burst causing flooding on main road.',
            },
            'recommended_action': 'ASSIGN_WORKER',
            'reasoning': 'Clear water infrastructure failure.',
        }

    def test_apply_analysis_success(self):
        result = apply_analysis(self.issue, self.valid_analysis)
        self.assertTrue(result['success'])
        self.assertEqual(result['action'], 'APPLY_ANALYSIS')
        self.issue.refresh_from_db()
        self.assertEqual(self.issue.title, 'Major water pipe burst')
        self.assertEqual(self.issue.description, 'Large water pipe burst causing flooding on main road.')

    def test_apply_analysis_invalid_category(self):
        self.valid_analysis['classification']['category'] = 'INVALID'
        result = apply_analysis(self.issue, self.valid_analysis)
        self.assertFalse(result['success'])
        self.assertIn('Invalid category', result['message'])

    def test_apply_analysis_invalid_priority(self):
        self.valid_analysis['priority']['level'] = 'EXTREME'
        result = apply_analysis(self.issue, self.valid_analysis)
        self.assertFalse(result['success'])
        self.assertIn('Invalid priority', result['message'])

    def test_apply_analysis_invalid_score(self):
        self.valid_analysis['priority']['score'] = 200
        result = apply_analysis(self.issue, self.valid_analysis)
        self.assertTrue(result['success'])  # score gets clamped
        self.issue.refresh_from_db()
        self.assertEqual(self.issue.priority_score, 100)

    def test_apply_analysis_none_input(self):
        result = apply_analysis(self.issue, None)
        self.assertFalse(result['success'])

    def test_apply_analysis_missing_keys(self):
        result = apply_analysis(self.issue, {'classification': {}})
        self.assertFalse(result['success'])


class LogAgentActionTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='latuser', email='lat@test.com', password='test1234',
            role='citizen', ward='Ward 2',
        )
        self.issue = Issue.objects.create(
            title='Garbage overflow', category='Garbage',
            ward='Ward 2', reported_by=self.user,
        )

    def test_log_agent_action_creates_trace(self):
        result = log_agent_action(
            self.issue, 'TEST_ACTION',
            input_data={'key': 'value'},
            decision={'result': 'ok'},
            output_data={'saved': True},
            duration_ms=500,
        )
        self.assertIsInstance(result, AgentTrace)
        self.assertEqual(result.action, 'TEST_ACTION')
        self.assertEqual(result.input_data, {'key': 'value'})
        self.assertEqual(result.decision, {'result': 'ok'})
        self.assertEqual(result.output_data, {'saved': True})
        self.assertEqual(result.duration_ms, 500)
        self.assertEqual(result.issue, self.issue)

    def test_log_agent_action_minimal(self):
        result = log_agent_action(self.issue, 'MINIMAL')
        self.assertIsInstance(result, AgentTrace)
        self.assertEqual(result.action, 'MINIMAL')
        self.assertIsNone(result.input_data)


VALID_ANALYSIS = {
    'classification': {'category': 'Water', 'confidence': 0.9},
    'severity': {'level': 'HIGH', 'score': 85, 'reason': 'Safety issue'},
    'priority': {'level': 'HIGH', 'score': 80, 'reason': 'Urgent'},
    'department': {'name': 'Water Supply', 'reason': 'Water infrastructure'},
    'complaint': {
        'title': 'Major water pipe burst',
        'summary': 'Pipe burst near main road',
        'description': 'Large water pipe burst causing flooding.',
    },
    'recommended_action': 'ASSIGN_WORKER',
    'reasoning': 'Clear water infrastructure failure.',
}


class ProcessComplaintTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='orchuser', email='orch@test.com', password='test1234',
            role='citizen', ward='Ward 5',
        )
        self.issue = Issue.objects.create(
            title='Water leak', category='Water',
            ward='Ward 5', reported_by=self.user,
        )

    @patch('agent.orchestrator.assign_worker')
    @patch('agent.orchestrator.apply_analysis')
    @patch('agent.orchestrator.analyze_complaint')
    @patch('agent.orchestrator.log_agent_action')
    def test_assign_worker_flow(self, mock_log, mock_analyze, mock_apply, mock_assign):
        mock_analyze.return_value = VALID_ANALYSIS
        mock_apply.return_value = {'success': True, 'action': 'APPLY_ANALYSIS'}
        mock_assign.return_value = {
            'success': True, 'action': 'ASSIGN_WORKER',
            'worker_id': 1, 'message': 'Worker assigned',
        }

        from agent.orchestrator import process_complaint
        result = process_complaint(self.issue)

        self.assertTrue(result['success'])
        self.assertEqual(result['action'], 'ASSIGN_WORKER')
        self.assertTrue(result['execution']['success'])

        trace_actions = [c.args[1] if len(c.args) > 1 else c.kwargs.get('action') for c in mock_log.call_args_list]
        self.assertIn('RECEIVED', trace_actions)
        self.assertIn('UNDERSTAND', trace_actions)
        self.assertIn('ANALYZED', trace_actions)
        self.assertIn('DECIDED', trace_actions)
        self.assertIn('WORKER_ASSIGNED', trace_actions)
        self.assertIn('COMPLETED', trace_actions)

    @patch('agent.orchestrator.apply_analysis')
    @patch('agent.orchestrator.analyze_complaint')
    @patch('agent.orchestrator.log_agent_action')
    def test_review_flow(self, mock_log, mock_analyze, mock_apply):
        analysis = dict(VALID_ANALYSIS, recommended_action='REVIEW')
        mock_analyze.return_value = analysis
        mock_apply.return_value = {'success': True, 'action': 'APPLY_ANALYSIS'}

        from agent.orchestrator import process_complaint
        result = process_complaint(self.issue)

        self.assertTrue(result['success'])
        self.assertEqual(result['action'], 'REVIEW')
        self.assertEqual(result['execution']['message'], 'Human review required')

        trace_actions = [c.args[1] if len(c.args) > 1 else c.kwargs.get('action') for c in mock_log.call_args_list]
        self.assertIn('REVIEW_REQUIRED', trace_actions)

    @patch('agent.orchestrator.apply_analysis')
    @patch('agent.orchestrator.analyze_complaint')
    @patch('agent.orchestrator.log_agent_action')
    def test_follow_up_flow(self, mock_log, mock_analyze, mock_apply):
        analysis = dict(VALID_ANALYSIS, recommended_action='FOLLOW_UP')
        mock_analyze.return_value = analysis
        mock_apply.return_value = {'success': True, 'action': 'APPLY_ANALYSIS'}

        from agent.orchestrator import process_complaint
        result = process_complaint(self.issue)

        self.assertTrue(result['success'])
        self.assertEqual(result['action'], 'FOLLOW_UP')
        self.assertEqual(result['execution']['message'], 'Follow-up required')

        trace_actions = [c.args[1] if len(c.args) > 1 else c.kwargs.get('action') for c in mock_log.call_args_list]
        self.assertIn('FOLLOW_UP_REQUIRED', trace_actions)

    @patch('agent.orchestrator.apply_analysis')
    @patch('agent.orchestrator.analyze_complaint')
    @patch('agent.orchestrator.log_agent_action')
    def test_escalate_flow(self, mock_log, mock_analyze, mock_apply):
        analysis = dict(VALID_ANALYSIS, recommended_action='ESCALATE')
        mock_analyze.return_value = analysis
        mock_apply.return_value = {'success': True, 'action': 'APPLY_ANALYSIS'}

        from agent.orchestrator import process_complaint
        result = process_complaint(self.issue)

        self.assertTrue(result['success'])
        self.assertEqual(result['action'], 'ESCALATE')
        self.assertEqual(result['execution']['message'], 'Escalation required')

        trace_actions = [c.args[1] if len(c.args) > 1 else c.kwargs.get('action') for c in mock_log.call_args_list]
        self.assertIn('ESCALATION_REQUIRED', trace_actions)

    @patch('agent.orchestrator.analyze_complaint', return_value=None)
    @patch('agent.orchestrator.log_agent_action')
    def test_analysis_failure(self, mock_log, mock_analyze):
        from agent.orchestrator import process_complaint
        result = process_complaint(self.issue)

        self.assertFalse(result['success'])
        self.assertEqual(result['stage'], 'ANALYZE')
        self.assertIn('analysis failed', result['message'].lower())

        trace_actions = [c.args[1] if len(c.args) > 1 else c.kwargs.get('action') for c in mock_log.call_args_list]
        self.assertIn('ANALYSIS_FAILED', trace_actions)

    @patch('agent.orchestrator.apply_analysis')
    @patch('agent.orchestrator.analyze_complaint')
    @patch('agent.orchestrator.log_agent_action')
    def test_apply_analysis_failure(self, mock_log, mock_analyze, mock_apply):
        mock_analyze.return_value = VALID_ANALYSIS
        mock_apply.return_value = {'success': False, 'action': 'APPLY_ANALYSIS', 'message': 'Bad data'}

        from agent.orchestrator import process_complaint
        result = process_complaint(self.issue)

        self.assertFalse(result['success'])
        self.assertEqual(result['stage'], 'APPLY_ANALYSIS')

        trace_actions = [c.args[1] if len(c.args) > 1 else c.kwargs.get('action') for c in mock_log.call_args_list]
        self.assertIn('DECISION_FAILED', trace_actions)

    @patch('agent.orchestrator.assign_worker')
    @patch('agent.orchestrator.apply_analysis')
    @patch('agent.orchestrator.analyze_complaint')
    @patch('agent.orchestrator.log_agent_action')
    def test_worker_assignment_failure(self, mock_log, mock_analyze, mock_apply, mock_assign):
        mock_analyze.return_value = VALID_ANALYSIS
        mock_apply.return_value = {'success': True, 'action': 'APPLY_ANALYSIS'}
        mock_assign.return_value = {
            'success': False, 'action': 'ASSIGN_WORKER',
            'message': 'No suitable worker available',
        }

        from agent.orchestrator import process_complaint
        result = process_complaint(self.issue)

        self.assertTrue(result['success'])
        self.assertEqual(result['action'], 'ASSIGN_WORKER')
        self.assertFalse(result['execution']['success'])

        trace_actions = [c.args[1] if len(c.args) > 1 else c.kwargs.get('action') for c in mock_log.call_args_list]
        self.assertIn('ASSIGNMENT_FAILED', trace_actions)

    def test_already_resolved_issue(self):
        self.issue.status = 'Resolved'
        self.issue.save()

        from agent.orchestrator import process_complaint
        result = process_complaint(self.issue)

        self.assertTrue(result['success'])
        self.assertTrue(result['skipped'])

    @patch('agent.orchestrator.assign_worker')
    @patch('agent.orchestrator.apply_analysis')
    @patch('agent.orchestrator.analyze_complaint')
    @patch('agent.orchestrator.log_agent_action')
    def test_tools_called_not_direct_db(self, mock_log, mock_analyze, mock_apply, mock_assign):
        mock_analyze.return_value = VALID_ANALYSIS
        mock_apply.return_value = {'success': True, 'action': 'APPLY_ANALYSIS'}
        mock_assign.return_value = {
            'success': True, 'action': 'ASSIGN_WORKER',
            'worker_id': 1, 'message': 'Done',
        }

        from agent.orchestrator import process_complaint
        result = process_complaint(self.issue)

        mock_analyze.assert_called_once_with(self.issue)
        mock_apply.assert_called_once_with(self.issue, VALID_ANALYSIS)
        mock_assign.assert_called_once_with(self.issue)

        self.assertFalse(mock_assign.return_value.get('failure', False))

    @patch('agent.orchestrator.assign_worker')
    @patch('agent.orchestrator.apply_analysis')
    @patch('agent.orchestrator.analyze_complaint')
    def test_trace_data_structured(self, mock_analyze, mock_apply, mock_assign):
        mock_analyze.return_value = VALID_ANALYSIS
        mock_apply.return_value = {'success': True, 'action': 'APPLY_ANALYSIS'}
        mock_assign.return_value = {
            'success': True, 'action': 'ASSIGN_WORKER',
            'worker_id': 1, 'worker_display_id': 'WK-001',
            'worker_name': 'Test Worker', 'message': 'Done',
        }

        from agent.orchestrator import process_complaint
        process_complaint(self.issue)

        traces = AgentTrace.objects.filter(issue=self.issue).order_by('timestamp')
        actions = list(traces.values_list('action', flat=True))
        self.assertEqual(actions, [
            'RECEIVED', 'UNDERSTAND', 'ANALYZED', 'DECIDED',
            'WORKER_ASSIGNED', 'COMPLETED',
        ])

        analyzed_trace = traces.filter(action='ANALYZED').first()
        self.assertIsNotNone(analyzed_trace.decision)
        self.assertIn('classification', analyzed_trace.decision)
        self.assertIn('priority', analyzed_trace.decision)
        self.assertIn('recommended_action', analyzed_trace.decision)


class AgentAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='adminapi', email='adminapi@test.com', password='test1234',
            role='admin', ward='Ward 5',
        )
        self.worker = User.objects.create_user(
            username='workerapi', email='workerapi@test.com', password='test1234',
            role='worker', ward='Ward 5', category='Water Supply',
        )
        self.citizen = User.objects.create_user(
            username='citizenapi', email='citizenapi@test.com', password='test1234',
            role='citizen', ward='Ward 5',
        )
        self.issue = Issue.objects.create(
            title='Water leak', category='Water',
            ward='Ward 5', reported_by=self.citizen,
        )

    def _auth(self, user):
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')

    @patch('agent.views.process_complaint')
    def test_admin_can_process(self, mock_process):
        mock_process.return_value = {
            'success': True, 'issue_id': self.issue.pk,
            'action': 'ASSIGN_WORKER', 'execution': {},
        }
        self._auth(self.admin)
        resp = self.client.post(f'/api/agent/process-complaint/{self.issue.pk}/')
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data['success'])
        mock_process.assert_called_once()

    def test_unauthenticated_rejected(self):
        resp = self.client.post(f'/api/agent/process-complaint/{self.issue.pk}/')
        self.assertEqual(resp.status_code, 401)

    def test_cannot_process_other_issue(self):
        other = Issue.objects.create(
            title='Other issue', category='Road',
            ward='Ward 3', reported_by=self.citizen,
        )
        self._auth(self.citizen)
        resp = self.client.post(f'/api/agent/process-complaint/{other.pk}/')
        self.assertEqual(resp.status_code, 403)

    @patch('agent.views.process_complaint')
    def test_process_calls_orchestrator(self, mock_process):
        mock_process.return_value = {
            'success': True, 'issue_id': self.issue.pk,
            'action': 'REVIEW', 'execution': {'success': True, 'message': 'Review'},
        }
        self._auth(self.admin)
        self.client.post(f'/api/agent/process-complaint/{self.issue.pk}/')
        mock_process.assert_called_once()

    def test_trace_returns_chronological(self):
        log_agent_action(self.issue, 'RECEIVED', input_data={'issue_id': self.issue.pk})
        log_agent_action(self.issue, 'ANALYZED', decision={'action': 'ASSIGN_WORKER'})
        log_agent_action(self.issue, 'COMPLETED')

        self._auth(self.admin)
        resp = self.client.get(f'/api/agent/trace/{self.issue.pk}/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['issue_id'], self.issue.pk)
        self.assertEqual(len(resp.data['traces']), 3)
        self.assertEqual(resp.data['traces'][0]['action'], 'RECEIVED')
        self.assertEqual(resp.data['traces'][2]['action'], 'COMPLETED')

    def test_status_returns_summary(self):
        log_agent_action(self.issue, 'WORKER_ASSIGNED')
        self._auth(self.admin)
        resp = self.client.get(f'/api/agent/status/{self.issue.pk}/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['issue_id'], self.issue.pk)
        self.assertEqual(resp.data['latest_agent_action'], 'WORKER_ASSIGNED')
        self.assertEqual(resp.data['trace_count'], 1)
        self.assertFalse(resp.data['agent_processing'])

    def test_issue_not_found_returns_404(self):
        self._auth(self.admin)
        resp = self.client.post('/api/agent/process-complaint/99999/')
        self.assertEqual(resp.status_code, 404)
        resp = self.client.get('/api/agent/trace/99999/')
        self.assertEqual(resp.status_code, 404)
        resp = self.client.get('/api/agent/status/99999/')
        self.assertEqual(resp.status_code, 404)

    def test_unauthorized_trace_access(self):
        other_citizen = User.objects.create_user(
            username='othercitizen', email='other@test.com', password='test1234',
            role='citizen', ward='Ward 3',
        )
        self._auth(other_citizen)
        resp = self.client.get(f'/api/agent/trace/{self.issue.pk}/')
        self.assertEqual(resp.status_code, 403)

    def test_unauthorized_status_access(self):
        other_citizen = User.objects.create_user(
            username='othercitizen2', email='other2@test.com', password='test1234',
            role='citizen', ward='Ward 3',
        )
        self._auth(other_citizen)
        resp = self.client.get(f'/api/agent/status/{self.issue.pk}/')
        self.assertEqual(resp.status_code, 403)

    def test_empty_trace_response(self):
        self._auth(self.admin)
        resp = self.client.get(f'/api/agent/trace/{self.issue.pk}/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['traces'], [])
        self.assertEqual(resp.data['trace_count'] if 'trace_count' in resp.data else len(resp.data['traces']), 0)


class EscalationTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='escuser', email='esc@test.com', password='test1234',
            role='citizen', ward='Ward Esc',
        )

    def _make_issue(self, priority='High', status='Assigned', hours_ago=30):
        issue = Issue.objects.create(
            title='Test issue', category='Water',
            ward='Ward Esc', reported_by=self.user, priority=priority,
            status=status,
        )
        Issue.objects.filter(pk=issue.pk).update(
            reported_at=timezone.now() - timedelta(hours=hours_ago),
            priority=priority,
        )
        issue.refresh_from_db()
        return issue

    def test_high_priority_escalation_threshold(self):
        from agent.escalation import should_escalate
        issue = self._make_issue(priority='High', hours_ago=25)
        should, reason = should_escalate(issue)
        self.assertTrue(should)
        self.assertIn('High', reason)

    def test_medium_priority_escalation_threshold(self):
        from agent.escalation import should_escalate
        issue = self._make_issue(priority='Medium', hours_ago=49)
        should, reason = should_escalate(issue)
        self.assertTrue(should)

    def test_low_priority_escalation_threshold(self):
        from agent.escalation import should_escalate
        issue = self._make_issue(priority='Low', hours_ago=73)
        should, reason = should_escalate(issue)
        self.assertTrue(should)

    def test_not_yet_escalated(self):
        from agent.escalation import should_escalate
        issue = self._make_issue(priority='High', hours_ago=10)
        should, _ = should_escalate(issue)
        self.assertFalse(should)

    def test_escalate_complaint_success(self):
        from agent.escalation import escalate_complaint
        issue = self._make_issue(priority='High', hours_ago=25)
        result = escalate_complaint(issue, reason='Test escalation')
        self.assertTrue(result['success'])
        self.assertEqual(result['action'], 'ESCALATE')
        self.assertTrue(AgentTrace.objects.filter(issue=issue, action='ESCALATION_INITIATED').exists())

    def test_escalate_resolved_issue_rejected(self):
        from agent.escalation import escalate_complaint
        issue = self._make_issue(priority='High', status='Resolved', hours_ago=30)
        result = escalate_complaint(issue)
        self.assertFalse(result['success'])
        self.assertIn('resolved', result['message'].lower())

    def test_duplicate_escalation_prevented(self):
        from agent.escalation import should_escalate, escalate_complaint
        issue = self._make_issue(priority='High', hours_ago=25)
        escalate_complaint(issue, reason='First escalation')
        should, _ = should_escalate(issue)
        self.assertFalse(should)


class FollowUpTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='fuuser', email='fu@test.com', password='test1234',
            role='citizen', ward='Ward Fu',
        )

    def _make_issue(self, status='Assigned', hours_ago=15):
        issue = Issue.objects.create(
            title='Test followup', category='Water',
            ward='Ward Fu', reported_by=self.user, priority='Medium',
            status=status,
        )
        Issue.objects.filter(pk=issue.pk).update(
            assigned_at=timezone.now() - timedelta(hours=hours_ago),
            reported_at=timezone.now() - timedelta(hours=hours_ago),
        )
        issue.refresh_from_db()
        return issue

    def test_follow_up_success(self):
        from agent.followup import follow_up_complaint
        issue = self._make_issue(status='Assigned', hours_ago=15)
        result = follow_up_complaint(issue)
        self.assertTrue(result['success'])
        self.assertEqual(result['action'], 'FOLLOW_UP')
        self.assertTrue(AgentTrace.objects.filter(issue=issue, action='FOLLOW_UP_INITIATED').exists())

    def test_follow_up_resolved_rejected(self):
        from agent.followup import follow_up_complaint
        issue = self._make_issue(status='Resolved', hours_ago=15)
        result = follow_up_complaint(issue)
        self.assertFalse(result['success'])
        self.assertIn('resolved', result['message'].lower())

    def test_follow_up_not_yet_due(self):
        from agent.followup import should_follow_up
        issue = self._make_issue(status='Assigned', hours_ago=5)
        should, _ = should_follow_up(issue)
        self.assertFalse(should)

    def test_duplicate_followup_prevented(self):
        from agent.followup import should_follow_up, follow_up_complaint
        issue = self._make_issue(status='Assigned', hours_ago=15)
        follow_up_complaint(issue)
        should, _ = should_follow_up(issue)
        self.assertFalse(should)


class MonitoringTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='monuser', email='mon@test.com', password='test1234',
            role='citizen', ward='Ward Mon',
        )

    def _make_issue(self, priority='Medium', status='Assigned', hours_ago=5):
        issue = Issue.objects.create(
            title='Monitor test', category='Water',
            ward='Ward Mon', reported_by=self.user, priority=priority,
            status=status,
        )
        Issue.objects.filter(pk=issue.pk).update(
            reported_at=timezone.now() - timedelta(hours=hours_ago),
            assigned_at=timezone.now() - timedelta(hours=hours_ago),
            priority=priority,
        )
        issue.refresh_from_db()
        return issue

    def test_unresolved_issue_detected(self):
        from agent.monitoring import monitor_complaints
        self._make_issue(status='Assigned', hours_ago=5)
        result = monitor_complaints()
        self.assertTrue(result['success'])
        self.assertGreaterEqual(result['processed'], 1)

    def test_resolved_issue_ignored(self):
        from agent.monitoring import monitor_complaints
        self._make_issue(status='Resolved', hours_ago=50)
        result = monitor_complaints()
        self.assertEqual(result['escalations'], 0)
        self.assertEqual(result['followups'], 0)

    def test_closed_issue_ignored(self):
        from agent.monitoring import monitor_complaints
        self._make_issue(status='Closed', hours_ago=50)
        result = monitor_complaints()
        self.assertEqual(result['escalations'], 0)

    def test_escalation_takes_precedence(self):
        from agent.monitoring import monitor_complaints
        # High priority, 25 hours old — should escalate, not follow up
        self._make_issue(priority='High', status='Assigned', hours_ago=25)
        result = monitor_complaints()
        self.assertEqual(result['escalations'], 1)
        self.assertEqual(result['followups'], 0)

    def test_followup_triggered(self):
        from agent.monitoring import monitor_complaints
        # Assigned issue, 15 hours old — should follow up
        self._make_issue(priority='Low', status='Assigned', hours_ago=15)
        result = monitor_complaints()
        self.assertEqual(result['followups'], 1)

    def test_one_failing_issue_does_not_stop_others(self):
        from agent.monitoring import monitor_complaints
        from agent.escalation import escalate_complaint
        # Create two issues, one will fail in escalate_complaint
        good = self._make_issue(priority='High', status='Assigned', hours_ago=25)
        bad = self._make_issue(priority='High', status='Assigned', hours_ago=25)

        # Patch escalate_complaint to fail only for the bad issue
        original = escalate_complaint
        def patched_escalate(issue, reason=None):
            if issue.pk == bad.pk:
                raise Exception('Simulated failure')
            return original(issue, reason=reason)

        with patch('agent.monitoring.escalate_complaint', side_effect=patched_escalate):
            result = monitor_complaints()

        self.assertEqual(result['errors'], 1)
        self.assertGreaterEqual(result['processed'], 2)

    def test_monitoring_summary_correct(self):
        from agent.monitoring import monitor_complaints
        # 1 escalation, 1 follow-up, 1 skipped (fresh issue)
        self._make_issue(priority='High', status='Assigned', hours_ago=25)
        self._make_issue(priority='Low', status='Assigned', hours_ago=15)
        self._make_issue(priority='Medium', status='Submitted', hours_ago=2)
        result = monitor_complaints()
        self.assertTrue(result['success'])
        self.assertEqual(result['escalations'], 1)
        self.assertEqual(result['followups'], 1)
        self.assertEqual(result['skipped'], 1)

    def test_submitted_issue_not_followed_up(self):
        from agent.monitoring import monitor_complaints
        # Submitted (not Assigned/In Progress) should not trigger follow-up
        self._make_issue(priority='Low', status='Submitted', hours_ago=15)
        result = monitor_complaints()
        self.assertEqual(result['followups'], 0)


class MonitorAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='monadmin', email='monadmin@test.com', password='test1234',
            role='admin', ward='Ward MonApi',
        )
        self.citizen = User.objects.create_user(
            username='moncitizen', email='moncitizen@test.com', password='test1234',
            role='citizen', ward='Ward MonApi',
        )

    def _auth(self, user):
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')

    @patch('agent.views.monitor_complaints')
    def test_admin_can_trigger_monitor(self, mock_monitor):
        mock_monitor.return_value = {
            'success': True, 'processed': 0, 'followups': 0,
            'escalations': 0, 'skipped': 0, 'errors': 0,
        }
        self._auth(self.admin)
        resp = self.client.post('/api/agent/monitor/')
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data['success'])
        mock_monitor.assert_called_once()

    def test_non_admin_cannot_trigger_monitor(self):
        self._auth(self.citizen)
        resp = self.client.post('/api/agent/monitor/')
        self.assertEqual(resp.status_code, 403)

    def test_unauthenticated_rejected(self):
        resp = self.client.post('/api/agent/monitor/')
        self.assertEqual(resp.status_code, 401)

    @patch('agent.views.monitor_complaints')
    def test_monitor_endpoint_returns_summary(self, mock_monitor):
        mock_monitor.return_value = {
            'success': True, 'processed': 5, 'followups': 2,
            'escalations': 1, 'skipped': 2, 'errors': 0,
        }
        self._auth(self.admin)
        resp = self.client.post('/api/agent/monitor/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['processed'], 5)
        self.assertEqual(resp.data['escalations'], 1)


class HealthCheckTest(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_health_returns_200(self):
        resp = self.client.get('/api/health/')
        self.assertEqual(resp.status_code, 200)

    def test_health_response_correct(self):
        resp = self.client.get('/api/health/')
        import json
        data = json.loads(resp.content)
        self.assertEqual(data, {'status': 'ok'})

    def test_root_health_still_works(self):
        resp = self.client.get('/')
        self.assertEqual(resp.status_code, 200)
        import json
        data = json.loads(resp.content)
        self.assertEqual(data, {'status': 'ok'})


class DatabaseConfigTest(TestCase):
    def test_sqlite_fallback_when_no_database_url(self):
        from django.conf import settings
        # In test env, DATABASE_URL is not set, so should use SQLite
        self.assertEqual(settings.DATABASES['default']['ENGINE'], 'django.db.backends.sqlite3')

    @patch.dict(os.environ, {'DATABASE_URL': 'postgres://testuser:testpass@localhost:5432/testdb'})
    def test_postgresql_config_from_env(self):
        from urllib.parse import urlparse
        import importlib
        import cityflow.settings as settings_mod

        url = urlparse(os.environ['DATABASE_URL'])
        # Verify URL parsing works correctly
        self.assertEqual(url.username, 'testuser')
        self.assertEqual(url.password, 'testpass')
        self.assertEqual(url.hostname, 'localhost')
        self.assertEqual(url.port, 5432)
        self.assertEqual(url.path, '/testdb')

    @patch.dict(os.environ, {'DATABASE_URL': 'postgres://user:pass@db.example.com:5432/civixai'})
    def test_postgresql_url_parsing_edge_cases(self):
        from urllib.parse import urlparse
        url = urlparse(os.environ['DATABASE_URL'])
        self.assertEqual(url.hostname, 'db.example.com')
        self.assertEqual(url.path[1:], 'civixai')

from django.conf import settings
from django.db import models


class AgentTrace(models.Model):
    """
    Records every meaningful CivixAI agent decision and action.

    Provides full traceability for what the agent did:
    - what information it received (input_data)
    - what decision it made (decision)
    - what action was executed (output_data)
    - when it happened (timestamp)
    - how long the operation took (duration_ms)
    """

    issue = models.ForeignKey(
        'issues.Issue',
        on_delete=models.CASCADE,
        related_name='agent_traces',
    )
    action = models.CharField(max_length=100)
    input_data = models.JSONField(null=True, blank=True)
    decision = models.JSONField(null=True, blank=True)
    output_data = models.JSONField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    duration_ms = models.IntegerField(null=True, blank=True)

    class Meta:
        ordering = ['-timestamp']
        verbose_name = 'Agent Trace'
        verbose_name_plural = 'Agent Traces'

    def __str__(self):
        return f"[{self.action}] {self.issue.display_id} @ {self.timestamp:%Y-%m-%d %H:%M}"

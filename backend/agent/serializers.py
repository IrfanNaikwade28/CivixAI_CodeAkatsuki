from rest_framework import serializers


class AgentTraceSerializer(serializers.Serializer):
    action = serializers.CharField()
    input_data = serializers.JSONField(allow_null=True)
    decision = serializers.JSONField(allow_null=True)
    output_data = serializers.JSONField(allow_null=True)
    timestamp = serializers.DateTimeField()
    duration_ms = serializers.IntegerField(allow_null=True)


class AgentProcessResultSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    issue_id = serializers.IntegerField()
    action = serializers.CharField(required=False)
    analysis = serializers.JSONField(required=False, allow_null=True)
    execution = serializers.JSONField(required=False)
    skipped = serializers.BooleanField(required=False)
    message = serializers.CharField(required=False)
    stage = serializers.CharField(required=False)


class AgentStatusSerializer(serializers.Serializer):
    issue_id = serializers.IntegerField()
    issue_status = serializers.CharField()
    priority = serializers.CharField()
    assigned_worker = serializers.JSONField(allow_null=True)
    latest_agent_action = serializers.CharField(allow_null=True)
    agent_processing = serializers.BooleanField()
    trace_count = serializers.IntegerField()

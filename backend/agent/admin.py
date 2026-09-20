from django.contrib import admin
from .models import AgentTrace


@admin.register(AgentTrace)
class AgentTraceAdmin(admin.ModelAdmin):
    list_display = ['id', 'issue', 'action', 'timestamp', 'duration_ms']
    list_filter = ['action', 'timestamp']
    search_fields = ['issue__display_id', 'issue__title', 'action']
    readonly_fields = ['issue', 'action', 'input_data', 'decision', 'output_data', 'timestamp', 'duration_ms']

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

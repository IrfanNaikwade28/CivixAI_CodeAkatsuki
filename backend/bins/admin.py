from django.contrib import admin
from .models import GarbageBin


@admin.register(GarbageBin)
class GarbageBinAdmin(admin.ModelAdmin):
    list_display = ('bin_id', 'location_text', 'ward', 'fill_level', 'status', 'capacity', 'assigned_worker')
    list_filter = ('ward',)
    search_fields = ('bin_id', 'location_text', 'ward')
    ordering = ('ward', 'bin_id')

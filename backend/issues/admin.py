from django.contrib import admin
from .models import Issue, IssueUpvote, IssueComment, IssueTimeline


@admin.register(Issue)
class IssueAdmin(admin.ModelAdmin):
    list_display = ('display_id', 'title', 'category', 'status', 'priority', 'ward', 'reported_by', 'assigned_to', 'reported_at')
    list_filter = ('status', 'priority', 'category', 'ward')
    search_fields = ('display_id', 'title', 'description', 'ward')
    ordering = ('-reported_at',)
    readonly_fields = ('display_id', 'priority_score', 'priority', 'reported_at')


@admin.register(IssueUpvote)
class IssueUpvoteAdmin(admin.ModelAdmin):
    list_display = ('issue', 'user')


@admin.register(IssueComment)
class IssueCommentAdmin(admin.ModelAdmin):
    list_display = ('issue', 'user', 'text', 'created_at')
    ordering = ('-created_at',)


@admin.register(IssueTimeline)
class IssueTimelineAdmin(admin.ModelAdmin):
    list_display = ('issue', 'status', 'note', 'changed_at')
    ordering = ('-changed_at',)

from django.urls import path
from . import views

urlpatterns = [
    path('detect-issue/', views.detect_issue_view, name='ai-detect-issue'),
    path('verify-completion/<int:issue_id>/', views.trigger_verify_view, name='ai-verify-completion'),
    path('preview-completion/<int:issue_id>/', views.preview_completion_view, name='ai-preview-completion'),
]

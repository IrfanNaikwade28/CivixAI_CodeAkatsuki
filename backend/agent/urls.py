from django.urls import path
from agent import views

urlpatterns = [
    path('process-complaint/<int:issue_id>/', views.process_complaint_view, name='agent-process-complaint'),
    path('trace/<int:issue_id>/', views.agent_trace_view, name='agent-trace'),
    path('status/<int:issue_id>/', views.agent_status_view, name='agent-status'),
]

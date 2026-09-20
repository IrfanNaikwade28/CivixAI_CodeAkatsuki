from django.urls import path
from . import views

urlpatterns = [
    path('', views.issue_list_create, name='issue-list-create'),
    path('my/', views.my_issues, name='my-issues'),
    path('assigned/', views.assigned_issues, name='assigned-issues'),
    path('nearby/', views.nearby_issues, name='nearby-issues'),
    path('<int:pk>/', views.issue_detail, name='issue-detail'),
    path('<int:pk>/upvote/', views.upvote_issue, name='issue-upvote'),
    path('<int:pk>/comments/', views.add_comment, name='issue-comment'),
]

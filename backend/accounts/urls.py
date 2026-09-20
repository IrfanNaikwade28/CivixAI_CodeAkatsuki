from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    path('register/', views.register, name='auth-register'),
    path('login/', views.login, name='auth-login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('me/', views.me, name='auth-me'),
    path('change-password/', views.change_password, name='auth-change-password'),
    path('profile/', views.update_profile, name='auth-update-profile'),
    path('profile-photo/', views.upload_profile_photo, name='auth-profile-photo'),
    path('workers/', views.workers_list, name='workers-list'),
    path('workers/<int:pk>/', views.worker_detail, name='worker-detail'),
]

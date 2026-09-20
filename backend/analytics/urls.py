from django.urls import path
from . import views

urlpatterns = [
    path('dashboard-stats/', views.dashboard_stats, name='analytics-dashboard'),
    path('wards/', views.ward_stats, name='analytics-wards'),
    path('category-trend/', views.category_trend, name='analytics-category-trend'),
    path('resolution-trend/', views.resolution_trend, name='analytics-resolution-trend'),
    path('activity-log/', views.activity_log, name='analytics-activity-log'),
]

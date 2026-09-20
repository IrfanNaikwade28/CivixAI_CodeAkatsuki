from django.urls import path
from . import views

urlpatterns = [
    path('', views.bin_list, name='bin-list'),
    path('<int:pk>/', views.bin_detail, name='bin-detail'),
]

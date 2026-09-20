from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('email', 'username', 'display_id', 'role', 'ward', 'phone', 'is_staff')
    list_filter = ('role', 'ward', 'is_staff', 'is_active')
    search_fields = ('email', 'username', 'first_name', 'last_name', 'display_id')
    ordering = ('email',)
    fieldsets = BaseUserAdmin.fieldsets + (
        ('CityFlow Info', {
            'fields': ('role', 'ward', 'phone', 'category', 'display_id', 'joined_date')
        }),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('CityFlow Info', {
            'fields': ('role', 'ward', 'phone', 'category')
        }),
    )

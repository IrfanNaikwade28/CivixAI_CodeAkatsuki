from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    ROLE_CHOICES = [
        ('citizen', 'Citizen'),
        ('worker', 'Worker'),
        ('admin', 'Admin'),
    ]
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='citizen')
    ward = models.CharField(max_length=50, blank=True)
    phone = models.CharField(max_length=15, blank=True)

    CATEGORY_CHOICES = [
        ('Infrastructure', 'Infrastructure'),
        ('Sanitation', 'Sanitation'),
        ('Water Supply', 'Water Supply'),
        ('Electrical', 'Electrical'),
        ('Traffic Control', 'Traffic Control'),
        ('Maintenance', 'Maintenance'),
    ]
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES, blank=True)
    joined_date = models.DateField(default=timezone.localdate)
    display_id = models.CharField(max_length=10, blank=True)
    profile_photo = models.ImageField(upload_to='profile_photos/', blank=True, null=True)

    GENDER_CHOICES = [
        ('Male', 'Male'),
        ('Female', 'Female'),
        ('Other', 'Other'),
    ]
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, blank=True)
    dob = models.DateField(null=True, blank=True)
    street = models.CharField(max_length=255, blank=True)
    landmark = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.role})"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if not self.display_id:
            prefix = {'citizen': 'C', 'worker': 'W', 'admin': 'A'}.get(self.role, 'U')
            self.display_id = f"{prefix}-{self.pk:03d}"
            User.objects.filter(pk=self.pk).update(display_id=self.display_id)

    @property
    def full_name(self):
        return self.get_full_name() or self.username

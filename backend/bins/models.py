from django.conf import settings
from django.db import models


class GarbageBin(models.Model):
    bin_id = models.CharField(max_length=15, unique=True)
    location_text = models.CharField(max_length=200)
    ward = models.CharField(max_length=50)
    lat = models.FloatField()
    lng = models.FloatField()
    fill_level = models.IntegerField(default=0)  # 0-100
    capacity = models.IntegerField(default=500)   # liters
    assigned_worker = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='assigned_bins',
    )
    last_collected = models.DateTimeField()

    def __str__(self):
        return f"{self.bin_id} — {self.location_text} ({self.fill_level}%)"

    @property
    def status(self):
        if self.fill_level >= 90:
            return 'Overflow'
        elif self.fill_level >= 70:
            return 'Near Capacity'
        return 'Normal'

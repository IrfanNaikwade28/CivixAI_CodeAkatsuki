from django.conf import settings
from django.db import models
from django.utils import timezone


class Issue(models.Model):
    CATEGORY_CHOICES = [
        ('Road', 'Road'),
        ('Water', 'Water'),
        ('Electricity', 'Electricity'),
        ('Garbage', 'Garbage'),
        ('Traffic', 'Traffic'),
        ('Public Facilities', 'Public Facilities'),
    ]
    STATUS_CHOICES = [
        ('Submitted', 'Submitted'),
        ('Assigned', 'Assigned'),
        ('In Progress', 'In Progress'),
        ('Resolved', 'Resolved'),
        ('Closed', 'Closed'),
    ]
    PRIORITY_CHOICES = [
        ('High', 'High'),
        ('Medium', 'Medium'),
        ('Low', 'Low'),
    ]
    BASE_WEIGHTS = {
        'Road': 90, 'Water': 85, 'Electricity': 80,
        'Garbage': 70, 'Traffic': 75, 'Public Facilities': 60,
    }

    display_id = models.CharField(max_length=15, unique=True, blank=True)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Submitted')
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='Medium')
    priority_score = models.IntegerField(null=True, blank=True)

    ward = models.CharField(max_length=50)
    location_text = models.CharField(max_length=200, blank=True)
    location_lat = models.FloatField(null=True, blank=True)
    location_lng = models.FloatField(null=True, blank=True)

    is_public = models.BooleanField(default=True)
    upvotes = models.IntegerField(default=0)

    image = models.ImageField(upload_to='issues/before/', null=True, blank=True)
    completion_photo = models.ImageField(upload_to='issues/after/', null=True, blank=True)

    # AI fields
    ai_completion_score = models.IntegerField(null=True, blank=True)
    ai_completion_verdict = models.TextField(blank=True)

    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reported_issues',
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='assigned_issues',
    )

    reported_at = models.DateTimeField(auto_now_add=True)
    assigned_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-reported_at']

    def __str__(self):
        return f"[{self.display_id}] {self.title}"

    def save(self, *args, **kwargs):
        # Auto-assign display_id on first save
        if not self.display_id:
            super().save(*args, **kwargs)
            self.display_id = f"CP-{2000 + self.pk}"
            self.compute_priority_score()
            Issue.objects.filter(pk=self.pk).update(
                display_id=self.display_id,
                priority=self.priority,
                priority_score=self.priority_score,
            )
            return
        self.compute_priority_score()
        super().save(*args, **kwargs)

    def compute_priority_score(self):
        base = self.BASE_WEIGHTS.get(self.category, 60)
        hours = (timezone.now() - self.reported_at).total_seconds() / 3600 if self.reported_at else 0
        time_factor = min(hours, 100)
        ward_freq = min(
            Issue.objects.filter(
                ward=self.ward,
                status__in=['Submitted', 'Assigned', 'In Progress']
            ).exclude(pk=self.pk).count(),
            100
        )
        score = int((base * 0.5) + (time_factor * 0.3) + (ward_freq * 0.2))
        self.priority_score = score
        if score >= 80:
            self.priority = 'High'
        elif score >= 50:
            self.priority = 'Medium'
        else:
            self.priority = 'Low'


class IssueUpvote(models.Model):
    issue = models.ForeignKey(Issue, on_delete=models.CASCADE, related_name='upvote_records')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    class Meta:
        unique_together = ('issue', 'user')


class IssueComment(models.Model):
    issue = models.ForeignKey(Issue, on_delete=models.CASCADE, related_name='comments')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Comment by {self.user} on {self.issue.display_id}"


class IssueTimeline(models.Model):
    issue = models.ForeignKey(Issue, on_delete=models.CASCADE, related_name='timeline')
    status = models.CharField(max_length=20)
    note = models.CharField(max_length=300, blank=True)
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['changed_at']

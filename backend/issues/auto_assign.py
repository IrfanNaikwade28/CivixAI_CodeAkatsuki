"""
Auto-assignment logic for CityFlow issues.

Algorithm:
  1. Map issue category → compatible worker categories
  2. Filter active (role=worker) users whose category matches
  3. Prefer workers in the same ward as the issue
  4. Among candidates, pick the one with the fewest active assigned issues (load balancing)
  5. If no same-ward match, fall back to any-ward match
  6. If still no match, return None (issue stays Submitted, admin assigns manually)
"""
from django.contrib.auth import get_user_model
from django.db.models import Count, Q

User = get_user_model()

# Maps issue category → list of worker categories that can handle it
CATEGORY_MAP = {
    'Road':              ['Infrastructure', 'Maintenance'],
    'Water':             ['Water Supply'],
    'Electricity':       ['Electrical'],
    'Garbage':           ['Sanitation'],
    'Traffic':           ['Traffic Control', 'Infrastructure'],
    'Public Facilities': ['Maintenance', 'Infrastructure'],
}


def find_best_worker(issue_category: str, ward: str):
    """
    Return the best available worker User instance for the given issue,
    or None if no suitable worker exists.
    """
    compatible_categories = CATEGORY_MAP.get(issue_category, [])
    if not compatible_categories:
        return None

    # All workers with a compatible category, annotated with active task count
    active_statuses = ['Submitted', 'Assigned', 'In Progress']
    candidates = (
        User.objects
        .filter(role='worker', category__in=compatible_categories)
        .annotate(
            active_tasks=Count(
                'assigned_issues',
                filter=Q(assigned_issues__status__in=active_statuses),
            )
        )
        .order_by('active_tasks')  # least loaded first
    )

    if not candidates.exists():
        return None

    # Try same-ward first
    same_ward = candidates.filter(ward=ward)
    if same_ward.exists():
        return same_ward.first()

    # Fallback: any ward
    return candidates.first()

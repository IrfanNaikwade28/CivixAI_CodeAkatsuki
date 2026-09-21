"""
Seed the Neon PostgreSQL database with realistic demo data for CivixAI.

Idempotent — safe to run multiple times without creating duplicates.
Only runs when DATABASE_URL is configured (production/Neon).
Does not delete any existing data.
"""
import os
from datetime import date, timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import connection

from accounts.models import User
from issues.models import Issue, IssueComment, IssueTimeline


WARD_NAMES = [
    'Ward 1', 'Ward 2', 'Ward 3', 'Ward 4',
    'Ward 5', 'Ward 6', 'Ward 7', 'Ward 8',
]

CITIZENS = [
    {
        'username': 'priya_sharma',
        'email': 'priya.sharma@example.com',
        'first_name': 'Priya',
        'last_name': 'Sharma',
        'password': 'Civix@2024',
        'phone': '9876543210',
        'ward': 'Ward 3',
        'gender': 'Female',
        'dob': date(1992, 6, 15),
        'street': '12, Tarabai Park',
        'landmark': 'Near Mahalaxmi Temple',
        'joined_date': date(2024, 1, 10),
    },
    {
        'username': 'amit_jadhav',
        'email': 'amit.jadhav@example.com',
        'first_name': 'Amit',
        'last_name': 'Jadhav',
        'password': 'Civix@2024',
        'phone': '9876543211',
        'ward': 'Ward 5',
        'gender': 'Male',
        'dob': date(1988, 3, 22),
        'street': '45, Rajarampuri',
        'landmark': 'Opposite Vasant High School',
        'joined_date': date(2024, 2, 5),
    },
    {
        'username': 'meena_patil',
        'email': 'meena.patil@example.com',
        'first_name': 'Meena',
        'last_name': 'Patil',
        'password': 'Civix@2024',
        'phone': '9876543212',
        'ward': 'Ward 7',
        'gender': 'Female',
        'dob': date(1995, 11, 8),
        'street': '78, Shahupuri',
        'landmark': 'Near New Market Yard',
        'joined_date': date(2024, 3, 18),
    },
    {
        'username': 'rahul_desai',
        'email': 'rahul.desai@example.com',
        'first_name': 'Rahul',
        'last_name': 'Desai',
        'password': 'Civix@2024',
        'phone': '9876543213',
        'ward': 'Ward 2',
        'gender': 'Male',
        'dob': date(1990, 7, 30),
        'street': '23, Vidyanagar',
        'landmark': 'Behind Shivaji University Gate 3',
        'joined_date': date(2024, 4, 12),
    },
]

WORKERS = [
    {
        'username': 'suresh_kumar',
        'email': 'suresh.kumar@ichalkaranji.gov.in',
        'first_name': 'Suresh',
        'last_name': 'Kumar',
        'password': 'Civix@2024',
        'phone': '9765432100',
        'ward': 'Ward 3',
        'category': 'Water Supply',
        'gender': 'Male',
        'dob': date(1985, 5, 12),
        'street': '5, Jadhav Nagar',
        'landmark': 'Near Water Tank',
        'joined_date': date(2023, 6, 1),
    },
    {
        'username': 'anjali_more',
        'email': 'anjali.more@ichalkaranji.gov.in',
        'first_name': 'Anjali',
        'last_name': 'More',
        'password': 'Civix@2024',
        'phone': '9765432101',
        'ward': 'Ward 5',
        'category': 'Sanitation',
        'gender': 'Female',
        'dob': date(1990, 9, 25),
        'street': '18, Shahu Colony',
        'landmark': 'Near Municipal School',
        'joined_date': date(2023, 8, 15),
    },
    {
        'username': 'vijay_sangle',
        'email': 'vijay.sangle@ichalkaranji.gov.in',
        'first_name': 'Vijay',
        'last_name': 'Sangle',
        'password': 'Civix@2024',
        'phone': '9765432102',
        'ward': 'Ward 1',
        'category': 'Infrastructure',
        'gender': 'Male',
        'dob': date(1982, 1, 30),
        'street': '32, Rankala Road',
        'landmark': 'Near Rankala Lake Entrance',
        'joined_date': date(2023, 4, 20),
    },
    {
        'username': 'kavita_bhosale',
        'email': 'kavita.bhosale@ichalkaranji.gov.in',
        'first_name': 'Kavita',
        'last_name': 'Bhosale',
        'password': 'Civix@2024',
        'phone': '9765432103',
        'ward': 'Ward 6',
        'category': 'Electrical',
        'gender': 'Female',
        'dob': date(1988, 12, 3),
        'street': '9, Tarabai Park',
        'landmark': 'Near LIC Office',
        'joined_date': date(2023, 10, 5),
    },
]

ADMIN = {
    'username': 'admin',
    'email': 'admin@civixai.gov.in',
    'first_name': 'Admin',
    'last_name': 'CivixAI',
    'password': 'admin1234',
    'phone': '9000000001',
    'ward': 'Ward 1',
    'gender': 'Male',
    'dob': date(1980, 1, 1),
    'street': '1, Municipal Corporation Road',
    'landmark': 'Near Collectorate',
    'joined_date': date(2023, 1, 1),
}

# Real Kolhapur coordinates
LOCATIONS = {
    'tarabai_park': {'lat': 16.7050, 'lng': 74.2433, 'text': 'Tarabai Park, Kolhapur'},
    'shahupuri': {'lat': 16.6950, 'lng': 74.2350, 'text': 'Shahupuri, Kolhapur'},
    'rajarampuri': {'lat': 16.7100, 'lng': 74.2500, 'text': 'Rajarampuri, Kolhapur'},
    'vidyanagar': {'lat': 16.6850, 'lng': 74.2250, 'text': 'Vidyanagar, Kolhapur'},
    'rankala': {'lat': 16.7000, 'lng': 74.2200, 'text': 'Rankala Lake Area, Kolhapur'},
    'laxmipuri': {'lat': 16.6900, 'lng': 74.2400, 'text': 'Laxmipuri, Kolhapur'},
    'mali_galli': {'lat': 16.6980, 'lng': 74.2300, 'text': 'Mali Galli, Kolhapur'},
    'jadhav_nagar': {'lat': 16.7120, 'lng': 74.2550, 'text': 'Jadhav Nagar, Kolhapur'},
}

ISSUES = [
    # Water issues
    {
        'title': 'Broken water pipe causing flooding on main road',
        'description': 'A major water pipe has burst near the intersection of Tarabai Park road. Water is gushing onto the street, creating a hazardous situation for pedestrians and vehicles. The road is partially submerged.',
        'category': 'Water',
        'priority': 'High',
        'status': 'In Progress',
        'ward': 'Ward 3',
        'location': 'tarabai_park',
        'citizen': 'priya_sharma',
        'worker': 'suresh_kumar',
        'upvotes': 12,
        'reported_days_ago': 2,
    },
    {
        'title': 'Low water pressure in residential area for 3 days',
        'description': 'Residents of Shahupuri area are experiencing extremely low water pressure since Monday morning. Several households on the 3rd and 4th floors are not receiving any water at all. This is affecting daily routines and cooking.',
        'category': 'Water',
        'priority': 'Medium',
        'status': 'Assigned',
        'ward': 'Ward 5',
        'location': 'shahupuri',
        'citizen': 'amit_jadhav',
        'worker': 'suresh_kumar',
        'upvotes': 8,
        'reported_days_ago': 3,
    },
    # Garbage issues
    {
        'title': 'Overflowing garbage bins attracting stray animals',
        'description': 'The garbage bins at the Shahupuri market junction have not been collected for over 4 days. The waste is spilling onto the road, creating a foul smell and attracting stray dogs and pigs. This is a health hazard especially for children playing in the area.',
        'category': 'Garbage',
        'priority': 'High',
        'status': 'Submitted',
        'ward': 'Ward 5',
        'location': 'shahupuri',
        'citizen': 'amit_jadhav',
        'worker': None,
        'upvotes': 15,
        'reported_days_ago': 4,
    },
    {
        'title': 'Illegal dumping of construction debris near school',
        'description': 'Unknown persons have dumped construction debris and rubble near the entrance of the municipal school in Ward 7. This blocks the pedestrian path and poses a safety risk to school children. The debris includes broken bricks and cement blocks.',
        'category': 'Garbage',
        'priority': 'Medium',
        'status': 'Assigned',
        'ward': 'Ward 7',
        'location': 'vidyanagar',
        'citizen': 'meena_patil',
        'worker': 'anjali_more',
        'upvotes': 6,
        'reported_days_ago': 1,
    },
    # Road issues
    {
        'title': 'Large pothole on Rajarampuri main road',
        'description': 'A dangerous pothole approximately 2 feet wide has formed on the main road near Rajarampuri bus stop. Several two-wheelers have skidded here during monsoon. The pothole is deep enough to cause serious injury. Immediate repair needed before someone gets seriously hurt.',
        'category': 'Road',
        'priority': 'High',
        'status': 'In Progress',
        'ward': 'Ward 1',
        'location': 'rajarampuri',
        'citizen': 'rahul_desai',
        'worker': 'vijay_sangle',
        'upvotes': 22,
        'reported_days_ago': 5,
    },
    {
        'title': 'Broken streetlights on Rankala Lake walking path',
        'description': 'Multiple streetlights along the Rankala Lake walking path have been non-functional for over a week. The area becomes completely dark after 7 PM, making it unsafe for morning and evening walkers. Several senior citizens have reported near-misses.',
        'category': 'Electricity',
        'priority': 'Medium',
        'status': 'Assigned',
        'ward': 'Ward 2',
        'location': 'rankala',
        'citizen': 'rahul_desai',
        'worker': 'kavita_bhosale',
        'upvotes': 18,
        'reported_days_ago': 7,
    },
    # Electricity issues
    {
        'title': 'Frequent power outages in Laxmipuri area',
        'description': 'The Laxmipuri area has been experiencing frequent and prolonged power outages for the past 2 weeks. Power goes out 3-4 times a day, each lasting 1-2 hours. This is affecting local businesses, medical shops, and residential areas. Several food vendors have reported spoilage of perishable goods.',
        'category': 'Electricity',
        'priority': 'High',
        'status': 'Submitted',
        'ward': 'Ward 6',
        'location': 'laxmipuri',
        'citizen': 'priya_sharma',
        'worker': None,
        'upvotes': 25,
        'reported_days_ago': 1,
    },
    {
        'title': 'Exposed electrical wires near public park',
        'description': 'Live electrical wires are hanging loose from a pole near the children\'s play area in Mali Galli park. The wires are at a height accessible to children. This is an extremely dangerous situation that could result in electrocution. The wires appear to have been damaged during recent tree trimming.',
        'category': 'Electricity',
        'priority': 'High',
        'status': 'In Progress',
        'ward': 'Ward 3',
        'location': 'mali_galli',
        'citizen': 'meena_patil',
        'worker': 'kavita_bhosale',
        'upvotes': 30,
        'reported_days_ago': 3,
    },
    # Traffic issues
    {
        'title': 'Non-functional traffic signal at Jadhav Nagar crossing',
        'description': 'The traffic signal at the main Jadhav Nagar crossing has been completely dead for 5 days. During peak hours, this creates massive traffic jams and has already resulted in 2 minor accidents. Police personnel are occasionally deployed but not consistently.',
        'category': 'Traffic',
        'priority': 'High',
        'status': 'Assigned',
        'ward': 'Ward 1',
        'location': 'jadhav_nagar',
        'citizen': 'amit_jadhav',
        'worker': 'vijay_sangle',
        'upvotes': 20,
        'reported_days_ago': 5,
    },
    {
        'title': 'Missing road signs near school zone',
        'description': 'Speed breakers and school zone warning signs are missing on the road passing through Vidyanagar near the primary school. Vehicles speed through this area during school hours putting children at risk. A student was narrowly missed by a speeding truck last week.',
        'category': 'Traffic',
        'priority': 'Medium',
        'status': 'Resolved',
        'ward': 'Ward 2',
        'location': 'vidyanagar',
        'citizen': 'rahul_desai',
        'worker': 'vijay_sangle',
        'upvotes': 9,
        'reported_days_ago': 10,
    },
    # Public Facilities issues
    {
        'title': 'Broken public toilet near Kolhapur bus stand',
        'description': 'The public toilet facility near the main bus stand is in a deplorable condition. The doors are broken, there is no water supply, and the drainage is blocked. This facility is used by hundreds of daily commuters and tourists visiting Kolhapur.',
        'category': 'Public Facilities',
        'priority': 'Medium',
        'status': 'Submitted',
        'ward': 'Ward 6',
        'location': 'rankala',
        'citizen': 'priya_sharma',
        'worker': None,
        'upvotes': 11,
        'reported_days_ago': 6,
    },
    {
        'title': 'Damaged park benches and playground equipment',
        'description': 'Several park benches in the Tarabai Park garden are broken or missing legs. The children\'s swing set has rusted chains and one swing is completely detached. The park is used by over 200 families daily and the deteriorating infrastructure is a safety concern.',
        'category': 'Public Facilities',
        'priority': 'Low',
        'status': 'Closed',
        'ward': 'Ward 3',
        'location': 'tarabai_park',
        'citizen': 'meena_patil',
        'worker': 'anjali_more',
        'upvotes': 5,
        'reported_days_ago': 15,
    },
]

# Map Issue category to User worker category
ISSUE_TO_WORKER_CATEGORY = {
    'Water': 'Water Supply',
    'Garbage': 'Sanitation',
    'Road': 'Infrastructure',
    'Electricity': 'Electrical',
    'Traffic': 'Infrastructure',
    'Public Facilities': 'Infrastructure',
}


class Command(BaseCommand):
    help = 'Seed Neon PostgreSQL with realistic demo data for CivixAI dashboard'

    def _is_postgres(self):
        return connection.vendor == 'postgresql'

    def _get_or_create_user(self, data, role):
        """Get existing user by username or create a new one. Never duplicates."""
        username = data['username']
        existing = User.objects.filter(username=username).first()
        if existing:
            self.stdout.write(f'  [skip] {role} "{username}" already exists')
            return existing

        password = data.pop('password')
        user = User.objects.create_user(role=role, **data)
        user.set_password(password)
        user.save()
        self.stdout.write(f'  [create] {role} "{username}" ({user.display_id})')
        return user

    def _find_worker_for_issue(self, category):
        """Find an available worker matching the issue category."""
        worker_cat = ISSUE_TO_WORKER_CATEGORY.get(category, 'Infrastructure')
        workers = User.objects.filter(role='worker', category=worker_cat)
        if workers.exists():
            return workers.order_by('?').first()
        return None

    def _next_display_id(self):
        """Generate the next unique Issue display_id."""
        from django.db.models import Max
        last = Issue.objects.aggregate(max_id=Max('display_id'))['max_id']
        if last and last.startswith('CP-'):
            try:
                num = int(last.split('-')[1]) + 1
            except (ValueError, IndexError):
                num = 2000 + Issue.objects.count() + 1
        else:
            num = 2000 + Issue.objects.count() + 1
        return f"CP-{num}"

    def _fix_orphan_display_ids(self):
        """Fix any existing issues that have empty display_id (from partial previous runs)."""
        orphans = Issue.objects.filter(display_id='')
        if orphans.exists():
            self.stdout.write(self.style.WARNING(
                f'  Fixing {orphans.count()} issue(s) with empty display_id...'
            ))
            for issue in orphans:
                issue.display_id = self._next_display_id()
                Issue.objects.filter(pk=issue.pk).update(display_id=issue.display_id)
                self.stdout.write(f'  [fix] {issue.title[:50]}... → {issue.display_id}')

    def handle(self, *args, **options):
        db_url = os.environ.get('DATABASE_URL', '')
        if not db_url:
            self.stdout.write(self.style.WARNING(
                'DATABASE_URL not set — skipping seed. '
                'This command only seeds Neon PostgreSQL.'
            ))
            return

        if not self._is_postgres():
            self.stdout.write(self.style.WARNING(
                f'Connected to {connection.vendor}, not PostgreSQL — skipping seed.'
            ))
            return

        self.stdout.write(self.style.SUCCESS(
            f'\n=== CivixAI Demo Data Seeder ===\n'
            f'Database: {connection.settings_dict.get("NAME", "?")}\n'
        ))

        # Fix any orphaned display_ids from previous partial runs
        self._fix_orphan_display_ids()

        # ── 1. Admin ──────────────────────────────────────────────────────
        self.stdout.write('1. Ensuring admin account...')
        admin_data = ADMIN.copy()
        admin_password = admin_data.pop('password')
        admin, created = User.objects.get_or_create(
            username=admin_data['username'],
            defaults={**admin_data, 'role': 'admin', 'is_staff': True, 'is_superuser': True},
        )
        if created:
            admin.set_password(admin_password)
            admin.save()
            self.stdout.write(f'  [create] admin "{admin.username}" ({admin.display_id})')
        else:
            self.stdout.write(f'  [skip]  admin "{admin.username}" already exists')

        # ── 2. Citizens ───────────────────────────────────────────────────
        self.stdout.write('\n2. Creating citizen accounts...')
        citizens = []
        for c_data in CITIZENS:
            data = c_data.copy()
            password = data.pop('password')
            username = data['username']
            existing = User.objects.filter(username=username).first()
            if existing:
                self.stdout.write(f'  [skip]  citizen "{username}" already exists')
                citizens.append(existing)
                continue
            user = User.objects.create_user(role='citizen', **data)
            user.set_password(password)
            user.save()
            self.stdout.write(f'  [create] citizen "{username}" ({user.display_id})')
            citizens.append(user)

        # ── 3. Workers ────────────────────────────────────────────────────
        self.stdout.write('\n3. Creating worker accounts...')
        workers = []
        for w_data in WORKERS:
            data = w_data.copy()
            password = data.pop('password')
            username = data['username']
            existing = User.objects.filter(username=username).first()
            if existing:
                self.stdout.write(f'  [skip]  worker "{username}" already exists')
                workers.append(existing)
                continue
            user = User.objects.create_user(role='worker', **data)
            user.set_password(password)
            user.save()
            self.stdout.write(f'  [create] worker "{username}" ({user.display_id})')
            workers.append(user)

        # ── 4. Issues ─────────────────────────────────────────────────────
        self.stdout.write('\n4. Creating civic issues...')
        citizen_map = {c.username: c for c in citizens}
        issue_count = 0
        for issue_data in ISSUES:
            title = issue_data['title']
            if Issue.objects.filter(title=title).exists():
                self.stdout.write(f'  [skip]  issue "{title[:50]}..." already exists')
                continue

            loc = LOCATIONS[issue_data['location']]
            citizen = citizen_map[issue_data['citizen']]
            reported_at = timezone.now() - timedelta(days=issue_data['reported_days_ago'])

            issue = Issue(
                display_id=self._next_display_id(),
                title=title,
                description=issue_data['description'],
                category=issue_data['category'],
                status=issue_data['status'],
                priority=issue_data['priority'],
                ward=issue_data['ward'],
                location_text=loc['text'],
                location_lat=loc['lat'],
                location_lng=loc['lng'],
                upvotes=issue_data['upvotes'],
                reported_by=citizen,
            )
            issue._agent_priority_applied = True
            issue.reported_at = reported_at
            issue.save()

            # Assign worker if specified
            worker_username = issue_data.get('worker')
            if worker_username:
                worker = User.objects.filter(username=worker_username).first()
                if worker:
                    issue.assigned_to = worker
                    issue.assigned_at = reported_at + timedelta(hours=2)
                    issue.save(update_fields=['assigned_to', 'assigned_at'])

            # Create timeline entries
            IssueTimeline.objects.create(
                issue=issue,
                status='Submitted',
                note='Issue reported by citizen',
                changed_at=reported_at,
            )
            if issue.status in ('Assigned', 'In Progress', 'Resolved', 'Closed'):
                IssueTimeline.objects.create(
                    issue=issue,
                    status='Assigned',
                    note=f'Assigned to {issue.assigned_to.get_full_name()}' if issue.assigned_to else '',
                    changed_at=reported_at + timedelta(hours=2),
                )
            if issue.status in ('In Progress', 'Resolved', 'Closed'):
                IssueTimeline.objects.create(
                    issue=issue,
                    status='In Progress',
                    note='Work started on the issue',
                    changed_at=reported_at + timedelta(days=1),
                )
            if issue.status in ('Resolved', 'Closed'):
                IssueTimeline.objects.create(
                    issue=issue,
                    status='Resolved',
                    note='Issue has been resolved',
                    changed_at=reported_at + timedelta(days=3),
                )
            if issue.status == 'Closed':
                IssueTimeline.objects.create(
                    issue=issue,
                    status='Closed',
                    note='Issue verified and closed',
                    changed_at=reported_at + timedelta(days=5),
                )

            issue_count += 1
            self.stdout.write(f'  [create] issue "{title[:55]}..." ({issue.display_id})')

        # ── 4b. Patch assignments for existing issues missing workers ─────
        self.stdout.write('\n4b. Patching worker assignments for existing issues...')
        for issue_data in ISSUES:
            title = issue_data['title']
            worker_username = issue_data.get('worker')
            if not worker_username:
                continue
            issue = Issue.objects.filter(title=title).first()
            if issue and not issue.assigned_to:
                worker = User.objects.filter(username=worker_username).first()
                if worker:
                    issue.assigned_to = worker
                    issue.assigned_at = issue.reported_at + timedelta(hours=2)
                    if issue.status == 'Submitted':
                        issue.status = 'Assigned'
                    issue.save(update_fields=['assigned_to', 'assigned_at', 'status'])
                    self.stdout.write(f'  [patch] {issue.display_id} → assigned to {worker.username}')

        # ── 5. Summary ────────────────────────────────────────────────────
        citizens_count = User.objects.filter(role='citizen').count()
        workers_count = User.objects.filter(role='worker').count()
        admins_count = User.objects.filter(role='admin').count()
        issues_count = Issue.objects.count()
        assigned_count = Issue.objects.filter(assigned_to__isnull=False).count()

        self.stdout.write(self.style.SUCCESS(f"""
=== Seed Complete ===

  Citizens:   {citizens_count}
  Workers:    {workers_count}
  Admins:     {admins_count}
  Issues:     {issues_count}
  Assigned:   {assigned_count}

  No existing data was deleted.
  Running this command again will not create duplicates.

--- Demo Credentials ---

  Admin:
    admin@civixai.gov.in  /  admin1234

  Citizens:
    priya.sharma@example.com  /  Civix@2024
    amit.jadhav@example.com   /  Civix@2024
    meena.patil@example.com   /  Civix@2024
    rahul.desai@example.com   /  Civix@2024

  Workers:
    suresh.kumar@ichalkaranji.gov.in    /  Civix@2024  (Water)
    anjali.more@ichalkaranji.gov.in     /  Civix@2024  (Sanitation)
    vijay.sangle@ichalkaranji.gov.in    /  Civix@2024  (Road)
    kavita.bhosale@ichalkaranji.gov.in  /  Civix@2024  (Electricity)
"""))

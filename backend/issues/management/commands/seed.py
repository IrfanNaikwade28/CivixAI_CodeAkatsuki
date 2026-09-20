from django.core.management.base import BaseCommand
from datetime import date

from accounts.models import User
from issues.models import Issue, IssueComment, IssueTimeline
from bins.models import GarbageBin


class Command(BaseCommand):
    help = 'Seed the database with fresh CityFlow data — 1 admin, 10 workers, 3 citizens. No issues or bins.'

    def handle(self, *args, **options):
        self.stdout.write('Clearing existing data...')
        IssueTimeline.objects.all().delete()
        IssueComment.objects.all().delete()
        Issue.objects.all().delete()
        GarbageBin.objects.all().delete()
        User.objects.all().delete()

        self.stdout.write('Creating admin...')

        admin = User.objects.create_superuser(
            username='admin',
            email='admin@cityflow.gov.in',
            password='admin1234',
            first_name='Admin',
            last_name='CityFlow',
            role='admin',
        )
        admin.display_id = 'A-00'
        admin.save()

        self.stdout.write('Creating citizens...')

        citizens = [
            dict(username='rajesh',  email='rajesh@example.com',  password='1234',
                 first_name='Rajesh',  last_name='Patil',   ward='Ward 5',  phone='9876543210',
                 joined_date=date(2024, 3, 15), display_id='C-01'),
            dict(username='sunita',  email='sunita@example.com',  password='1234',
                 first_name='Sunita',  last_name='Mane',    ward='Ward 3',  phone='9765432109',
                 joined_date=date(2024, 5, 20), display_id='C-02'),
            dict(username='amol',    email='amol@example.com',    password='1234',
                 first_name='Amol',    last_name='Kumbhar', ward='Ward 7',  phone='9654321098',
                 joined_date=date(2024, 7, 10), display_id='C-03'),
        ]

        for c in citizens:
            did = c.pop('display_id')
            u = User.objects.create_user(role='citizen', **c)
            u.display_id = did
            u.save()

        self.stdout.write('Creating workers (10, all categories, multiple wards)...')

        workers = [
            # Infrastructure
            dict(username='dnyanesh', email='dnyanesh@ichalkaranji.gov.in', password='1234',
                 first_name='Dnyaneshwar', last_name='Jadhav',   ward='Ward 5', phone='9543210987',
                 category='Infrastructure', joined_date=date(2023, 1, 10), display_id='W-01'),
            dict(username='prashant', email='prashant@ichalkaranji.gov.in', password='1234',
                 first_name='Prashant',    last_name='Shinde',   ward='Ward 2', phone='9532109876',
                 category='Infrastructure', joined_date=date(2023, 4, 18), display_id='W-02'),
            # Sanitation
            dict(username='vishwas',  email='vishwas@ichalkaranji.gov.in',  password='1234',
                 first_name='Vishwas',     last_name='Kamble',   ward='Ward 3', phone='9432109876',
                 category='Sanitation', joined_date=date(2023, 3, 22), display_id='W-03'),
            dict(username='suresh',   email='suresh@ichalkaranji.gov.in',   password='1234',
                 first_name='Suresh',      last_name='Nikam',    ward='Ward 8', phone='9421098765',
                 category='Sanitation', joined_date=date(2023, 7, 5), display_id='W-04'),
            # Water Supply
            dict(username='santosh',  email='santosh@ichalkaranji.gov.in',  password='1234',
                 first_name='Santosh',     last_name='Chougule', ward='Ward 7', phone='9321098765',
                 category='Water Supply', joined_date=date(2023, 6, 5), display_id='W-05'),
            dict(username='ganesh',   email='ganesh@ichalkaranji.gov.in',   password='1234',
                 first_name='Ganesh',      last_name='Pawar',    ward='Ward 1', phone='9310987654',
                 category='Water Supply', joined_date=date(2023, 9, 14), display_id='W-06'),
            # Electrical
            dict(username='anil',     email='anil@ichalkaranji.gov.in',     password='1234',
                 first_name='Anil',        last_name='Deshmukh', ward='Ward 5', phone='9210987654',
                 category='Electrical', joined_date=date(2023, 2, 28), display_id='W-07'),
            dict(username='ravi',     email='ravi@ichalkaranji.gov.in',     password='1234',
                 first_name='Ravi',        last_name='Kulkarni', ward='Ward 4', phone='9209876543',
                 category='Electrical', joined_date=date(2023, 11, 3), display_id='W-08'),
            # Traffic Control
            dict(username='mahesh',   email='mahesh@ichalkaranji.gov.in',   password='1234',
                 first_name='Mahesh',      last_name='Gaikwad',  ward='Ward 6', phone='9109876543',
                 category='Traffic Control', joined_date=date(2023, 5, 17), display_id='W-09'),
            # Maintenance
            dict(username='prakash',  email='prakash@ichalkaranji.gov.in',  password='1234',
                 first_name='Prakash',     last_name='More',     ward='Ward 3', phone='9098765432',
                 category='Maintenance', joined_date=date(2023, 8, 22), display_id='W-10'),
        ]

        for w in workers:
            did = w.pop('display_id')
            u = User.objects.create_user(role='worker', **w)
            u.display_id = did
            u.save()

        self.stdout.write(self.style.SUCCESS(
            '\nSeed complete! Clean database — no issues, no bins.\n\n'
            '  Admin:    admin@cityflow.gov.in         / admin1234\n'
            '  Citizens: rajesh@example.com            / 1234  (Ward 5)\n'
            '            sunita@example.com            / 1234  (Ward 3)\n'
            '            amol@example.com              / 1234  (Ward 7)\n'
            '\n'
            '  Workers (all pw: 1234):\n'
            '    W-01  dnyanesh@ichalkaranji.gov.in   Infrastructure  Ward 5\n'
            '    W-02  prashant@ichalkaranji.gov.in   Infrastructure  Ward 2\n'
            '    W-03  vishwas@ichalkaranji.gov.in    Sanitation      Ward 3\n'
            '    W-04  suresh@ichalkaranji.gov.in     Sanitation      Ward 8\n'
            '    W-05  santosh@ichalkaranji.gov.in    Water Supply    Ward 7\n'
            '    W-06  ganesh@ichalkaranji.gov.in     Water Supply    Ward 1\n'
            '    W-07  anil@ichalkaranji.gov.in       Electrical      Ward 5\n'
            '    W-08  ravi@ichalkaranji.gov.in       Electrical      Ward 4\n'
            '    W-09  mahesh@ichalkaranji.gov.in     Traffic Control Ward 6\n'
            '    W-10  prakash@ichalkaranji.gov.in    Maintenance     Ward 3\n'
        ))

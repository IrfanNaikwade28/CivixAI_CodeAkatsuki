from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import RegisterSerializer, LoginSerializer, UserSerializer, UpdateProfileSerializer

User = get_user_model()


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }


@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        tokens = get_tokens_for_user(user)
        return Response({
            'user': UserSerializer(user, context={'request': request}).data,
            **tokens,
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.validated_data['user']  # type: ignore[index]
        tokens = get_tokens_for_user(user)
        return Response({
            'user': UserSerializer(user, context={'request': request}).data,
            **tokens,
        })
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(UserSerializer(request.user, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def workers_list(request):
    """Admin: list all workers with computed task stats."""
    if request.user.role != 'admin':
        return Response({'detail': 'Forbidden'}, status=403)

    from django.db.models import Count, Q, Avg
    from django.utils import timezone

    workers = User.objects.filter(role='worker').annotate(
        open_tasks=Count(
            'assigned_issues',
            filter=Q(assigned_issues__status__in=['Submitted', 'Assigned', 'In Progress'])
        ),
        completed_tasks=Count(
            'assigned_issues',
            filter=Q(assigned_issues__status__in=['Resolved', 'Closed'])
        ),
    )

    data = []
    for w in workers:
        data.append({
            'id': w.id,
            'display_id': w.display_id,
            'name': w.full_name,
            'email': w.email,
            'phone': w.phone,
            'ward': w.ward,
            'category': w.category,
            'joined_date': w.joined_date,
            'open_tasks': w.open_tasks,
            'completed_tasks': w.completed_tasks,
            'status': 'Active',
        })
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def worker_detail(request, pk):
    if request.user.role != 'admin':
        return Response({'detail': 'Forbidden'}, status=403)
    try:
        w = User.objects.get(pk=pk, role='worker')
    except User.DoesNotExist:
        return Response({'detail': 'Not found'}, status=404)

    from django.db.models import Count, Q
    stats = w.assigned_issues.aggregate(
        open_tasks=Count('id', filter=Q(status__in=['Submitted', 'Assigned', 'In Progress'])),
        completed_tasks=Count('id', filter=Q(status__in=['Resolved', 'Closed'])),
    )
    return Response({
        'id': w.id,
        'display_id': w.display_id,
        'name': w.full_name,
        'email': w.email,
        'phone': w.phone,
        'ward': w.ward,
        'category': w.category,
        'joined_date': w.joined_date,
        **stats,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    """Change the authenticated user's password.
    Body: { current_password, new_password }
    """
    current = request.data.get('current_password', '')
    new_pass = request.data.get('new_password', '')

    if not current or not new_pass:
        return Response({'detail': 'current_password and new_password are required.'}, status=400)

    if not request.user.check_password(current):
        return Response({'detail': 'Current password is incorrect.'}, status=400)

    if len(new_pass) < 4:
        return Response({'detail': 'New password must be at least 4 characters.'}, status=400)

    request.user.set_password(new_pass)
    request.user.save()
    return Response({'detail': 'Password changed successfully.'})


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_profile(request):
    """PATCH /auth/profile/ — update name, ward, gender, dob, street, landmark.
    Phone is intentionally excluded and cannot be changed.
    """
    serializer = UpdateProfileSerializer(request.user, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(UserSerializer(request.user, context={'request': request}).data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_profile_photo(request):
    """Upload or replace the authenticated user's profile photo.
    Body: multipart/form-data with field `photo`.
    """
    photo = request.FILES.get('photo')
    if not photo:
        return Response({'detail': 'No photo file provided.'}, status=400)

    user = request.user
    # Delete old file from storage if one exists
    if user.profile_photo:
        user.profile_photo.delete(save=False)

    user.profile_photo = photo
    user.save(update_fields=['profile_photo'])
    return Response(UserSerializer(user, context={'request': request}).data)


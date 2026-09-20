from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import GarbageBin
from .serializers import GarbageBinSerializer


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def bin_list(request):
    ward = request.query_params.get('ward')
    qs = GarbageBin.objects.select_related('assigned_worker').all()
    if ward:
        qs = qs.filter(ward=ward)
    return Response(GarbageBinSerializer(qs, many=True).data)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def bin_detail(request, pk):
    try:
        bin_obj = GarbageBin.objects.get(pk=pk)
    except GarbageBin.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=404)

    if request.method == 'GET':
        return Response(GarbageBinSerializer(bin_obj).data)

    # PATCH — update fill_level (simulated IoT) or assign worker (admin)
    if request.user.role != 'admin':
        # Allow IoT simulation without role check for demo
        if 'fill_level' not in request.data:
            return Response({'detail': 'Forbidden.'}, status=403)

    if 'fill_level' in request.data:
        level = int(request.data['fill_level'])
        bin_obj.fill_level = max(0, min(100, level))
    if 'assigned_worker' in request.data and request.user.role == 'admin':
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            worker = User.objects.get(pk=request.data['assigned_worker'], role='worker')
            bin_obj.assigned_worker = worker
        except User.DoesNotExist:
            return Response({'detail': 'Worker not found.'}, status=400)

    bin_obj.save()
    return Response(GarbageBinSerializer(bin_obj).data)

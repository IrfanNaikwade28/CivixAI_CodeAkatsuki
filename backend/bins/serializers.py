from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import GarbageBin

User = get_user_model()


class GarbageBinSerializer(serializers.ModelSerializer):
    status = serializers.CharField(read_only=True)
    assigned_worker_name = serializers.CharField(
        source='assigned_worker.full_name', read_only=True
    )

    class Meta:
        model = GarbageBin
        fields = [
            'id', 'bin_id', 'location_text', 'ward', 'lat', 'lng',
            'fill_level', 'capacity', 'status',
            'assigned_worker', 'assigned_worker_name',
            'last_collected',
        ]
        read_only_fields = ['id', 'bin_id', 'status', 'assigned_worker_name']
        extra_kwargs = {'assigned_worker': {'write_only': True, 'required': False}}

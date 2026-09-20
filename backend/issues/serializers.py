from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Issue, IssueComment, IssueTimeline
import re

try:
    import pluscodes as _pluscodes
    _PLUSCODES_AVAILABLE = True
except ImportError:
    _PLUSCODES_AVAILABLE = False

User = get_user_model()

# OLC short-code pattern: 2–8 uppercase chars, '+', 2–3 chars
_SHORT_CODE_RE = re.compile(r'\b([23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{2,3})\b', re.I)
_COORD_RE      = re.compile(r'([\d.]+)[°\s]*N[,\s]+([\d.]+)[°\s]*E', re.I)

# City reference coordinates for short-code recovery
_CITY_REFS = {
    'ichalkaranji': (16.6925, 74.4191),
    'rui':          (18.5000, 73.8000),
    'pune':         (18.5204, 73.8567),
    'kolhapur':     (16.7050, 74.2433),
}
_DEFAULT_REF = _CITY_REFS['ichalkaranji']


def _recover_plus_code(short_code, ref_lat, ref_lng):
    """Recover a short OLC Plus Code to lat/lng using a reference point."""
    if not _PLUSCODES_AVAILABLE:
        return None, None
    try:
        plus_idx = short_code.index('+')
        prefix_len = plus_idx
        ref_full = _pluscodes.encode(ref_lat, ref_lng, 8)
        full_code = ref_full[:prefix_len] + short_code.upper()
        area = _pluscodes.decode(full_code)
        return (area.sw.lat + area.ne.lat) / 2, (area.sw.lon + area.ne.lon) / 2
    except Exception:
        return None, None


def extract_coords_from_text(text):
    """
    Try to extract lat/lng from location_text.
    1. Explicit coordinate string: "16.6925° N, 74.4191° E"
    2. Plus Code short code: "MFJC+W82, Rajwada, Ichalkaranji"
    Returns (lat, lng) or (None, None).
    """
    if not text:
        return None, None

    # 1. Coordinate string
    m = _COORD_RE.search(text)
    if m:
        return float(m.group(1)), float(m.group(2))

    # 2. Plus Code
    m = _SHORT_CODE_RE.search(text)
    if m:
        code = m.group(1)
        low = text.lower()
        ref_lat, ref_lng = _DEFAULT_REF
        for city, coords in _CITY_REFS.items():
            if city in low:
                ref_lat, ref_lng = coords
                break
        lat, lng = _recover_plus_code(code, ref_lat, ref_lng)
        if lat is not None:
            return lat, lng

    return None, None


class AuthorSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source='full_name', read_only=True)
    profile_photo_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'display_id', 'name', 'role', 'ward', 'profile_photo_url']

    def get_profile_photo_url(self, obj):
        if not obj.profile_photo:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.profile_photo.url)
        return obj.profile_photo.url


class IssueCommentSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    user_id = serializers.IntegerField(source='user.id', read_only=True)

    class Meta:
        model = IssueComment
        fields = ['id', 'user_id', 'user_name', 'text', 'created_at']
        read_only_fields = ['id', 'user_id', 'user_name', 'created_at']


class IssueTimelineSerializer(serializers.ModelSerializer):
    class Meta:
        model = IssueTimeline
        fields = ['id', 'status', 'note', 'changed_at']


class IssueSerializer(serializers.ModelSerializer):
    reported_by_detail = AuthorSerializer(source='reported_by', read_only=True)
    assigned_to_detail = AuthorSerializer(source='assigned_to', read_only=True)
    comments = IssueCommentSerializer(many=True, read_only=True)
    timeline = IssueTimelineSerializer(many=True, read_only=True)
    image_url = serializers.SerializerMethodField()
    completion_photo_url = serializers.SerializerMethodField()
    upvoted_by_me = serializers.SerializerMethodField()

    class Meta:
        model = Issue
        fields = [
            'id', 'display_id', 'title', 'description', 'category',
            'status', 'priority', 'priority_score',
            'ward', 'location_text', 'location_lat', 'location_lng',
            'is_public', 'upvotes',
            'image', 'image_url', 'completion_photo', 'completion_photo_url',
            'ai_completion_score', 'ai_completion_verdict',
            'reported_by', 'reported_by_detail',
            'assigned_to', 'assigned_to_detail',
            'reported_at', 'assigned_at', 'resolved_at',
            'comments', 'timeline',
            'upvoted_by_me',
        ]
        read_only_fields = [
            'id', 'display_id', 'priority_score', 'upvotes',
            'ai_completion_score', 'ai_completion_verdict',
            'reported_by', 'reported_at',
        ]
        extra_kwargs = {
            'image': {'write_only': True, 'required': False},
            'completion_photo': {'write_only': True, 'required': False},
            'assigned_to': {'write_only': True, 'required': False},
        }

    def get_image_url(self, obj):
        request = self.context.get('request')
        if obj.image and request:
            return request.build_absolute_uri(obj.image.url)
        return None

    def get_completion_photo_url(self, obj):
        request = self.context.get('request')
        if obj.completion_photo and request:
            return request.build_absolute_uri(obj.completion_photo.url)
        return None

    def get_upvoted_by_me(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.upvote_records.filter(user=request.user).exists()
        return False


class IssueCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Issue
        fields = [
            'title', 'description', 'category', 'ward',
            'location_text', 'location_lat', 'location_lng',
            'is_public', 'image',
        ]

    def create(self, validated_data):
        # Auto-extract lat/lng from location_text if not explicitly provided
        if validated_data.get('location_lat') is None:
            lat, lng = extract_coords_from_text(validated_data.get('location_text', ''))
            if lat is not None:
                validated_data['location_lat'] = lat
                validated_data['location_lng'] = lng
        return super().create(validated_data)

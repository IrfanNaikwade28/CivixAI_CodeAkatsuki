from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    profile_photo_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'display_id', 'username', 'email', 'first_name', 'last_name',
            'full_name', 'role', 'ward', 'phone', 'category', 'joined_date',
            'profile_photo_url', 'gender', 'dob', 'street', 'landmark',
        ]
        read_only_fields = ['id', 'display_id', 'joined_date']

    def get_profile_photo_url(self, obj):
        if not obj.profile_photo:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.profile_photo.url)
        return obj.profile_photo.url


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=4)
    name = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['name', 'email', 'password', 'role', 'ward', 'phone', 'category']

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def create(self, validated_data):
        name = validated_data.pop('name')
        password = validated_data.pop('password')
        parts = name.strip().split(' ', 1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else ''

        user = User(
            username=validated_data['email'],
            email=validated_data['email'],
            first_name=first_name,
            last_name=last_name,
            role=validated_data.get('role', 'citizen'),
            ward=validated_data.get('ward', ''),
            phone=validated_data.get('phone', ''),
            category=validated_data.get('category', ''),
        )
        user.set_password(password)
        user.save()
        return user


class UpdateProfileSerializer(serializers.ModelSerializer):
    """PATCH /auth/profile/ — phone is excluded (immutable after registration)."""
    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'ward', 'gender', 'dob', 'street', 'landmark']


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        from django.contrib.auth import authenticate
        try:
            user = User.objects.get(email=attrs['email'])
        except User.DoesNotExist:
            raise serializers.ValidationError("Invalid email or password.")

        user = authenticate(username=user.username, password=attrs['password'])
        if not user:
            raise serializers.ValidationError("Invalid email or password.")
        if not user.is_active:
            raise serializers.ValidationError("Account is disabled.")

        attrs['user'] = user
        return attrs

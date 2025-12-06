from rest_framework import serializers
from accounts.models import User, Profile
from accounts.constants import SCREEN_IDS


class ProfileSerializer(serializers.ModelSerializer):
    permissions = serializers.ListField(
        child=serializers.ChoiceField(choices=SCREEN_IDS),
        allow_empty=True,
        required=False,
    )

    class Meta:
        model = Profile
        fields = ["id", "name", "permissions", "is_default"]
        read_only_fields = ["id", "is_default"]


class ProfileDetailSerializer(ProfileSerializer):
    class Meta(ProfileSerializer.Meta):
        fields = ["id", "name", "permissions", "is_default", "created_at"]
        read_only_fields = ["id", "is_default", "created_at"]


class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(read_only=True)
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "name", "email", "is_superuser", "profile", "permissions"]

    def get_permissions(self, obj):
        return obj.get_permissions()


class SignUpSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    is_superuser = serializers.BooleanField(required=False, default=False)
    profile_id = serializers.PrimaryKeyRelatedField(
        source="profile",
        queryset=Profile.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = User
        fields = ["id", "name", "email", "password", "is_superuser", "profile_id"]

    def create(self, validated_data):
        password = validated_data.pop("password")
        is_first_user = not User.objects.exists()
        profile = validated_data.get("profile")

        if is_first_user:
            # garante que o primeiro usuário criado possa administrar o sistema
            validated_data["is_superuser"] = True
            validated_data["profile"] = Profile.ensure_admin()
        elif not profile:
            validated_data["profile"] = Profile.ensure_default()

        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserAdminUpdateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6, required=False, allow_blank=True)
    profile_id = serializers.PrimaryKeyRelatedField(
        source="profile",
        queryset=Profile.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = User
        fields = ["id", "name", "email", "password", "is_superuser", "profile_id"]
        extra_kwargs = {
            "name": {"required": False},
            "email": {"required": False},
            "is_superuser": {"required": False},
        }

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        if not instance.profile_id:
            instance.profile = Profile.ensure_default()
        instance.save()
        return instance

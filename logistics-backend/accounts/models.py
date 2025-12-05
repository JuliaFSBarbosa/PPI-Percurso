from django.db import models
from django.contrib.auth.models import BaseUserManager, AbstractBaseUser
from accounts.constants import (
    SCREEN_IDS,
    SCREEN_DEFINITIONS,
    DEFAULT_PROFILE_NAME,
    DEFAULT_PROFILE_PERMISSIONS,
    ADMIN_PROFILE_NAME,
    ADMIN_PROFILE_PERMISSIONS,
)


def sanitize_permissions(values):
    if not values:
        return []
    sanitized = []
    for value in values:
        if value in SCREEN_IDS and value not in sanitized:
            sanitized.append(value)
    return sanitized


class Profile(models.Model):
    name = models.CharField(max_length=80, unique=True)
    permissions = models.JSONField(default=list, blank=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        db_table = "user_profiles"

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        self.permissions = sanitize_permissions(self.permissions or [])
        super().save(*args, **kwargs)
        if self.is_default:
            Profile.objects.exclude(pk=self.pk).filter(is_default=True).update(is_default=False)

    @classmethod
    def ensure_default(cls):
        profile, _ = cls.objects.get_or_create(
            name=DEFAULT_PROFILE_NAME,
            defaults={
                "permissions": DEFAULT_PROFILE_PERMISSIONS,
                "is_default": True,
            },
        )
        updated = False
        if profile.permissions != DEFAULT_PROFILE_PERMISSIONS:
            profile.permissions = DEFAULT_PROFILE_PERMISSIONS
            updated = True
        if not profile.is_default:
            profile.is_default = True
            updated = True
        if updated:
            profile.save()
        return profile

    @classmethod
    def ensure_admin(cls):
        profile, created = cls.objects.get_or_create(
            name=ADMIN_PROFILE_NAME,
            defaults={
                "permissions": ADMIN_PROFILE_PERMISSIONS,
                "is_default": False,
            },
        )
        updated = False
        if profile.permissions != ADMIN_PROFILE_PERMISSIONS:
            profile.permissions = ADMIN_PROFILE_PERMISSIONS
            updated = True
        if profile.is_default:
            profile.is_default = False
            updated = True
        if updated:
            profile.save()
        return profile

    def get_permission_labels(self):
        labels = []
        for permission in self.permissions:
            screen = next((item for item in SCREEN_DEFINITIONS if item["id"] == permission), None)
            if screen:
                labels.append(screen["label"])
        return labels

class UserManager(BaseUserManager):
    def create_superuser(self, email, password):
        user = self.model(
            email=self.normalize_email(email)
        )
        
        user.set_password(password)
        user.is_superuser = True
        user.save(using=self._db)
        
        if not user.profile_id:
            user.profile = Profile.ensure_default()
            user.save(using=self._db)
        
        return user
    
class User(AbstractBaseUser):
    name = models.CharField(max_length=80)
    email = models.EmailField(unique=True)
    is_superuser = models.BooleanField(default=False)
    profile = models.ForeignKey(Profile, on_delete=models.SET_NULL, related_name="users", null=True, blank=True)
    
    objects = UserManager()
    
    USERNAME_FIELD = 'email'

    def get_permissions(self):
        if self.is_superuser:
            return SCREEN_IDS
        if self.profile and isinstance(self.profile.permissions, list):
            return self.profile.permissions
        return []
    
    def has_perm(self, perm, obj=None):
        return True
    
    def has_module_perms(self, app_Label):
        return True
    
    @property
    def is_staff(self):
        return self.is_superuser
    
    class Meta: 
        db_table = 'users'

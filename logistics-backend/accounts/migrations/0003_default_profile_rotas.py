from django.db import migrations

import accounts.constants as constants


def enforce_default_permissions(apps, schema_editor):
    Profile = apps.get_model('accounts', 'Profile')
    User = apps.get_model('accounts', 'User')
    default_profiles = Profile.objects.filter(is_default=True)
    if not default_profiles.exists():
        profile = Profile.objects.create(
            name=constants.DEFAULT_PROFILE_NAME,
            permissions=constants.DEFAULT_PROFILE_PERMISSIONS,
            is_default=True,
        )
        User.objects.filter(profile__isnull=True).update(profile_id=profile.id)
        return

    for profile in default_profiles:
        profile.permissions = constants.DEFAULT_PROFILE_PERMISSIONS
        profile.save()


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_profile'),
    ]

    operations = [
        migrations.RunPython(enforce_default_permissions, migrations.RunPython.noop),
    ]

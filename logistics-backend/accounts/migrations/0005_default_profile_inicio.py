from django.db import migrations
import accounts.constants as constants


def add_inicio_permission(apps, schema_editor):
    Profile = apps.get_model('accounts', 'Profile')
    profiles = Profile.objects.filter(name=constants.DEFAULT_PROFILE_NAME)
    for profile in profiles:
        permissions = set(profile.permissions or [])
        updated = False
        for perm in constants.DEFAULT_PROFILE_PERMISSIONS:
            if perm not in permissions:
                permissions.add(perm)
                updated = True
        if updated:
            profile.permissions = list(permissions)
            profile.save()


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0004_admin_profile'),
    ]

    operations = [
        migrations.RunPython(add_inicio_permission, migrations.RunPython.noop),
    ]

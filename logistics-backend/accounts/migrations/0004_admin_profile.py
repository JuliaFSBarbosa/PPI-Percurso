from django.db import migrations
import accounts.constants as constants


def create_admin_profile(apps, schema_editor):
    Profile = apps.get_model('accounts', 'Profile')
    profile, created = Profile.objects.get_or_create(
        name=constants.ADMIN_PROFILE_NAME,
        defaults={
            'permissions': constants.ADMIN_PROFILE_PERMISSIONS,
            'is_default': False,
        }
    )
    if not created:
        profile.permissions = constants.ADMIN_PROFILE_PERMISSIONS
        profile.is_default = False
        profile.save()


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_default_profile_rotas'),
    ]

    operations = [
        migrations.RunPython(create_admin_profile, migrations.RunPython.noop),
    ]

from django.db import migrations, models
import django.db.models.deletion

import accounts.constants as constants


def create_default_profile(apps, schema_editor):
    Profile = apps.get_model('accounts', 'Profile')
    Profile.objects.update_or_create(
        name=constants.DEFAULT_PROFILE_NAME,
        defaults={
            'permissions': constants.DEFAULT_PROFILE_PERMISSIONS,
            'is_default': True,
        }
    )


def assign_default_profile(apps, schema_editor):
    Profile = apps.get_model('accounts', 'Profile')
    User = apps.get_model('accounts', 'User')
    default_profile = Profile.objects.filter(is_default=True).first()
    if default_profile is None:
        default_profile = Profile.objects.create(
            name=constants.DEFAULT_PROFILE_NAME,
            permissions=constants.DEFAULT_PROFILE_PERMISSIONS,
            is_default=True,
        )
    User.objects.filter(profile__isnull=True).update(profile_id=default_profile.id)


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Profile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=80, unique=True)),
                ('permissions', models.JSONField(blank=True, default=list)),
                ('is_default', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['name'],
                'db_table': 'user_profiles',
            },
        ),
        migrations.AddField(
            model_name='user',
            name='profile',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='users', to='accounts.profile'),
        ),
        migrations.RunPython(create_default_profile, migrations.RunPython.noop),
        migrations.RunPython(assign_default_profile, migrations.RunPython.noop),
    ]

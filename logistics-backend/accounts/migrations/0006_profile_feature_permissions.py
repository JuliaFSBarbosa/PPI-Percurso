from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0005_default_profile_inicio"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="feature_permissions",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]

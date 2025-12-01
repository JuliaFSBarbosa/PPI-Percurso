from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('logistics', '0002_pedido_cliente_restricaofamilia'),
    ]

    operations = [
        migrations.AddField(
            model_name='pedido',
            name='cidade',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AddField(
            model_name='pedido',
            name='endereco_cidade',
            field=models.CharField(blank=True, default='', max_length=150),
        ),
        migrations.AddField(
            model_name='pedido',
            name='endereco',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='pedido',
            name='endereco_resumido',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
    ]

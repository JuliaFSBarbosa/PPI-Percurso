from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('logistics', '0003_pedido_cidade_campos_endereco'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='pedido',
            name='endereco',
        ),
        migrations.RemoveField(
            model_name='pedido',
            name='endereco_cidade',
        ),
        migrations.RemoveField(
            model_name='pedido',
            name='endereco_resumido',
        ),
    ]

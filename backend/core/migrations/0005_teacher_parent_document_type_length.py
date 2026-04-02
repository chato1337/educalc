from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0004_student_bulk_load_fields"),
    ]

    operations = [
        migrations.AlterField(
            model_name="teacher",
            name="document_type",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
        migrations.AlterField(
            model_name="parent",
            name="document_type",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
    ]

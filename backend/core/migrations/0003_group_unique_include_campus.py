# Generated manually for bulk load: groups per campus

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0002_add_phase_2_to_5_models"),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name="group",
            unique_together={("grade_level", "academic_year", "campus", "name")},
        ),
    ]

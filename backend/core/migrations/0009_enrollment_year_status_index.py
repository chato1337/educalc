from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0008_courseassignment_teacher_year_index"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="enrollment",
            index=models.Index(
                fields=["academic_year", "status"],
                name="core_enroll_year_status_idx",
            ),
        ),
    ]

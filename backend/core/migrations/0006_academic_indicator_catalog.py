import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0005_teacher_parent_document_type_length"),
    ]

    operations = [
        migrations.CreateModel(
            name="AcademicIndicatorCatalog",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("achievement_below_basic", models.TextField()),
                ("achievement_basic_or_above", models.TextField()),
                (
                    "academic_area",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="indicator_catalogs",
                        to="core.academicarea",
                    ),
                ),
                (
                    "grade_level",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="indicator_catalogs",
                        to="core.gradelevel",
                    ),
                ),
            ],
            options={
                "verbose_name": "Academic Indicator Catalog",
                "verbose_name_plural": "Academic Indicator Catalogs",
                "ordering": [
                    "academic_area__name",
                    "grade_level__level_order",
                    "grade_level__name",
                ],
                "unique_together": {("academic_area", "grade_level")},
            },
        ),
        migrations.AddField(
            model_name="academicindicator",
            name="catalog",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="student_indicators",
                to="core.academicindicatorcatalog",
            ),
        ),
        migrations.AddField(
            model_name="academicindicator",
            name="outcome",
            field=models.CharField(
                blank=True,
                choices=[
                    ("below_basic", "Bajo (por debajo del umbral de Básico)"),
                    ("basic_or_above", "Básico o superior"),
                ],
                max_length=20,
            ),
        ),
    ]

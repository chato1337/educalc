from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0011_subject_component_catalog"),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name="academicindicatorcatalog",
            unique_together=set(),
        ),
        migrations.AddField(
            model_name="academicindicatorcatalog",
            name="period_number",
            field=models.PositiveSmallIntegerField(
                blank=True,
                help_text="Número de periodo (1–4). Vacío = plantilla genérica para todos.",
                null=True,
            ),
        ),
        migrations.AlterModelOptions(
            name="academicindicatorcatalog",
            options={
                "ordering": [
                    "academic_area__name",
                    "grade_level__level_order",
                    "grade_level__name",
                    "period_number",
                ],
                "verbose_name": "Academic Indicator Catalog",
                "verbose_name_plural": "Academic Indicator Catalogs",
            },
        ),
        migrations.AddConstraint(
            model_name="academicindicatorcatalog",
            constraint=models.UniqueConstraint(
                condition=models.Q(("period_number__isnull", False)),
                fields=("academic_area", "grade_level", "period_number"),
                name="uniq_indicator_catalog_area_grade_period",
            ),
        ),
        migrations.AddConstraint(
            model_name="academicindicatorcatalog",
            constraint=models.UniqueConstraint(
                condition=models.Q(("period_number__isnull", True)),
                fields=("academic_area", "grade_level"),
                name="uniq_indicator_catalog_area_grade_generic",
            ),
        ),
    ]

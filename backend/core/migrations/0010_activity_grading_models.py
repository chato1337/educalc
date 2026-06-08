import uuid
from decimal import Decimal

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0009_enrollment_year_status_index"),
    ]

    operations = [
        migrations.CreateModel(
            name="GradingScheme",
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
                ("is_active", models.BooleanField(default=True)),
                (
                    "academic_period",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="grading_schemes",
                        to="core.academicperiod",
                    ),
                ),
                (
                    "course_assignment",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="grading_schemes",
                        to="core.courseassignment",
                    ),
                ),
            ],
            options={
                "verbose_name": "Grading Scheme",
                "verbose_name_plural": "Grading Schemes",
                "ordering": [
                    "course_assignment__academic_year__year",
                    "academic_period__number",
                    "course_assignment__subject__name",
                ],
                "unique_together": {("course_assignment", "academic_period")},
            },
        ),
        migrations.CreateModel(
            name="SubjectComponent",
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
                ("name", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                (
                    "weight_percent",
                    models.DecimalField(decimal_places=2, max_digits=5),
                ),
                ("sort_order", models.PositiveSmallIntegerField(default=0)),
                (
                    "grading_scheme",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="components",
                        to="core.gradingscheme",
                    ),
                ),
            ],
            options={
                "verbose_name": "Subject Component",
                "verbose_name_plural": "Subject Components",
                "ordering": ["sort_order", "name"],
            },
        ),
        migrations.CreateModel(
            name="ComponentSegment",
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
                ("name", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                (
                    "weight_percent",
                    models.DecimalField(decimal_places=2, max_digits=5),
                ),
                ("sort_order", models.PositiveSmallIntegerField(default=0)),
                (
                    "component",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="segments",
                        to="core.subjectcomponent",
                    ),
                ),
            ],
            options={
                "verbose_name": "Component Segment",
                "verbose_name_plural": "Component Segments",
                "ordering": ["sort_order", "name"],
            },
        ),
        migrations.CreateModel(
            name="GradingActivity",
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
                ("name", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("activity_date", models.DateField()),
                (
                    "max_score",
                    models.DecimalField(
                        decimal_places=2,
                        default=Decimal("5.00"),
                        max_digits=4,
                    ),
                ),
                ("sort_order", models.PositiveSmallIntegerField(default=0)),
                (
                    "segment",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="activities",
                        to="core.componentsegment",
                    ),
                ),
            ],
            options={
                "verbose_name": "Grading Activity",
                "verbose_name_plural": "Grading Activities",
                "ordering": ["activity_date", "sort_order", "name"],
            },
        ),
        migrations.CreateModel(
            name="StudentActivityScore",
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
                (
                    "score",
                    models.DecimalField(decimal_places=2, max_digits=4),
                ),
                ("notes", models.TextField(blank=True)),
                (
                    "activity",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="student_scores",
                        to="core.gradingactivity",
                    ),
                ),
                (
                    "student",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="activity_scores",
                        to="core.student",
                    ),
                ),
            ],
            options={
                "verbose_name": "Student Activity Score",
                "verbose_name_plural": "Student Activity Scores",
                "ordering": ["student__full_name", "activity__activity_date"],
                "unique_together": {("activity", "student")},
            },
        ),
    ]

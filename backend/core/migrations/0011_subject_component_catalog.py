import uuid

import django.db.models.deletion
from django.db import migrations, models


def migrate_components_to_subject(apps, schema_editor):
    SubjectComponent = apps.get_model("core", "SubjectComponent")
    for component in SubjectComponent.objects.select_related(
        "grading_scheme__course_assignment"
    ).iterator():
        component.subject_id = component.grading_scheme.course_assignment.subject_id
        component.save(update_fields=["subject_id"])


def migrate_segments_to_scheme(apps, schema_editor):
    ComponentSegment = apps.get_model("core", "ComponentSegment")
    for segment in ComponentSegment.objects.select_related(
        "component__grading_scheme"
    ).iterator():
        segment.subject_component_id = segment.component_id
        segment.grading_scheme_id = segment.component.grading_scheme_id
        segment.save(update_fields=["subject_component_id", "grading_scheme_id"])


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0010_activity_grading_models"),
    ]

    operations = [
        migrations.AddField(
            model_name="subjectcomponent",
            name="subject",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="grading_components",
                to="core.subject",
            ),
        ),
        migrations.RunPython(
            migrate_components_to_subject,
            migrations.RunPython.noop,
        ),
        migrations.AddField(
            model_name="componentsegment",
            name="grading_scheme",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="segments",
                to="core.gradingscheme",
            ),
        ),
        migrations.AddField(
            model_name="componentsegment",
            name="subject_component",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="segments",
                to="core.subjectcomponent",
            ),
        ),
        migrations.RunPython(
            migrate_segments_to_scheme,
            migrations.RunPython.noop,
        ),
        migrations.RemoveField(
            model_name="componentsegment",
            name="component",
        ),
        migrations.RemoveField(
            model_name="subjectcomponent",
            name="grading_scheme",
        ),
        migrations.AlterField(
            model_name="subjectcomponent",
            name="subject",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="grading_components",
                to="core.subject",
            ),
        ),
        migrations.AlterField(
            model_name="componentsegment",
            name="grading_scheme",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="segments",
                to="core.gradingscheme",
            ),
        ),
        migrations.AlterField(
            model_name="componentsegment",
            name="subject_component",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="segments",
                to="core.subjectcomponent",
            ),
        ),
        migrations.AlterField(
            model_name="studentactivityscore",
            name="score",
            field=models.DecimalField(
                blank=True, decimal_places=2, max_digits=4, null=True
            ),
        ),
    ]

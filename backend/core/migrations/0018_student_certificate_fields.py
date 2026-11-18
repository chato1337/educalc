from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0017_institution_bulletin_logos"),
    ]

    operations = [
        migrations.AddField(
            model_name="institution",
            name="certificate_subtitle",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Second name printed under the institution on the student certificate.",
                max_length=255,
            ),
        ),
        migrations.AddField(
            model_name="institution",
            name="certificate_authorization",
            field=models.TextField(
                blank=True,
                default="",
                help_text="Authorization paragraph on the student certificate.",
            ),
        ),
        migrations.AddField(
            model_name="institution",
            name="rector_name",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="institution",
            name="rector_document_number",
            field=models.CharField(blank=True, default="", max_length=40),
        ),
        migrations.AddField(
            model_name="institution",
            name="secretary_name",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="institution",
            name="secretary_document_number",
            field=models.CharField(blank=True, default="", max_length=40),
        ),
        migrations.AddField(
            model_name="institution",
            name="rector_signature_url",
            field=models.URLField(
                blank=True,
                default="",
                help_text="Public URL of the rector signature on the student certificate.",
                max_length=500,
            ),
        ),
        migrations.AddField(
            model_name="institution",
            name="secretary_signature_url",
            field=models.URLField(
                blank=True,
                default="",
                help_text="Public URL of the secretary signature on the student certificate.",
                max_length=500,
            ),
        ),
        migrations.AddField(
            model_name="campus",
            name="locality",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Vereda or neighborhood printed on the student certificate.",
                max_length=150,
            ),
        ),
        migrations.AddField(
            model_name="campus",
            name="municipality",
            field=models.CharField(blank=True, default="", max_length=150),
        ),
        migrations.AddField(
            model_name="campus",
            name="department",
            field=models.CharField(blank=True, default="", max_length=150),
        ),
    ]

from django.db import migrations


def migrate_generic_catalogs_to_period_1(apps, schema_editor):
    """
    Convierte plantillas genéricas (period_number=NULL) a P1.

    Si ya existe P1 para el mismo área+grado, reasigna AcademicIndicator y
    elimina la fila genérica duplicada.
    """
    AcademicIndicatorCatalog = apps.get_model("core", "AcademicIndicatorCatalog")
    AcademicIndicator = apps.get_model("core", "AcademicIndicator")

    for cat in AcademicIndicatorCatalog.objects.filter(period_number__isnull=True):
        existing_p1 = AcademicIndicatorCatalog.objects.filter(
            academic_area_id=cat.academic_area_id,
            grade_level_id=cat.grade_level_id,
            period_number=1,
        ).first()
        if existing_p1:
            AcademicIndicator.objects.filter(catalog_id=cat.id).update(
                catalog_id=existing_p1.id
            )
            cat.delete()
        else:
            cat.period_number = 1
            cat.save(update_fields=["period_number"])


class Migration(migrations.Migration):
    """
    Migración de datos legacy → P1.

    RunPython deshabilitado intencionalmente: en un ambiente fresco las
    plantillas pueden crearse ya con periodo (UI/CSV) o permanecer genéricas
    (period_number=NULL) sin normalización automática.

    Para migrar un entorno existente con plantillas antiguas sin periodo,
    descomenta RunPython en ``operations`` o invoca
    ``migrate_generic_catalogs_to_period_1`` desde ``manage.py shell``.
    """

    dependencies = [
        ("core", "0012_academic_indicator_catalog_period"),
    ]

    operations = [
        # Solo para entornos con plantillas legacy (period_number=NULL).
        # migrations.RunPython(
        #     migrate_generic_catalogs_to_period_1,
        #     migrations.RunPython.noop,
        # ),
    ]

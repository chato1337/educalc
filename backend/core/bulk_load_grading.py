"""
Bulk CSV loaders for activity-based grading (GradingScheme hierarchy and scores).

Column contracts align with docs/bulk_load_grading_structure.csv and
docs/bulk_load_student_activity_scores.csv.
"""
from decimal import Decimal

from django.core.exceptions import ValidationError

from .bulk_load_extended import (
    _empty_stats,
    _resolve_course_assignment,
    _resolve_period,
)
from .bulk_load_utils import clean_str, open_csv_dict_reader, parse_date, parse_decimal, parse_int, row_col
from .models import (
    ComponentSegment,
    Enrollment,
    GradingActivity,
    GradingScheme,
    Student,
    StudentActivityScore,
    SubjectComponent,
)


def _resolve_grading_scheme(row, col, row_num, stats):
    resolved = _resolve_course_assignment(row, col, row_num, stats)
    if not resolved:
        return None
    ca, _group, ay, institution = resolved
    pnum = parse_int(col(row, ["PERIODO_NUM", "periodo_num"]))
    if pnum is None:
        stats["errors"].append(
            {"row": row_num, "error": "PERIODO_NUM es obligatorio."}
        )
        return None
    ap = _resolve_period(institution, ay.year, pnum, row_num, stats)
    if not ap:
        return None
    return ca, ap, institution


def _get_or_create_scheme(ca, ap, stats, row_num):
    scheme, created = GradingScheme.objects.get_or_create(
        course_assignment=ca,
        academic_period=ap,
        defaults={"is_active": True},
    )
    if created:
        stats["schemes_created"] += 1
    return scheme


def _resolve_component(subject, row, col, row_num, stats, create=False):
    name = clean_str(col(row, ["COMPONENTE_NOMBRE", "componente_nombre"]))
    if not name:
        stats["errors"].append(
            {"row": row_num, "error": "COMPONENTE_NOMBRE es obligatorio."}
        )
        return None
    component = SubjectComponent.objects.filter(
        subject=subject, name__iexact=name
    ).first()
    if component:
        return component
    if not create:
        stats["errors"].append(
            {
                "row": row_num,
                "error": f"Componente no encontrado: {name}",
            }
        )
        return None
    weight = parse_decimal(
        col(row, ["COMPONENTE_PESO", "componente_peso", "COMPONENTE_PORCENTAJE"])
    )
    if weight is None:
        stats["errors"].append(
            {"row": row_num, "error": "COMPONENTE_PESO es obligatorio al crear componente."}
        )
        return None
    sort_order = parse_int(col(row, ["COMPONENTE_ORDEN", "componente_orden"])) or 0
    component = SubjectComponent.objects.create(
        subject=subject,
        name=name,
        description=clean_str(
            col(row, ["COMPONENTE_DESCRIPCION", "componente_descripcion"])
        ),
        weight_percent=weight,
        sort_order=sort_order,
    )
    stats["components_created"] += 1
    return component


def _resolve_segment(scheme, subject_component, row, col, row_num, stats, create=False):
    name = clean_str(col(row, ["SEGMENTO_NOMBRE", "segmento_nombre"]))
    if not name:
        stats["errors"].append(
            {"row": row_num, "error": "SEGMENTO_NOMBRE es obligatorio."}
        )
        return None
    segment = ComponentSegment.objects.filter(
        grading_scheme=scheme,
        subject_component=subject_component,
        name__iexact=name,
    ).first()
    if segment:
        return segment
    if not create:
        stats["errors"].append(
            {"row": row_num, "error": f"Segmento no encontrado: {name}"}
        )
        return None
    weight = parse_decimal(
        col(row, ["SEGMENTO_PESO", "segmento_peso", "SEGMENTO_PORCENTAJE"])
    )
    if weight is None:
        stats["errors"].append(
            {"row": row_num, "error": "SEGMENTO_PESO es obligatorio al crear segmento."}
        )
        return None
    sort_order = parse_int(col(row, ["SEGMENTO_ORDEN", "segmento_orden"])) or 0
    segment = ComponentSegment.objects.create(
        grading_scheme=scheme,
        subject_component=subject_component,
        name=name,
        description=clean_str(
            col(row, ["SEGMENTO_DESCRIPCION", "segmento_descripcion"])
        ),
        weight_percent=weight,
        sort_order=sort_order,
    )
    stats["segments_created"] += 1
    return segment


def _resolve_activity(segment, row, col, row_num, stats, create=False):
    name = clean_str(col(row, ["ACTIVIDAD_NOMBRE", "actividad_nombre"]))
    if not name:
        stats["errors"].append(
            {"row": row_num, "error": "ACTIVIDAD_NOMBRE es obligatorio."}
        )
        return None
    activity_date = parse_date(
        col(row, ["ACTIVIDAD_FECHA", "actividad_fecha", "FECHA_ACTIVIDAD"])
    )
    qs = GradingActivity.objects.filter(segment=segment, name__iexact=name)
    if activity_date:
        qs = qs.filter(activity_date=activity_date)
    activity = qs.first()
    if activity:
        return activity
    if not create:
        stats["errors"].append(
            {"row": row_num, "error": f"Actividad no encontrada: {name}"}
        )
        return None
    if not activity_date:
        stats["errors"].append(
            {"row": row_num, "error": "ACTIVIDAD_FECHA es obligatoria al crear actividad."}
        )
        return None
    max_score = parse_decimal(
        col(row, ["NOTA_MAXIMA", "nota_maxima", "ACTIVIDAD_NOTA_MAX"])
    ) or Decimal("5.00")
    sort_order = parse_int(col(row, ["ACTIVIDAD_ORDEN", "actividad_orden"])) or 0
    activity = GradingActivity.objects.create(
        segment=segment,
        name=name,
        description=clean_str(
            col(row, ["ACTIVIDAD_DESCRIPCION", "actividad_descripcion"])
        ),
        activity_date=activity_date,
        max_score=max_score,
        sort_order=sort_order,
    )
    stats["activities_created"] += 1
    return activity


def _update_structure_weights(component, segment, row, col, stats):
    comp_weight = parse_decimal(
        col(row, ["COMPONENTE_PESO", "componente_peso", "COMPONENTE_PORCENTAJE"])
    )
    if comp_weight is not None and component.weight_percent != comp_weight:
        component.weight_percent = comp_weight
        component.save(update_fields=["weight_percent", "updated_at"])
        stats["components_updated"] += 1
    seg_weight = parse_decimal(
        col(row, ["SEGMENTO_PESO", "segmento_peso", "SEGMENTO_PORCENTAJE"])
    )
    if seg_weight is not None and segment.weight_percent != seg_weight:
        segment.weight_percent = seg_weight
        segment.save(update_fields=["weight_percent", "updated_at"])
        stats["segments_updated"] += 1


def bulk_load_grading_structure(csv_file):
    """
    Columns: DANE_COD, ANO, SEDE, GRADO, GRUPO, ASIGNATURA_NOMBRE, ENFASIS (optional),
    AREA_NOMBRE (optional), DOC_DOCENTE (optional), PERIODO_NUM,
    COMPONENTE_NOMBRE, COMPONENTE_PESO, COMPONENTE_ORDEN (optional),
    SEGMENTO_NOMBRE, SEGMENTO_PESO, SEGMENTO_ORDEN (optional),
    ACTIVIDAD_NOMBRE, ACTIVIDAD_FECHA, NOTA_MAXIMA (optional),
    ACTIVIDAD_DESCRIPCION (optional), ACTIVIDAD_ORDEN (optional).
    """
    col = row_col
    stats = _empty_stats(
        [
            "rows_processed",
            "rows_skipped",
            "schemes_created",
            "components_created",
            "components_updated",
            "segments_created",
            "segments_updated",
            "activities_created",
            "activities_updated",
        ]
    )
    stats["errors"] = []
    reader = open_csv_dict_reader(csv_file)
    for row_num, row in enumerate(reader, start=2):
        try:
            resolved = _resolve_grading_scheme(row, col, row_num, stats)
            if not resolved:
                stats["rows_skipped"] += 1
                continue
            ca, ap, _institution = resolved
            scheme = _get_or_create_scheme(ca, ap, stats, row_num)
            component = _resolve_component(
                ca.subject, row, col, row_num, stats, create=True
            )
            if not component:
                stats["rows_skipped"] += 1
                continue
            segment = _resolve_segment(
                scheme, component, row, col, row_num, stats, create=True
            )
            if not segment:
                stats["rows_skipped"] += 1
                continue
            _update_structure_weights(component, segment, row, col, stats)
            existing_activity = GradingActivity.objects.filter(
                segment=segment,
                name__iexact=clean_str(
                    col(row, ["ACTIVIDAD_NOMBRE", "actividad_nombre"])
                ),
            ).first()
            activity = _resolve_activity(
                segment, row, col, row_num, stats, create=True
            )
            if not activity:
                stats["rows_skipped"] += 1
                continue
            if existing_activity and existing_activity.id == activity.id:
                max_score = parse_decimal(
                    col(row, ["NOTA_MAXIMA", "nota_maxima", "ACTIVIDAD_NOTA_MAX"])
                )
                description = clean_str(
                    col(row, ["ACTIVIDAD_DESCRIPCION", "actividad_descripcion"])
                )
                changed = False
                if max_score is not None and activity.max_score != max_score:
                    activity.max_score = max_score
                    changed = True
                if description and activity.description != description:
                    activity.description = description
                    changed = True
                if changed:
                    activity.save()
                    stats["activities_updated"] += 1
            stats["rows_processed"] += 1
        except Exception as e:
            stats["errors"].append({"row": row_num, "error": str(e)})
    return stats


def _student_enrolled_in_course(student, ca):
    return Enrollment.objects.filter(
        student=student,
        group_id=ca.group_id,
        academic_year_id=ca.academic_year_id,
        status="active",
    ).exists()


def bulk_load_student_activity_scores(csv_file):
    """
    Columns: DOC_ESTUDIANTE, DANE_COD, ANO, SEDE, GRADO, GRUPO, ASIGNATURA_NOMBRE,
    ENFASIS (optional), AREA_NOMBRE (optional), DOC_DOCENTE (optional), PERIODO_NUM,
    COMPONENTE_NOMBRE, SEGMENTO_NOMBRE, ACTIVIDAD_NOMBRE,
    ACTIVIDAD_FECHA (optional), NOTA, OBSERVACIONES (optional).
    Requires existing GradingScheme and activities (use grading-structure bulk first).
    Does not modify Grade records.
    """
    col = row_col
    stats = _empty_stats(["rows_processed", "rows_skipped", "created", "updated"])
    stats["errors"] = []
    reader = open_csv_dict_reader(csv_file)
    for row_num, row in enumerate(reader, start=2):
        try:
            sdoc = clean_str(col(row, ["DOC_ESTUDIANTE", "doc_estudiante"]))
            nota = parse_decimal(col(row, ["NOTA", "nota"]))
            if not sdoc or nota is None:
                stats["rows_skipped"] += 1
                continue
            student = Student.objects.filter(document_number=sdoc).first()
            if not student:
                stats["errors"].append(
                    {"row": row_num, "error": f"Estudiante no encontrado DOC={sdoc}"}
                )
                stats["rows_skipped"] += 1
                continue
            resolved = _resolve_grading_scheme(row, col, row_num, stats)
            if not resolved:
                stats["rows_skipped"] += 1
                continue
            ca, ap, _institution = resolved
            if not _student_enrolled_in_course(student, ca):
                stats["errors"].append(
                    {
                        "row": row_num,
                        "error": (
                            f"Estudiante {sdoc} no matriculado activamente en el grupo."
                        ),
                    }
                )
                stats["rows_skipped"] += 1
                continue
            scheme = GradingScheme.objects.filter(
                course_assignment=ca, academic_period=ap
            ).first()
            if not scheme:
                stats["errors"].append(
                    {
                        "row": row_num,
                        "error": "Esquema de calificación no encontrado; cargue estructura primero.",
                    }
                )
                stats["rows_skipped"] += 1
                continue
            component = _resolve_component(
                ca.subject, row, col, row_num, stats, create=False
            )
            if not component:
                stats["rows_skipped"] += 1
                continue
            segment = _resolve_segment(
                scheme, component, row, col, row_num, stats, create=False
            )
            if not segment:
                stats["rows_skipped"] += 1
                continue
            activity = _resolve_activity(
                segment, row, col, row_num, stats, create=False
            )
            if not activity:
                stats["rows_skipped"] += 1
                continue
            if nota < 0 or nota > activity.max_score:
                stats["errors"].append(
                    {
                        "row": row_num,
                        "error": (
                            f"NOTA debe estar entre 0 y {activity.max_score}."
                        ),
                    }
                )
                stats["rows_skipped"] += 1
                continue
            notes = clean_str(
                col(row, ["OBSERVACIONES", "observaciones", "NOTAS", "notas"])
            )
            obj, created = StudentActivityScore.objects.get_or_create(
                activity=activity,
                student=student,
                defaults={"score": nota, "notes": notes},
            )
            if created:
                stats["created"] += 1
            else:
                obj.score = nota
                if notes:
                    obj.notes = notes
                obj.save(update_fields=["score", "notes", "updated_at"])
                stats["updated"] += 1
            stats["rows_processed"] += 1
        except ValidationError as e:
            messages = e.messages if hasattr(e, "messages") else [str(e)]
            stats["errors"].append(
                {"row": row_num, "error": messages[0] if messages else str(e)}
            )
            stats["rows_skipped"] += 1
        except Exception as e:
            stats["errors"].append({"row": row_num, "error": str(e)})
    return stats

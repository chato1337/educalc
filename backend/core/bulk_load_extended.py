"""
Extended bulk CSV loaders. Column names align with docs/plan-implementacion-carga-masiva-csv.md.
"""
import logging
import unicodedata

from django.contrib.auth import get_user_model

from .bulk_load_utils import (
    bool_from_cell,
    clean_str,
    compose_full_name,
    find_subject,
    get_academic_year,
    get_group_by_context,
    get_institution_by_dane,
    get_or_create_subject_for_course_assignment,
    open_csv_dict_reader,
    parent_synthetic_email,
    parse_date,
    parse_decimal,
    parse_int,
    row_col,
)
from .models import (
    AcademicArea,
    AcademicIndicator,
    AcademicPeriod,
    Attendance,
    CourseAssignment,
    DisciplinaryReport,
    Grade,
    GradeDirector,
    GradingScale,
    Parent,
    PerformanceSummary,
    Student,
    StudentGuardian,
    Subject,
    Teacher,
    UserProfile,
)

logger = logging.getLogger(__name__)
User = get_user_model()


def _empty_stats(keys):
    return {k: 0 for k in keys}


def _normalize_username_token(value):
    """Normalize names to ASCII lowercase token safe for usernames."""
    text = clean_str(value)
    if not text:
        return ""
    normalized = unicodedata.normalize("NFKD", text)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    cleaned = "".join(ch for ch in ascii_text.lower() if ch.isalnum())
    return cleaned


def _build_teacher_username(first_name, first_last_name, document_number):
    first = _normalize_username_token(first_name)
    last = _normalize_username_token(first_last_name)
    base = f"{first}.{last}" if first and last else ""
    if not base:
        base = f"doc.{clean_str(document_number) or 'teacher'}"
    return base


def _next_available_username(base_username):
    username = base_username
    suffix = 0
    while User.objects.filter(username=username).exists():
        suffix += 1
        username = f"{base_username}{suffix}"
    return username


def bulk_load_academic_areas(csv_file):
    col = row_col
    stats = _empty_stats(
        ["rows_processed", "rows_skipped", "created", "updated"]
    )
    stats["errors"] = []
    reader = open_csv_dict_reader(csv_file)
    for row_num, row in enumerate(reader, start=2):
        try:
            dane = clean_str(col(row, ["DANE_COD", "dane_cod"]))
            name = clean_str(col(row, ["AREA_NOMBRE", "area_nombre"]))
            if not dane or not name:
                stats["rows_skipped"] += 1
                continue
            institution = get_institution_by_dane(dane)
            if not institution:
                stats["errors"].append(
                    {"row": row_num, "error": f"Institution not found for DANE_COD={dane}"}
                )
                stats["rows_skipped"] += 1
                continue
            code = clean_str(col(row, ["AREA_COD", "area_cod"]))
            desc = clean_str(col(row, ["DESCRIPCION", "descripcion"]))
            obj, created = AcademicArea.objects.get_or_create(
                institution=institution,
                name=name,
                defaults={"code": code, "description": desc},
            )
            if created:
                stats["created"] += 1
            else:
                if code:
                    obj.code = code
                if desc:
                    obj.description = desc
                obj.save()
                stats["updated"] += 1
            stats["rows_processed"] += 1
        except Exception as e:
            stats["errors"].append({"row": row_num, "error": str(e)})
    return stats


def bulk_load_grading_scales(csv_file):
    col = row_col
    stats = _empty_stats(["rows_processed", "rows_skipped", "created", "updated"])
    stats["errors"] = []
    reader = open_csv_dict_reader(csv_file)
    for row_num, row in enumerate(reader, start=2):
        try:
            dane = clean_str(col(row, ["DANE_COD", "dane_cod"]))
            code = clean_str(col(row, ["COD_NIVEL", "cod_nivel"]))
            nombre = clean_str(col(row, ["NOMBRE_NIVEL", "nombre_nivel"]))
            mn = parse_decimal(col(row, ["NOTA_MIN", "nota_min"]))
            mx = parse_decimal(col(row, ["NOTA_MAX", "nota_max"]))
            if not dane or not code or not nombre or mn is None or mx is None:
                stats["rows_skipped"] += 1
                continue
            institution = get_institution_by_dane(dane)
            if not institution:
                stats["errors"].append(
                    {"row": row_num, "error": f"Institution not found for DANE_COD={dane}"}
                )
                stats["rows_skipped"] += 1
                continue
            desc = clean_str(col(row, ["DESCRIPCION", "descripcion"]))
            obj, created = GradingScale.objects.get_or_create(
                institution=institution,
                code=code,
                defaults={
                    "name": nombre,
                    "min_score": mn,
                    "max_score": mx,
                    "description": desc,
                },
            )
            if created:
                stats["created"] += 1
            else:
                obj.name = nombre
                obj.min_score = mn
                obj.max_score = mx
                if desc:
                    obj.description = desc
                obj.save()
                stats["updated"] += 1
            stats["rows_processed"] += 1
        except Exception as e:
            stats["errors"].append({"row": row_num, "error": str(e)})
    return stats


def bulk_load_academic_periods(csv_file):
    col = row_col
    stats = _empty_stats(["rows_processed", "rows_skipped", "created", "updated"])
    stats["errors"] = []
    reader = open_csv_dict_reader(csv_file)
    for row_num, row in enumerate(reader, start=2):
        try:
            dane = clean_str(col(row, ["DANE_COD", "dane_cod"]))
            ano = parse_int(col(row, ["ANO", "ano"]))
            pnum = parse_int(col(row, ["PERIODO_NUM", "periodo_num"]))
            pname = clean_str(col(row, ["PERIODO_NOMBRE", "periodo_nombre"]))
            if not dane or ano is None or pnum is None or not pname:
                stats["rows_skipped"] += 1
                continue
            institution = get_institution_by_dane(dane)
            if not institution:
                stats["errors"].append(
                    {"row": row_num, "error": f"Institution not found for DANE_COD={dane}"}
                )
                stats["rows_skipped"] += 1
                continue
            ay = get_academic_year(institution, ano)
            if not ay:
                stats["errors"].append(
                    {
                        "row": row_num,
                        "error": f"AcademicYear not found for DANE={dane} ANO={ano}",
                    }
                )
                stats["rows_skipped"] += 1
                continue
            fi = parse_date(col(row, ["FECHA_INI", "fecha_ini"]))
            ff = parse_date(col(row, ["FECHA_FIN", "fecha_fin"]))
            obj, created = AcademicPeriod.objects.get_or_create(
                academic_year=ay,
                number=pnum,
                defaults={"name": pname, "start_date": fi, "end_date": ff},
            )
            if created:
                stats["created"] += 1
            else:
                obj.name = pname
                if fi:
                    obj.start_date = fi
                if ff:
                    obj.end_date = ff
                obj.save()
                stats["updated"] += 1
            stats["rows_processed"] += 1
        except Exception as e:
            stats["errors"].append({"row": row_num, "error": str(e)})
    return stats


def bulk_load_teachers(csv_file):
    col = row_col
    stats = _empty_stats(["rows_processed", "rows_skipped", "created", "updated"])
    stats["errors"] = []
    reader = open_csv_dict_reader(csv_file)
    for row_num, row in enumerate(reader, start=2):
        try:
            doc = clean_str(col(row, ["DOC", "doc", "DOC_DOCENTE"]))
            if not doc:
                stats["rows_skipped"] += 1
                continue
            tipodoc = clean_str(col(row, ["TIPODOC", "tipodoc"]))
            n1 = clean_str(col(row, ["NOMBRE1", "nombre1"]))
            n2 = clean_str(col(row, ["NOMBRE2", "nombre2"]))
            a1 = clean_str(col(row, ["APELLIDO1", "apellido1"]))
            a2 = clean_str(col(row, ["APELLIDO2", "apellido2"]))
            if not n1 and not a1:
                stats["rows_skipped"] += 1
                continue
            email = clean_str(col(row, ["EMAIL", "email"]))
            phone = clean_str(col(row, ["TELEFONO", "telefono"]))
            spec = clean_str(col(row, ["ESPECIALIDAD", "especialidad"]))
            t = Teacher.objects.filter(document_number=doc).first()
            if t:
                t.document_type = tipodoc or t.document_type
                t.first_name = n1 or t.first_name
                t.second_name = n2 or t.second_name
                t.first_last_name = a1 or t.first_last_name
                t.second_last_name = a2 or t.second_last_name
                t.email = email or t.email
                t.phone = phone or t.phone
                t.specialty = spec or t.specialty
                t.save()
                stats["updated"] += 1
            else:
                Teacher.objects.create(
                    document_type=tipodoc,
                    document_number=doc,
                    first_name=n1 or "N/A",
                    second_name=n2,
                    first_last_name=a1 or "N/A",
                    second_last_name=a2,
                    email=email,
                    phone=phone,
                    specialty=spec,
                )
                stats["created"] += 1
            stats["rows_processed"] += 1
        except Exception as e:
            stats["errors"].append({"row": row_num, "error": str(e)})
    return stats


def bulk_load_teacher_users(csv_file):
    """
    Create/update auth users for teachers from teachers CSV.

    Username format: first_name.first_last_name (normalized ASCII, lowercase).
    Password format: teacher document number.
    """
    col = row_col
    stats = _empty_stats(
        ["rows_processed", "rows_skipped", "users_created", "users_updated", "profile_linked"]
    )
    stats["errors"] = []
    reader = open_csv_dict_reader(csv_file)
    for row_num, row in enumerate(reader, start=2):
        try:
            doc = clean_str(col(row, ["DOC", "doc", "DOC_DOCENTE"]))
            n1 = clean_str(col(row, ["NOMBRE1", "nombre1"]))
            a1 = clean_str(col(row, ["APELLIDO1", "apellido1"]))
            if not doc:
                stats["rows_skipped"] += 1
                continue

            teacher = Teacher.objects.filter(document_number=doc).first()
            if not teacher:
                stats["errors"].append(
                    {"row": row_num, "error": f"Teacher not found DOC={doc}. Run teachers bulk load first."}
                )
                stats["rows_skipped"] += 1
                continue

            base_username = _build_teacher_username(n1 or teacher.first_name, a1 or teacher.first_last_name, doc)
            existing_user = None
            if hasattr(teacher, "user_profile") and teacher.user_profile:
                existing_user = teacher.user_profile.user

            if existing_user:
                changed = False
                if existing_user.username != base_username and not User.objects.filter(
                    username=base_username
                ).exclude(pk=existing_user.pk).exists():
                    existing_user.username = base_username
                    changed = True
                if teacher.email and existing_user.email != teacher.email:
                    existing_user.email = teacher.email
                    changed = True
                existing_user.set_password(doc)
                changed = True
                if changed:
                    existing_user.save()
                user = existing_user
                stats["users_updated"] += 1
            else:
                username = _next_available_username(base_username)
                user = User.objects.create_user(
                    username=username,
                    password=doc,
                    email=teacher.email or "",
                )
                stats["users_created"] += 1

            profile, _ = UserProfile.objects.get_or_create(user=user)
            if profile.teacher_id != teacher.id or profile.role != "TEACHER":
                profile.teacher = teacher
                profile.role = "TEACHER"
                profile.save()
                stats["profile_linked"] += 1

            stats["rows_processed"] += 1
        except Exception as e:
            stats["errors"].append({"row": row_num, "error": str(e)})
    return stats


def bulk_load_subjects(csv_file):
    col = row_col
    stats = _empty_stats(["rows_processed", "rows_skipped", "created", "updated"])
    stats["errors"] = []
    reader = open_csv_dict_reader(csv_file)
    for row_num, row in enumerate(reader, start=2):
        try:
            dane = clean_str(col(row, ["DANE_COD", "dane_cod"]))
            area = clean_str(col(row, ["AREA_NOMBRE", "area_nombre"]))
            subj = clean_str(col(row, ["ASIGNATURA_NOMBRE", "asignatura_nombre"]))
            if not dane or not area or not subj:
                stats["rows_skipped"] += 1
                continue
            institution = get_institution_by_dane(dane)
            if not institution:
                stats["errors"].append(
                    {"row": row_num, "error": f"Institution not found for DANE_COD={dane}"}
                )
                stats["rows_skipped"] += 1
                continue
            aa = AcademicArea.objects.filter(
                institution=institution, name__iexact=area
            ).first()
            if not aa:
                stats["errors"].append(
                    {"row": row_num, "error": f"AcademicArea not found: {area}"}
                )
                stats["rows_skipped"] += 1
                continue
            emphasis = clean_str(col(row, ["ENFASIS", "enfasis"]))
            hours = parse_int(col(row, ["HORAS", "horas"]))
            qs = Subject.objects.filter(
                institution=institution, academic_area=aa, name__iexact=subj
            )
            if emphasis:
                qs = qs.filter(emphasis__iexact=emphasis)
            else:
                qs = qs.filter(emphasis="")
            obj = qs.first()
            if obj:
                if hours is not None:
                    obj.hours = hours
                obj.save()
                stats["updated"] += 1
            else:
                Subject.objects.create(
                    academic_area=aa,
                    institution=institution,
                    name=subj,
                    emphasis=emphasis,
                    hours=hours,
                )
                stats["created"] += 1
            stats["rows_processed"] += 1
        except Exception as e:
            stats["errors"].append({"row": row_num, "error": str(e)})
    return stats


def _resolve_course_assignment(row, col, row_num, stats):
    dane = clean_str(col(row, ["DANE_COD", "dane_cod"]))
    ano = parse_int(col(row, ["ANO", "ano"]))
    sede = clean_str(col(row, ["SEDE", "sede"]))
    grado = clean_str(col(row, ["GRADO", "grado"]))
    grupo = clean_str(col(row, ["GRUPO", "grupo"]))
    subj_name = clean_str(col(row, ["ASIGNATURA_NOMBRE", "asignatura_nombre"]))
    emphasis = clean_str(col(row, ["ENFASIS", "enfasis"]))
    teacher_doc = clean_str(col(row, ["DOC_DOCENTE", "doc_docente"]))

    if not all([dane, ano is not None, sede, grado, grupo, subj_name]):
        return None
    institution = get_institution_by_dane(dane)
    if not institution:
        stats["errors"].append(
            {"row": row_num, "error": f"Institution not found for DANE_COD={dane}"}
        )
        return None
    ay = get_academic_year(institution, ano)
    if not ay:
        stats["errors"].append(
            {"row": row_num, "error": f"AcademicYear not found ANO={ano}"}
        )
        return None
    group = get_group_by_context(institution, ano, sede, grado, grupo)
    if not group:
        stats["errors"].append(
            {"row": row_num, "error": "Group not found (check SEDE, GRADO, GRUPO, ANO)"}
        )
        return None
    area_name = clean_str(col(row, ["AREA_NOMBRE", "area_nombre"]))
    subject = None
    if area_name:
        subject = find_subject(institution, area_name, subj_name, emphasis)
    if not subject:
        subject = Subject.objects.filter(
            institution=institution, name__iexact=subj_name
        ).first()
        if subject and emphasis:
            em = (subject.emphasis or "").strip().lower()
            if em != emphasis.lower():
                alt = Subject.objects.filter(
                    institution=institution,
                    name__iexact=subj_name,
                    emphasis__iexact=emphasis,
                ).first()
                if alt:
                    subject = alt
    if not subject:
        stats["errors"].append(
            {"row": row_num, "error": f"Subject not found: {subj_name}"}
        )
        return None
    qs = CourseAssignment.objects.filter(
        subject=subject, group=group, academic_year=ay
    )
    if teacher_doc:
        teacher = Teacher.objects.filter(document_number=teacher_doc).first()
        if teacher:
            qs = qs.filter(teacher=teacher)
    ca = qs.first()
    if not ca:
        stats["errors"].append(
            {
                "row": row_num,
                "error": "CourseAssignment not found; load asignaciones_curso first",
            }
        )
        return None
    return ca, group, ay, institution


def bulk_load_course_assignments(csv_file):
    col = row_col
    stats = _empty_stats(["rows_processed", "rows_skipped", "created", "updated"])
    stats["errors"] = []
    reader = open_csv_dict_reader(csv_file)
    for row_num, row in enumerate(reader, start=2):
        try:
            dane = clean_str(col(row, ["DANE_COD", "dane_cod"]))
            ano = parse_int(col(row, ["ANO", "ano"]))
            sede = clean_str(col(row, ["SEDE", "sede"]))
            grado = clean_str(col(row, ["GRADO", "grado"]))
            grupo = clean_str(col(row, ["GRUPO", "grupo"]))
            subj_name = clean_str(col(row, ["ASIGNATURA_NOMBRE", "asignatura_nombre"]))
            teacher_doc = clean_str(col(row, ["DOC_DOCENTE", "doc_docente"]))
            emphasis = clean_str(col(row, ["ENFASIS", "enfasis"]))
            if not teacher_doc:
                stats["rows_skipped"] += 1
                continue
            if not all([dane, ano is not None, sede, grado, grupo, subj_name]):
                stats["rows_skipped"] += 1
                continue
            institution = get_institution_by_dane(dane)
            if not institution:
                stats["errors"].append(
                    {"row": row_num, "error": f"Institution not found DANE={dane}"}
                )
                stats["rows_skipped"] += 1
                continue
            ay = get_academic_year(institution, ano)
            if not ay:
                stats["errors"].append(
                    {"row": row_num, "error": f"AcademicYear not found ANO={ano}"}
                )
                stats["rows_skipped"] += 1
                continue
            group = get_group_by_context(institution, ano, sede, grado, grupo)
            if not group:
                stats["errors"].append(
                    {"row": row_num, "error": "Group not found"}
                )
                stats["rows_skipped"] += 1
                continue
            area_name = clean_str(col(row, ["AREA_NOMBRE", "area_nombre"]))
            subject = get_or_create_subject_for_course_assignment(
                institution, area_name, subj_name, emphasis
            )
            if not subject:
                stats["errors"].append(
                    {
                        "row": row_num,
                        "error": (
                            f"Subject not found: {subj_name} "
                            "(include AREA_NOMBRE to create the subject)"
                        ),
                    }
                )
                stats["rows_skipped"] += 1
                continue
            teacher = Teacher.objects.filter(document_number=teacher_doc).first()
            if not teacher:
                stats["errors"].append(
                    {"row": row_num, "error": f"Teacher not found DOC={teacher_doc}"}
                )
                stats["rows_skipped"] += 1
                continue
            obj, created = CourseAssignment.objects.get_or_create(
                subject=subject,
                group=group,
                academic_year=ay,
                defaults={"teacher": teacher},
            )
            if created:
                stats["created"] += 1
            else:
                obj.teacher = teacher
                obj.save()
                stats["updated"] += 1
            stats["rows_processed"] += 1
        except Exception as e:
            stats["errors"].append({"row": row_num, "error": str(e)})
    return stats


def bulk_load_grade_directors(csv_file):
    col = row_col
    stats = _empty_stats(["rows_processed", "rows_skipped", "created", "updated"])
    stats["errors"] = []
    reader = open_csv_dict_reader(csv_file)
    for row_num, row in enumerate(reader, start=2):
        try:
            dane = clean_str(col(row, ["DANE_COD", "dane_cod"]))
            ano = parse_int(col(row, ["ANO", "ano"]))
            sede = clean_str(col(row, ["SEDE", "sede"]))
            grado = clean_str(col(row, ["GRADO", "grado"]))
            grupo = clean_str(col(row, ["GRUPO", "grupo"]))
            teacher_doc = clean_str(col(row, ["DOC_DOCENTE", "doc_docente"]))
            missing = []
            if not dane:
                missing.append("DANE_COD")
            if ano is None:
                missing.append("ANO")
            if not sede:
                missing.append("SEDE")
            if not grado:
                missing.append("GRADO")
            if not grupo:
                missing.append("GRUPO")
            if not teacher_doc:
                missing.append("DOC_DOCENTE")
            if missing:
                msg = (
                    "Validación inicial: faltan columnas o valores vacíos tras leer el CSV: "
                    + ", ".join(missing)
                    + ". Revisa nombres de cabecera (DANE_COD, ANO, SEDE, GRADO, GRUPO, DOC_DOCENTE)."
                )
                logger.warning(
                    "bulk_load_grade_directors row %s: %s valores_leídos DANE_COD=%r ANO=%r "
                    "SEDE=%r GRADO=%r GRUPO=%r DOC_DOCENTE=%r keys_fila=%s",
                    row_num,
                    msg,
                    dane,
                    ano,
                    sede,
                    grado,
                    grupo,
                    teacher_doc,
                    list(row.keys()) if row else [],
                )
                stats["errors"].append({"row": row_num, "error": msg})
                stats["rows_skipped"] += 1
                continue
            institution = get_institution_by_dane(dane)
            if not institution:
                err = f"Institution not found DANE_COD={dane!r}"
                logger.warning("bulk_load_grade_directors row %s: %s", row_num, err)
                stats["errors"].append({"row": row_num, "error": err})
                stats["rows_skipped"] += 1
                continue
            ay = get_academic_year(institution, ano)
            if not ay:
                err = (
                    f"AcademicYear not found for institution id={institution.id} "
                    f"name={institution.name!r} ANO={ano}"
                )
                logger.warning("bulk_load_grade_directors row %s: %s", row_num, err)
                stats["errors"].append({"row": row_num, "error": err})
                stats["rows_skipped"] += 1
                continue
            group = get_group_by_context(institution, ano, sede, grado, grupo)
            if not group:
                err = (
                    f"Group not found: SEDE={sede!r} GRADO={grado!r} GRUPO={grupo!r} "
                    f"ANO={ano} (deben existir Campus, GradeLevel y Group coincidentes "
                    f"para esa institución)"
                )
                logger.warning("bulk_load_grade_directors row %s: %s", row_num, err)
                stats["errors"].append({"row": row_num, "error": err})
                stats["rows_skipped"] += 1
                continue
            teacher = Teacher.objects.filter(document_number=teacher_doc).first()
            if not teacher:
                err = f"Teacher not found DOC_DOCENTE={teacher_doc!r}"
                logger.warning("bulk_load_grade_directors row %s: %s", row_num, err)
                stats["errors"].append({"row": row_num, "error": err})
                stats["rows_skipped"] += 1
                continue
            obj, created = GradeDirector.objects.get_or_create(
                group=group,
                academic_year=ay,
                defaults={"teacher": teacher},
            )
            if created:
                stats["created"] += 1
            else:
                obj.teacher = teacher
                obj.save()
                stats["updated"] += 1
            stats["rows_processed"] += 1
        except Exception as e:
            logger.exception(
                "bulk_load_grade_directors row %s: error inesperado", row_num
            )
            stats["errors"].append({"row": row_num, "error": str(e)})
    return stats


def bulk_load_parents(csv_file):
    col = row_col
    stats = _empty_stats(["rows_processed", "rows_skipped", "created", "updated"])
    stats["errors"] = []
    reader = open_csv_dict_reader(csv_file)
    for row_num, row in enumerate(reader, start=2):
        try:
            doc = clean_str(col(row, ["DOC", "doc"]))
            if not doc:
                stats["rows_skipped"] += 1
                continue
            tipodoc = clean_str(col(row, ["TIPODOC", "tipodoc"]))
            n1 = clean_str(col(row, ["NOMBRE1", "nombre1"]))
            n2 = clean_str(col(row, ["NOMBRE2", "nombre2"]))
            a1 = clean_str(col(row, ["APELLIDO1", "apellido1"]))
            a2 = clean_str(col(row, ["APELLIDO2", "apellido2"]))
            email = clean_str(col(row, ["EMAIL", "email"]))
            if not email:
                email = parent_synthetic_email(doc)
            phone = clean_str(col(row, ["TELEFONO", "telefono"]))
            kinship = clean_str(col(row, ["PARENTESCO", "parentesco"]))
            if not n1 and not a1:
                stats["rows_skipped"] += 1
                continue
            fn = compose_full_name(a1, a2, n1, n2)
            p = Parent.objects.filter(document_number=doc).first()
            if p:
                p.document_type = tipodoc or p.document_type
                p.first_name = n1 or p.first_name
                p.second_name = n2 or p.second_name
                p.first_last_name = a1 or p.first_last_name
                p.second_last_name = a2 or p.second_last_name
                p.full_name = fn or p.full_name
                p.email = email
                p.phone = phone or p.phone
                p.kinship = kinship or p.kinship
                p.save()
                stats["updated"] += 1
            else:
                Parent.objects.create(
                    document_type=tipodoc,
                    document_number=doc,
                    first_name=n1 or "N/A",
                    second_name=n2,
                    first_last_name=a1 or "N/A",
                    second_last_name=a2,
                    full_name=fn or "N/A",
                    email=email,
                    phone=phone,
                    kinship=kinship,
                )
                stats["created"] += 1
            stats["rows_processed"] += 1
        except Exception as e:
            stats["errors"].append({"row": row_num, "error": str(e)})
    return stats


def bulk_load_student_guardians(csv_file):
    col = row_col
    stats = _empty_stats(["rows_processed", "rows_skipped", "created", "updated"])
    stats["errors"] = []
    reader = open_csv_dict_reader(csv_file)
    for row_num, row in enumerate(reader, start=2):
        try:
            sdoc = clean_str(col(row, ["DOC_ESTUDIANTE", "doc_estudiante"]))
            pdoc = clean_str(col(row, ["DOC_ACUDIENTE", "doc_acudiente"]))
            if not sdoc or not pdoc:
                stats["rows_skipped"] += 1
                continue
            student = Student.objects.filter(document_number=sdoc).first()
            parent = Parent.objects.filter(document_number=pdoc).first()
            if not student or not parent:
                stats["errors"].append(
                    {
                        "row": row_num,
                        "error": "Student or Parent not found by document",
                    }
                )
                stats["rows_skipped"] += 1
                continue
            primary = bool_from_cell(col(row, ["ES_PRIMARIO", "es_primario"]))
            obj, created = StudentGuardian.objects.get_or_create(
                student=student,
                parent=parent,
                defaults={"is_primary": primary},
            )
            if created:
                stats["created"] += 1
            else:
                obj.is_primary = primary
                obj.save()
                stats["updated"] += 1
            stats["rows_processed"] += 1
        except Exception as e:
            stats["errors"].append({"row": row_num, "error": str(e)})
    return stats


def _resolve_period(institution, ano, period_num, row_num, stats):
    ay = get_academic_year(institution, ano)
    if not ay:
        stats["errors"].append(
            {"row": row_num, "error": f"AcademicYear not found ANO={ano}"}
        )
        return None
    ap = AcademicPeriod.objects.filter(academic_year=ay, number=period_num).first()
    if not ap:
        stats["errors"].append(
            {"row": row_num, "error": f"AcademicPeriod not found number={period_num}"}
        )
    return ap


def bulk_load_grades(csv_file):
    col = row_col
    stats = _empty_stats(["rows_processed", "rows_skipped", "created", "updated"])
    stats["errors"] = []
    reader = open_csv_dict_reader(csv_file)
    for row_num, row in enumerate(reader, start=2):
        try:
            sdoc = clean_str(col(row, ["DOC_ESTUDIANTE", "doc_estudiante"]))
            dane = clean_str(col(row, ["DANE_COD", "dane_cod"]))
            ano = parse_int(col(row, ["ANO", "ano"]))
            pnum = parse_int(col(row, ["PERIODO_NUM", "periodo_num"]))
            nota = parse_decimal(col(row, ["NOTA", "nota"]))
            if not sdoc or not dane or ano is None or pnum is None or nota is None:
                stats["rows_skipped"] += 1
                continue
            student = Student.objects.filter(document_number=sdoc).first()
            if not student:
                stats["errors"].append(
                    {"row": row_num, "error": f"Student not found DOC={sdoc}"}
                )
                stats["rows_skipped"] += 1
                continue
            institution = get_institution_by_dane(dane)
            if not institution:
                stats["errors"].append(
                    {"row": row_num, "error": f"Institution not found DANE={dane}"}
                )
                stats["rows_skipped"] += 1
                continue
            ap = _resolve_period(institution, ano, pnum, row_num, stats)
            if not ap:
                stats["rows_skipped"] += 1
                continue
            resolved = _resolve_course_assignment(row, col, row_num, stats)
            if not resolved:
                stats["rows_skipped"] += 1
                continue
            ca, _, _, _ = resolved
            cod_nivel = clean_str(col(row, ["COD_NIVEL", "cod_nivel"]))
            perf = None
            if cod_nivel:
                perf = GradingScale.objects.filter(
                    institution=institution, code__iexact=cod_nivel
                ).first()
            def_nota = parse_decimal(col(row, ["NOTA_DEFINITIVA", "nota_definitiva"]))
            obj, created = Grade.objects.get_or_create(
                student=student,
                course_assignment=ca,
                academic_period=ap,
                defaults={
                    "numerical_grade": nota,
                    "performance_level": perf,
                    "definitive_grade": def_nota,
                },
            )
            if created:
                stats["created"] += 1
            else:
                obj.numerical_grade = nota
                if perf:
                    obj.performance_level = perf
                if def_nota is not None:
                    obj.definitive_grade = def_nota
                obj.save()
                stats["updated"] += 1
            stats["rows_processed"] += 1
        except Exception as e:
            stats["errors"].append({"row": row_num, "error": str(e)})
    return stats


def bulk_load_attendance(csv_file):
    col = row_col
    stats = _empty_stats(["rows_processed", "rows_skipped", "created", "updated"])
    stats["errors"] = []
    reader = open_csv_dict_reader(csv_file)
    for row_num, row in enumerate(reader, start=2):
        try:
            sdoc = clean_str(col(row, ["DOC_ESTUDIANTE", "doc_estudiante"]))
            dane = clean_str(col(row, ["DANE_COD", "dane_cod"]))
            ano = parse_int(col(row, ["ANO", "ano"]))
            pnum = parse_int(col(row, ["PERIODO_NUM", "periodo_num"]))
            if not sdoc or not dane or ano is None or pnum is None:
                stats["rows_skipped"] += 1
                continue
            student = Student.objects.filter(document_number=sdoc).first()
            if not student:
                stats["errors"].append(
                    {"row": row_num, "error": f"Student not found DOC={sdoc}"}
                )
                stats["rows_skipped"] += 1
                continue
            institution = get_institution_by_dane(dane)
            if not institution:
                stats["errors"].append(
                    {"row": row_num, "error": f"Institution not found DANE={dane}"}
                )
                stats["rows_skipped"] += 1
                continue
            ap = _resolve_period(institution, ano, pnum, row_num, stats)
            if not ap:
                stats["rows_skipped"] += 1
                continue
            resolved = _resolve_course_assignment(row, col, row_num, stats)
            if not resolved:
                stats["rows_skipped"] += 1
                continue
            ca, _, _, _ = resolved
            uabs = parse_int(col(row, ["INASISTENCIAS_SIN_JUSTIFICAR", "inasistencias_sin_justificar"]), 0)
            eabs = parse_int(col(row, ["INASISTENCIAS_JUSTIFICADAS", "inasistencias_justificadas"]), 0)
            if uabs is None:
                uabs = 0
            if eabs is None:
                eabs = 0
            obj, created = Attendance.objects.get_or_create(
                student=student,
                course_assignment=ca,
                academic_period=ap,
                defaults={
                    "unexcused_absences": uabs,
                    "excused_absences": eabs,
                },
            )
            if created:
                stats["created"] += 1
            else:
                obj.unexcused_absences = uabs
                obj.excused_absences = eabs
                obj.save()
                stats["updated"] += 1
            stats["rows_processed"] += 1
        except Exception as e:
            stats["errors"].append({"row": row_num, "error": str(e)})
    return stats


def bulk_load_academic_indicators(csv_file):
    col = row_col
    stats = _empty_stats(["rows_processed", "rows_skipped", "created"])
    stats["errors"] = []
    reader = open_csv_dict_reader(csv_file)
    for row_num, row in enumerate(reader, start=2):
        try:
            sdoc = clean_str(col(row, ["DOC_ESTUDIANTE", "doc_estudiante"]))
            dane = clean_str(col(row, ["DANE_COD", "dane_cod"]))
            ano = parse_int(col(row, ["ANO", "ano"]))
            pnum = parse_int(col(row, ["PERIODO_NUM", "periodo_num"]))
            desc = clean_str(col(row, ["DESCRIPCION", "descripcion"]))
            if not sdoc or not dane or ano is None or pnum is None or not desc:
                stats["rows_skipped"] += 1
                continue
            student = Student.objects.filter(document_number=sdoc).first()
            if not student:
                stats["errors"].append(
                    {"row": row_num, "error": f"Student not found DOC={sdoc}"}
                )
                stats["rows_skipped"] += 1
                continue
            institution = get_institution_by_dane(dane)
            if not institution:
                stats["errors"].append(
                    {"row": row_num, "error": f"Institution not found DANE={dane}"}
                )
                stats["rows_skipped"] += 1
                continue
            ap = _resolve_period(institution, ano, pnum, row_num, stats)
            if not ap:
                stats["rows_skipped"] += 1
                continue
            resolved = _resolve_course_assignment(row, col, row_num, stats)
            if not resolved:
                stats["rows_skipped"] += 1
                continue
            ca, _, _, _ = resolved
            ngrade = parse_decimal(col(row, ["NOTA", "nota"]))
            plevel = clean_str(col(row, ["NIVEL_DESEMPENO_TEXTO", "nivel_desempeno_texto"]))
            AcademicIndicator.objects.create(
                student=student,
                course_assignment=ca,
                academic_period=ap,
                description=desc,
                numerical_grade=ngrade,
                performance_level=plevel,
            )
            stats["created"] += 1
            stats["rows_processed"] += 1
        except Exception as e:
            stats["errors"].append({"row": row_num, "error": str(e)})
    return stats


def bulk_load_performance_summaries(csv_file):
    col = row_col
    stats = _empty_stats(["rows_processed", "rows_skipped", "created", "updated"])
    stats["errors"] = []
    reader = open_csv_dict_reader(csv_file)
    for row_num, row in enumerate(reader, start=2):
        try:
            sdoc = clean_str(col(row, ["DOC_ESTUDIANTE", "doc_estudiante"]))
            dane = clean_str(col(row, ["DANE_COD", "dane_cod"]))
            ano = parse_int(col(row, ["ANO", "ano"]))
            sede = clean_str(col(row, ["SEDE", "sede"]))
            grado = clean_str(col(row, ["GRADO", "grado"]))
            grupo = clean_str(col(row, ["GRUPO", "grupo"]))
            pnum = parse_int(col(row, ["PERIODO_NUM", "periodo_num"]))
            prom = parse_decimal(col(row, ["PROMEDIO_PERIODO", "promedio_periodo"]))
            if (
                not sdoc
                or not dane
                or ano is None
                or not sede
                or not grado
                or not grupo
                or pnum is None
                or prom is None
            ):
                stats["rows_skipped"] += 1
                continue
            student = Student.objects.filter(document_number=sdoc).first()
            if not student:
                stats["errors"].append(
                    {"row": row_num, "error": f"Student not found DOC={sdoc}"}
                )
                stats["rows_skipped"] += 1
                continue
            institution = get_institution_by_dane(dane)
            if not institution:
                stats["errors"].append(
                    {"row": row_num, "error": f"Institution not found DANE={dane}"}
                )
                stats["rows_skipped"] += 1
                continue
            group = get_group_by_context(institution, ano, sede, grado, grupo)
            if not group:
                stats["errors"].append({"row": row_num, "error": "Group not found"})
                stats["rows_skipped"] += 1
                continue
            ap = _resolve_period(institution, ano, pnum, row_num, stats)
            if not ap:
                stats["rows_skipped"] += 1
                continue
            rank = parse_int(col(row, ["PUESTO", "puesto"]))
            def_avg = parse_decimal(
                col(row, ["PROMEDIO_DEFINITIVO", "promedio_definitivo"])
            )
            obj, created = PerformanceSummary.objects.get_or_create(
                student=student,
                group=group,
                academic_period=ap,
                defaults={
                    "period_average": prom,
                    "rank": rank,
                    "definitive_average": def_avg,
                },
            )
            if created:
                stats["created"] += 1
            else:
                obj.period_average = prom
                if rank is not None:
                    obj.rank = rank
                if def_avg is not None:
                    obj.definitive_average = def_avg
                obj.save()
                stats["updated"] += 1
            stats["rows_processed"] += 1
        except Exception as e:
            stats["errors"].append({"row": row_num, "error": str(e)})
    return stats


def bulk_load_disciplinary_reports(csv_file):
    col = row_col
    stats = _empty_stats(["rows_processed", "rows_skipped", "created", "updated"])
    stats["errors"] = []
    reader = open_csv_dict_reader(csv_file)
    for row_num, row in enumerate(reader, start=2):
        try:
            sdoc = clean_str(col(row, ["DOC_ESTUDIANTE", "doc_estudiante"]))
            dane = clean_str(col(row, ["DANE_COD", "dane_cod"]))
            ano = parse_int(col(row, ["ANO", "ano"]))
            pnum = parse_int(col(row, ["PERIODO_NUM", "periodo_num"]))
            if not sdoc or not dane or ano is None or pnum is None:
                stats["rows_skipped"] += 1
                continue
            student = Student.objects.filter(document_number=sdoc).first()
            if not student:
                stats["errors"].append(
                    {"row": row_num, "error": f"Student not found DOC={sdoc}"}
                )
                stats["rows_skipped"] += 1
                continue
            institution = get_institution_by_dane(dane)
            if not institution:
                stats["errors"].append(
                    {"row": row_num, "error": f"Institution not found DANE={dane}"}
                )
                stats["rows_skipped"] += 1
                continue
            ap = _resolve_period(institution, ano, pnum, row_num, stats)
            if not ap:
                stats["rows_skipped"] += 1
                continue
            texto = clean_str(col(row, ["TEXTO", "texto", "REPORT_TEXT"]))
            tdoc = clean_str(col(row, ["DOC_DOCENTE_CREADOR", "doc_docente_creador"]))
            created_by = None
            if tdoc:
                created_by = Teacher.objects.filter(document_number=tdoc).first()
            obj, created = DisciplinaryReport.objects.get_or_create(
                student=student,
                academic_period=ap,
                defaults={"report_text": texto, "created_by": created_by},
            )
            if created:
                stats["created"] += 1
            else:
                if texto:
                    obj.report_text = texto
                if created_by:
                    obj.created_by = created_by
                obj.save()
                stats["updated"] += 1
            stats["rows_processed"] += 1
        except Exception as e:
            stats["errors"].append({"row": row_num, "error": str(e)})
    return stats

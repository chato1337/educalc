"""
Bulk load students from CSV format.

CSV columns (from docs/bulk_load_students.csv):
ANO, INSTITUCION, SEDE, GRADO_COD, GRADO, GRUPO, FECHAINI, ESTRATO, SISBEN IV,
DOC, TIPODOC, APELLIDO1, APELLIDO2, NOMBRE1, NOMBRE2, GENERO, FECHA_NACIMIENTO,
BARRIO, EPS, TIPO DE SANGRE, DISCAPACIDAD, TELEFONO
"""
import csv
import io
import uuid

from django.utils import timezone

from .bulk_load_utils import (
    clean_str as _clean_str,
    parse_date as _parse_date,
    parse_int as _parse_int,
    row_col as _row_col,
)
from .models import (
    AcademicYear,
    Campus,
    Enrollment,
    GradeLevel,
    Group,
    Institution,
    Student,
)


def bulk_load_students(csv_file, created_by_institution_id=None):
    """
    Load students from CSV. Creates Institution, Campus, AcademicYear,
    GradeLevel, Group, Student, Enrollment as needed.

    Returns: dict with created/updated counts and any errors.
    """
    reader = csv.DictReader(io.TextIOWrapper(csv_file, encoding="utf-8-sig"))
    # Normalize column names (strip)
    if reader.fieldnames:
        reader.fieldnames = [f.strip() for f in reader.fieldnames]
    col = _row_col

    stats = {
        "institutions_created": 0,
        "campuses_created": 0,
        "academic_years_created": 0,
        "grade_levels_created": 0,
        "groups_created": 0,
        "students_created": 0,
        "students_updated": 0,
        "enrollments_created": 0,
        "rows_processed": 0,
        "rows_skipped": 0,
        "errors": [],
    }

    for row_num, row in enumerate(reader, start=2):  # 2 = header is row 1
        try:
            ano = _parse_int(col(row, ["ANO", "ANO"]))
            inst_name = _clean_str(col(row, ["INSTITUCION", "INSTITUCION"]))
            sede_name = _clean_str(col(row, ["SEDE", "SEDE"]))
            grado_cod = _parse_int(col(row, ["GRADO_COD", "GRADO_COD"]), 1)
            grado_name = _clean_str(col(row, ["GRADO", "GRADO"]), "PRIMERO")
            grupo_name = _clean_str(col(row, ["GRUPO", "GRUPO"]), "101")
            doc = _clean_str(col(row, ["DOC", "DOC"]))
            tipodoc = _clean_str(col(row, ["TIPODOC", "TIPODOC"]))
            apellido1 = _clean_str(col(row, ["APELLIDO1", "APELLIDO1"]))
            apellido2 = _clean_str(col(row, ["APELLIDO2", "APELLIDO2"]))
            nombre1 = _clean_str(col(row, ["NOMBRE1", "NOMBRE1"]))
            nombre2 = _clean_str(col(row, ["NOMBRE2", "NOMBRE2"]))
            genero = _clean_str(col(row, ["GENERO", "GENERO"]))
            barrio = _clean_str(col(row, ["BARRIO", "BARRIO"]))
            eps = _clean_str(col(row, ["EPS", "EPS"]))
            sangre = _clean_str(col(row, ["TIPO DE SANGRE", "TIPO DE SANGRE"]))
            discapacidad = _clean_str(col(row, ["DISCAPACIDAD", "DISCAPACIDAD"]))
            telefono = _clean_str(col(row, ["TELEFONO", "TELEFONO"]))
            estrato = _clean_str(col(row, ["ESTRATO", "ESTRATO"]))
            sisben = _clean_str(col(row, ["SISBEN IV", "SISBEN IV"]))

            # Required for a valid row
            if not inst_name or not sede_name:
                stats["rows_skipped"] += 1
                continue
            if not nombre1 and not apellido1:
                stats["rows_skipped"] += 1
                continue

            ano = ano or timezone.now().year

            # Institution
            institution = Institution.objects.filter(name__iexact=inst_name).first()
            if not institution:
                institution = Institution.objects.create(
                    name=inst_name,
                    dane_code=f"BULK-{uuid.uuid4().hex[:12].upper()}",
                    legal_reference="",
                    nit="",
                )
                stats["institutions_created"] += 1

            # Campus
            campus = Campus.objects.filter(
                institution=institution, name__iexact=sede_name
            ).first()
            if not campus:
                campus = Campus.objects.create(
                    institution=institution, name=sede_name, code=""
                )
                stats["campuses_created"] += 1

            # AcademicYear
            academic_year, ay_created = AcademicYear.objects.get_or_create(
                institution=institution,
                year=ano,
                defaults={
                    "start_date": None,
                    "end_date": None,
                    "is_active": ano == timezone.now().year,
                },
            )
            if ay_created:
                stats["academic_years_created"] += 1

            # GradeLevel
            grade_level = GradeLevel.objects.filter(
                institution=institution, name__iexact=grado_name
            ).first()
            if not grade_level:
                grade_level = GradeLevel.objects.create(
                    institution=institution, name=grado_name, level_order=grado_cod
                )
                stats["grade_levels_created"] += 1

            # Group (unique: grade_level + academic_year + name; campus distinguishes)
            group = Group.objects.filter(
                grade_level=grade_level,
                academic_year=academic_year,
                campus=campus,
                name=grupo_name,
            ).first()
            if not group:
                group = Group.objects.create(
                    grade_level=grade_level,
                    academic_year=academic_year,
                    campus=campus,
                    name=grupo_name,
                )
                stats["groups_created"] += 1

            # Student (by document_number; require doc for new students or use placeholder)
            student = Student.objects.filter(document_number=doc).first() if doc else None
            if not student and not doc:
                doc = f"BULK-{uuid.uuid4().hex[:12].upper()}"

            fecha_nac = _parse_date(col(row, ["FECHA_NACIMIENTO", "FECHA_NACIMIENTO"]))
            fecha_ini = _parse_date(col(row, ["FECHAINI", "FECHAINI"]))

            if student:
                student.first_name = nombre1 or student.first_name
                student.second_name = nombre2 or student.second_name
                student.first_last_name = apellido1 or student.first_last_name
                student.second_last_name = apellido2 or student.second_last_name
                student.document_type = tipodoc or student.document_type
                student.document_number = doc or student.document_number
                student.gender = genero or student.gender
                student.date_of_birth = fecha_nac or student.date_of_birth
                student.stratum = estrato or student.stratum
                student.sisben = sisben or student.sisben
                student.neighborhood = barrio or student.neighborhood
                student.health_insurer = eps or student.health_insurer
                student.blood_type = sangre or student.blood_type
                student.disability = discapacidad or student.disability
                student.phone = telefono or student.phone
                student.save()
                stats["students_updated"] += 1
            else:
                student = Student.objects.create(
                    document_type=tipodoc,
                    document_number=doc,
                    first_name=nombre1 or "N/A",
                    second_name=nombre2,
                    first_last_name=apellido1 or "N/A",
                    second_last_name=apellido2,
                    date_of_birth=fecha_nac,
                    gender=genero,
                    stratum=estrato,
                    sisben=sisben,
                    neighborhood=barrio,
                    health_insurer=eps,
                    blood_type=sangre,
                    disability=discapacidad,
                    phone=telefono,
                )
                stats["students_created"] += 1

            # Enrollment
            _, e_created = Enrollment.objects.get_or_create(
                student=student,
                group=group,
                academic_year=academic_year,
                defaults={
                    "enrollment_date": fecha_ini,
                    "status": "active",
                },
            )
            if e_created:
                stats["enrollments_created"] += 1

            stats["rows_processed"] += 1

        except Exception as e:
            stats["errors"].append({"row": row_num, "error": str(e)})

    return stats

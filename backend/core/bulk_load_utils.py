"""Shared CSV parsing and domain resolution for bulk loaders."""
import csv
import io
from datetime import datetime
from decimal import Decimal, InvalidOperation

from .models import (
    AcademicArea,
    AcademicYear,
    Campus,
    GradeLevel,
    Group,
    Institution,
    Subject,
)


def parse_date(value):
    """Parse date from formats: DD/MM/YYYY, DD/MM/YY, MM/DD/YYYY, MM/DD/YY HH:MM."""
    if not value or not str(value).strip():
        return None
    value = str(value).strip()
    if " " in value:
        value = value.split()[0]
    for fmt in ("%d/%m/%Y", "%d/%m/%y", "%m/%d/%Y", "%m/%d/%y", "%Y-%m-%d"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


def parse_int(value, default=None):
    if value is None or str(value).strip() == "":
        return default
    try:
        return int(Decimal(str(value).replace(",", ".")))
    except (ValueError, TypeError, InvalidOperation):
        return default


def parse_decimal(value, default=None):
    if value is None or str(value).strip() == "":
        return default
    try:
        return Decimal(str(value).strip().replace(",", "."))
    except (InvalidOperation, ValueError, TypeError):
        return default


def clean_str(value, default=""):
    if value is None:
        return default
    s = str(value).strip()
    return s if s else default


def row_col(row, keys, default=""):
    """Get value from row by key (case-insensitive). Tries each key in order."""
    row_lower = {str(k).strip().lower(): k for k in row.keys() if k}
    for key in keys:
        k_lower = str(key).strip().lower()
        if k_lower in row_lower:
            orig_key = row_lower[k_lower]
            val = row.get(orig_key)
            if val is not None and str(val).strip():
                return str(val).strip()
    return default


def bool_from_cell(value):
    if value is None or str(value).strip() == "":
        return False
    s = str(value).strip().lower()
    return s in ("1", "true", "t", "s", "si", "sí", "yes", "y")


def open_csv_dict_reader(csv_file):
    # El archivo multipart puede haberse leído antes de llegar al loader; rebobinar.
    if hasattr(csv_file, "seek"):
        try:
            csv_file.seek(0)
        except (OSError, io.UnsupportedOperation):
            pass
    reader = csv.DictReader(io.TextIOWrapper(csv_file, encoding="utf-8-sig"))
    if reader.fieldnames:
        reader.fieldnames = [f.strip() for f in reader.fieldnames]
    return reader


def get_institution_by_dane(dane_cod):
    if not dane_cod or not str(dane_cod).strip():
        return None
    return Institution.objects.filter(dane_code=str(dane_cod).strip()).first()


def get_academic_year(institution, year):
    if not institution or year is None:
        return None
    return AcademicYear.objects.filter(institution=institution, year=year).first()


def get_group_by_context(institution, year, campus_name, grade_name, group_name):
    """Resolve Group from institution DANE year and location names (case-insensitive)."""
    ay = get_academic_year(institution, year)
    if not ay:
        return None
    campus = Campus.objects.filter(
        institution=institution, name__iexact=clean_str(campus_name)
    ).first()
    if not campus:
        return None
    gl = GradeLevel.objects.filter(
        institution=institution, name__iexact=clean_str(grade_name)
    ).first()
    if not gl:
        return None
    return Group.objects.filter(
        grade_level=gl,
        academic_year=ay,
        campus=campus,
        name__iexact=clean_str(group_name),
    ).first()


def find_subject(institution, area_name, subject_name, emphasis=""):
    """Resolve Subject; disambiguate by emphasis when multiple match name in area."""
    area_name = clean_str(area_name)
    subject_name = clean_str(subject_name)
    emphasis = clean_str(emphasis)

    area = AcademicArea.objects.filter(
        institution=institution, name__iexact=area_name
    ).first()
    if not area:
        return None
    qs = Subject.objects.filter(
        institution=institution, academic_area=area, name__iexact=subject_name
    )
    subs = list(qs)
    if not subs:
        return None
    if len(subs) == 1:
        return subs[0]
    em_low = emphasis.lower()
    for s in subs:
        if (s.emphasis or "").strip().lower() == em_low:
            return s
    if not emphasis:
        for s in subs:
            if not (s.emphasis or "").strip():
                return s
    return subs[0]


def parent_synthetic_email(doc):
    d = clean_str(doc).replace("@", "_")
    return f"sin-correo-{d}@bulk.local"


def compose_full_name(first_last, second_last, first_name, second_name):
    parts = [first_last, second_last, first_name, second_name]
    return " ".join(p for p in parts if p).strip()

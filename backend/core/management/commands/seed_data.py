"""
Seed data for development and testing.

Creates: Institution, Campus, AcademicYear, GradeLevels, GradingScale, AcademicAreas.
Reference: INSTITUCIÓN EDUCATIVA AGROPECUARIA CARRIZALES, Decreto 1290 de 2009.
"""
from datetime import date

from django.core.management.base import BaseCommand

from core.models import (
    AcademicArea,
    AcademicYear,
    Campus,
    GradeLevel,
    GradingScale,
    Institution,
)


class Command(BaseCommand):
    help = "Load seed data: institution, campus, academic year, grade levels, grading scale, academic areas."

    def handle(self, *args, **options):
        # Institution (reference from analysis doc)
        institution, created = Institution.objects.get_or_create(
            dane_code="219212000339",
            defaults={
                "name": "INSTITUCIÓN EDUCATIVA AGROPECUARIA CARRIZALES",
                "legal_reference": "Art. 16 Decreto 1290 de 2009",
                "nit": "817006134-1",
            },
        )
        if created:
            self.stdout.write(f"Created institution: {institution.name}")

        # Campus
        campus, _ = Campus.objects.get_or_create(
            institution=institution,
            defaults={
                "name": "COLEGIO RURAL AGROPECUARIO CARRIZALES",
                "code": "E.R.M. CARRIZALES",
            },
        )
        self.stdout.write(f"  Campus: {campus.name}")

        # Academic year (current)
        from django.utils import timezone

        current_year = timezone.now().year
        academic_year, _ = AcademicYear.objects.get_or_create(
            institution=institution,
            year=current_year,
            defaults={
                "start_date": date(current_year, 1, 15),
                "end_date": date(current_year, 11, 30),
                "is_active": True,
            },
        )
        self.stdout.write(f"  Academic year: {academic_year.year}")

        # Grade levels (PRIMERO through ONCE)
        grade_names = [
            ("PRIMERO", 1),
            ("SEGUNDO", 2),
            ("TERCERO", 3),
            ("CUARTO", 4),
            ("QUINTO", 5),
            ("SEXTO", 6),
            ("SÉPTIMO", 7),
            ("OCTAVO", 8),
            ("NOVENO", 9),
            ("DÉCIMO", 10),
            ("ONCE", 11),
        ]
        for name, order in grade_names:
            GradeLevel.objects.get_or_create(
                institution=institution,
                name=name,
                defaults={"level_order": order},
            )
        self.stdout.write(f"  Grade levels: {len(grade_names)} created")

        # Grading scale (Decreto 1290)
        scale_data = [
            ("SP", "Superior", "4.60", "5.00"),
            ("AL", "Alto", "4.00", "4.59"),
            ("BS", "Básico", "3.00", "3.99"),
            ("BJ", "Bajo", "0.00", "2.99"),
        ]
        for code, name, min_s, max_s in scale_data:
            GradingScale.objects.get_or_create(
                institution=institution,
                code=code,
                defaults={
                    "name": name,
                    "min_score": min_s,
                    "max_score": max_s,
                },
            )
        self.stdout.write(f"  Grading scale: {len(scale_data)} levels")

        # Academic areas (from reference document)
        areas = [
            "BIENESTAR Y CULTURA",
            "COMUNICACIÓN COMUNITARIA",
            "COMUNIDAD Y PARTICIPACIÓN",
            "HUMANIDAD Y ESPIRITUALIDAD",
            "INGLÉS",
            "NATURALEZA Y PRODUCCIÓN",
            "PENSAMIENTO MATEMÁTICO",
        ]
        for area_name in areas:
            AcademicArea.objects.get_or_create(
                institution=institution,
                name=area_name,
                defaults={"code": area_name[:10].replace(" ", "").upper()},
            )
        self.stdout.write(f"  Academic areas: {len(areas)} created")

        self.stdout.write(self.style.SUCCESS("Seed data loaded successfully."))

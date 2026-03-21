"""
Core models for the eduCalc academic reporting system.

All models use UUID primary keys and standard timestamps.
Reference: docs/analisis-entidades-reporte-academico.md
"""
import uuid

from django.db import models


class TimeStampedModel(models.Model):
    """Abstract base model with UUID pk and created/updated timestamps."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Institution(TimeStampedModel):
    """Educational institution at corporate level."""

    name = models.CharField(max_length=255)
    legal_reference = models.CharField(max_length=255, blank=True)
    dane_code = models.CharField(max_length=20, unique=True)
    nit = models.CharField(max_length=20, blank=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Institution"
        verbose_name_plural = "Institutions"

    def __str__(self):
        return self.name


class Campus(TimeStampedModel):
    """Campus or sede of an institution."""

    institution = models.ForeignKey(
        Institution, on_delete=models.CASCADE, related_name="campuses"
    )
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, blank=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Campus"
        verbose_name_plural = "Campuses"

    def __str__(self):
        return f"{self.name} ({self.institution.name})"


class AcademicYear(TimeStampedModel):
    """Academic/school year."""

    institution = models.ForeignKey(
        Institution, on_delete=models.CASCADE, related_name="academic_years"
    )
    year = models.PositiveIntegerField()
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=False)

    class Meta:
        ordering = ["-year"]
        verbose_name = "Academic Year"
        verbose_name_plural = "Academic Years"
        unique_together = [["institution", "year"]]

    def __str__(self):
        return f"{self.institution.name} - {self.year}"


class GradeLevel(TimeStampedModel):
    """Grade level (e.g. SEXTO, PRIMERO, SEGUNDO)."""

    institution = models.ForeignKey(
        Institution, on_delete=models.CASCADE, related_name="grade_levels"
    )
    name = models.CharField(max_length=100)
    level_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["level_order", "name"]
        verbose_name = "Grade Level"
        verbose_name_plural = "Grade Levels"
        unique_together = [["institution", "name"]]

    def __str__(self):
        return self.name


class AcademicArea(TimeStampedModel):
    """Broad category of knowledge (e.g. BIENESTAR Y CULTURA, PENSAMIENTO MATEMÁTICO)."""

    institution = models.ForeignKey(
        Institution, on_delete=models.CASCADE, related_name="academic_areas"
    )
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, blank=True)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Academic Area"
        verbose_name_plural = "Academic Areas"
        unique_together = [["institution", "name"]]

    def __str__(self):
        return self.name


class GradingScale(TimeStampedModel):
    """Performance levels per Decreto 1290 (Superior, Alto, Básico, Bajo)."""

    institution = models.ForeignKey(
        Institution, on_delete=models.CASCADE, related_name="grading_scales"
    )
    code = models.CharField(max_length=10)  # SP, AL, BS, BJ
    name = models.CharField(max_length=50)  # Superior, Alto, Básico, Bajo
    min_score = models.DecimalField(max_digits=4, decimal_places=2)
    max_score = models.DecimalField(max_digits=4, decimal_places=2)
    description = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-min_score"]
        verbose_name = "Grading Scale"
        verbose_name_plural = "Grading Scales"
        unique_together = [["institution", "code"]]

    def __str__(self):
        return f"{self.code} - {self.name} ({self.min_score}-{self.max_score})"

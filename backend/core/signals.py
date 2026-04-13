"""Signals for the core app."""
from django.contrib.auth import get_user_model
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import Grade, UserProfile
from .performance_summary_service import (
    group_period_ids_from_grade,
    schedule_sync_after_grade_change,
)

User = get_user_model()


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """Create UserProfile when a new User is created."""
    if created:
        default_role = "ADMIN" if instance.is_superuser else "TEACHER"
        UserProfile.objects.get_or_create(user=instance, defaults={"role": default_role})


@receiver(post_save, sender=Grade)
def performance_summary_on_grade_save(sender, instance, **kwargs):
    gid, pid = group_period_ids_from_grade(instance)
    if gid and pid:
        schedule_sync_after_grade_change(gid, pid)


@receiver(post_delete, sender=Grade)
def performance_summary_on_grade_delete(sender, instance, **kwargs):
    gid, pid = group_period_ids_from_grade(instance)
    if gid and pid:
        schedule_sync_after_grade_change(gid, pid)

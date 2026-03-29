"""Signals for the core app."""
from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import UserProfile

User = get_user_model()


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """Create UserProfile when a new User is created."""
    if created:
        default_role = "ADMIN" if instance.is_superuser else "TEACHER"
        UserProfile.objects.get_or_create(user=instance, defaults={"role": default_role})

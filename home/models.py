# home/models.py
# Django models for pins, reactions, friendships, and multi-photo attachments.

from django.conf import settings
from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

# ------------------------------------------------------
# PIN + PHOTO MODELS
# ------------------------------------------------------

class Pin(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="pins"
    )

    city = models.CharField(max_length=100, blank=True, null=True)
    state = models.CharField(max_length=120, blank=True, null=True)
    country = models.CharField(max_length=100, blank=True, null=True)

    latitude = models.FloatField()
    longitude = models.FloatField()

    caption = models.CharField(max_length=280, blank=True)
    image = models.ImageField(upload_to="pins/", blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} @ {self.city}, {self.country} ({self.latitude:.3f}, {self.longitude:.3f})"


class PinPhoto(models.Model):
    pin = models.ForeignKey(
        Pin,
        on_delete=models.CASCADE,
        related_name="photos",
    )

    image = models.ImageField(upload_to="pin_photos/")
    caption = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Photo {self.id} for Pin {self.pin_id}"


# ------------------------------------------------------
# REACTION MODEL
# ------------------------------------------------------

class Reaction(models.Model):
    EMOJI_CHOICES = [
        ("like", "👍"),
        ("love", "❤️"),
        ("laugh", "😂"),
        ("wow", "😮"),
    ]

    pin = models.ForeignKey(Pin, on_delete=models.CASCADE, related_name="reactions")
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    emoji = models.CharField(max_length=10, choices=EMOJI_CHOICES)

    class Meta:
        unique_together = ("pin", "user")


# ------------------------------------------------------
# NEW FRIENDSHIP MODEL
# ------------------------------------------------------

class Friendship(models.Model):
    """
    Represents a friend request or accepted friendship.
    - from_user → person who sent request
    - to_user → recipient
    - status → pending / accepted
    """
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("accepted", "Accepted"),
    ]

    from_user = models.ForeignKey(
        User,
        related_name="friendships_sent",
        on_delete=models.CASCADE
    )
    to_user = models.ForeignKey(
        User,
        related_name="friendships_received",
        on_delete=models.CASCADE
    )
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Prevent duplicate friend requests
        constraints = [
            models.UniqueConstraint(
                fields=["from_user", "to_user"],
                name="unique_friendship_request"
            )
        ]

    def __str__(self):
        return f"{self.from_user} → {self.to_user} ({self.status})"

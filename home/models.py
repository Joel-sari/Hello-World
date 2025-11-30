# home/models.py
# Django models for pins, reactions, and (multi-photo) pin attachments used by the Hello World globe app.

from django.conf import settings
from django.db import models
from django.contrib.auth import get_user_model
User = get_user_model()


# Pin
# ----
# Represents a single location on the globe that a user has visited.
# Each Pin belongs to exactly one user and stores both a human-readable
# location (city/state/country) and precise coordinates for 3D rendering.
# The `image` field is treated as the "cover" photo for the pin; additional
# photos will be stored in the PinPhoto model (see below).
class Pin(models.Model):
    # Owner of this pin (who created it). We keep a reverse relation `user.pins`.
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="pins"
    )

    # Human-readable location fields. These are optional so that we can
    # still store pins even if the geocoder cannot resolve everything.
    city = models.CharField(max_length=100, blank=True, null=True)
    state = models.CharField(max_length=120, blank=True, null = True)
    country = models.CharField(max_length=100, blank=True, null=True)

    # Actual coordinates used to place the pin on the Three.js globe.
    # These are always required once the pin is created.
    latitude = models.FloatField()     # -90..+90
    longitude = models.FloatField()    # -180..+180

    # User-provided caption and a single "cover" image for the pin.
    # Additional images are stored in PinPhoto below and can be surfaced
    # in a gallery view in the UI.
    caption = models.CharField(max_length=280, blank=True)
    image = models.ImageField(upload_to="pins/", blank=True, null=True)

    # When the pin was first created. Used for ordering and timeline views.
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} @ {self.city}, {self.country} ({self.latitude:.3f}, {self.longitude:.3f})"


class PinPhoto(models.Model):
    """
    PinPhoto
    --------
    Represents an additional photo attached to a Pin.
    A single Pin can have multiple PinPhoto rows (e.g. up to 5),
    which allows us to show a mini-gallery when the user clicks a pin.
    """

    # The pin this photo belongs to. The related_name "photos" lets us
    # access all photos for a pin via `pin.photos.all()`.
    pin = models.ForeignKey(
        Pin,
        on_delete=models.CASCADE,
        related_name="photos",
    )

    # Actual image file stored in MEDIA_ROOT/pin_photos/.
    image = models.ImageField(upload_to="pin_photos/")

    # Optional per-photo caption (for example, a more specific note
    # than the main Pin caption).
    caption = models.CharField(max_length=255, blank=True)

    # When this photo was uploaded. Useful for sorting in galleries.
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        # Helpful string representation in the Django admin / shell.
        return f"Photo {self.id} for Pin {self.pin_id}"


# Reaction
# --------
# Stores lightweight emoji reactions that users leave on pins.
# A user can react to a given pin only once (enforced in Meta).
class Reaction(models.Model):
    EMOJI_CHOICES = [
        ("like", "👍"),
        ("love", "❤️"),
        ("laugh", "😂"),
        ("wow", "😮"),
    ]

    # The pin this reaction is attached to.
    pin = models.ForeignKey(Pin, on_delete=models.CASCADE, related_name="reactions")
    # The user who reacted.
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    # Logical emoji key (e.g. "like", "love", "laugh", "wow").
    # The actual symbol is stored in EMOJI_CHOICES for display.
    emoji = models.CharField(max_length=10, choices=EMOJI_CHOICES)

    class Meta:
        # Ensure a user can only have one reaction per pin.
        unique_together = ("pin", "user")  # Only 1 reaction per user per pin
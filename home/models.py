from django.conf import settings
from django.db import models
from django.contrib.auth import get_user_model
User = get_user_model()



class Pin(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="pins"
    )

    # Human-readable location fields
    city = models.CharField(max_length=100, blank=True, null=True)
    state = models.CharField(max_length=120, blank=True, null = True)
    country = models.CharField(max_length=100, blank=True, null=True)

    # Actual coordinates used for 3D globe positioning
    latitude = models.FloatField()     # -90..+90
    longitude = models.FloatField()    # -180..+180

    caption = models.CharField(max_length=280, blank=True)
    image = models.ImageField(upload_to="pins/", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} @ {self.city}, {self.country} ({self.latitude:.3f}, {self.longitude:.3f})"
    
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
        unique_together = ("pin", "user")  # Only 1 reaction per user per pin
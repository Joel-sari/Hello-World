from django.conf import settings
from django.db import models

class Pin(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="pins")
    latitude = models.FloatField()     # -90..+90
    longitude = models.FloatField()    # -180..+180
    caption = models.CharField(max_length=280, blank=True)
    image = models.ImageField(upload_to="pins/", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} @ ({self.latitude:.3f}, {self.longitude:.3f})"

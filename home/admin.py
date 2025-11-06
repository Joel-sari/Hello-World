from django.contrib import admin
from .models import Pin

@admin.register(Pin)
class PinAdmin(admin.ModelAdmin):
    list_display = ("user", "latitude", "longitude", "caption", "created_at")
    list_filter = ("user", "created_at")
    search_fields = ("caption",)

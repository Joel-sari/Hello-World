from django.contrib import admin
from django.urls import reverse
from django.shortcuts import redirect

from .models import Pin, Reaction, Friendship


@admin.register(Pin)
class PinAdmin(admin.ModelAdmin):
    list_display = ("user", "latitude", "longitude", "caption", "created_at")
    list_filter = ("user", "created_at")
    search_fields = ("caption",)


# Optional: register Reaction and Friendship if you want to see them in admin
@admin.register(Reaction)
class ReactionAdmin(admin.ModelAdmin):
    list_display = ("pin", "user", "emoji")
    list_filter = ("emoji",)


@admin.register(Friendship)
class FriendshipAdmin(admin.ModelAdmin):
    list_display = ("from_user", "to_user", "status", "created_at")
    list_filter = ("status",)


# Proxy model to create a "Popularity dashboard" menu item
class PopularityProxy(Pin):
    class Meta:
        proxy = True
        verbose_name = "Popularity dashboard"
        verbose_name_plural = "Popularity dashboard"


@admin.register(PopularityProxy)
class PopularityAdmin(admin.ModelAdmin):
    """
    When you click this in the admin sidebar, it redirects
    to the real /admin/popularity/ dashboard view.
    """
    change_list_template = "admin/popularity_redirect.html"

    def changelist_view(self, request, extra_context=None):
        return redirect(reverse("admin_popularity"))

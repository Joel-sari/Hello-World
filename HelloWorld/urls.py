"""
URL configuration for HelloWorld project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include

from home.views import popularity_dashboard  # ⬅️ import the dashboard view


urlpatterns = [
    # Custom admin analytics dashboard
    path("admin/popularity/", popularity_dashboard, name="admin_popularity"),

    # Default Django admin
    path("admin/", admin.site.urls),

    # Public site URLs
    path("", include("home.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

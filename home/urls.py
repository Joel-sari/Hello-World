from django.urls import path
from django.contrib.auth import views as auth_views
from . import views

from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("", views.index, name="index"),           # login + half-globe
    path("map/", views.map_view, name="map"),      # full globe (auth required)
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
    path("signup/", views.signup_view, name="signup"),

    # === API endpoints ===
    path("api/my-pins/", views.my_pins, name="my_pins"),
    #path("api/search/", views.search_by_country, name="search_by_country"), This is old 
    path("api/search/", views.search_location, name="search_location"),
    path("api/add-pin/", views.add_pin, name="add_pin"),

    # 🔹 new: fetch a single pin for the details/edit modal
    path("api/pin/<int:pin_id>/", views.get_pin, name="get_pin"),

    # Gallery view
    path("gallery/", views.gallery_view, name="gallery"),
    path("api/my-photos/", views.my_photos, name="my_photos"),

    # 🔹 new: save edits to a pin (caption/image)
    path("api/edit-pin/<int:pin_id>/", views.edit_pin, name="edit_pin"),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
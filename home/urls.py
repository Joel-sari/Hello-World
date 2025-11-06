from django.urls import path
from django.contrib.auth import views as auth_views
from . import views

urlpatterns = [
    path("", views.index, name="index"),           # login + half-globe
    path("map/", views.map_view, name="map"),      # full globe (auth required)
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
    path("signup/", views.signup_view, name="signup"),
    path("api/my-pins/", views.my_pins, name="my_pins"),
    path("api/add-pin/", views.add_pin, name="add_pin"),
]
from django.urls import path
from . import views

urlpatterns = [
    path("", views.index, name="index"),           # login + half-globe
    path("map/", views.map_view, name="map"),      # full globe (auth required)
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
     path("signup/", views.signup_view, name="signup")
]
# home/views.py
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render
from django.contrib import messages
from django import forms
from .forms import SignUpForm
from django.http import JsonResponse
from .models import Pin

class LoginForm(forms.Form):
    username = forms.CharField(widget=forms.TextInput(attrs={"placeholder": "Username"}))
    password = forms.CharField(widget=forms.PasswordInput(attrs={"placeholder": "Password"}))


def index(request):
    # If already logged in, skip login screen
    if request.user.is_authenticated:
        return redirect("map")

    form = LoginForm()
    return render(request, "home/index.html", {"form": form})


def signup_view(request):
    if request.method == "POST":
        form = SignUpForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)   # auto-log in after signup
            messages.success(request, f"Welcome, {user.username}!")
            return redirect("map")
        else:
            messages.error(request, "Please fix the errors below.")
    else:
        form = SignUpForm()
    return render(request, "home/signup.html", {"form": form})


def login_view(request):
    if request.method != "POST":
        return redirect("index")

    form = LoginForm(request.POST)
    if form.is_valid():
        user = authenticate(
            request,
            username=form.cleaned_data["username"],
            password=form.cleaned_data["password"],
        )
        if user is not None:
            login(request, user)
            return redirect("map")
        messages.error(request, "Invalid username or password.")

    # Re-render login screen with errors
    return render(request, "home/index.html", {"form": form})


def logout_view(request):
    logout(request)
    return redirect("index")


@login_required
def map_view(request):
    # Full globe view (camera reveal happens on load)
    return render(request, "home/map.html")


@login_required
def my_pins(request):
    pins = Pin.objects.filter(user=request.user).values(
        "id", "latitude", "longitude", "caption", "image"
    )
    # Convert to list and expand image URL if present
    data = []
    for p in pins:
        data.append({
            "id": p["id"],
            "lat": p["latitude"],
            "lon": p["longitude"],
            "caption": p["caption"] or "",
            "imageUrl": request.build_absolute_uri(p["image"]) if p["image"] else None,
        })
    return JsonResponse({"pins": data})


# ------------------------------
# Country search API
# ------------------------------

# Very lightweight static bounds for a few countries.
# You can expand this list anytime (values are approximate).
COUNTRY_BOUNDS = {
    # lat_min, lat_max, lon_min, lon_max
    "united states": (24.5, 49.5, -125.0, -66.9),
    "usa":            (24.5, 49.5, -125.0, -66.9),
    "us":             (24.5, 49.5, -125.0, -66.9),
    "canada":         (41.7, 83.1, -141.0, -52.6),
    "mexico":         (14.5, 32.7, -118.5, -86.5),
    "brazil":         (-33.8, 5.3, -73.9, -34.8),
    "uk":             (49.9, 60.9, -8.6, 1.8),
    "united kingdom": (49.9, 60.9, -8.6, 1.8),
    "france":         (41.0, 51.2, -5.3, 9.6),
    "germany":        (47.2, 55.1, 5.9, 15.0),
    "spain":          (36.0, 43.8, -9.5, 3.3),
    "italy":          (36.6, 47.1, 6.6, 18.6),
    "india":          (6.5, 35.7, 68.1, 97.4),
    "china":          (18.0, 53.6, 73.5, 134.8),
    "japan":          (24.0, 45.6, 122.9, 153.9),
    "australia":      (-43.7, -10.7, 113.3, 153.6),
    "south africa":   (-34.9, -22.1, 16.4, 32.9),
}

def _normalize_country(q: str) -> str:
    return (q or "").strip().lower()

def _bounds_to_center(bounds):
    lat_min, lat_max, lon_min, lon_max = bounds
    return [(lat_min + lat_max) / 2.0, (lon_min + lon_max) / 2.0]

@login_required
def search_by_country(request):
    """
    GET /api/search/?country=<name>

    Returns:
      {
        "country": "<normalized name>",
        "bounds": [lat_min, lat_max, lon_min, lon_max],
        "center": [lat, lon],
        "pins": [
          {
            "user": "username",
            "caption": "...",
            "lat": 12.34,
            "lon": 56.78,
            "imageUrl": "https://.../media/pins/.."
          },
          ...
        ]
      }
    """
    name_raw = request.GET.get("country")
    name = _normalize_country(name_raw)

    if not name:
        return JsonResponse({"error": "Missing 'country' query parameter."}, status=400)

    bounds = COUNTRY_BOUNDS.get(name)
    if not bounds:
        return JsonResponse(
            {
                "error": "Unknown country.",
                "hint": "Try a different spelling (e.g., 'United States', 'UK', 'India')."
            },
            status=404,
        )

    lat_min, lat_max, lon_min, lon_max = bounds
    pins_qs = Pin.objects.filter(
        latitude__gte=lat_min,
        latitude__lte=lat_max,
        longitude__gte=lon_min,
        longitude__lte=lon_max,
    )

    pins = []
    for p in pins_qs:
        pins.append({
            "user": p.user.username,
            "caption": p.caption or "",
            "lat": p.latitude,
            "lon": p.longitude,
            "imageUrl": request.build_absolute_uri(p.image.url) if p.image else None,
        })

    return JsonResponse({
        "country": name,
        "bounds": [lat_min, lat_max, lon_min, lon_max],
        "center": _bounds_to_center(bounds),
        "pins": pins,
    })

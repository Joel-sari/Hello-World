# home/views.py
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render
from django.shortcuts import get_object_or_404
from django.contrib import messages
from django import forms
from .forms import SignUpForm
from django.http import JsonResponse
from .models import Pin, PinPhoto
from .forms import PinForm
import requests
from django.conf import settings
from datetime import datetime

# Max number of photos per pin (1 cover + up to 4 extra = 5 total)
MAX_PIN_PHOTOS = 5

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
    """
    Return all pins for the current user, including:
      - cover image (Pin.image)
      - extra gallery images (PinPhoto, as URLs)
    The frontend (main.js → loadMyPins) expects:
      { "pins": [ { id, lat, lon, caption, imageUrl, photos[], ... }, ... ] }
    """
    pins_qs = (
        Pin.objects.filter(user=request.user)
        .select_related("user")
        .prefetch_related("photos")
    )

    data = []
    for pin in pins_qs:
        cover_url = (
            request.build_absolute_uri(pin.image.url) if pin.image else None
        )

        # For map + pin details modal we only need URLs here
        extra_photos = [
            request.build_absolute_uri(photo.image.url)
            for photo in pin.photos.all()
        ]

        photo_count = (1 if cover_url else 0) + len(extra_photos)

        data.append({
            "id": pin.id,
            "lat": pin.latitude,
            "lon": pin.longitude,
            "caption": pin.caption or "",
            "imageUrl": cover_url,      # cover image
            "photos": extra_photos,     # extra images (URLs)
            "photoCount": photo_count,  # for "5 photos" indicator if you want
            "user": pin.user.username,
            "city": pin.city,
            "state": pin.state,
            "country": pin.country,
        })

    return JsonResponse({"pins": data})

def geocode_location(city: str, state: str, country: str):
    """
    Use OpenCage API to turn (city/state/country) into (lat, lon).
    Returns (lat, lon) or None if nothing found.
    """
    # Build a nice query string like: "Madrid, Community of Madrid, Spain"
    parts = [city.strip()] if city else []
    if state:
        parts.append(state.strip())
    if country:
        parts.append(country.strip())
    query = ", ".join(p for p in parts if p)

    if not query:
        return None

    url = "https://api.opencagedata.com/geocode/v1/json"
    params = {
        "q": query,
        "key": settings.OPENCAGE_API_KEY,
        "limit": 1,
    }

    try:
        resp = requests.get(url, params=params, timeout=5)
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        return None

    if not data.get("results"):
        return None

    geom = data["results"][0]["geometry"]
    return float(geom["lat"]), float(geom["lng"])





# This will replace the search by country functions since we want our users to be able to search for any country or city not just a fixed amount. 
@login_required
def search_location(request):
    """
    GET /api/search/?q=<location>
    Supports any city, country, region, landmark via OpenCage.
    Returns:
      { "center": [lat, lon], "pins": [ ... ] }
    """
    query = request.GET.get("q", "").strip()
    if not query:
        return JsonResponse({"error": "Missing 'q' parameter."}, status=400)

    # Use the same geocoder used for pin creation
    geo = geocode_location(city=query, state="", country="")
    if not geo:
        return JsonResponse({"error": "Location not found."}, status=404)

    lat, lon = geo

    # Fetch pins within ~5 degrees (rough bounding box)
    lat_min, lat_max = lat - 5, lat + 5
    lon_min, lon_max = lon - 5, lon + 5

    pins_qs = Pin.objects.filter(
        latitude__gte=lat_min,
        latitude__lte=lat_max,
        longitude__gte=lon_min,
        longitude__lte=lon_max,
    )

    pins = []
    for p in pins_qs:
        pins.append({
            "id": p.id,
            "user": p.user.username,
            "caption": p.caption or "",
            "lat": p.latitude,
            "lon": p.longitude,
            "imageUrl": request.build_absolute_uri(p.image.url) if p.image else None,
            "city": p.city,
            "state": p.state,
            "country": p.country,
            })

    return JsonResponse({
        "query": query,
        "center": [lat, lon],
        "pins": pins,
    })
@login_required
def get_pin(request, pin_id):
    """
    Return full details for a single pin, including:
      - coordinates
      - caption
      - cover image
      - extra gallery photos
      - owner + location info
    Used by the pin details modal and (later) a full-screen gallery.
    """
    pin = get_object_or_404(
        Pin.objects.select_related("user").prefetch_related("photos"),
        id=pin_id
    )

    cover_url = (
        request.build_absolute_uri(pin.image.url) if pin.image else None
    )
    extra_photos = [
    {
        "id": photo.id,
        "url": request.build_absolute_uri(photo.image.url),
    }
    for photo in pin.photos.all()
    ]
    photo_count = (1 if cover_url else 0) + len(extra_photos)

    return JsonResponse({
        "id": pin.id,
        "lat": pin.latitude,
        "lon": pin.longitude,
        "caption": pin.caption or "",
        "imageUrl": cover_url,
        "photos": extra_photos,       # <-- now objects
        "photoCount": photo_count,
        "user": pin.user.username,
        "city": pin.city,
        "state": pin.state,
        "country": pin.country,
    })

@login_required
def add_pin(request):
    if request.method == "POST":
        form = PinForm(request.POST, request.FILES)
        if form.is_valid():
            temp_pin = form.save(commit=False)

            # Geocode the human location fields
            geo = geocode_location(
                city=temp_pin.city,
                state=temp_pin.state,
                country=temp_pin.country,
            )
            if not geo:
                return JsonResponse(
                    {
                        "errors": {
                            "location": [
                                "Could not find that location. Try a more specific city/state/country."
                            ]
                        }
                    },
                    status=400,
                )

            lat, lon = geo
            temp_pin.latitude = lat
            temp_pin.longitude = lon
            temp_pin.user = request.user
            temp_pin.save()

      

            # NEW: handle extra gallery photos
            # -----------------------------
            # Frontend sends all extra images in the "photos" field
            extra_files = request.FILES.getlist("photos")

            # How many photos this pin already has (for new pins, it's 0)
            current_count = temp_pin.photos.count()
            remaining_slots = MAX_PIN_PHOTOS - current_count
            if remaining_slots < 0:
                remaining_slots = 0  # safety guard

            # Create PinPhoto rows for up to the remaining slots
            for f in extra_files[:remaining_slots]:
                PinPhoto.objects.create(pin=temp_pin, image=f)

            # Build list of extra photo URLs for JSON response
            extra_photos = [
                {
                    "id": photo.id,
                    "url": request.build_absolute_uri(photo.image.url),
                }
                for photo in temp_pin.photos.all()
            ]
            cover_url = (
                request.build_absolute_uri(temp_pin.image.url)
                if temp_pin.image
                else None
            )
            photo_count = (1 if cover_url else 0) + len(extra_photos)

            return JsonResponse({
                "id": temp_pin.id,
                "lat": temp_pin.latitude,
                "lon": temp_pin.longitude,
                "caption": temp_pin.caption,
                "imageUrl": cover_url,
                "photos": extra_photos,
                "photoCount": photo_count,
                "city": temp_pin.city,
                "state": temp_pin.state,
                "country": temp_pin.country,
                "user": temp_pin.user.username,
                "isOwner": True,
            })

        return JsonResponse({"errors": form.errors}, status=400)

    return JsonResponse({"error": "POST required"}, status=405)

@login_required
def edit_pin(request, pin_id):
    """
    POST /api/edit-pin/<id>/
    Allows the logged-in user to edit their own pin’s caption, image, and location.
    """
    pin = get_object_or_404(Pin, id=pin_id, user=request.user)

    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)

    # Store original location before updating the form
    old_city = pin.city
    old_state = pin.state
    old_country = pin.country

    form = PinForm(request.POST, request.FILES, instance=pin)

    if form.is_valid():
        updated_pin = form.save(commit=False)

        # If user changed any part of the location → re-geocode
        if (updated_pin.city != old_city or
            updated_pin.state != old_state or
            updated_pin.country != old_country):

            geo = geocode_location(
                city=updated_pin.city,
                state=updated_pin.state,
                country=updated_pin.country,
            )

            if not geo:
                return JsonResponse(
                    {"errors": {"location": ["Could not find that location. Try a more specific city/state/country."]}},
                    status=400,
                )
            
            lat, lon = geo
            updated_pin.latitude = lat
            updated_pin.longitude = lon

        updated_pin.save()
        # -----------------------------
        # Handle deletions for existing photos (if any)
        # -----------------------------
        to_delete_raw = request.POST.get("photos_to_delete", "").strip()
        if to_delete_raw:
            ids = [
                int(x)
                for x in to_delete_raw.split(",")
                if x.strip().isdigit()
            ]
            if ids:
                PinPhoto.objects.filter(pin=updated_pin, id__in=ids).delete()

        # -----------------------------
        # NEW: handle extra images on edit
        # -----------------------------
        extra_files = request.FILES.getlist("photos")

        # Current total photos = cover (if any) + extra PinPhoto rows
        current_count = (1 if updated_pin.image else 0) + updated_pin.photos.count()
        remaining_slots = MAX_PIN_PHOTOS - current_count

        if remaining_slots < 0:
            remaining_slots = 0

        for f in extra_files[:remaining_slots]:
            PinPhoto.objects.create(pin=updated_pin, image=f)

        

        # Recompute URLs + counts for response
        cover_url = (
            request.build_absolute_uri(updated_pin.image.url)
            if updated_pin.image
            else None
        )
        extra_photos = [
            request.build_absolute_uri(photo.image.url)
            for photo in updated_pin.photos.all()
        ]
        photo_count = (1 if cover_url else 0) + len(extra_photos)

        return JsonResponse({
            "id": updated_pin.id,
            "lat": updated_pin.latitude,
            "lon": updated_pin.longitude,
            "caption": updated_pin.caption or "",
            "imageUrl": cover_url,
            "photos": extra_photos,
            "photoCount": photo_count,
            "city": updated_pin.city,
            "state": updated_pin.state,
            "country": updated_pin.country,
            "user": updated_pin.user.username,
            "isOwner": True,
            "updated": True,
        })

    return JsonResponse({"errors": form.errors}, status=400)

# NOW WE WILL FOCUS ON THE GALLERY VIEW!
@login_required
def gallery_view(request):
    """
    Render the photo gallery page.
    The page itself will fetch photo data via /api/my-photos/.
    """
    return render(request, "home/gallery.html")

@login_required
def my_photos(request):
    """
    Return ALL photos for the current user (covers + PinPhoto extras),
    flattened into a single list so the frontend can show them in a grid.

    Response shape:
      {
        "photos": [
          {
            "id": <photo_id or "pin-<id>" for cover>,
            "pin_id": <pin id>,
            "imageUrl": "<absolute url>",
            "caption": "...",
            "city": "...",
            "country": "...",
            "createdAt": "2025-11-29T12:34:56Z"
          },
          ...
        ]
      }
    """
    # 1) Get all pins for this user
    pins = (
        Pin.objects.filter(user=request.user)
        .select_related("user")
        .prefetch_related("photos")
    )

    photos_payload = []

    for pin in pins:
        # Cover image as a "photo"
        if pin.image:
            photos_payload.append({
                "id": f"cover-{pin.id}",
                "pin_id": pin.id,
                "imageUrl": request.build_absolute_uri(pin.image.url),
                "caption": pin.caption or "",
                "city": pin.city,
                "country": pin.country,
                # If Pin has created_at, use that; otherwise reuse pin.id or something
                "createdAt": getattr(pin, "created_at", None),
            })

        # Extra gallery images
        for photo in pin.photos.all():
            photos_payload.append({
                "id": photo.id,
                "pin_id": pin.id,
                "imageUrl": request.build_absolute_uri(photo.image.url),
                "caption": pin.caption or "",
                "city": pin.city,
                "country": pin.country,
                "createdAt": photo.created_at,
            })

    # Optional: sort newest → oldest by createdAt
    photos_payload.sort(
        key=lambda p: p["createdAt"] or datetime.min,
        reverse=True,
    )

    return JsonResponse({"photos": photos_payload})

# -----------------------------------------------------------
# FRIENDSHIP API ENDPOINTS
# -----------------------------------------------------------

from .models import Friendship
from django.db.models import Q

@login_required
def search_users(request):
    """
    GET /api/friends/search/?q=<text>
    Returns a list of users matching the query (excluding self).
    """
    query = request.GET.get("q", "").strip()
    if not query:
        return JsonResponse({"results": []})

    users = User.objects.filter(username__icontains=query).exclude(
        id=request.user.id
    )[:20]

    results = [
        {
            "id": u.id,
            "username": u.username,
            "display_name": u.username,
        }
        for u in users
    ]

    return JsonResponse({"results": results})


@login_required
def friend_request(request, username):
    """
    POST /api/friend-request/<username>/
    Sends a friend request unless one already exists.
    """
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)

    try:
        target = User.objects.get(username=username)
    except User.DoesNotExist:
        return JsonResponse({"error": "User not found"}, status=404)

    if target == request.user:
        return JsonResponse({"error": "Cannot friend yourself"}, status=400)

    # Check if any relationship already exists in either direction
    existing = Friendship.objects.filter(
        Q(from_user=request.user, to_user=target)
        | Q(from_user=target, to_user=request.user)
    ).first()

    if existing:
        return JsonResponse({"status": existing.status})

    # Create new pending request
    Friendship.objects.create(
        from_user=request.user,
        to_user=target,
        status="pending"
    )

    return JsonResponse({"ok": True, "status": "pending"})


@login_required
def friend_accept(request, friendship_id):
    """
    POST /api/friend-accept/<id>/
    Accepts an incoming friend request.
    """
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)

    try:
        fr = Friendship.objects.get(id=friendship_id, to_user=request.user)
    except Friendship.DoesNotExist:
        return JsonResponse({"error": "Friend request not found"}, status=404)

    fr.status = "accepted"
    fr.save()

    return JsonResponse({
        "id": fr.id,
        "from_user": fr.from_user.username,
        "to_user": fr.to_user.username,
        "status": fr.status
    })


@login_required
def friend_reject(request, friendship_id):
    """
    POST /api/friend-reject/<id>/
    Deletes the friend request entirely.
    """
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)

    try:
        fr = Friendship.objects.get(id=friendship_id, to_user=request.user)
    except Friendship.DoesNotExist:
        return JsonResponse({"error": "Friend request not found"}, status=404)

    fr.delete()

    return JsonResponse({"ok": True})


@login_required
def friend_list(request):
    """
    GET /api/friends/
    Returns:
      - accepted friends
      - incoming pending
      - outgoing pending
    """
    # Accepted friendships
    accepted = Friendship.objects.filter(
        Q(from_user=request.user) | Q(to_user=request.user),
        status="accepted"
    )

    def other_user(f):
        return f.to_user if f.from_user == request.user else f.from_user

    friends = [
        {"id": other_user(f).id, "username": other_user(f).username}
        for f in accepted
    ]

    # Incoming friend requests
    incoming = [
        {
            "id": fr.id,
            "from_user": fr.from_user.username,
        }
        for fr in Friendship.objects.filter(
            to_user=request.user, status="pending"
        )
    ]

    # Outgoing friend requests
    outgoing = [
        {
            "id": fr.id,
            "to_user": fr.to_user.username,
        }
        for fr in Friendship.objects.filter(
            from_user=request.user, status="pending"
        )
    ]

    return JsonResponse({
        "friends": friends,
        "incoming_requests": incoming,
        "outgoing_requests": outgoing,
        "friend_count": len(friends),
    })
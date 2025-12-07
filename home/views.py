# home/views.py

from django.contrib.auth import authenticate, login, logout, get_user_model
from django.contrib.auth.decorators import login_required, user_passes_test
from django.shortcuts import redirect, render, get_object_or_404
from django.contrib import messages
from django import forms
from django.http import JsonResponse
from django.conf import settings
from django.db.models import Q, Count
from datetime import datetime
import requests
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import Profile

from .forms import SignUpForm, PinForm
from .models import Pin, PinPhoto, Friendship, Reaction

User = get_user_model()
MAX_PIN_PHOTOS = 5


# =====================================================================
# AUTH VIEWS
# =====================================================================

class LoginForm(forms.Form):
    username = forms.CharField(widget=forms.TextInput(attrs={"placeholder": "Username"}))
    password = forms.CharField(widget=forms.PasswordInput(attrs={"placeholder": "Password"}))


def index(request):
    if request.user.is_authenticated:
        return redirect("map")
    return render(request, "home/index.html", {"form": LoginForm()})


def signup_view(request):
    if request.method == "POST":
        form = SignUpForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            messages.success(request, f"Welcome, {user.username}!")
            return redirect("map")
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
    return render(request, "home/index.html", {"form": form})


def logout_view(request):
    logout(request)
    return redirect("index")


# =====================================================================
# MAP VIEW
# =====================================================================

@login_required
def map_view(request):
    return render(request, "home/map.html")


# =====================================================================
# PIN ENDPOINTS
# =====================================================================

@login_required
def my_pins(request):
    pins_qs = (
        Pin.objects.filter(user=request.user)
        .select_related("user")
        .prefetch_related("photos")
    )

    data = []
    for pin in pins_qs:
        cover = request.build_absolute_uri(pin.image.url) if pin.image else None
        extra = [request.build_absolute_uri(p.image.url) for p in pin.photos.all()]

        data.append({
            "id": pin.id,
            "lat": pin.latitude,
            "lon": pin.longitude,
            "caption": pin.caption or "",
            "imageUrl": cover,
            "photos": extra,
            "photoCount": (1 if cover else 0) + len(extra),
            "user": pin.user.username,
            "city": pin.city,
            "state": pin.state,
            "country": pin.country,
        })

    return JsonResponse({"pins": data})


def geocode_location(city, state, country):
    parts = [p.strip() for p in [city, state, country] if p]
    if not parts:
        return None

    # FIXED API URL (vv1 → v1)
    url = "https://api.opencagedata.com/geocode/v1/json"
    params = {
        "q": ", ".join(parts),
        "key": settings.OPENCAGE_API_KEY,
        "limit": 1
    }

    try:
        response = requests.get(url, params=params, timeout=5)
        data = response.json()
    except Exception as e:
        print("❌ GEOCODE ERROR:", e)
        return None

    if not data.get("results"):
        return None

    g = data["results"][0]["geometry"]
    return float(g["lat"]), float(g["lng"])

@login_required
def search_location(request):
    query = request.GET.get("q", "").strip()
    if not query:
        return JsonResponse({"error": "Missing 'q' parameter"}, status=400)

    geo = geocode_location(query, "", "")
    if not geo:
        return JsonResponse({"error": "Location not found"}, status=404)

    lat, lon = geo
    pins = Pin.objects.filter(
        latitude__gte=lat - 5,
        latitude__lte=lat + 5,
        longitude__gte=lon - 5,
        longitude__lte=lon + 5,
    )

    return JsonResponse({
        "query": query,
        "center": [lat, lon],
        "pins": [
            {
                "id": p.id,
                "lat": p.latitude,
                "lon": p.longitude,
                "caption": p.caption or "",
                "imageUrl": request.build_absolute_uri(p.image.url) if p.image else None,
                "user": p.user.username,
                "city": p.city,
                "state": p.state,
                "country": p.country,
            }
            for p in pins
        ],
    })


# =====================================================================
# FRIENDS SYSTEM — FULLY FIXED
# =====================================================================

@login_required
def search_users(request):
    q = request.GET.get("q", "").strip()
    if not q:
        return JsonResponse({"results": []})

    users = User.objects.filter(username__icontains=q).exclude(id=request.user.id)[:20]

    return JsonResponse({
        "results": [
            {"id": u.id, "username": u.username, "display_name": u.username}
            for u in users
        ]
    })


@login_required
def friend_request(request, username):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)

    try:
        target = User.objects.get(username=username)
    except User.DoesNotExist:
        return JsonResponse({"error": "User not found"}, status=404)

    if target == request.user:
        return JsonResponse({"error": "Cannot friend yourself"}, status=400)

    existing = Friendship.objects.filter(
        Q(from_user=request.user, to_user=target) |
        Q(from_user=target, to_user=request.user)
    ).first()

    if existing:
        return JsonResponse({"status": existing.status})

    Friendship.objects.create(from_user=request.user, to_user=target, status="pending")
    return JsonResponse({"ok": True, "status": "pending"})


@login_required
def friend_accept(request, friendship_id):
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
        "status": "accepted"
    })


@login_required
def friend_reject(request, friendship_id):
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
    Returns MUST include friendship_id so Unfriend works.
    """
    accepted = Friendship.objects.filter(
        Q(from_user=request.user) | Q(to_user=request.user),
        status="accepted"
    )

    def other_side(f):
        return f.to_user if f.from_user == request.user else f.from_user

    friends = [
        {
            "username": other_side(f).username,
            "friendship_id": f.id,   # <<< CRUCIAL FIX
        }
        for f in accepted
    ]

    incoming = [
        { "id": fr.id, "from_user": fr.from_user.username }
        for fr in Friendship.objects.filter(to_user=request.user, status="pending")
    ]

    outgoing = [
        { "id": fr.id, "to_user": fr.to_user.username }
        for fr in Friendship.objects.filter(from_user=request.user, status="pending")
    ]

    return JsonResponse({
        "friends": friends,
        "incoming_requests": incoming,
        "outgoing_requests": outgoing,
        "friend_count": len(friends),
    })


@login_required
def friend_remove(request, friendship_id):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)

    f = get_object_or_404(Friendship, id=friendship_id, status="accepted")

    if f.from_user != request.user and f.to_user != request.user:
        return JsonResponse({"error": "Not allowed"}, status=403)

    f.delete()
    return JsonResponse({"ok": True})


# =====================================================================
# USER PINS (VIEW PINS FEATURE)
# =====================================================================

@login_required
def user_pins(request, username):
    target = get_object_or_404(User, username=username)

    pins = Pin.objects.filter(user=target).select_related("user").prefetch_related("photos")

    payload = []
    for pin in pins:
        cover = request.build_absolute_uri(pin.image.url) if pin.image else None
        extra = [
            request.build_absolute_uri(photo.image.url)
            for photo in pin.photos.all()
        ]

        payload.append({
            "id": pin.id,
            "lat": pin.latitude,
            "lon": pin.longitude,
            "caption": pin.caption or "",
            "imageUrl": cover,
            "photos": extra,
            "user": target.username,
            "city": pin.city,
            "state": pin.state,
            "country": pin.country,
            "isOwner": (request.user == target),
        })

    return JsonResponse({"pins": payload})


# =====================================================================
# PIN DETAILS / ADD / EDIT
# =====================================================================

@login_required
def get_pin(request, pin_id):
    pin = get_object_or_404(
        Pin.objects.select_related("user").prefetch_related("photos"),
        id=pin_id
    )

    cover_url = request.build_absolute_uri(pin.image.url) if pin.image else None
    extra_photos = [
        {
            "id": photo.id,
            "url": request.build_absolute_uri(photo.image.url),
        }
        for photo in pin.photos.all()
    ]

    return JsonResponse({
        "id": pin.id,
        "lat": pin.latitude,
        "lon": pin.longitude,
        "caption": pin.caption or "",
        "imageUrl": cover_url,
        "photos": extra_photos,
        "user": pin.user.username,
        "city": pin.city,
        "state": pin.state,
        "country": pin.country,
    })


import logging
logger = logging.getLogger(__name__)

@login_required
def add_pin(request):
    # =============================================
    # DEBUG SECTION – LOG REQUEST DETAILS
    # =============================================
    print("\n===== ADD PIN DEBUG =====")
    print("Request method:", request.method)
    print("Headers:", dict(request.headers))
    print("GET params:", request.GET)
    print("POST params:", request.POST.dict())
    print("FILES:", request.FILES)
    print("=========================\n")

    # If NOT POST → reject
    if request.method != "POST":
        print("❌ DEBUG: Request was NOT POST — returning error")
        return JsonResponse({"error": "POST required"}, status=405)

    print("✅ DEBUG: Request IS POST, continuing")

    # =============================================
    # FORM VALIDATION
    # =============================================
    form = PinForm(request.POST, request.FILES)
    print("Form valid?", form.is_valid())
    print("Form errors:", form.errors)

    if not form.is_valid():
        print("❌ DEBUG: Form validation failed — returning 400")
        return JsonResponse({"errors": form.errors}, status=400)

    print("✅ DEBUG: Form is valid — saving base pin (commit=False)")
    temp_pin = form.save(commit=False)

    # =============================================
    # GEOCODING
    # =============================================
    geo = geocode_location(temp_pin.city, temp_pin.state, temp_pin.country)
    print("Geo result:", geo)

    if not geo:
        print("❌ DEBUG: Geocode failed — returning 400")
        return JsonResponse(
            {"errors": {"location": ["Location not found"]}},
            status=400,
        )

    lat, lon = geo
    temp_pin.latitude = lat
    temp_pin.longitude = lon
    temp_pin.user = request.user

    temp_pin.save()
    print(f"✅ DEBUG: Pin saved successfully — ID: {temp_pin.id}")

    # =============================================
    # MULTIPLE PHOTO HANDLING
    # =============================================
    extra_files = request.FILES.getlist("photos")
    print("Extra uploaded photo files:", extra_files)

    from home.models import PinPhoto

    for f in extra_files:
        PinPhoto.objects.create(pin=temp_pin, image=f)
        print(f"📸 DEBUG: Saved extra photo: {f}")

    print("===== END ADD PIN DEBUG =====\n")

    # =============================================
    # SUCCESS RESPONSE
    # =============================================
    return JsonResponse({
        "success": True,
        "id": temp_pin.id,
        "city": temp_pin.city,
        "state": temp_pin.state,
        "country": temp_pin.country,
        "caption": temp_pin.caption,
        "lat": temp_pin.latitude,
        "lon": temp_pin.longitude,
    })



@login_required
def edit_pin(request, pin_id):
    pin = get_object_or_404(Pin, id=pin_id, user=request.user)

    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)

    old_city, old_state, old_country = pin.city, pin.state, pin.country
    form = PinForm(request.POST, request.FILES, instance=pin)

    if not form.is_valid():
        return JsonResponse({"errors": form.errors}, status=400)

    updated = form.save(commit=False)

    if (updated.city != old_city or updated.state != old_state or updated.country != old_country):
        geo = geocode_location(updated.city, updated.state, updated.country)
        if not geo:
            return JsonResponse({"errors": {"location": ["Invalid location"]}}, status=400)
        updated.latitude, updated.longitude = geo

    updated.save()

    to_delete = request.POST.get("photos_to_delete", "").strip()
    if to_delete:
        ids = [int(x) for x in to_delete.split(",") if x.strip().isdigit()]
        PinPhoto.objects.filter(pin=pin, id__in=ids).delete()

    extra_files = request.FILES.getlist("photos")
    current_count = (1 if updated.image else 0) + updated.photos.count()
    remaining = MAX_PIN_PHOTOS - current_count

    for f in extra_files[:remaining]:
        PinPhoto.objects.create(pin=updated, image=f)

    cover = request.build_absolute_uri(updated.image.url) if updated.image else None
    extra = [request.build_absolute_uri(p.image.url) for p in updated.photos.all()]

    return JsonResponse({
        "id": updated.id,
        "lat": updated.latitude,
        "lon": updated.longitude,
        "caption": updated.caption or "",
        "imageUrl": cover,
        "photos": extra,
        "city": updated.city,
        "state": updated.state,
        "country": updated.country,
        "updated": True,
        "isOwner": True,
    })


# =====================================================================
# GALLERY
# =====================================================================

@login_required
def gallery_view(request):
    return render(request, "home/gallery.html")


@login_required
def my_photos(request):
    pins = Pin.objects.filter(user=request.user).prefetch_related("photos")

    payload = []

    for pin in pins:
        if pin.image:
            payload.append({
                "id": f"cover-{pin.id}",
                "pin_id": pin.id,
                "imageUrl": request.build_absolute_uri(pin.image.url),
                "caption": pin.caption or "",
                "city": pin.city,
                "country": pin.country,
                "createdAt": pin.created_at,
            })

        for photo in pin.photos.all():
            payload.append({
                "id": photo.id,
                "pin_id": pin.id,
                "imageUrl": request.build_absolute_uri(photo.image.url),
                "caption": pin.caption or "",
                "city": pin.city,
                "country": pin.country,
                "createdAt": photo.created_at,
            })

    payload.sort(key=lambda p: p["createdAt"], reverse=True)

    return JsonResponse({"photos": payload})

# =====================================================================
# ADMIN POPULARITY DASHBOARD
# =====================================================================

def is_staff(user):
    return user.is_staff


@user_passes_test(is_staff)
def popularity_dashboard(request):
    # 1) Top countries by pin count
    country_qs = (
        Pin.objects
        .values("country")
        .annotate(pin_count=Count("id"))
        .order_by("-pin_count")
    )

    total_pins = sum(row["pin_count"] for row in country_qs) or 1  # avoid div by zero

    country_stats = []
    for row in country_qs[:10]:  # Top 10
        country = row["country"] or "Unknown"
        pin_count = row["pin_count"]
        percent = round(100 * pin_count / total_pins * 100) / 100  # round to 2 decimals
        country_stats.append({
            "country": country,
            "pin_count": pin_count,
            "percent": percent,
        })

    # 2) OPTIONAL: reactions per country
    reaction_qs = (
        Reaction.objects
        .values("pin__country")
        .annotate(reaction_count=Count("id"))
        .order_by("-reaction_count")
    )

    reaction_stats = []
    for row in reaction_qs:
        country = row["pin__country"] or "Unknown"
        reaction_stats.append({
            "country": country,
            "reaction_count": row["reaction_count"],
        })

    # Data for Chart.js
    chart_labels = [row["country"] for row in country_stats]
    chart_data = [row["pin_count"] for row in country_stats]

    context = {
        "country_stats": country_stats,
        "reaction_stats": reaction_stats,
        "total_pins": total_pins,
        "chart_labels": json.dumps(chart_labels),
        "chart_data": json.dumps(chart_data),
    }
    return render(request, "admin/popularity_dashboard.html", context)


@login_required
@csrf_exempt
def edit_profile(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=400)

    user = request.user

    # Safely get or create profile
    profile, created = Profile.objects.get_or_create(user=user)

    username = request.POST.get("username")
    bio = request.POST.get("bio")
    avatar = request.FILES.get("avatar")

    if username:
        user.username = username
        user.save()

    if bio is not None:
        profile.bio = bio

    if avatar:
        profile.avatar = avatar

    profile.save()

    return JsonResponse({"success": True})
# home/views.py
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render
from django.contrib import messages
from django import forms
from .forms import SignUpForm


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
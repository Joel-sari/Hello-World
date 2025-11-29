# home/forms.py
from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User
from .models import Pin


class SignUpForm(UserCreationForm):
    email = forms.EmailField(required=True, widget=forms.EmailInput(attrs={
        "placeholder": "Email",
    }))

    class Meta:
        model = User
        fields = ("username", "email", "password1", "password2")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['username'].widget.attrs.update({"placeholder": "Username"})
        self.fields['email'].widget.attrs.update({"placeholder": "Email"})
        self.fields['password1'].widget.attrs.update({"placeholder": "Password"})
        self.fields['password2'].widget.attrs.update({"placeholder": "Confirm Password"})
        for field in self.fields.values():
            field.widget.attrs.update({"class": "field"})

class PinForm(forms.ModelForm):
    class Meta:
        model = Pin
        fields = ["city", "state", "country", "caption", "image"]

# serializers.py

# This file defines how our Django models are converted to and from JSON
# for the API. The frontend talks to the backend using JSON, so serializers
# control what data is sent out (e.g., pins, reactions) and how incoming
# data is validated.

# Add or update serializers here whenever you need to change what the API
# returns to the frontend.


from rest_framework import serializers
from django.db.models import Count

from .models import Reaction, Pin

class ReactionSerializer(serializers.ModelSerializer):
    emoji_icon = serializers.SerializerMethodField()

    class Meta:
        model = Reaction
        fields = ["pin", "user", "emoji", "emoji_icon"]

    def get_emoji_icon(self, obj):
        return dict(Reaction.EMOJI_CHOICES).get(obj.emoji)
    

class PinSerializer(serializers.ModelSerializer):
    imageUrl = serializers.SerializerMethodField()
    reaction_counts = serializers.SerializerMethodField()
    user_reaction = serializers.SerializerMethodField()

    class Meta:
        model = Pin
        fields = [
            "id",
            "lat",
            "lon",
            "caption",
            "imageUrl",
            "reaction_counts",
            "user_reaction",
        ]

    def get_imageUrl(self, obj):
        request = self.context.get("request")
        if obj.image:
            return request.build_absolute_uri(obj.image.url)
        return None

    def get_reaction_counts(self, obj):
        counts = obj.reactions.values("emoji").annotate(count=Count("emoji"))
        return {item["emoji"]: item["count"] for item in counts}

    def get_user_reaction(self, obj):
        reaction = obj.reactions.filter(user=self.context["request"].user).first()
        return reaction.emoji if reaction else None
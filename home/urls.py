from django.urls import path
from django.contrib.auth import views as auth_views
from . import views

from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("", views.index, name="index"),           
    path("map/", views.map_view, name="map"),      
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
    path("signup/", views.signup_view, name="signup"),

    # === PIN API endpoints ===
    path("api/my-pins/", views.my_pins, name="my_pins"),
    path("api/search/", views.search_location, name="search_location"),
    path("api/add-pin/", views.add_pin, name="add_pin"),

    path("api/pin/<int:pin_id>/", views.get_pin, name="get_pin"),

    path("gallery/", views.gallery_view, name="gallery"),
    path("api/my-photos/", views.my_photos, name="my_photos"),

    path("api/edit-pin/<int:pin_id>/", views.edit_pin, name="edit_pin"),

    # === NEW FRIENDSHIP API ENDPOINTS ===
    path("api/friends/search/", views.search_users, name="search_users"),
    path("api/friend-request/<str:username>/", views.friend_request, name="friend_request"),
    path("api/friend-accept/<int:friendship_id>/", views.friend_accept, name="friend_accept"),
    path("api/friend-reject/<int:friendship_id>/", views.friend_reject, name="friend_reject"),
    path("api/friends/", views.friend_list, name="friend_list"),
    path("api/friend-remove/<int:friendship_id>/", views.friend_remove, name="friend_remove"),
    path("api/pins/<str:username>/", views.user_pins, name="user_pins"),
    path("api/edit-profile/", views.edit_profile, name="edit_profile"),
    path("api/profile/", views.profile_api, name="profile_api"),
    path("edit-profile/", views.edit_profile, name="edit_profile"),


    # === REACTION API ===
    path("api/react/<int:pin_id>/", views.react_to_pin, name="react_to_pin"),
    

]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

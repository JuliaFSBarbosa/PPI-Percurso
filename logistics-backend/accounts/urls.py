from django.urls import path
from accounts.views import (
    SignUpView,
    SignInView,
    MeView,
    UserAdminView,
    UserAdminDetailView,
    ProfileListCreateView,
    ProfileDetailView,
    ScreenPermissionView,
)

urlpatterns = [
    path('signup/', SignUpView.as_view()),
    path('signin/', SignInView.as_view()),
    path('me', MeView.as_view()),
    path('users/', UserAdminView.as_view()),
    path('users/<int:user_id>/', UserAdminDetailView.as_view()),
    path('profiles/screens/', ScreenPermissionView.as_view()),
    path('profiles/', ProfileListCreateView.as_view()),
    path('profiles/<int:profile_id>/', ProfileDetailView.as_view()),
]

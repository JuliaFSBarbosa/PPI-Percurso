from django.urls import path
from accounts.views import SignUpView, SignInView, MeView

urlpatterns = [
    path('signup/', SignUpView.as_view()),
    path('signin/', SignInView.as_view()),
    path('me', MeView.as_view()),
    
]

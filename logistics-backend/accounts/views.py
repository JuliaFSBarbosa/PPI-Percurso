from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response 

from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.exceptions import AuthenticationFailed

from accounts.models import User
from accounts.serializers import UserSerializer, SignUpSerializer

from core.utils.exceptions import ValidationError
from core.utils.formatters import format_serializer_error
from django.contrib.auth.hashers import check_password, make_password
 
class SignInView(APIView):
    permission_classes = [AllowAny]

    def post(self, request: Request):
        email = request.data.get('email', '')
        password = request.data.get('password', '')

        if not email or not password:
            raise ValidationError
        
        user = User.objects.filter(email=email).first()

        if not user:
            raise AuthenticationFailed("Email e/ou senha inválido(s)")
        
        if not check_password(password, user.password):
            raise AuthenticationFailed("Email e/ou senha inválido(s)")
        
        user_data = UserSerializer(user).data
        access_token = RefreshToken.for_user(user).access_token

        return Response({
            "user": user_data,
            "access_token": str(access_token)
        })

class SignUpView(APIView):
    permission_classes = [AllowAny]

    def post(self, request: Request):
        serializer = SignUpSerializer(data=request.data)

        if not serializer.is_valid():
            raise ValidationError(format_serializer_error(serializer.errors))

        user = serializer.save()

        access_token = RefreshToken.for_user(user).access_token

        return Response({
            "user": UserSerializer(user).data,
            "access_token": str(access_token)
        })

class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        return Response(UserSerializer(request.user).data)

    def put(self, request: Request):
        user = request.user
        name = request.data.get('name')
        password = request.data.get('password')
        if name:
            user.name = name
        if password:
            user.set_password(password)
        user.save()
        return Response(UserSerializer(user).data)


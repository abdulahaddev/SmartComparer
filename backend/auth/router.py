from fastapi import APIRouter, HTTPException, status, Depends
from schemas import LoginRequest, TokenResponse, UserResponse
from config import settings
from auth.jwt import create_access_token
from auth.dependencies import get_current_user


router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    """Authenticate with username/password and receive a JWT token."""
    if (
        request.username != settings.ADMIN_USERNAME
        or request.password != settings.ADMIN_PASSWORD
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    token = create_access_token(request.username)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
async def get_me(username: str = Depends(get_current_user)):
    """Get the current authenticated user info."""
    return UserResponse(username=username)

from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from config import settings


ALGORITHM = "HS256"


def create_access_token(username: str) -> str:
    """Create a JWT access token for the given username."""
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRY_HOURS)
    payload = {
        "sub": username,
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=ALGORITHM)


def verify_token(token: str) -> str | None:
    """Verify a JWT token and return the username, or None if invalid."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
        return username
    except JWTError:
        return None

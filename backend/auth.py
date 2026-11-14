"""
Simple admin authentication module using environment variables and JWT tokens.
"""

import os
from datetime import datetime, timedelta
from typing import Optional
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

_admin_password = os.getenv("ADMIN_PASSWORD")
if not _admin_password:
    raise RuntimeError(
        "ADMIN_PASSWORD environment variable is not set. "
        "Set it before starting the server."
    )
ADMIN_PASSWORD = _admin_password

_jwt_secret = os.getenv("JWT_SECRET")
if not _jwt_secret:
    raise RuntimeError(
        "JWT_SECRET environment variable is not set. "
        "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(32))\""
    )
JWT_SECRET = _jwt_secret
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

security = HTTPBearer()


def verify_admin_password(password: str) -> bool:
    """
    Verify admin password against environment variable.

    Args:
        password: Password to verify

    Returns:
        True if password matches, False otherwise
    """
    return password == ADMIN_PASSWORD


def create_access_token(username: str = "admin") -> str:
    """
    Create a JWT access token.

    Args:
        username: Username to encode in token

    Returns:
        JWT token string
    """
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {
        "sub": username,
        "exp": expire,
        "iat": datetime.utcnow()
    }

    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return token


def verify_token(token: str) -> Optional[str]:
    """
    Verify JWT token and extract username.

    Args:
        token: JWT token string

    Returns:
        Username if valid, None otherwise
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        username: str = payload.get("sub")
        return username
    except jwt.ExpiredSignatureError:
        return None
    except jwt.PyJWTError:
        return None


async def verify_admin_token(
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> str:
    """
    FastAPI dependency to verify admin authentication.

    Args:
        credentials: HTTP Bearer token credentials

    Returns:
        Username if authenticated

    Raises:
        HTTPException: If authentication fails
    """
    token = credentials.credentials
    username = verify_token(token)

    if username is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return username

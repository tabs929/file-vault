from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.exceptions import AuthenticationError, ValidationError
from app.core.rate_limit import limiter
from app.core.security import (
    SESSION_COOKIE_NAME,
    create_access_token,
    session_cookie_max_age,
    session_cookie_secure,
)
from app.models.user import User
from app.schemas.auth import LoginRequest, MessageResponse, RegisterRequest, UserResponse
from app.services.auth_service import authenticate_user, register_user, user_to_response

router = APIRouter()


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("5/minute")
async def register(
    request: Request,
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    user = await register_user(
        db,
        email=body.email,
        password=body.password,
        plan_name=body.plan_name,
    )
    return user_to_response(user)


@router.post("/login", response_model=UserResponse)
@limiter.limit("5/minute")
async def login(
    request: Request,
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    user = await authenticate_user(db, email=body.email, password=body.password)
    if user is None:
        raise AuthenticationError("Invalid credentials")

    token = create_access_token(user_id=user.id, token_version=user.token_version)
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        path="/",
        max_age=session_cookie_max_age(),
        secure=session_cookie_secure(),
    )
    return user_to_response(user)


@router.post("/logout", response_model=MessageResponse)
async def logout(
    response: Response,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    # Bump token_version — instantly invalidates every existing JWT for this user.
    user.token_version += 1
    await db.commit()

    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
        httponly=True,
        samesite="lax",
        secure=session_cookie_secure(),
    )
    return MessageResponse(message="Logged out")


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)) -> UserResponse:
    return user_to_response(user)

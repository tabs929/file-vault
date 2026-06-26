from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import noload

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.core.exceptions import AuthenticationError, ValidationError
from app.core.rate_limit import get_user_id_key, limiter
from app.core.security import (
    SESSION_COOKIE_NAME,
    create_access_token,
    hash_password,
    session_cookie_max_age,
    session_cookie_secure,
)
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    ResetPasswordRequest,
    UserResponse,
)
from app.services import email_service, token_service
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
        full_name=body.full_name,
    )

    raw_token = await token_service.create_token(
        db, user.id, "email_verification", expires_in_minutes=24 * 60
    )
    await db.commit()

    verification_url = f"{settings.FRONTEND_URL}/auth/verify-email?token={raw_token}"
    await email_service.send_verification_email(user.email, verification_url)

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


# ── Email verification ────────────────────────────────────────────────────────


@router.post("/resend-verification", response_model=MessageResponse)
@limiter.limit("1/minute", key_func=get_user_id_key)
async def resend_verification(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    if current_user.email_verified:
        return MessageResponse(message="Email already verified.")

    raw_token = await token_service.create_token(
        db, current_user.id, "email_verification", expires_in_minutes=24 * 60
    )
    await db.commit()

    verification_url = f"{settings.FRONTEND_URL}/auth/verify-email?token={raw_token}"
    await email_service.send_verification_email(current_user.email, verification_url)

    return MessageResponse(message="Verification email sent.")


@router.get("/verify-email", response_model=MessageResponse)
async def verify_email(
    token: str,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    token_record = await token_service.consume_token(db, token, "email_verification")
    if token_record is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token.",
        )

    result = await db.execute(
        select(User)
        .options(noload(User.plan))
        .where(User.id == token_record.user_id)
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token.",
        )

    user.email_verified = True
    await db.commit()

    return MessageResponse(message="Email verified successfully.")


# ── Password reset ────────────────────────────────────────────────────────────

_FORGOT_PASSWORD_GENERIC = MessageResponse(
    message=(
        "If an account with that email exists and is verified, "
        "a password reset link has been sent."
    )
)


@router.post("/forgot-password", response_model=MessageResponse)
@limiter.limit("3/hour")
async def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    result = await db.execute(
        select(User)
        .options(noload(User.plan))
        .where(User.email == body.email.lower())
    )
    user = result.scalar_one_or_none()

    # Always return the same generic response regardless of whether the email
    # exists or is verified — prevents account enumeration. If unverified,
    # do NOT send a reset email (the account isn't confirmed yet).
    if user is None or not user.email_verified:
        return _FORGOT_PASSWORD_GENERIC

    raw_token = await token_service.create_token(
        db, user.id, "password_reset", expires_in_minutes=60
    )
    await db.commit()

    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={raw_token}"
    await email_service.send_password_reset_email(user.email, reset_url)

    return _FORGOT_PASSWORD_GENERIC


@router.get("/verify-reset-token", response_model=MessageResponse)
async def verify_reset_token(
    token: str,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Pre-flight check: validate a reset token WITHOUT consuming it.

    The reset-password page calls this on mount to decide whether to render
    the form or the "link expired" error state.
    """
    token_record = await token_service.verify_token(db, token, "password_reset")
    if token_record is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token.",
        )
    return MessageResponse(message="Token is valid.")


@router.post("/reset-password", response_model=MessageResponse)
@limiter.limit("10/hour")
async def reset_password(
    request: Request,
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    token_record = await token_service.consume_token(db, body.token, "password_reset")
    if token_record is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token.",
        )

    result = await db.execute(
        select(User)
        .options(noload(User.plan))
        .where(User.id == token_record.user_id)
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token.",
        )

    user.password_hash = hash_password(body.password)
    # Bump token_version — invalidates all existing sessions across every device.
    user.token_version += 1
    await db.commit()

    return MessageResponse(message="Password reset successfully.")

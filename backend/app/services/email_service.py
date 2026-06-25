import asyncio
import logging

import resend

from app.core.config import settings

logger = logging.getLogger(__name__)


def _resend_send(params: dict) -> None:
    resend.api_key = settings.RESEND_API_KEY
    resend.Emails.send(params)


async def send_verification_email(to: str, verification_url: str) -> None:
    # Always log the URL — works for local dev without Resend configured
    print(f"[EMAIL] email_verification link for {to}: {verification_url}", flush=True)

    # Only attempt Resend if API key is configured
    if not settings.RESEND_API_KEY:
        print("[EMAIL] RESEND_API_KEY not set — email not sent, use link above", flush=True)
        return

    try:
        await asyncio.to_thread(
            _resend_send,
            {
                "from": settings.EMAIL_FROM,
                "to": to,
                "subject": "Verify your Vault email",
                "html": (
                    "<p>Click the link below to verify your email address.</p>"
                    f"<p><a href='{verification_url}'>Verify email</a></p>"
                    "<p>This link expires in 24 hours. "
                    "If you did not create a Vault account, you can ignore this email.</p>"
                ),
            },
        )
    except Exception as e:
        logger.error(f"send_verification_email failed for {to}: {e}")


async def send_password_reset_email(to: str, reset_url: str) -> None:
    # Always log the URL — works for local dev without Resend configured
    print(f"[EMAIL] password_reset link for {to}: {reset_url}", flush=True)

    # Only attempt Resend if API key is configured
    if not settings.RESEND_API_KEY:
        print("[EMAIL] RESEND_API_KEY not set — email not sent, use link above", flush=True)
        return

    try:
        await asyncio.to_thread(
            _resend_send,
            {
                "from": settings.EMAIL_FROM,
                "to": to,
                "subject": "Reset your Vault password",
                "html": (
                    "<p>Click the link below to reset your Vault password.</p>"
                    f"<p><a href='{reset_url}'>Reset password</a></p>"
                    "<p>This link expires in 1 hour. "
                    "If you did not request a password reset, you can ignore this email.</p>"
                ),
            },
        )
    except Exception as e:
        logger.error(f"send_password_reset_email failed for {to}: {e}")

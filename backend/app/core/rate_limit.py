from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

# 5 requests/minute per IP on auth endpoints — per-account hard lockout is
# intentionally not implemented (attackers could lock users out by failing
# logins on their behalf).
limiter = Limiter(key_func=get_remote_address)


def get_user_id_key(request: Request) -> str:
    """Rate limit key: JWT sub (user UUID) from session cookie, fallback to IP.

    Used for authenticated endpoints (e.g. resend-verification) so the limit
    applies per-user instead of per-IP, which matters behind shared NAT.
    Falls back to IP if the cookie is absent, expired, or tampered.
    """
    try:
        from app.core.security import decode_access_token

        token = request.cookies.get("session", "")
        if token:
            payload = decode_access_token(token)
            return f"user:{payload['sub']}"
    except Exception:
        pass
    return get_remote_address(request)

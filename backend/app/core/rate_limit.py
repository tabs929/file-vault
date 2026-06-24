from slowapi import Limiter
from slowapi.util import get_remote_address

# 5 requests/minute per IP on auth endpoints — per-account hard lockout is
# intentionally not implemented (attackers could lock users out by failing
# logins on their behalf).
limiter = Limiter(key_func=get_remote_address)

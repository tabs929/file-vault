from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse


class AppError(Exception):
    """Base application error with an HTTP status and public message."""

    def __init__(self, message: str, status_code: int = status.HTTP_400_BAD_REQUEST) -> None:
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class RegistrationError(AppError):
    def __init__(self, message: str = "Registration failed") -> None:
        super().__init__(message, status_code=status.HTTP_409_CONFLICT)


class ValidationError(AppError):
    pass


class AuthenticationError(AppError):
    def __init__(self, message: str = "Invalid credentials") -> None:
        super().__init__(message, status_code=status.HTTP_401_UNAUTHORIZED)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.message},
        )

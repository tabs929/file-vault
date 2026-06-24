from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str

    # CORS — stored as a comma-separated string in the env file.
    # pydantic-settings v2.14+ tries to JSON-decode list[str] fields at the
    # source level before validators run, which breaks comma-separated values.
    # Keeping this as str and splitting at the point of use is the reliable fix.
    CORS_ORIGINS: str

    ENVIRONMENT: Literal["development", "production"] = "development"

    # Used for signing tokens in later phases; required now so it's never absent.
    SECRET_KEY: str

    # Object storage (MinIO locally, AWS S3 in production)
    S3_ENDPOINT_URL: str
    S3_BUCKET: str
    S3_REGION: str
    S3_ACCESS_KEY_ID: str
    S3_SECRET_ACCESS_KEY: str

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins_list(self) -> list[str]:
        """Return CORS_ORIGINS as a parsed list, trimming whitespace."""
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()  # type: ignore[call-arg]

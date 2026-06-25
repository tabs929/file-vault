import uuid
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    plan_name: Literal["free", "pro_10"]
    full_name: str = Field(..., min_length=1, max_length=100, strip_whitespace=True)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str
    plan_name: str
    quota_bytes: int
    used_bytes: int
    email_verified: bool

    model_config = {"from_attributes": True}


class MessageResponse(BaseModel):
    message: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str = Field(min_length=8)

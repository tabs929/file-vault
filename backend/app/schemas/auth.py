import uuid
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    plan_name: Literal["free", "pro_10"]


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    plan_name: str
    quota_bytes: int
    used_bytes: int
    email_verified: bool

    model_config = {"from_attributes": True}


class MessageResponse(BaseModel):
    message: str

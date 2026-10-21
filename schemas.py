from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Literal


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class UserOut(BaseModel):
    id: int
    name: str
    email: str

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UploadOut(BaseModel):
    id: int
    filename: str
    created_at: datetime
    status: str = "uploaded"

    class Config:
        from_attributes = True


class ImageAnalysisOut(BaseModel):
    upload: UploadOut
    prediction: Literal["REAL", "FAKE"]
    confidence: float
    real_probability: float
    fake_probability: float
    threat_level: Literal["SAFE", "LOW", "MEDIUM", "HIGH", "CRITICAL"]

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: str = "teacher"
    display_name: str | None = None
    department: str | None = None


class LoginRequest(BaseModel):
    username: str
    password: str


class UserUpdate(BaseModel):
    role: str | None = None
    display_name: str | None = None
    department: str | None = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str = "teacher"


class UserResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: str
    display_name: str | None
    department: str | None
    is_active: bool

    class Config:
        from_attributes = True
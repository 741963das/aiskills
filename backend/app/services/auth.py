from sqlalchemy.orm import Session
from datetime import timedelta

from ..models.user import User
from ..schemas.auth import UserCreate, UserUpdate, LoginRequest
from ..utils.security import get_password_hash, verify_password, create_access_token
from ..config import settings


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def get_user_by_username(db: Session, username: str) -> User | None:
    return db.query(User).filter(User.username == username).first()


def create_user(db: Session, user: UserCreate) -> User:
    hashed_password = get_password_hash(user.password)
    db_user = User(
        username=user.username,
        email=user.email,
        password_hash=hashed_password,
        role=user.role,
        display_name=user.display_name,
        department=user.department,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def authenticate_user(db: Session, login: LoginRequest) -> User | None:
    user = get_user_by_username(db, login.username)
    if not user or not verify_password(login.password, user.password_hash):
        return None
    return user


def generate_token(user: User) -> str:
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "user_id": user.id, "role": user.role},
        expires_delta=access_token_expires,
    )
    return access_token


def update_user_profile(db: Session, user: User, updates: UserUpdate) -> User:
    if updates.role is not None:
        user.role = updates.role
    if updates.display_name is not None:
        user.display_name = updates.display_name
    if updates.department is not None:
        user.department = updates.department
    db.commit()
    db.refresh(user)
    return user
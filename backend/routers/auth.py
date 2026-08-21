from fastapi import APIRouter, Depends, HTTPException, Request, status
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User
from backend.schemas import LoginRequest, LoginResponse, UserPublic

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
def login(
        payload: LoginRequest,
        request: Request,
        db: Session = Depends(get_db),
) -> LoginResponse:
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not pwd_context.verify(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Establishes the signed, HttpOnly session cookie. The frontend sends
    # credentials: "include" and never stores a token anywhere, so a cookie
    # is the only mechanism its existing code can actually use.
    request.session["user_id"] = user.id

    return LoginResponse(
        user=UserPublic(id=user.id, email=user.email, name=user.username)
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request) -> None:
    # Deliberately unauthenticated: logging out while already logged out
    # should succeed quietly rather than 401.
    request.session.clear()

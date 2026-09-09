from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User
from backend.schemas import LoginRequest, LoginResponse, UserPublic, UserRegister
from backend.security import pwd_context

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


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
def register(
        payload: UserRegister,
        db: Session = Depends(get_db),
) -> UserPublic:
    """
    Register a new user, check if the username and email is already exist.
    Then store the password after bcrypt.
    In the end the new user will be created and added into the database.
    """
    # check the username
    existing_username = db.query(User).filter(User.username == payload.username).first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already taken"
        )

    # check the email
    existing_email = db.query(User).filter(User.email == payload.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )

    # encryp password
    hashed_password = pwd_context.hash(payload.password)

    # create new user
    new_user = User(
        username=payload.username,
        email=payload.email,
        password_hash= hashed_password,
        is_active=True
    )

    # add user to database
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return UserPublic(id = new_user.id, email = new_user.email, name = new_user.username)

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..models import User, UserRole
from ..utils.security import hash_password, verify_password, create_access_token
from ..deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginIn(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    email: str | None = None
    role: str = UserRole.VIEWER.value


class UserOut(BaseModel):
    id: int
    username: str
    full_name: str
    email: str | None
    role: str
    is_active: bool

    class Config:
        from_attributes = True


@router.post("/login")
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == data.username).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="اسم المستخدم أو كلمة المرور غير صحيحة")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="الحساب غير نشط")
    token = create_access_token({"sub": str(user.id), "role": user.role, "username": user.username})
    return {"access_token": token, "token_type": "bearer", "user": UserOut.model_validate(user)}


@router.get("/me", response_model=UserOut)
def me(user=Depends(get_current_user)):
    if user is None:
        raise HTTPException(status_code=401, detail="غير مسجل")
    return user


@router.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), user=Depends(get_current_user)):
    if user is None or user.role != UserRole.ADMIN.value:
        raise HTTPException(status_code=403, detail="صلاحية مدير مطلوبة")
    return db.query(User).all()


@router.post("/users", response_model=UserOut)
def create_user(data: UserCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if user is None or user.role != UserRole.ADMIN.value:
        raise HTTPException(status_code=403, detail="صلاحية مدير مطلوبة")
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=400, detail="اسم المستخدم موجود")
    u = User(username=data.username, hashed_password=hash_password(data.password),
             full_name=data.full_name, email=data.email, role=data.role)
    db.add(u)
    db.commit()
    db.refresh(u)
    return u
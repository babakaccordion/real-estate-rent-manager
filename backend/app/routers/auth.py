from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..models import User, UserRole
from ..utils.security import hash_password, verify_password, create_access_token
from ..deps import get_current_user, require_user

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


class CredentialsIn(BaseModel):
    current_password: str
    username: str | None = None
    new_password: str | None = None


class SetupIn(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    full_name: str
    email: str | None
    role: str
    is_active: bool

    class Config:
        from_attributes = True


@router.get("/status")
def auth_status(db: Session = Depends(get_db)):
    """هل يحتاج التطبيق إلى إعداد أولي؟ لا توجد أي بيانات دخول افتراضية منشورة."""
    return {"needs_setup": db.query(User).count() == 0}


@router.post("/setup")
def setup(data: SetupIn, db: Session = Depends(get_db)):
    """أول تشغيل فقط: إنشاء بيانات الدخول التي يختارها المستخدم بنفسه."""
    if db.query(User).count() > 0:
        raise HTTPException(status_code=400, detail="بيانات الدخول مُعدّة مسبقًا")
    username = (data.username or "").strip()
    if len(username) < 3:
        raise HTTPException(status_code=400, detail="اسم المستخدم يجب أن يكون 3 أحرف على الأقل")
    if len(data.password or "") < 8:
        raise HTTPException(status_code=400, detail="كلمة المرور يجب أن تكون 8 أحرف على الأقل")
    user = User(
        username=username,
        hashed_password=hash_password(data.password),
        full_name="مدير النظام",
        role=UserRole.ADMIN.value,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": str(user.id), "role": user.role, "username": user.username})
    return {"access_token": token, "token_type": "bearer", "user": UserOut.model_validate(user)}


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


@router.post("/change-credentials", response_model=UserOut)
def change_credentials(data: CredentialsIn, db: Session = Depends(get_db), user=Depends(require_user)):
    """تغيير اسم المستخدم (رمز الدخول) و/أو كلمة المرور بعد التحقق من الكلمة الحالية."""
    if not verify_password(data.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="كلمة المرور الحالية غير صحيحة")

    new_username = (data.username or "").strip()
    if new_username and new_username != user.username:
        if len(new_username) < 3:
            raise HTTPException(status_code=400, detail="اسم المستخدم يجب أن يكون 3 أحرف على الأقل")
        if db.query(User).filter(User.username == new_username, User.id != user.id).first():
            raise HTTPException(status_code=400, detail="اسم المستخدم مستخدم مسبقًا")
        user.username = new_username

    if data.new_password:
        if len(data.new_password) < 8:
            raise HTTPException(status_code=400, detail="كلمة المرور يجب أن تكون 8 أحرف على الأقل")
        user.hashed_password = hash_password(data.new_password)

    db.commit()
    db.refresh(user)
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
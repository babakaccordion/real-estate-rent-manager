from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from ..database import get_db
from ..deps import require_user, require_role
from ..models import AppSetting

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingIn(BaseModel):
    key: str
    value: str


@router.get("")
def get_settings(db: Session = Depends(get_db), user=Depends(require_user)):
    rows = db.query(AppSetting).all()
    return {r.key: r.value for r in rows}


@router.put("")
def set_setting(data: SettingIn, db: Session = Depends(get_db), user=Depends(require_role("admin"))):
    s = db.query(AppSetting).filter(AppSetting.key == data.key).first()
    if s:
        s.value = data.value
    else:
        s = AppSetting(key=data.key, value=data.value)
        db.add(s)
    db.commit()
    return {"message": "تم"}
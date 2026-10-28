from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Any
from decimal import Decimal
from ..database import get_db
from ..deps import require_user, require_role
from ..models import Charge, ChargeStatus
from ..services.charges import refresh_charge_statuses

router = APIRouter(prefix="/charges", tags=["charges"])


class ChargeOut(BaseModel):
    id: int
    lease_id: int
    property_id: int
    tenant_id: int
    period: str
    due_date: Any
    amount_due: float
    amount_paid: float
    status: str
    cancel_reason: Optional[str]

    class Config:
        from_attributes = True


class CancelIn(BaseModel):
    reason: str


@router.get("", response_model=list[ChargeOut])
def list_charges(property_id: Optional[int] = None, tenant_id: Optional[int] = None,
                 status: Optional[str] = None, db: Session = Depends(get_db), user=Depends(require_user)):
    q = db.query(Charge)
    if property_id:
        q = q.filter(Charge.property_id == property_id)
    if tenant_id:
        q = q.filter(Charge.tenant_id == tenant_id)
    if status:
        q = q.filter(Charge.status == status)
    charges = q.order_by(Charge.due_date.desc()).all()
    out = []
    for c in charges:
        o = ChargeOut.model_validate(c)
        o.due_date = c.due_date.isoformat()
        o.amount_due = float(c.amount_due)
        o.amount_paid = float(c.amount_paid)
        out.append(o)
    return out


@router.post("/refresh-status")
def refresh(db: Session = Depends(get_db), user=Depends(require_user)):
    n = refresh_charge_statuses(db)
    return {"updated": n}


@router.post("/{cid}/cancel")
def cancel_charge(cid: int, data: CancelIn, db: Session = Depends(get_db), user=Depends(require_role("admin", "accountant"))):
    c = db.query(Charge).filter(Charge.id == cid).first()
    if not c:
        raise HTTPException(status_code=404, detail="الاستحقاق غير موجود")
    c.status = ChargeStatus.CANCELLED.value
    c.cancel_reason = data.reason
    db.commit()
    return {"message": "تم إلغاء الاستحقاق"}
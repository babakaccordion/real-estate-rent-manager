from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime
from ..database import get_db
from ..deps import require_user, require_role
from ..models import Payment, Tenant
from ..services.payments import record_payment, cancel_payment

router = APIRouter(prefix="/payments", tags=["payments"])


class PaymentIn(BaseModel):
    tenant_id: int
    amount: float
    payment_date: Any
    method: str = "cash"
    property_id: Optional[int] = None
    notes: Optional[str] = None
    charge_id: Optional[int] = None


class PaymentOut(BaseModel):
    id: int
    receipt_number: str
    tenant_id: int
    property_id: Optional[int]
    amount: float
    payment_date: Any
    method: str
    notes: Optional[str]

    class Config:
        from_attributes = True


@router.get("", response_model=list[PaymentOut])
def list_payments(property_id: Optional[int] = None, tenant_id: Optional[int] = None,
                  db: Session = Depends(get_db), user=Depends(require_user)):
    q = db.query(Payment)
    if property_id:
        q = q.filter(Payment.property_id == property_id)
    if tenant_id:
        q = q.filter(Payment.tenant_id == tenant_id)
    pays = q.order_by(Payment.payment_date.desc()).all()
    out = []
    for p in pays:
        o = PaymentOut.model_validate(p)
        o.payment_date = p.payment_date.isoformat()
        o.amount = float(p.amount)
        out.append(o)
    return out


@router.post("", response_model=PaymentOut)
def create_payment(data: PaymentIn, db: Session = Depends(get_db), user=Depends(require_role("admin", "accountant"))):
    pd = datetime.fromisoformat(data.payment_date)
    payment = record_payment(
        db,
        tenant_id=data.tenant_id,
        amount=data.amount,
        payment_date=pd,
        method=data.method,
        property_id=data.property_id,
        notes=data.notes,
        charge_id=data.charge_id,
        user_id=user.id,
        username=user.username,
    )
    o = PaymentOut.model_validate(payment)
    o.payment_date = payment.payment_date.isoformat()
    o.amount = float(payment.amount)
    return o


@router.delete("/{pid}")
def delete_payment(pid: int, db: Session = Depends(get_db), user=Depends(require_role("admin"))):
    cancel_payment(db, pid, user_id=user.id, username=user.username, reason="حذف")
    return {"message": "تم حذف الدفعة"}
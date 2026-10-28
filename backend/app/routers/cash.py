from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime
from decimal import Decimal
from ..database import get_db
from ..deps import require_user, require_role
from ..models import CashMovement, CashMovementType, Property
from ..utils.numbering import gen_movement_number
from ..utils.audit import log_audit

router = APIRouter(prefix="/cash", tags=["cash"])


class MovementIn(BaseModel):
    movement_type: str
    amount: float
    movement_date: Any
    property_id: Optional[int] = None
    tenant_id: Optional[int] = None
    category: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    method: Optional[str] = None
    receipt_ref: Optional[str] = None


class MovementOut(BaseModel):
    id: int
    movement_number: str
    movement_type: str
    amount: float
    movement_date: Any
    property_id: Optional[int]
    tenant_id: Optional[int]
    category: Optional[str]
    description: Optional[str]
    notes: Optional[str]
    method: Optional[str]
    receipt_ref: Optional[str]

    class Config:
        from_attributes = True


@router.get("", response_model=list[MovementOut])
def list_movements(property_id: Optional[int] = None, db: Session = Depends(get_db), user=Depends(require_user)):
    q = db.query(CashMovement)
    if property_id is not None:
        q = q.filter(CashMovement.property_id == property_id)
    ms = q.order_by(CashMovement.movement_date.desc()).all()
    out = []
    for m in ms:
        o = MovementOut.model_validate(m)
        o.movement_date = m.movement_date.isoformat()
        o.amount = float(m.amount)
        out.append(o)
    return out


@router.post("", response_model=MovementOut)
def create_movement(data: MovementIn, db: Session = Depends(get_db), user=Depends(require_role("admin", "accountant"))):
    # amount sign: for expense type force negative? user may enter positive; convert
    amt = Decimal(str(data.amount))
    if data.movement_type == "expense" and amt > 0:
        amt = -amt
    if data.movement_type in ("opening_balance", "rent_receipt", "adjustment") :
        pass
    m = CashMovement(
        movement_number=gen_movement_number(),
        movement_type=data.movement_type,
        amount=amt,
        movement_date=datetime.fromisoformat(data.movement_date),
        property_id=data.property_id,
        tenant_id=data.tenant_id,
        category=data.category,
        description=data.description,
        notes=data.notes,
        method=data.method,
        receipt_ref=data.receipt_ref,
        created_by=user.id,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    o = MovementOut.model_validate(m)
    o.movement_date = m.movement_date.isoformat()
    o.amount = float(m.amount)
    return o


@router.delete("/{mid}")
def delete_movement(mid: int, db: Session = Depends(get_db), user=Depends(require_role("admin"))):
    m = db.query(CashMovement).filter(CashMovement.id == mid).first()
    if not m:
        raise HTTPException(status_code=404, detail="الحركة غير موجودة")
    # prevent deleting auto-linked rent/expense movements? allow admin with audit
    db.delete(m)
    log_audit(db, user.id, user.username, "cash.delete", "cash_movement", mid, {"amount": str(m.amount)}, None)
    db.commit()
    return {"message": "تم حذف الحركة"}
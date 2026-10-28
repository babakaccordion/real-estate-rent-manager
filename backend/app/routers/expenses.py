from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime
from decimal import Decimal
from ..database import get_db
from ..deps import require_user, require_role
from ..models import Expense, ExpenseCategory, CashMovement, CashMovementType
from ..utils.numbering import gen_expense_number, gen_movement_number
from ..utils.audit import log_audit

router = APIRouter(prefix="/expenses", tags=["expenses"])


class ExpenseIn(BaseModel):
    property_id: Optional[int] = None
    category: str = "other"
    amount: float
    expense_date: Any
    description: Optional[str] = None
    is_paid: bool = True
    paid_date: Any = None
    notes: Optional[str] = None


class ExpenseOut(BaseModel):
    id: int
    expense_number: str
    property_id: Optional[int]
    category: str
    amount: float
    expense_date: Any
    description: Optional[str]
    is_paid: bool
    paid_date: Any
    notes: Optional[str]

    class Config:
        from_attributes = True


@router.get("", response_model=list[ExpenseOut])
def list_expenses(property_id: Optional[int] = None, db: Session = Depends(get_db), user=Depends(require_user)):
    q = db.query(Expense)
    if property_id is not None:
        q = q.filter(Expense.property_id == property_id)
    exps = q.order_by(Expense.expense_date.desc()).all()
    out = []
    for e in exps:
        o = ExpenseOut.model_validate(e)
        o.expense_date = e.expense_date.isoformat()
        o.paid_date = e.paid_date.isoformat() if e.paid_date else None
        o.amount = float(e.amount)
        out.append(o)
    return out


@router.post("", response_model=ExpenseOut)
def create_expense(data: ExpenseIn, db: Session = Depends(get_db), user=Depends(require_role("admin", "accountant"))):
    ed = datetime.fromisoformat(data.expense_date)
    pd = datetime.fromisoformat(data.paid_date) if data.paid_date else (ed if data.is_paid else None)
    exp = Expense(
        expense_number=gen_expense_number(),
        property_id=data.property_id,
        category=data.category,
        amount=Decimal(str(data.amount)),
        expense_date=ed,
        description=data.description,
        is_paid=data.is_paid,
        paid_date=pd,
        notes=data.notes,
        created_by=user.id,
    )
    db.add(exp)
    db.flush()
    if data.is_paid:
        cm = CashMovement(
            movement_number=gen_movement_number(),
            movement_type=CashMovementType.EXPENSE.value,
            amount=-Decimal(str(data.amount)),
            movement_date=pd or ed,
            property_id=data.property_id,
            expense_id=exp.id,
            category=data.category,
            description=data.description or "مصروف",
            method=None,
            created_by=user.id,
        )
        db.add(cm)
    log_audit(db, user.id, user.username, "expense.create", "expense", exp.id, None, {"amount": data.amount})
    db.commit()
    db.refresh(exp)
    o = ExpenseOut.model_validate(exp)
    o.expense_date = exp.expense_date.isoformat()
    o.paid_date = exp.paid_date.isoformat() if exp.paid_date else None
    o.amount = float(exp.amount)
    return o


@router.put("/{eid}", response_model=ExpenseOut)
def update_expense(eid: int, data: ExpenseIn, db: Session = Depends(get_db), user=Depends(require_role("admin", "accountant"))):
    exp = db.query(Expense).filter(Expense.id == eid).first()
    if not exp:
        raise HTTPException(status_code=404, detail="المصروف غير موجود")
    # remove old cash movement
    old_cm = db.query(CashMovement).filter(CashMovement.expense_id == eid).first()
    if old_cm:
        db.delete(old_cm)
    exp.property_id = data.property_id
    exp.category = data.category
    exp.amount = Decimal(str(data.amount))
    exp.expense_date = datetime.fromisoformat(data.expense_date)
    exp.description = data.description
    exp.is_paid = data.is_paid
    exp.paid_date = datetime.fromisoformat(data.paid_date) if data.paid_date else (exp.expense_date if data.is_paid else None)
    exp.notes = data.notes
    if data.is_paid:
        cm = CashMovement(
            movement_number=gen_movement_number(),
            movement_type=CashMovementType.EXPENSE.value,
            amount=-Decimal(str(data.amount)),
            movement_date=exp.paid_date,
            property_id=data.property_id,
            expense_id=exp.id,
            category=data.category,
            description=data.description or "مصروف",
            created_by=user.id,
        )
        db.add(cm)
    db.commit()
    db.refresh(exp)
    o = ExpenseOut.model_validate(exp)
    o.expense_date = exp.expense_date.isoformat()
    o.paid_date = exp.paid_date.isoformat() if exp.paid_date else None
    o.amount = float(exp.amount)
    return o


@router.delete("/{eid}")
def delete_expense(eid: int, db: Session = Depends(get_db), user=Depends(require_role("admin"))):
    exp = db.query(Expense).filter(Expense.id == eid).first()
    if not exp:
        raise HTTPException(status_code=404, detail="المصروف غير موجود")
    cm = db.query(CashMovement).filter(CashMovement.expense_id == eid).first()
    if cm:
        db.delete(cm)
    db.delete(exp)
    db.commit()
    return {"message": "تم حذف المصروف"}
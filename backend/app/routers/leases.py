from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Any
from decimal import Decimal
from datetime import datetime
from ..database import get_db
from ..deps import require_user, require_role
from ..models import Lease, LeaseStatus, LeaseFrequency, Tenant, Property, Unit, Charge
from ..services.charges import generate_charges_for_lease, generate_all_charges

router = APIRouter(prefix="/leases", tags=["leases"])


class LeaseIn(BaseModel):
    tenant_id: int
    property_id: int
    unit_id: Optional[int] = None
    agreed_rent: float
    start_date: Any
    end_date: Any = None
    due_day: int = 1
    frequency: str = "monthly"
    notes: Optional[str] = None


class LeaseOut(BaseModel):
    id: int
    tenant_id: int
    property_id: int
    unit_id: Optional[int]
    agreed_rent: float
    start_date: Any
    end_date: Any
    due_day: int
    frequency: str
    status: str
    notes: Optional[str]

    class Config:
        from_attributes = True


@router.get("", response_model=list[LeaseOut])
def list_leases(db: Session = Depends(get_db), user=Depends(require_user)):
    leases = db.query(Lease).order_by(Lease.id.desc()).all()
    out = []
    for l in leases:
        o = LeaseOut.model_validate(l)
        o.start_date = l.start_date.isoformat()
        o.end_date = l.end_date.isoformat() if l.end_date else None
        o.agreed_rent = float(l.agreed_rent)
        out.append(o)
    return out


@router.post("", response_model=LeaseOut)
def create_lease(data: LeaseIn, db: Session = Depends(get_db), user=Depends(require_role("admin", "accountant"))):
    ls = datetime.fromisoformat(data.start_date)
    le = datetime.fromisoformat(data.end_date) if data.end_date else None
    lease = Lease(
        tenant_id=data.tenant_id,
        property_id=data.property_id,
        unit_id=data.unit_id,
        agreed_rent=Decimal(str(data.agreed_rent)),
        start_date=ls,
        end_date=le,
        due_day=data.due_day,
        frequency=data.frequency,
        status=LeaseStatus.ACTIVE.value,
        notes=data.notes,
    )
    db.add(lease)
    db.flush()
    # generate charges up to today
    generate_charges_for_lease(db, lease)
    db.commit()
    db.refresh(lease)
    o = LeaseOut.model_validate(lease)
    o.start_date = lease.start_date.isoformat()
    o.end_date = lease.end_date.isoformat() if lease.end_date else None
    o.agreed_rent = float(lease.agreed_rent)
    return o


@router.put("/{lid}/status")
def set_lease_status(lid: int, status: str, db: Session = Depends(get_db), user=Depends(require_role("admin", "accountant"))):
    lease = db.query(Lease).filter(Lease.id == lid).first()
    if not lease:
        raise HTTPException(status_code=404, detail="العقد غير موجود")
    lease.status = status
    db.commit()
    return {"message": "تم"}


@router.post("/generate-charges")
def generate_charges(up_to: Optional[str] = None, db: Session = Depends(get_db), user=Depends(require_role("admin", "accountant"))):
    from datetime import date
    d = date.fromisoformat(up_to) if up_to else None
    n = generate_all_charges(db, d)
    return {"created": n}
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Any
from decimal import Decimal
from ..database import get_db
from ..deps import require_user, require_role
from ..models import Tenant, TenantStatus, Lease, LeaseStatus, Property, Unit, Note
from ..utils.numbering import gen_tenant_number
from ..utils.audit import log_audit

router = APIRouter(prefix="/tenants", tags=["tenants"])


class TenantIn(BaseModel):
    full_name: str
    phone: Optional[str] = None
    phone2: Optional[str] = None
    id_number: Optional[str] = None
    status: str = "active"
    notes: Optional[str] = None
    # optional lease info
    property_id: Optional[int] = None
    unit_id: Optional[int] = None
    agreed_rent: Optional[float] = None
    lease_start: Optional[str] = None
    lease_end: Optional[str] = None
    due_day: int = 1


class TenantOut(BaseModel):
    id: int
    tenant_number: str
    full_name: str
    phone: Optional[str]
    phone2: Optional[str]
    id_number: Optional[str]
    status: str
    notes: Optional[str]
    credit_balance: float
    created_at: Any

    class Config:
        from_attributes = True


@router.get("", response_model=list[TenantOut])
def list_tenants(search: Optional[str] = None, db: Session = Depends(get_db), user=Depends(require_user)):
    q = db.query(Tenant)
    if search:
        like = f"%{search}%"
        q = q.filter((Tenant.full_name.ilike(like)) | (Tenant.phone.ilike(like)) | (Tenant.tenant_number.ilike(like)))
    tenants = q.order_by(Tenant.id.desc()).all()
    out = []
    for t in tenants:
        d = TenantOut.model_validate(t)
        d.created_at = t.created_at.isoformat() if t.created_at else ""
        d.credit_balance = float(t.credit_balance or 0)
        out.append(d)
    return out


@router.post("", response_model=TenantOut)
def create_tenant(data: TenantIn, db: Session = Depends(get_db), user=Depends(require_role("admin", "accountant"))):
    t = Tenant(
        tenant_number=gen_tenant_number(),
        full_name=data.full_name,
        phone=data.phone,
        phone2=data.phone2,
        id_number=data.id_number,
        status=data.status,
        notes=data.notes,
    )
    db.add(t)
    db.flush()
    # create lease if property provided
    if data.property_id is not None and data.agreed_rent is not None:
        from datetime import datetime
        ls = datetime.fromisoformat(data.lease_start) if data.lease_start else datetime.now()
        le = datetime.fromisoformat(data.lease_end) if data.lease_end else None
        lease = Lease(
            tenant_id=t.id,
            property_id=data.property_id,
            unit_id=data.unit_id,
            agreed_rent=Decimal(str(data.agreed_rent)),
            start_date=ls,
            end_date=le,
            due_day=data.due_day or 1,
            status=LeaseStatus.ACTIVE.value,
        )
        db.add(lease)
        db.flush()
        from ..services.charges import generate_charges_for_lease
        generate_charges_for_lease(db, lease)
        # update unit
        if data.unit_id:
            u = db.query(Unit).filter(Unit.id == data.unit_id).first()
            if u:
                u.status = "occupied"
                u.current_tenant_id = t.id
                u.agreed_rent = Decimal(str(data.agreed_rent))
    log_audit(db, user.id, user.username, "tenant.create", "tenant", t.id, None, {"name": t.full_name})
    db.commit()
    db.refresh(t)
    d = TenantOut.model_validate(t)
    d.created_at = t.created_at.isoformat() if t.created_at else ""
    d.credit_balance = float(t.credit_balance or 0)
    return d


@router.get("/{tid}")
def get_tenant(tid: int, db: Session = Depends(get_db), user=Depends(require_user)):
    t = db.query(Tenant).filter(Tenant.id == tid).first()
    if not t:
        raise HTTPException(status_code=404, detail="المستأجر غير موجود")
    leases = db.query(Lease).filter(Lease.tenant_id == tid).all()
    notes = db.query(Note).filter(Note.entity_type == "tenant", Note.entity_id == tid).order_by(Note.created_at.desc()).all()
    return {
        "id": t.id,
        "tenant_number": t.tenant_number,
        "full_name": t.full_name,
        "phone": t.phone,
        "phone2": t.phone2,
        "id_number": t.id_number,
        "status": t.status,
        "notes": t.notes,
        "credit_balance": float(t.credit_balance or 0),
        "created_at": t.created_at.isoformat() if t.created_at else "",
        "leases": [{"id": l.id, "property_id": l.property_id, "unit_id": l.unit_id,
                    "agreed_rent": float(l.agreed_rent), "start_date": l.start_date.isoformat(),
                    "end_date": l.end_date.isoformat() if l.end_date else None,
                    "due_day": l.due_day, "status": l.status} for l in leases],
        "notes_list": [{"id": n.id, "content": n.content, "created_at": n.created_at.isoformat()} for n in notes],
    }


@router.put("/{tid}", response_model=TenantOut)
def update_tenant(tid: int, data: TenantIn, db: Session = Depends(get_db), user=Depends(require_role("admin", "accountant"))):
    t = db.query(Tenant).filter(Tenant.id == tid).first()
    if not t:
        raise HTTPException(status_code=404, detail="المستأجر غير موجود")
    t.full_name = data.full_name
    t.phone = data.phone
    t.phone2 = data.phone2
    t.id_number = data.id_number
    t.status = data.status
    t.notes = data.notes
    db.commit()
    db.refresh(t)
    d = TenantOut.model_validate(t)
    d.created_at = t.created_at.isoformat() if t.created_at else ""
    d.credit_balance = float(t.credit_balance or 0)
    return d


@router.post("/{tid}/notes")
def add_tenant_note(tid: int, content: str, db: Session = Depends(get_db), user=Depends(require_role("admin", "accountant"))):
    n = Note(entity_type="tenant", entity_id=tid, content=content, created_by=user.id)
    db.add(n)
    db.commit()
    db.refresh(n)
    return {"id": n.id, "content": n.content, "created_at": n.created_at.isoformat()}


@router.get("/search/query")
def search_tenants(q: str, db: Session = Depends(get_db), user=Depends(require_user)):
    like = f"%{q}%"
    tenants = db.query(Tenant).filter(
        (Tenant.full_name.ilike(like)) | (Tenant.phone.ilike(like)) | (Tenant.tenant_number.ilike(like))
    ).limit(20).all()
    return [{"id": t.id, "tenant_number": t.tenant_number, "full_name": t.full_name, "phone": t.phone} for t in tenants]
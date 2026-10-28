from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Any
from decimal import Decimal
from ..database import get_db
from ..deps import require_user, require_role
from ..models import Property, PropertyType, PropertyStatus, Unit, UnitType, Note
from ..utils.numbering import gen_property_number
from ..utils.audit import log_audit

router = APIRouter(prefix="/properties", tags=["properties"])


class PropertyIn(BaseModel):
    name: str
    property_type: str = "other"
    address: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    description: Optional[str] = None
    units_count: int = 1
    status: str = "vacant"
    notes: Optional[str] = None


class PropertyOut(BaseModel):
    id: int
    property_number: str
    name: str
    property_type: str
    address: Optional[str]
    city: Optional[str]
    district: Optional[str]
    description: Optional[str]
    units_count: int
    status: str
    notes: Optional[str]
    created_at: Any

    class Config:
        from_attributes = True


class UnitIn(BaseModel):
    unit_number: str
    unit_type: str = "other"
    agreed_rent: float = 0
    status: str = "vacant"
    notes: Optional[str] = None
    lease_start: Optional[str] = None
    lease_end: Optional[str] = None


class UnitOut(BaseModel):
    id: int
    property_id: int
    unit_number: str
    unit_type: str
    agreed_rent: float
    status: str
    current_tenant_id: Optional[int]
    notes: Optional[str]

    class Config:
        from_attributes = True


class NoteIn(BaseModel):
    content: str


@router.get("", response_model=list[PropertyOut])
def list_properties(db: Session = Depends(get_db), user=Depends(require_user)):
    props = db.query(Property).order_by(Property.id.desc()).all()
    out = []
    for p in props:
        d = PropertyOut.model_validate(p)
        d.created_at = p.created_at.isoformat() if p.created_at else ""
        out.append(d)
    return out


@router.post("", response_model=PropertyOut)
def create_property(data: PropertyIn, db: Session = Depends(get_db), user=Depends(require_role("admin", "accountant"))):
    p = Property(
        property_number=gen_property_number(),
        name=data.name,
        property_type=data.property_type,
        address=data.address,
        city=data.city,
        district=data.district,
        description=data.description,
        units_count=data.units_count,
        status=data.status,
        notes=data.notes,
    )
    db.add(p)
    db.flush()
    # create default unit if units_count==1? Create one unit for single property convenience
    if data.units_count and data.units_count <= 1:
        u = Unit(property_id=p.id, unit_number="1", unit_type="other", agreed_rent=0, status="vacant")
        db.add(u)
    log_audit(db, user.id, user.username, "property.create", "property", p.id, None, {"name": p.name})
    db.commit()
    db.refresh(p)
    d = PropertyOut.model_validate(p)
    d.created_at = p.created_at.isoformat() if p.created_at else ""
    return d


@router.get("/{pid}", response_model=PropertyOut)
def get_property(pid: int, db: Session = Depends(get_db), user=Depends(require_user)):
    p = db.query(Property).filter(Property.id == pid).first()
    if not p:
        raise HTTPException(status_code=404, detail="العقار غير موجود")
    d = PropertyOut.model_validate(p)
    d.created_at = p.created_at.isoformat() if p.created_at else ""
    return d


@router.put("/{pid}", response_model=PropertyOut)
def update_property(pid: int, data: PropertyIn, db: Session = Depends(get_db), user=Depends(require_role("admin", "accountant"))):
    p = db.query(Property).filter(Property.id == pid).first()
    if not p:
        raise HTTPException(status_code=404, detail="العقار غير موجود")
    old = {"name": p.name, "status": p.status}
    p.name = data.name
    p.property_type = data.property_type
    p.address = data.address
    p.city = data.city
    p.district = data.district
    p.description = data.description
    p.units_count = data.units_count
    p.status = data.status
    p.notes = data.notes
    log_audit(db, user.id, user.username, "property.update", "property", p.id, old, {"name": p.name, "status": p.status})
    db.commit()
    db.refresh(p)
    d = PropertyOut.model_validate(p)
    d.created_at = p.created_at.isoformat() if p.created_at else ""
    return d


@router.delete("/{pid}")
def archive_property(pid: int, db: Session = Depends(get_db), user=Depends(require_role("admin"))):
    # soft: set inactive instead of delete; prevent delete if financial records
    p = db.query(Property).filter(Property.id == pid).first()
    if not p:
        raise HTTPException(status_code=404, detail="العقار غير موجود")
    # check financial records
    from ..models import Charge, Expense, CashMovement, Lease
    has = db.query(Charge).filter(Charge.property_id == pid).first() or \
          db.query(Expense).filter(Expense.property_id == pid).first() or \
          db.query(Lease).filter(Lease.property_id == pid).first()
    if has:
        p.status = PropertyStatus.INACTIVE.value
        db.commit()
        return {"message": "تم أرشفة العقار (يحتوي على سجلات مالية)"}
    db.delete(p)
    db.commit()
    return {"message": "تم حذف العقار"}


# Units
@router.get("/{pid}/units", response_model=list[UnitOut])
def list_units(pid: int, db: Session = Depends(get_db), user=Depends(require_user)):
    units = db.query(Unit).filter(Unit.property_id == pid).all()
    return [UnitOut.model_validate(u) for u in units]


@router.post("/{pid}/units", response_model=UnitOut)
def create_unit(pid: int, data: UnitIn, db: Session = Depends(get_db), user=Depends(require_role("admin", "accountant"))):
    p = db.query(Property).filter(Property.id == pid).first()
    if not p:
        raise HTTPException(status_code=404, detail="العقار غير موجود")
    from datetime import datetime
    ls = datetime.fromisoformat(data.lease_start) if data.lease_start else None
    le = datetime.fromisoformat(data.lease_end) if data.lease_end else None
    u = Unit(property_id=pid, unit_number=data.unit_number, unit_type=data.unit_type,
             agreed_rent=Decimal(str(data.agreed_rent)), status=data.status, notes=data.notes,
             lease_start=ls, lease_end=le)
    db.add(u)
    db.commit()
    db.refresh(u)
    return UnitOut.model_validate(u)


@router.put("/units/{uid}", response_model=UnitOut)
def update_unit(uid: int, data: UnitIn, db: Session = Depends(get_db), user=Depends(require_role("admin", "accountant"))):
    u = db.query(Unit).filter(Unit.id == uid).first()
    if not u:
        raise HTTPException(status_code=404, detail="الوحدة غير موجودة")
    from datetime import datetime
    u.unit_number = data.unit_number
    u.unit_type = data.unit_type
    u.agreed_rent = Decimal(str(data.agreed_rent))
    u.status = data.status
    u.notes = data.notes
    u.lease_start = datetime.fromisoformat(data.lease_start) if data.lease_start else None
    u.lease_end = datetime.fromisoformat(data.lease_end) if data.lease_end else None
    db.commit()
    db.refresh(u)
    return UnitOut.model_validate(u)


# Notes
@router.get("/{pid}/notes")
def list_notes(pid: int, db: Session = Depends(get_db), user=Depends(require_user)):
    notes = db.query(Note).filter(Note.entity_type == "property", Note.entity_id == pid).order_by(Note.created_at.desc()).all()
    return [{"id": n.id, "content": n.content, "created_at": n.created_at.isoformat()} for n in notes]


@router.post("/{pid}/notes")
def add_note(pid: int, data: NoteIn, db: Session = Depends(get_db), user=Depends(require_role("admin", "accountant"))):
    n = Note(entity_type="property", entity_id=pid, content=data.content, created_by=user.id)
    db.add(n)
    db.commit()
    db.refresh(n)
    return {"id": n.id, "content": n.content, "created_at": n.created_at.isoformat()}
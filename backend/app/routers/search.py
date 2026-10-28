from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..deps import require_user
from ..models import Property, Tenant, Payment, CashMovement

router = APIRouter(prefix="/search", tags=["search"])


@router.get("")
def global_search(q: str, db: Session = Depends(get_db), user=Depends(require_user)):
    like = f"%{q}%"
    results = {"properties": [], "tenants": [], "payments": [], "movements": []}
    props = db.query(Property).filter(
        (Property.name.ilike(like)) | (Property.property_number.ilike(like)) |
        (Property.address.ilike(like)) | (Property.city.ilike(like))
    ).limit(20).all()
    results["properties"] = [{"id": p.id, "property_number": p.property_number, "name": p.name,
                              "address": p.address, "city": p.city} for p in props]
    tenants = db.query(Tenant).filter(
        (Tenant.full_name.ilike(like)) | (Tenant.phone.ilike(like)) | (Tenant.tenant_number.ilike(like))
    ).limit(20).all()
    results["tenants"] = [{"id": t.id, "tenant_number": t.tenant_number, "full_name": t.full_name,
                           "phone": t.phone} for t in tenants]
    pays = db.query(Payment).filter(Payment.receipt_number.ilike(like)).limit(20).all()
    results["payments"] = [{"id": p.id, "receipt_number": p.receipt_number, "amount": float(p.amount),
                            "payment_date": p.payment_date.isoformat(), "tenant_id": p.tenant_id} for p in pays]
    movs = db.query(CashMovement).filter(
        (CashMovement.movement_number.ilike(like)) | (CashMovement.description.ilike(like))
    ).limit(20).all()
    results["movements"] = [{"id": m.id, "movement_number": m.movement_number, "amount": float(m.amount),
                             "movement_date": m.movement_date.isoformat()} for m in movs]
    return results
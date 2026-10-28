from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..deps import require_user
from ..models import AuditLog

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("")
def list_audit(limit: int = 200, db: Session = Depends(get_db), user=Depends(require_user)):
    rows = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()
    return [{"id": r.id, "username": r.username, "action": r.action, "entity_type": r.entity_type,
             "entity_id": r.entity_id, "old_values": r.old_values, "new_values": r.new_values,
             "created_at": r.created_at.isoformat() if r.created_at else None} for r in rows]
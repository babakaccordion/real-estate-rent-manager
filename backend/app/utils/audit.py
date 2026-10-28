from sqlalchemy.orm import Session
from ..models import AuditLog


def log_audit(db: Session, user_id, username, action, entity_type, entity_id=None, old_values=None, new_values=None):
    entry = AuditLog(
        user_id=user_id,
        username=username,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_values=old_values,
        new_values=new_values,
    )
    db.add(entry)
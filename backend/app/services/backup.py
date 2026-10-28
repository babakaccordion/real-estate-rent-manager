import json
from datetime import datetime, date, timezone
from decimal import Decimal
from sqlalchemy.orm import Session
from ..models import (
    User, Property, Unit, Tenant, Lease, Charge, Payment, PaymentAllocation,
    Expense, CashMovement, Note, AuditLog, AppSetting,
)
from ..config import DATA_DIR, BACKUPS_DIR


def _default(o):
    if isinstance(o, (datetime, date)):
        return o.isoformat()
    if isinstance(o, Decimal):
        return str(o)
    raise TypeError(f"Not serializable: {type(o)}")


def export_all(db: Session) -> str:
    data = {}
    for name, model in [
        ("users", User), ("properties", Property), ("units", Unit), ("tenants", Tenant),
        ("leases", Lease), ("charges", Charge), ("payments", Payment),
        ("payment_allocations", PaymentAllocation), ("expenses", Expense),
        ("cash_movements", CashMovement), ("notes", Note), ("audit_logs", AuditLog),
        ("app_settings", AppSetting),
    ]:
        rows = db.query(model).all()
        data[name] = [{c.name: getattr(r, c.name) for c in model.__table__.columns} for r in rows]
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = BACKUPS_DIR / f"backup_{ts}.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=_default)
    return str(path)


def _coerce_row(model, row: dict) -> dict:
    """يحوّل قيم JSON (نصوص) إلى أنواع الأعمدة قبل الإدراج.

    ملفات النسخ الاحتياطي تحفظ التواريخ والأرقام كنصوص، وSQLAlchemy يرفض
    إدراج النص في عمود DateTime، لذا نحوّلها هنا. التواريخ تُخزَّن UTC وبدون
    منطقة زمنية كما يفعل باقي التطبيق.
    """
    out = {}
    for col in model.__table__.columns:
        if col.name not in row:
            continue
        value = row[col.name]
        if value is None:
            out[col.name] = None
            continue
        try:
            py_type = col.type.python_type
        except (NotImplementedError, AttributeError):
            out[col.name] = value
            continue
        try:
            if py_type is datetime and isinstance(value, str):
                dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
                if dt.tzinfo is not None:
                    dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
                out[col.name] = dt
            elif py_type is date and isinstance(value, str):
                out[col.name] = date.fromisoformat(value[:10])
            elif py_type is Decimal:
                out[col.name] = Decimal(str(value))
            elif py_type is bool:
                out[col.name] = value if isinstance(value, bool) else str(value).strip().lower() in ("1", "true", "yes", "on")
            elif py_type is int and not isinstance(value, int):
                out[col.name] = int(value)
            elif py_type is float and not isinstance(value, float):
                out[col.name] = float(value)
            else:
                out[col.name] = value
        except (TypeError, ValueError):
            out[col.name] = value
    return out


def restore_from_file(db: Session, path: str) -> dict:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    # Simple restore: clear tables then insert. Order matters.
    # Delete all
    for model in [PaymentAllocation, Payment, Charge, Lease, Unit, Expense, CashMovement, Note, AuditLog, Tenant, Property, AppSetting]:
        db.query(model).delete()
    db.commit()

    def load(name, model):
        for row in data.get(name, []):
            obj = model(**_coerce_row(model, row))
            db.add(obj)
        db.commit()

    # users keep? skip users to avoid password overwrite? We'll restore users too.
    load("properties", Property)
    load("units", Unit)
    load("tenants", Tenant)
    load("leases", Lease)
    load("charges", Charge)
    load("payments", Payment)
    load("payment_allocations", PaymentAllocation)
    load("expenses", Expense)
    load("cash_movements", CashMovement)
    load("notes", Note)
    load("app_settings", AppSetting)
    db.commit()
    return {"restored": True, "counts": {k: len(v) for k, v in data.items()}}
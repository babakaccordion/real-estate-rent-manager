import pytest
from app.database import SessionLocal, Base, engine
from app.models import (
    PaymentAllocation, Payment, Charge, Lease, Unit, Expense, CashMovement,
    Note, AuditLog, Tenant, Property, AppSetting,
)


@pytest.fixture(autouse=True)
def clean_db():
    db = SessionLocal()
    for model in [PaymentAllocation, Payment, Charge, Lease, Unit, Expense, CashMovement, Note, AuditLog, Tenant, Property]:
        db.query(model).delete()
    db.commit()
    # keep users and settings
    db.close()
    yield
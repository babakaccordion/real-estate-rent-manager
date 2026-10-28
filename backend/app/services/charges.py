from datetime import datetime, timezone, date
from sqlalchemy.orm import Session
from ..models import Lease, LeaseStatus, Charge, ChargeStatus
from ..services.finance import to_decimal, charge_status
from ..config import DEFAULT_TIMEZONE
import calendar


def _add_months(d: date, n: int) -> date:
    y = d.year + (d.month - 1 + n) // 12
    m = (d.month - 1 + n) % 12 + 1
    day = min(d.day, calendar.monthrange(y, m)[1])
    return date(y, m, day)


def generate_charges_for_lease(db: Session, lease: Lease, up_to: date | None = None) -> int:
    """Generate monthly charges for a lease from start_date up to up_to (or lease end). Idempotent."""
    if lease.status != LeaseStatus.ACTIVE.value and lease.status != "active":
        # allow generating for active only
        if lease.status != LeaseStatus.ACTIVE.value:
            return 0
    if up_to is None:
        up_to = date.today()
    if lease.end_date is not None:
        end_d = lease.end_date.date() if hasattr(lease.end_date, "date") else lease.end_date
        if end_d < up_to:
            up_to = end_d

    start = lease.start_date.date() if hasattr(lease.start_date, "date") else lease.start_date
    # first due date: start month with due_day
    # We generate from the month of start_date
    cur = date(start.year, start.month, 1)
    created = 0
    # safety cap: 240 months
    for _ in range(240):
        if cur > up_to:
            break
        # due day clamped
        due_day = min(lease.due_day, calendar.monthrange(cur.year, cur.month)[1])
        due_date = date(cur.year, cur.month, due_day)
        if due_date < start:
            # skip months before start
            cur = _add_months(cur, 1)
            continue
        if due_date > up_to:
            cur = _add_months(cur, 1)
            continue
        period = f"{cur.year:04d}-{cur.month:02d}"
        existing = db.query(Charge).filter(Charge.lease_id == lease.id, Charge.period == period).first()
        if existing is None:
            ch = Charge(
                lease_id=lease.id,
                property_id=lease.property_id,
                tenant_id=lease.tenant_id,
                period=period,
                due_date=datetime(due_date.year, due_date.month, due_date.day, tzinfo=timezone.utc),
                amount_due=lease.agreed_rent,
                amount_paid=Decimal("0"),
                status=ChargeStatus.DUE.value,
            )
            db.add(ch)
            created += 1
        cur = _add_months(cur, 1)
    return created


def generate_all_charges(db: Session, up_to: date | None = None) -> int:
    total = 0
    leases = db.query(Lease).filter(Lease.status == LeaseStatus.ACTIVE.value).all()
    for lease in leases:
        total += generate_charges_for_lease(db, lease, up_to)
    db.commit()
    return total


def refresh_charge_statuses(db: Session) -> int:
    """Recompute status for all non-cancelled charges based on payments and today."""
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    charges = db.query(Charge).filter(Charge.status != ChargeStatus.CANCELLED.value).all()
    updated = 0
    for c in charges:
        # amount_paid should be synced from allocations; recompute
        alloc_sum = sum((a.amount for a in c.allocations), start=__import__("decimal").Decimal("0"))
        c.amount_paid = alloc_sum
        new = charge_status(c.amount_due, c.amount_paid, c.due_date, now)
        if new != c.status:
            c.status = new
            updated += 1
    db.commit()
    return updated


from decimal import Decimal
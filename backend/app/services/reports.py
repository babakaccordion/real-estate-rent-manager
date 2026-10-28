from datetime import datetime, timezone, date, timedelta
from decimal import Decimal
from sqlalchemy import func
from sqlalchemy.orm import Session
from ..models import (
    Property, Unit, Tenant, Lease, LeaseStatus, Charge, ChargeStatus,
    Payment, Expense, CashMovement, CashMovementType,
)
from ..services.finance import to_decimal


def _day_start(d: date) -> datetime:
    return datetime(d.year, d.month, d.day, tzinfo=timezone.utc)


def _day_end(d: date) -> datetime:
    return datetime(d.year, d.month, d.day, 23, 59, 59, tzinfo=timezone.utc)


def cash_balance_upto(db: Session, end: datetime, property_id=None) -> Decimal:
    q = db.query(func.coalesce(func.sum(CashMovement.amount), 0)).filter(CashMovement.movement_date <= end)
    if property_id is not None:
        q = q.filter(CashMovement.property_id == property_id)
    return to_decimal(q.scalar())


def property_report(db: Session, property_id: int, start: date, end: date) -> dict:
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise ValueError("العقار غير موجود")
    units = db.query(Unit).filter(Unit.property_id == property_id).all()
    # tenants linked via leases
    leases = db.query(Lease).filter(Lease.property_id == property_id).all()
    tenant_ids = {l.tenant_id for l in leases}
    tenants = db.query(Tenant).filter(Tenant.id.in_(tenant_ids)).all() if tenant_ids else []

    start_dt = _day_start(start)
    end_dt = _day_end(end)

    # charges in period
    charges = db.query(Charge).filter(
        Charge.property_id == property_id,
        Charge.due_date >= start_dt,
        Charge.due_date <= end_dt,
        Charge.status != ChargeStatus.CANCELLED.value,
    ).all()
    total_due = sum((to_decimal(c.amount_due) for c in charges), start=Decimal("0"))
    total_remaining_charges = sum((to_decimal(c.amount_due) - to_decimal(c.amount_paid) for c in charges), start=Decimal("0"))
    if total_remaining_charges < 0:
        total_remaining_charges = Decimal("0")

    # payments in period
    payments = db.query(Payment).filter(
        Payment.property_id == property_id,
        Payment.payment_date >= start_dt,
        Payment.payment_date <= end_dt,
    ).all()
    total_collected = sum((to_decimal(p.amount) for p in payments), start=Decimal("0"))

    # expenses in period
    expenses = db.query(Expense).filter(
        Expense.property_id == property_id,
        Expense.expense_date >= start_dt,
        Expense.expense_date <= end_dt,
    ).all()
    exp_paid = sum((to_decimal(e.amount) for e in expenses if e.is_paid), start=Decimal("0"))
    exp_unpaid = sum((to_decimal(e.amount) for e in expenses if not e.is_paid), start=Decimal("0"))

    # cash
    opening = cash_balance_upto(db, start_dt - timedelta(seconds=1), property_id)
    closing = cash_balance_upto(db, end_dt, property_id)
    net_cf = total_collected - exp_paid

    # overdue charges (all time up to end) for this property
    overdue_charges = db.query(Charge).filter(
        Charge.property_id == property_id,
        Charge.due_date <= end_dt,
        Charge.status.in_([ChargeStatus.DUE.value, ChargeStatus.PARTIAL.value, ChargeStatus.OVERDUE.value]),
    ).all()
    total_overdue = sum((to_decimal(c.amount_due) - to_decimal(c.amount_paid) for c in overdue_charges), start=Decimal("0"))

    return {
        "property": {
            "id": prop.id,
            "property_number": prop.property_number,
            "name": prop.name,
            "type": prop.property_type,
            "address": prop.address,
            "city": prop.city,
            "district": prop.district,
            "status": prop.status,
        },
        "period": {"start": str(start), "end": str(end)},
        "units_count": len(units),
        "tenants_count": len(tenants),
        "active_leases": sum(1 for l in leases if l.status == LeaseStatus.ACTIVE.value),
        "total_due": total_due,
        "total_collected": total_collected,
        "total_remaining": total_remaining_charges,
        "total_overdue": total_overdue,
        "expenses_paid": exp_paid,
        "expenses_unpaid": exp_unpaid,
        "net_cash_flow": net_cf,
        "opening_balance": opening,
        "closing_balance": closing,
        "charges": [
            {
                "id": c.id, "period": c.period, "due_date": c.due_date.isoformat(),
                "amount_due": str(c.amount_due), "amount_paid": str(c.amount_paid),
                "status": c.status, "tenant_id": c.tenant_id,
            } for c in charges
        ],
        "payments": [
            {"id": p.id, "receipt_number": p.receipt_number, "amount": str(p.amount),
             "payment_date": p.payment_date.isoformat(), "method": p.method, "tenant_id": p.tenant_id}
            for p in payments
        ],
        "expenses": [
            {"id": e.id, "expense_number": e.expense_number, "category": e.category,
             "amount": str(e.amount), "expense_date": e.expense_date.isoformat(),
             "is_paid": e.is_paid, "description": e.description}
            for e in expenses
        ],
    }


def overall_report(db: Session, start: date, end: date, property_id: int | None = None) -> dict:
    """Overall report across properties (or single if property_id given)."""
    if property_id is not None:
        pr = property_report(db, property_id, start, end)
        return {"period": pr["period"], "properties": [pr], "totals": _totals_from_properties([pr])}

    props = db.query(Property).order_by(Property.id).all()
    prop_reports = [property_report(db, p.id, start, end) for p in props]
    totals = _totals_from_properties(prop_reports)
    return {"period": {"start": str(start), "end": str(end)}, "properties": prop_reports, "totals": totals}


def _totals_from_properties(prs: list) -> dict:
    return {
        "properties_count": len(prs),
        "units_count": sum(p["units_count"] for p in prs),
        "tenants_count": sum(p["tenants_count"] for p in prs),
        "total_due": sum((to_decimal(p["total_due"]) for p in prs), start=Decimal("0")),
        "total_collected": sum((to_decimal(p["total_collected"]) for p in prs), start=Decimal("0")),
        "total_remaining": sum((to_decimal(p["total_remaining"]) for p in prs), start=Decimal("0")),
        "total_overdue": sum((to_decimal(p["total_overdue"]) for p in prs), start=Decimal("0")),
        "expenses_paid": sum((to_decimal(p["expenses_paid"]) for p in prs), start=Decimal("0")),
        "expenses_unpaid": sum((to_decimal(p["expenses_unpaid"]) for p in prs), start=Decimal("0")),
        "net_cash_flow": sum((to_decimal(p["net_cash_flow"]) for p in prs), start=Decimal("0")),
        "opening_balance": sum((to_decimal(p["opening_balance"]) for p in prs), start=Decimal("0")),
        "closing_balance": sum((to_decimal(p["closing_balance"]) for p in prs), start=Decimal("0")),
    }


def tenant_report(db: Session, tenant_id: int, start: date, end: date) -> dict:
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise ValueError("المستأجر غير موجود")
    start_dt = _day_start(start)
    end_dt = _day_end(end)
    charges = db.query(Charge).filter(
        Charge.tenant_id == tenant_id,
        Charge.due_date >= start_dt,
        Charge.due_date <= end_dt,
        Charge.status != ChargeStatus.CANCELLED.value,
    ).all()
    payments = db.query(Payment).filter(
        Payment.tenant_id == tenant_id,
        Payment.payment_date >= start_dt,
        Payment.payment_date <= end_dt,
    ).all()
    leases = db.query(Lease).filter(Lease.tenant_id == tenant_id).all()
    total_due = sum((to_decimal(c.amount_due) for c in charges), start=Decimal("0"))
    total_paid = sum((to_decimal(c.amount_paid) for c in charges), start=Decimal("0"))
    total_collected = sum((to_decimal(p.amount) for p in payments), start=Decimal("0"))
    remaining = total_due - total_paid
    if remaining < 0:
        remaining = Decimal("0")
    return {
        "tenant": {
            "id": tenant.id, "tenant_number": tenant.tenant_number,
            "full_name": tenant.full_name, "phone": tenant.phone, "status": tenant.status,
            "credit_balance": str(tenant.credit_balance),
        },
        "period": {"start": str(start), "end": str(end)},
        "leases": [{"id": l.id, "property_id": l.property_id, "agreed_rent": str(l.agreed_rent),
                    "start_date": l.start_date.isoformat(), "end_date": l.end_date.isoformat() if l.end_date else None,
                    "status": l.status} for l in leases],
        "charges": [{"id": c.id, "period": c.period, "due_date": c.due_date.isoformat(),
                     "amount_due": str(c.amount_due), "amount_paid": str(c.amount_paid), "status": c.status}
                    for c in charges],
        "payments": [{"id": p.id, "receipt_number": p.receipt_number, "amount": str(p.amount),
                      "payment_date": p.payment_date.isoformat(), "method": p.method} for p in payments],
        "total_due": total_due,
        "total_collected": total_collected,
        "remaining": remaining,
    }


def cash_report(db: Session, start: date, end: date, property_id: int | None = None) -> dict:
    start_dt = _day_start(start)
    end_dt = _day_end(end)
    opening = cash_balance_upto(db, start_dt - timedelta(seconds=1), property_id)
    closing = cash_balance_upto(db, end_dt, property_id)
    q = db.query(CashMovement).filter(CashMovement.movement_date >= start_dt, CashMovement.movement_date <= end_dt)
    if property_id is not None:
        q = q.filter(CashMovement.property_id == property_id)
    movements = q.order_by(CashMovement.movement_date).all()
    receipts = sum((to_decimal(m.amount) for m in movements if m.movement_type == CashMovementType.RENT_RECEIPT.value), start=Decimal("0"))
    expenses = sum((-to_decimal(m.amount) for m in movements if m.movement_type == CashMovementType.EXPENSE.value), start=Decimal("0"))
    adjustments = sum((to_decimal(m.amount) for m in movements if m.movement_type in (CashMovementType.ADJUSTMENT.value, CashMovementType.OTHER.value, CashMovementType.OPENING_BALANCE.value)), start=Decimal("0"))
    # opening balance movements in period? include as adjustments? Already counted in opening if before. Movements of type opening_balance in period add to balance; treat as part of adjustments above.
    return {
        "period": {"start": str(start), "end": str(end)},
        "property_id": property_id,
        "opening_balance": opening,
        "receipts": receipts,
        "expenses_paid": expenses,
        "adjustments": adjustments,
        "closing_balance": closing,
        "movements": [
            {"id": m.id, "movement_number": m.movement_number, "movement_type": m.movement_type,
             "amount": str(m.amount), "movement_date": m.movement_date.isoformat(),
             "property_id": m.property_id, "tenant_id": m.tenant_id, "category": m.category,
             "description": m.description, "method": m.method, "receipt_ref": m.receipt_ref}
            for m in movements
        ],
    }


def arrears_report(db: Session, end: date, property_id: int | None = None) -> list:
    end_dt = _day_end(end)
    q = db.query(Charge).filter(
        Charge.due_date <= end_dt,
        Charge.status.in_([ChargeStatus.DUE.value, ChargeStatus.PARTIAL.value, ChargeStatus.OVERDUE.value]),
    )
    if property_id is not None:
        q = q.filter(Charge.property_id == property_id)
    charges = q.order_by(Charge.due_date).all()
    result = []
    for c in charges:
        rem = to_decimal(c.amount_due) - to_decimal(c.amount_paid)
        if rem <= 0:
            continue
        days = (end_dt.date() - c.due_date.date()).days
        if days < 0:
            days = 0
        tenant = db.query(Tenant).filter(Tenant.id == c.tenant_id).first()
        prop = db.query(Property).filter(Property.id == c.property_id).first()
        result.append({
            "charge_id": c.id, "period": c.period, "due_date": c.due_date.isoformat(),
            "amount_due": str(c.amount_due), "amount_paid": str(c.amount_paid),
            "remaining": str(rem), "days_overdue": days,
            "tenant_id": c.tenant_id, "tenant_name": tenant.full_name if tenant else "",
            "property_id": c.property_id, "property_name": prop.name if prop else "",
        })
    return result


def expenses_report(db: Session, start: date, end: date, property_id: int | None = None) -> list:
    start_dt = _day_start(start)
    end_dt = _day_end(end)
    q = db.query(Expense).filter(Expense.expense_date >= start_dt, Expense.expense_date <= end_dt)
    if property_id is not None:
        q = q.filter(Expense.property_id == property_id)
    exps = q.order_by(Expense.expense_date).all()
    return [
        {"id": e.id, "expense_number": e.expense_number, "property_id": e.property_id,
         "category": e.category, "amount": str(e.amount), "expense_date": e.expense_date.isoformat(),
         "is_paid": e.is_paid, "description": e.description}
        for e in exps
    ]


def receipts_report(db: Session, start: date, end: date, property_id: int | None = None) -> list:
    start_dt = _day_start(start)
    end_dt = _day_end(end)
    q = db.query(Payment).filter(Payment.payment_date >= start_dt, Payment.payment_date <= end_dt)
    if property_id is not None:
        q = q.filter(Payment.property_id == property_id)
    pays = q.order_by(Payment.payment_date).all()
    out = []
    for p in pays:
        tenant = db.query(Tenant).filter(Tenant.id == p.tenant_id).first()
        prop = db.query(Property).filter(Property.id == p.property_id).first() if p.property_id else None
        out.append({
            "id": p.id, "receipt_number": p.receipt_number, "amount": str(p.amount),
            "payment_date": p.payment_date.isoformat(), "method": p.method,
            "tenant_id": p.tenant_id, "tenant_name": tenant.full_name if tenant else "",
            "property_id": p.property_id, "property_name": prop.name if prop else "",
        })
    return out
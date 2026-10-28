from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from ..models import (
    Payment, PaymentAllocation, Charge, ChargeStatus, Tenant, CashMovement, CashMovementType,
)
from ..utils.numbering import gen_receipt_number, gen_movement_number
from ..services.finance import to_decimal
from ..utils.audit import log_audit


def record_payment(
    db: Session,
    tenant_id: int,
    amount,
    payment_date: datetime,
    method: str = "cash",
    property_id: int | None = None,
    notes: str | None = None,
    charge_id: int | None = None,
    user_id: int | None = None,
    username: str | None = None,
) -> Payment:
    amt = to_decimal(amount)
    if amt <= 0:
        raise ValueError("المبلغ يجب أن يكون أكبر من صفر")

    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise ValueError("المستأجر غير موجود")

    # determine property if not given
    if property_id is None:
        # from active lease
        from ..models import Lease, LeaseStatus
        lease = db.query(Lease).filter(Lease.tenant_id == tenant_id, Lease.status == LeaseStatus.ACTIVE.value).first()
        if lease:
            property_id = lease.property_id

    payment = Payment(
        receipt_number=gen_receipt_number(),
        tenant_id=tenant_id,
        property_id=property_id,
        amount=amt,
        payment_date=payment_date,
        method=method,
        notes=notes,
        created_by=user_id,
    )
    db.add(payment)
    db.flush()

    # Candidate charges for this tenant (unpaid/partial/overdue/due), ordered by due_date
    q = db.query(Charge).filter(
        Charge.tenant_id == tenant_id,
        Charge.status != ChargeStatus.CANCELLED.value,
        Charge.status != ChargeStatus.PAID.value,
    ).order_by(Charge.due_date.asc())
    if charge_id is not None:
        # prioritize selected charge but still allow others? We'll allocate to selected first
        selected = db.query(Charge).filter(Charge.id == charge_id).first()
        if selected:
            others = [c for c in q.all() if c.id != charge_id]
            charges = [selected] + others
        else:
            charges = q.all()
    else:
        charges = q.all()

    remaining = amt
    for c in charges:
        if remaining <= 0:
            break
        due = to_decimal(c.amount_due)
        paid = to_decimal(c.amount_paid)
        charge_remaining = due - paid
        if charge_remaining <= 0:
            continue
        alloc = min(remaining, charge_remaining)
        db.add(PaymentAllocation(payment_id=payment.id, charge_id=c.id, amount=alloc))
        c.amount_paid = paid + alloc
        # status
        from ..services.finance import charge_status
        c.status = charge_status(c.amount_due, c.amount_paid, c.due_date)
        remaining -= alloc

    # handle overpayment -> credit balance
    if remaining > 0:
        tenant.credit_balance = to_decimal(tenant.credit_balance) + remaining
        # record as credit? We'll note in payment notes already; cash movement includes full amount

    db.flush()

    # cash movement (rent receipt) full amount
    cm = CashMovement(
        movement_number=gen_movement_number(),
        movement_type=CashMovementType.RENT_RECEIPT.value,
        amount=amt,  # positive receipt
        movement_date=payment_date,
        property_id=property_id,
        tenant_id=tenant_id,
        payment_id=payment.id,
        category="إيجار",
        description=f"قبض إيجار - إيصال {payment.receipt_number}",
        method=method,
        receipt_ref=payment.receipt_number,
        created_by=user_id,
    )
    db.add(cm)

    log_audit(db, user_id, username, "payment.create", "payment", payment.id,
              None, {"amount": str(amt), "tenant_id": tenant_id, "receipt": payment.receipt_number})

    db.commit()
    db.refresh(payment)
    return payment


def cancel_payment(db: Session, payment_id: int, user_id=None, username=None, reason=None):
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise ValueError("الدفعة غير موجودة")
    # reverse allocations
    for alloc in payment.allocations:
        charge = db.query(Charge).filter(Charge.id == alloc.charge_id).first()
        if charge:
            charge.amount_paid = to_decimal(charge.amount_paid) - to_decimal(alloc.amount)
            from ..services.finance import charge_status
            charge.status = charge_status(charge.amount_due, charge.amount_paid, charge.due_date)
    # reverse credit if overpayment occurred? We credited excess; reverse by recomputing? Simpler: subtract amount from credit up to remaining credit
    tenant = db.query(Tenant).filter(Tenant.id == payment.tenant_id).first()
    if tenant:
        # reverse credit: we don't know exact excess; recompute credit from all payments? Instead, subtract min(credit, payment amount not allocated)
        allocated = sum((to_decimal(a.amount) for a in payment.allocations), start=Decimal("0"))
        excess = to_decimal(payment.amount) - allocated
        if excess > 0:
            tenant.credit_balance = max(Decimal("0"), to_decimal(tenant.credit_balance) - excess)
    # remove cash movement
    cm = db.query(CashMovement).filter(CashMovement.payment_id == payment.id).first()
    if cm:
        db.delete(cm)
    # delete allocations
    for alloc in list(payment.allocations):
        db.delete(alloc)
    db.delete(payment)
    log_audit(db, user_id, username, "payment.cancel", "payment", payment_id, {"amount": str(payment.amount)}, {"reason": reason})
    db.commit()
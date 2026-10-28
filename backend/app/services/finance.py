from decimal import Decimal, ROUND_HALF_UP
from datetime import date, datetime, timezone


def to_decimal(value) -> Decimal:
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def q(value, places=4) -> Decimal:
    quant = Decimal(1).scaleb(-places)  # 10^-places
    return to_decimal(value).quantize(quant, rounding=ROUND_HALF_UP)


def charge_status(amount_due: Decimal, amount_paid: Decimal, due_date: datetime, today: datetime | None = None) -> str:
    ad = to_decimal(amount_due)
    ap = to_decimal(amount_paid)
    if due_date is not None and getattr(due_date, "tzinfo", None) is None:
        due_date = due_date.replace(tzinfo=timezone.utc)
    if ad <= 0:
        return "paid"
    if ap >= ad:
        return "paid"
    ref = today or datetime.now(timezone.utc)
    if getattr(ref, "tzinfo", None) is None:
        ref = ref.replace(tzinfo=timezone.utc)
    if ap > 0:
        if due_date < ref:
            return "overdue"
        return "partial"
    if due_date < ref:
        return "overdue"
    return "due"


def remaining_charge(amount_due, amount_paid) -> Decimal:
    return to_decimal(amount_due) - to_decimal(amount_paid)


def cash_balance(opening, receipts, expenses_paid, adjustments) -> Decimal:
    return to_decimal(opening) + to_decimal(receipts) - to_decimal(expenses_paid) + to_decimal(adjustments)


def net_cash_flow(receipts, expenses_paid) -> Decimal:
    return to_decimal(receipts) - to_decimal(expenses_paid)


def period_key(d: datetime | date) -> str:
    return f"{d.year:04d}-{d.month:02d}"
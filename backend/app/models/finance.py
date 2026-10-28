import enum
from sqlalchemy import String, Integer, Text, DateTime, ForeignKey, func, Numeric, UniqueConstraint, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base
from decimal import Decimal


class ChargeStatus(str, enum.Enum):
    DUE = "due"
    PARTIAL = "partial"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


CHARGE_STATUS_LABELS = {
    "due": "مستحق",
    "partial": "مدفوع جزئيًا",
    "paid": "مدفوع بالكامل",
    "overdue": "متأخر",
    "cancelled": "ملغى",
}

PAYMENT_METHOD_LABELS = {
    "cash": "نقدًا",
    "bank": "تحويل بنكي",
    "other": "أخرى",
}


class Charge(Base):
    __tablename__ = "charges"
    __table_args__ = (UniqueConstraint("lease_id", "period", name="uq_charge_lease_period"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    lease_id: Mapped[int] = mapped_column(ForeignKey("leases.id", ondelete="CASCADE"), index=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("properties.id", ondelete="CASCADE"), index=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    period: Mapped[str] = mapped_column(String(7), index=True)  # YYYY-MM
    due_date: Mapped[DateTime] = mapped_column(DateTime(timezone=True))
    amount_due: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    amount_paid: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=0)
    status: Mapped[str] = mapped_column(String(16), default=ChargeStatus.DUE.value)
    cancel_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    lease: Mapped["Lease"] = relationship("Lease", back_populates="charges")
    allocations: Mapped[list["PaymentAllocation"]] = relationship("PaymentAllocation", back_populates="charge", cascade="all, delete-orphan")


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    receipt_number: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    property_id: Mapped[int | None] = mapped_column(ForeignKey("properties.id", ondelete="SET NULL"), nullable=True, index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    payment_date: Mapped[DateTime] = mapped_column(DateTime(timezone=True))
    method: Mapped[str] = mapped_column(String(16), default="cash")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    allocations: Mapped[list["PaymentAllocation"]] = relationship("PaymentAllocation", back_populates="payment", cascade="all, delete-orphan")


class PaymentAllocation(Base):
    __tablename__ = "payment_allocations"

    id: Mapped[int] = mapped_column(primary_key=True)
    payment_id: Mapped[int] = mapped_column(ForeignKey("payments.id", ondelete="CASCADE"), index=True)
    charge_id: Mapped[int] = mapped_column(ForeignKey("charges.id", ondelete="CASCADE"), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 4))

    payment: Mapped["Payment"] = relationship("Payment", back_populates="allocations")
    charge: Mapped["Charge"] = relationship("Charge", back_populates="allocations")


class ExpenseCategory(str, enum.Enum):
    MAINTENANCE = "maintenance"
    REPAIR = "repair"
    UTILITIES = "utilities"
    WATER_ELECTRIC = "water_electric"
    TAXES_FEES = "taxes_fees"
    CLEANING = "cleaning"
    OTHER = "other"


EXPENSE_CATEGORY_LABELS = {
    "maintenance": "صيانة",
    "repair": "إصلاح أعطال",
    "utilities": "أجور خدمات",
    "water_electric": "jualanات المياه والكهرباء",
    "taxes_fees": "رسوم وضرائب",
    "cleaning": "تنظيف",
    "other": "أخرى",
}


class Expense(Base):
    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(primary_key=True)
    expense_number: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    property_id: Mapped[int | None] = mapped_column(ForeignKey("properties.id", ondelete="SET NULL"), nullable=True, index=True)
    category: Mapped[str] = mapped_column(String(32), default=ExpenseCategory.OTHER.value)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    expense_date: Mapped[DateTime] = mapped_column(DateTime(timezone=True))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_paid: Mapped[bool] = mapped_column(Boolean, default=True)
    paid_date: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    attachment_path: Mapped[str | None] = mapped_column(String(256), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CashMovementType(str, enum.Enum):
    OPENING_BALANCE = "opening_balance"
    RENT_RECEIPT = "rent_receipt"
    EXPENSE = "expense"
    ADJUSTMENT = "adjustment"
    OTHER = "other"


CASH_MOVEMENT_TYPE_LABELS = {
    "opening_balance": "رصيد افتتاحي",
    "rent_receipt": "قبض إيجار",
    "expense": "مصروف",
    "adjustment": "تسوية",
    "other": "حركة أخرى",
}


class CashMovement(Base):
    __tablename__ = "cash_movements"

    id: Mapped[int] = mapped_column(primary_key=True)
    movement_number: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    movement_type: Mapped[str] = mapped_column(String(32))
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 4))  # signed? we store signed amounts: receipts +, expenses -
    movement_date: Mapped[DateTime] = mapped_column(DateTime(timezone=True), index=True)
    property_id: Mapped[int | None] = mapped_column(ForeignKey("properties.id", ondelete="SET NULL"), nullable=True, index=True)
    tenant_id: Mapped[int | None] = mapped_column(ForeignKey("tenants.id", ondelete="SET NULL"), nullable=True, index=True)
    expense_id: Mapped[int | None] = mapped_column(ForeignKey("expenses.id", ondelete="SET NULL"), nullable=True)
    payment_id: Mapped[int | None] = mapped_column(ForeignKey("payments.id", ondelete="SET NULL"), nullable=True)
    category: Mapped[str | None] = mapped_column(String(64), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    method: Mapped[str | None] = mapped_column(String(16), nullable=True)
    receipt_ref: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# Fix typo in label
EXPENSE_CATEGORY_LABELS["water_electric"] = "فواتير المياه والكهرباء"
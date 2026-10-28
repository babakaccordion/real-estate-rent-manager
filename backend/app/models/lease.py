import enum
from sqlalchemy import String, Integer, Text, DateTime, ForeignKey, func, Numeric, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base
from decimal import Decimal


class LeaseFrequency(str, enum.Enum):
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"
    CUSTOM = "custom"


class LeaseStatus(str, enum.Enum):
    ACTIVE = "active"
    ENDED = "ended"
    CANCELLED = "cancelled"


LEASE_STATUS_LABELS = {
    "active": "نشط",
    "ended": "منتهٍ",
    "cancelled": "ملغى",
}

LEASE_FREQ_LABELS = {
    "monthly": "شهري",
    "quarterly": "ربع سنوي",
    "yearly": "سنوي",
    "custom": "مخصص",
}


class Lease(Base):
    __tablename__ = "leases"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("properties.id", ondelete="CASCADE"), index=True)
    unit_id: Mapped[int | None] = mapped_column(ForeignKey("units.id", ondelete="SET NULL"), nullable=True, index=True)
    agreed_rent: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    start_date: Mapped[DateTime] = mapped_column(DateTime(timezone=True))
    end_date: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    due_day: Mapped[int] = mapped_column(Integer, default=1)  # day of month
    frequency: Mapped[str] = mapped_column(String(16), default=LeaseFrequency.MONTHLY.value)
    status: Mapped[str] = mapped_column(String(16), default=LeaseStatus.ACTIVE.value)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="leases")
    property: Mapped["Property"] = relationship("Property", back_populates="leases")
    charges: Mapped[list["Charge"]] = relationship("Charge", back_populates="lease", cascade="all, delete-orphan")
import enum
from sqlalchemy import String, Integer, Text, DateTime, ForeignKey, func, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base
from decimal import Decimal


class TenantStatus(str, enum.Enum):
    ACTIVE = "active"
    FORMER = "former"
    INACTIVE = "inactive"


TENANT_STATUS_LABELS = {
    "active": "نشط",
    "former": "سابق",
    "inactive": "غير نشط",
}


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_number: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(128), index=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    phone2: Mapped[str | None] = mapped_column(String(32), nullable=True)
    id_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default=TenantStatus.ACTIVE.value)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    credit_balance: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=0)  # رصيد دائن (دفعة مقدمة)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    leases: Mapped[list["Lease"]] = relationship("Lease", back_populates="tenant")
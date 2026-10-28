import enum
from sqlalchemy import String, Integer, Text, DateTime, ForeignKey, func, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base
from decimal import Decimal


class PropertyType(str, enum.Enum):
    APARTMENT = "apartment"
    BUILDING = "building"
    HOUSE = "house"
    SHOP = "shop"
    OFFICE = "office"
    WAREHOUSE = "warehouse"
    LAND = "land"
    OTHER = "other"


class PropertyStatus(str, enum.Enum):
    RENTED = "rented"
    PARTIAL = "partial"
    VACANT = "vacant"
    INACTIVE = "inactive"


PROPERTY_TYPE_LABELS = {
    "apartment": "شقة",
    "building": "عمارة",
    "house": "منزل",
    "shop": "محل تجاري",
    "office": "مكتب",
    "warehouse": "مستودع",
    "land": "أرض",
    "other": "أخرى",
}

PROPERTY_STATUS_LABELS = {
    "rented": "مؤجر",
    "partial": "مؤجر جزئيًا",
    "vacant": "شاغر",
    "inactive": "غير نشط",
}


class Property(Base):
    __tablename__ = "properties"

    id: Mapped[int] = mapped_column(primary_key=True)
    property_number: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(128))
    property_type: Mapped[str] = mapped_column(String(32), default=PropertyType.OTHER.value)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    city: Mapped[str | None] = mapped_column(String(64), nullable=True)
    district: Mapped[str | None] = mapped_column(String(64), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    units_count: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(32), default=PropertyStatus.VACANT.value)
    image_path: Mapped[str | None] = mapped_column(String(256), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    units: Mapped[list["Unit"]] = relationship("Unit", back_populates="property", cascade="all, delete-orphan")
    leases: Mapped[list["Lease"]] = relationship("Lease", back_populates="property")


class UnitType(str, enum.Enum):
    APARTMENT = "apartment"
    SHOP = "shop"
    OFFICE = "office"
    WAREHOUSE = "warehouse"
    ROOM = "room"
    OTHER = "other"


class Unit(Base):
    __tablename__ = "units"

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("properties.id", ondelete="CASCADE"), index=True)
    unit_number: Mapped[str] = mapped_column(String(64))
    unit_type: Mapped[str] = mapped_column(String(32), default=UnitType.OTHER.value)
    agreed_rent: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=0)
    status: Mapped[str] = mapped_column(String(32), default="vacant")  # occupied/vacant
    current_tenant_id: Mapped[int | None] = mapped_column(ForeignKey("tenants.id", ondelete="SET NULL"), nullable=True)
    lease_start: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    lease_end: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    property: Mapped["Property"] = relationship("Property", back_populates="units")
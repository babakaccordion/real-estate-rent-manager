from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .config import CORS_ORIGINS, UPLOADS_DIR, DATA_DIR
from .database import Base, engine
from .models import *  # noqa
from .routers import auth, properties, tenants, leases, charges, payments, expenses, cash, reports, search, settings, backup, audit
from .utils.security import hash_password
from sqlalchemy.orm import Session
from .database import SessionLocal
from .models import User, UserRole, AppSetting

app = FastAPI(title="العقارات والإيجارات", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

# seed admin
db = SessionLocal()
try:
    if not db.query(User).filter(User.username == "admin").first():
        db.add(User(username="admin", hashed_password=hash_password("REMOVED"), full_name="مدير النظام", role=UserRole.ADMIN.value))
        db.commit()
    # default settings
    defaults = {"currency": "JOD", "decimal_places": "3", "timezone": "Asia/Amman", "company_name": "العقارات والإيجارات"}
    for k, v in defaults.items():
        if not db.query(AppSetting).filter(AppSetting.key == k).first():
            db.add(AppSetting(key=k, value=v))
    db.commit()
finally:
    db.close()

app.include_router(auth.router)
app.include_router(properties.router)
app.include_router(tenants.router)
app.include_router(leases.router)
app.include_router(charges.router)
app.include_router(payments.router)
app.include_router(expenses.router)
app.include_router(cash.router)
app.include_router(reports.router)
app.include_router(search.router)
app.include_router(settings.router)
app.include_router(backup.router)
app.include_router(audit.router)

app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")
app.mount("/data", StaticFiles(directory=str(DATA_DIR)), name="data")


@app.get("/health")
def health():
    return {"status": "ok", "app": "العقارات والإيجارات"}
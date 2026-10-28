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

app.include_router(auth.router, prefix="/api")
app.include_router(properties.router, prefix="/api")
app.include_router(tenants.router, prefix="/api")
app.include_router(leases.router, prefix="/api")
app.include_router(charges.router, prefix="/api")
app.include_router(payments.router, prefix="/api")
app.include_router(expenses.router, prefix="/api")
app.include_router(cash.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
app.include_router(backup.router, prefix="/api")
app.include_router(audit.router, prefix="/api")

@app.get("/health")
def health():
    return {"status": "ok", "app": "العقارات والإيجارات"}


app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

from pathlib import Path as _P
from fastapi.responses import FileResponse, JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

_static = _P(__file__).resolve().parent.parent / "static"
if _static.exists():
    app.mount("/", StaticFiles(directory=str(_static), html=True), name="static")


@app.exception_handler(StarletteHTTPException)
async def spa_fallback(request, exc):
    """Let the React router handle deep links (e.g. refreshing on /properties)."""
    path = request.url.path
    index = _static / "index.html"
    if (
        exc.status_code == 404
        and request.method in ("GET", "HEAD")
        and index.exists()
        and not path.startswith(("/api", "/health", "/uploads"))
    ):
        return FileResponse(index)
    return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from ..database import get_db
from ..deps import require_role
from ..services.backup import export_all, restore_from_file
from fastapi.responses import FileResponse
import shutil, os
from ..config import BACKUPS_DIR

router = APIRouter(prefix="/backup", tags=["backup"])


@router.post("/export")
def do_export(db: Session = Depends(get_db), user=Depends(require_role("admin"))):
    path = export_all(db)
    return {"path": path, "filename": os.path.basename(path)}


@router.get("/download/{filename}")
def download(filename: str):
    path = BACKUPS_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="الملف غير موجود")
    return FileResponse(str(path), filename=filename, media_type="application/json")


@router.post("/restore")
def do_restore(file: UploadFile = File(...), db: Session = Depends(get_db), user=Depends(require_role("admin"))):
    tmp = BACKUPS_DIR / f"restore_{file.filename}"
    with open(tmp, "wb") as f:
        shutil.copyfileobj(file.file, f)
    try:
        res = restore_from_file(db, str(tmp))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"فشل الاستعادة: {e}")
    return res


@router.get("/list")
def list_backups(user=Depends(require_role("admin"))):
    files = sorted(BACKUPS_DIR.glob("backup_*.json"), reverse=True)
    return [{"name": f.name, "size": f.stat().st_size} for f in files]
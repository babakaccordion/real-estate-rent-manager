# العقارات والإيجارات — Real Estate & Rent Manager

تطبيق متكامل لإدارة العقارات المؤجرة والإيجارات، باللغة العربية ودعم كامل لاتجاه RTL.

## التقنية المستخدمة

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + Radix UI + Recharts
- **Backend**: FastAPI + SQLAlchemy + SQLite (محلي) / PostgreSQL (متعدد المستخدمين)
- **التقارير**: ReportLab (PDF عربي) + openpyxl (Excel)
- **الاختبارات**: pytest

## تشغيل Backend

```powershell
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

المستخدم الافتراضي: `admin` / `REMOVED`

## تشغيل Frontend

```powershell
cd frontend
npm install
npm run dev
```

افتح http://localhost:5173

## بناء Frontend للإنتاج

```powershell
cd frontend
npm run build
```

## مكان تخزين البيانات

- قاعدة البيانات: `backend/data/app.db` (SQLite)
- النسخ الاحتياطية: `backend/data/backups/`
- التصدير: `backend/data/exports/`
- المرفقات: `backend/data/uploads/`

## النسخ الاحتياطي والاستعادة

- من الواجهة: الإعدادات → النسخ الاحتياطي → إنشاء نسخة احتياطية
- API: `POST /backup/export` ثم `GET /backup/download/{filename}`
- الاستعادة: `POST /backup/restore` (رفع ملف JSON)

## الاختبارات

```powershell
cd backend
python -m pytest tests/ -v
```

## متغيرات البيئة

انسخ `backend/.env.example` إلى `backend/.env` وعدل القيم.

## وضع متعدد المستخدمين (إنترنت)

- اضبط `DATABASE_URL` إلى PostgreSQL.
- اضبط `SECRET_KEY` و `CORS_ORIGINS`.
- شغّل Backend على خادم، و Frontend (build) behind reverse proxy.
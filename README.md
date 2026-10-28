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

## التثبيت على ويندوز (نسخة جاهزة)

- البرنامج مثبّت على هذا الجهاز في:
  `C:\Users\DELL\AppData\Local\Programs\RealEstateRentManager`
- اختصارات جاهزة على **سطح المكتب** وفي **قائمة ابدأ** باسم «العقارات والإيجارات».
- التشغيل يفتح المتصفح تلقائياً على http://127.0.0.1:8000
- البيانات تُحفظ بجانب البرنامج في مجلد `data` (قاعدة البيانات `data/app.db`، النسخ الاحتياطية، المرفقات).

## الدخول من الهاتف (نسخة الموبايل)

الواجهة متجاوبة بالكامل وتعمل كتطبيق PWA. للدخول من الهاتف:

1. وصّل الهاتف بنفس شبكة الواي فاي الخاصة بالكمبيوتر.
2. شغّل البرنامج على الكمبيوتر (يجب أن يبقى مفتوحاً).
3. افتح على الهاتف الرابط المكتوب في ملف `mobile-access.txt` بجانب ملف التشغيل، مثل:
   `http://192.168.1.78:8000`
4. من قائمة المتصفح اختر **إضافة إلى الشاشة الرئيسية**.

> ملاحظة أمنية: البرنامج يستمع على الشبكة المحلية (`0.0.0.0`). غيّر كلمة مرور `admin` الافتراضية من الإعدادات، ولا تفتح المنفذ 8000 على الإنترنت مباشرة بدون HTTPS.

## المستودع

https://github.com/babakaccordion/real-estate-rent-manager

## تحميل نسخة ويندوز

نسخة ويندوز غير منشورة على GitHub (بناء محلي فقط).

## النشر على الإنترنت (الوصول من الآيفون والكمبيوتر مغلق)

انظر `DEPLOY.md` — فيه خطوات Render + Neon مجاناً، أو VPS عبر `docker compose`.

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
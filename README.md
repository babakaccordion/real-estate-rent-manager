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

## بناء نسخة الموبايل المستقلة (بدون خادم)

```powershell
cd frontend
npm run build:local     # يبني نسخة تعمل بالكامل في المتصفح (VITE_LOCAL_MODE=1)
npm run preview:local   # لتجربتها محلياً على http://localhost:4173/real-estate-rent-manager/
```

- البناء يُنشر تلقائياً على GitHub Pages عند الدفع إلى `main` (`.github/workflows/pages.yml`).
- كل الطلبات تُعالَج داخل المتصفح عبر `frontend/src/local/`، والبيانات في `localStorage`
  تحت المفتاح `rr-local-db-v1`.
- نسخة الكمبيوتر تُبنى بـ `npm run build` (بدون Service Worker) وتُنسخ إلى `backend/static`.

## التثبيت على ويندوز (نسخة جاهزة)

- البرنامج مثبّت على هذا الجهاز في:
  `C:\Users\DELL\AppData\Local\Programs\RealEstateRentManager`
- اختصارات جاهزة على **سطح المكتب** وفي **قائمة ابدأ** باسم «العقارات والإيجارات».
- التشغيل يفتح المتصفح تلقائياً على http://127.0.0.1:8000
- البيانات تُحفظ بجانب البرنامج في مجلد `data` (قاعدة البيانات `data/app.db`، النسخ الاحتياطية، المرفقات).

## نسخة الموبايل المستقلة (GitHub Pages) — تعمل والكمبيوتر مغلق

هذه هي الطريقة الموصى بها لاستخدام البرنامج من الآيفون: نسخة ويب مستقلة منشورة على GitHub Pages،
تعمل داخل المتصفح وتخزّن البيانات على الجهاز نفسه (localStorage) بدون خادم وبدون أي حساب إضافي.

**الرابط:** https://babakaccordion.github.io/real-estate-rent-manager/

### التثبيت على الآيفون

1. افتح الرابط أعلاه في **Safari**.
2. اضغط زر المشاركة (المربع مع السهم) → **إضافة إلى الشاشة الرئيسية**.
3. افتح التطبيق من الشاشة الرئيسية، وسجّل الدخول: `admin` / `REMOVED`.
4. بعد أول فتح يُحفظ التطبيق على الجهاز ويعمل حتى بدون إنترنت.

### الفرق بين النسختين

| | نسخة الكمبيوتر | نسخة الموبايل (GitHub Pages) |
|---|---|---|
| مكان البيانات | قاعدة بيانات على الكمبيوتر | داخل متصفح الآيفون فقط |
| يحتاج الكمبيوتر | نعم | لا |
| يحتاج إنترنت | لا (شبكة محلية) | فقط عند أول فتح/تحديث |
| مشاركة البيانات | نفس الشبكة المحلية | يدوياً عبر ملف نسخة احتياطية |

> **مهم:** بيانات نسخة الموبايل منفصلة عن نسخة الكمبيوتر. لنقل البيانات بينهما استخدم
> الإعدادات → **تنزيل نسخة احتياطية (JSON)** في إحدى النسختين، ثم **استعادة** نفس الملف في النسخة الأخرى
> (الصيغة متوافقة في الاتجاهين).
>
> إذا حذفت بيانات الموقع من إعدادات Safari أو غيّرت الجهاز فستفقد البيانات، لذلك نزّل نسخة احتياطية بانتظام.

### الدخول من الهاتف عبر شبكة الواي فاي (نسخة الكمبيوتر)

بديل يعمل على بيانات الكمبيوتر نفسها: شغّل البرنامج على الكمبيوتر، وصّل الهاتف بنفس شبكة الواي فاي،
ثم افتح الرابط المكتوب في ملف `mobile-access.txt` بجانب ملف التشغيل، مثل `http://192.168.1.78:8000`.

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
# صورة تشغيل البرنامج على أي استضافة (Render / Fly.io / Railway / VPS)
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DATA_DIR=/app/data

WORKDIR /app

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY backend/static ./static

RUN mkdir -p /app/data
EXPOSE 8000

# --proxy-headers ضروري خلف HTTPS الخاص بالاستضافة
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips=*"]

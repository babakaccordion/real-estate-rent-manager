"""نقطة تشغيل برنامج «العقارات والإيجارات» على ويندوز.

- يعمل على 0.0.0.0 حتى يستطيع الهاتف على نفس شبكة الواي فاي فتح البرنامج.
- يفتح المتصفح تلقائياً على الجهاز.
- يكتب ملف mobile-access.txt يحتوي رابط الهاتف.
"""
import os
import socket
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

# When frozen, data lives next to the exe
if getattr(sys, "frozen", False):
    BASE = Path(sys.executable).resolve().parent
    os.environ.setdefault("DATA_DIR", str(BASE / "data"))
else:
    BASE = Path(__file__).resolve().parent
    os.environ.setdefault("DATA_DIR", str(BASE / "data"))

DATA_DIR = Path(os.environ["DATA_DIR"])
DATA_DIR.mkdir(parents=True, exist_ok=True)

import uvicorn
from app.main import app

HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "8000"))
LOCAL_URL = f"http://127.0.0.1:{PORT}"


def lan_ip() -> str:
    """Best effort local network IP (no packets are actually sent)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return "127.0.0.1"
    finally:
        s.close()


def server_alive() -> bool:
    try:
        with urllib.request.urlopen(f"{LOCAL_URL}/health", timeout=1) as r:
            return r.status == 200
    except Exception:
        return False


def write_mobile_info(ip: str) -> Path:
    path = BASE / "mobile-access.txt"
    url = f"http://{ip}:{PORT}"
    text = (
        "العقارات والإيجارات — الدخول من الهاتف\n"
        "=====================================\n\n"
        "1) وصّل الهاتف بنفس شبكة الواي فاي التي يستخدمها الكمبيوتر.\n"
        "2) افتح متصفح الهاتف (كروم أو سفاري) واكتب الرابط التالي:\n\n"
        f"   {url}\n\n"
        "3) من قائمة المتصفح اختر «إضافة إلى الشاشة الرئيسية» ليصبح كالتطبيق.\n\n"
        "ملاحظة: يجب أن يبقى البرنامج مفتوحاً على الكمبيوتر أثناء الاستخدام من الهاتف.\n"
        f"رابط الكمبيوتر: {LOCAL_URL}\n"
    )
    try:
        path.write_text(text, encoding="utf-8")
    except Exception:
        pass
    return path


def run_server():
    uvicorn.run(app, host=HOST, port=PORT, log_level="warning")


if __name__ == "__main__":
    if server_alive():
        webbrowser.open(LOCAL_URL)
        sys.exit(0)

    threading.Thread(target=run_server, daemon=True).start()

    ready = False
    for _ in range(60):
        if server_alive():
            ready = True
            break
        time.sleep(0.5)

    ip = lan_ip()
    write_mobile_info(ip)

    if ready:
        webbrowser.open(LOCAL_URL)
    else:
        print(f"تعذر تشغيل الخادم على المنفذ {PORT}. أغلق النسخة الأخرى ثم أعد المحاولة.")

    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        pass

import arabic_reshaper
from bidi.algorithm import get_display
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.units import cm
from pathlib import Path
import os

from ..config import DATA_DIR


def _ar(text) -> str:
    if text is None:
        return ""
    s = str(text)
    try:
        reshaped = arabic_reshaper.reshape(s)
        return get_display(reshaped)
    except Exception:
        return s


# Try to register an Arabic font
_FONT_NAME = "Helvetica"
_FONT_PATHS = [
    r"C:\Windows\Fonts\arial.ttf",
    r"C:\Windows\Fonts\tahoma.ttf",
    r"C:\Windows\Fonts\seguiemj.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
]
for p in _FONT_PATHS:
    if os.path.exists(p):
        try:
            pdfmetrics.registerFont(TTFont("ArabicFont", p))
            _FONT_NAME = "ArabicFont"
            break
        except Exception:
            continue


def _style(size=10, bold=False, align=2):
    # align 2 = right for RTL-ish
    return ParagraphStyle("ar", fontName=_FONT_NAME, fontSize=size, leading=size + 4,
                          alignment=align, wordWrap="CJK")


def build_pdf(title: str, subtitle: str, tables: list, filename: str) -> str:
    """tables: list of (headers list, rows list of lists). Returns file path."""
    out_dir = DATA_DIR / "exports"
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / filename
    doc = SimpleDocTemplate(str(path), pagesize=landscape(A4), rightMargin=1*cm, leftMargin=1*cm,
                            topMargin=1.5*cm, bottomMargin=1*cm)
    story = []
    story.append(Paragraph(_ar(title), _style(16, True, 1)))
    story.append(Spacer(1, 6))
    if subtitle:
        story.append(Paragraph(_ar(subtitle), _style(10, False, 1)))
        story.append(Spacer(1, 10))

    for headers, rows in tables:
        data = [[_ar(h) for h in headers]] + [[_ar(c) for c in r] for r in rows]
        t = Table(data, repeatRows=1)
        t.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, -1), _FONT_NAME),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a5f")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.whitesmoke, colors.lightgrey]),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(t)
        story.append(Spacer(1, 10))

    story.append(Spacer(1, 6))
    story.append(Paragraph(_ar("اسم البرنامج: العقارات والإيجارات"), _style(8, False, 1)))
    doc.build(story)
    return str(path)
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional
from ..database import get_db
from ..deps import require_user
from ..services import reports as R
from ..services.pdf import build_pdf
from ..services.excel import build_excel
import csv, json

router = APIRouter(prefix="/reports", tags=["reports"])


def _parse(d: str) -> date:
    return date.fromisoformat(d)


@router.get("/property/{pid}")
def property_report(pid: int, start: str, end: str, db: Session = Depends(get_db), user=Depends(require_user)):
    return R.property_report(db, pid, _parse(start), _parse(end))


@router.get("/overall")
def overall_report(start: str, end: str, property_id: Optional[int] = None, db: Session = Depends(get_db), user=Depends(require_user)):
    return R.overall_report(db, _parse(start), _parse(end), property_id)


@router.get("/tenant/{tid}")
def tenant_report(tid: int, start: str, end: str, db: Session = Depends(get_db), user=Depends(require_user)):
    return R.tenant_report(db, tid, _parse(start), _parse(end))


@router.get("/cash")
def cash_report(start: str, end: str, property_id: Optional[int] = None, db: Session = Depends(get_db), user=Depends(require_user)):
    return R.cash_report(db, _parse(start), _parse(end), property_id)


@router.get("/arrears")
def arrears_report(end: str, property_id: Optional[int] = None, db: Session = Depends(get_db), user=Depends(require_user)):
    return R.arrears_report(db, _parse(end), property_id)


@router.get("/expenses")
def expenses_report(start: str, end: str, property_id: Optional[int] = None, db: Session = Depends(get_db), user=Depends(require_user)):
    return R.expenses_report(db, _parse(start), _parse(end), property_id)


@router.get("/receipts")
def receipts_report(start: str, end: str, property_id: Optional[int] = None, db: Session = Depends(get_db), user=Depends(require_user)):
    return R.receipts_report(db, _parse(start), _parse(end), property_id)


@router.get("/dashboard")
def dashboard(start: str, end: str, db: Session = Depends(get_db), user=Depends(require_user)):
    from ..models import Property
    props = db.query(Property).all()
    overall = R.overall_report(db, _parse(start), _parse(end))
    totals = overall["totals"]
    # upcoming due dates
    from ..services.charges import refresh_charge_statuses
    # arrears count tenants
    arrears = R.arrears_report(db, _parse(end))
    unique_tenants = len({a["tenant_id"] for a in arrears})
    # next due charges
    from ..models import Charge
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    upcoming = db.query(Charge).filter(Charge.due_date >= now, Charge.status.in_(["due", "partial"])).order_by(Charge.due_date).limit(5).all()
    upcoming_list = [{"id": c.id, "period": c.period, "due_date": c.due_date.isoformat(), "amount_due": float(c.amount_due),
                      "amount_paid": float(c.amount_paid), "tenant_id": c.tenant_id, "property_id": c.property_id} for c in upcoming]
    return {
        "totals": {
            "properties_count": len(props),
            "rented_properties": sum(1 for p in props if p.status in ("rented", "partial")),
            "vacant_units": sum(1 for p in props if p.status == "vacant"),
            "total_due": str(totals["total_due"]),
            "total_collected": str(totals["total_collected"]),
            "total_remaining": str(totals["total_remaining"]),
            "total_expenses": str(totals["expenses_paid"]),
            "net_cash_flow": str(totals["net_cash_flow"]),
            "opening_balance": str(totals["opening_balance"]),
            "closing_balance": str(totals["closing_balance"]),
            "arrears_tenants": unique_tenants,
        },
        "upcoming": upcoming_list,
        "arrears": arrears[:10],
    }


# Export endpoints
@router.get("/export/pdf")
def export_pdf(kind: str, start: str, end: str, property_id: Optional[int] = None,
               db: Session = Depends(get_db), user=Depends(require_user)):
    s = _parse(start); e = _parse(end)
    if kind == "overall":
        data = R.overall_report(db, s, e, property_id)
        rows = []
        for p in data["properties"]:
            rows.append([
                p["property"]["name"], p["units_count"], p["tenants_count"],
                p["total_due"], p["total_collected"], p["total_remaining"],
                p["expenses_paid"], p["net_cash_flow"],
            ])
        t = data["totals"]
        rows.append(["الإجمالي", t["units_count"], t["tenants_count"], t["total_due"],
                     t["total_collected"], t["total_remaining"], t["expenses_paid"], t["net_cash_flow"]])
        headers = ["العقار", "الوحدات", "المستأجرون", "المستحق", "المحصل", "المتبقي", "المصاريف", "صافي التدفق"]
        path = build_pdf("التقرير الشامل لجميع العقارات", f"من {start} إلى {end}", [(headers, rows)],
                         f"report_overall_{start}_{end}.pdf")
    elif kind == "property" and property_id:
        data = R.property_report(db, property_id, s, e)
        rows = [[c["period"], c["due_date"][:10], c["amount_due"], c["amount_paid"], c["status"]] for c in data["charges"]]
        headers = ["الفترة", "تاريخ الاستحقاق", "المستحق", "المدفوع", "الحالة"]
        exp_rows = [[x["expense_date"][:10], x["category"], x["amount"], "مدفوع" if x["is_paid"] else "غير مدفوع", x["description"]] for x in data["expenses"]]
        tables = [(headers, rows), (["التاريخ", "التصنيف", "المبلغ", "الحالة", "الوصف"], exp_rows)]
        summary = [["الإجمالي المستحق", str(data["total_due"])], ["المحصل", str(data["total_collected"])],
                   ["المتبقي", str(data["total_remaining"])], ["المصاريف المدفوعة", str(data["expenses_paid"])],
                   ["صافي التدفق", str(data["net_cash_flow"])], ["الرصيد الافتتاحي", str(data["opening_balance"])],
                   ["الرصيد الختامي", str(data["closing_balance"])]]
        tables.append((["البيان", "القيمة"], summary))
        path = build_pdf(f"تقرير العقار: {data['property']['name']}", f"من {start} إلى {end}", tables,
                         f"report_property_{property_id}_{start}_{end}.pdf")
    elif kind == "cash":
        data = R.cash_report(db, s, e, property_id)
        rows = [[m["movement_date"][:10], m["movement_type"], m["amount"], m["category"], m["description"]] for m in data["movements"]]
        headers = ["التاريخ", "النوع", "المبلغ", "التصنيف", "الوصف"]
        summary = [["الرصيد الافتتاحي", str(data["opening_balance"])], ["المقبوضات", str(data["receipts"])],
                   ["المصاريف المدفوعة", str(data["expenses_paid"])], ["التسويات", str(data["adjustments"])],
                   ["الرصيد الختامي", str(data["closing_balance"])]]
        tables = [(headers, rows), (["البيان", "القيمة"], summary)]
        path = build_pdf("تقرير حركة الصندوق", f"من {start} إلى {end}", tables, f"report_cash_{start}_{end}.pdf")
    elif kind == "arrears":
        data = R.arrears_report(db, e, property_id)
        rows = [[d["tenant_name"], d["property_name"], d["period"], d["due_date"][:10], d["remaining"], d["days_overdue"]] for d in data]
        headers = ["المستأجر", "العقار", "الفترة", "تاريخ الاستحقاق", "المتبقي", "أيام التأخير"]
        path = build_pdf("تقرير المتأخرات", f"حتى {end}", [(headers, rows)], f"report_arrears_{end}.pdf")
    else:
        raise HTTPException(status_code=400, detail="نوع تقرير غير مدعوم")
    return FileResponse(path, filename=path.split("\\")[-1].split("/")[-1], media_type="application/pdf")


@router.get("/export/excel")
def export_excel(kind: str, start: str, end: str, property_id: Optional[int] = None,
                 db: Session = Depends(get_db), user=Depends(require_user)):
    s = _parse(start); e = _parse(end)
    if kind == "overall":
        data = R.overall_report(db, s, e, property_id)
        rows = []
        for p in data["properties"]:
            rows.append([p["property"]["name"], p["units_count"], p["tenants_count"], float(p["total_due"]),
                         float(p["total_collected"]), float(p["total_remaining"]), float(p["expenses_paid"]),
                         float(p["net_cash_flow"])])
        t = data["totals"]
        rows.append(["الإجمالي", t["units_count"], t["tenants_count"], float(t["total_due"]), float(t["total_collected"]),
                     float(t["total_remaining"]), float(t["expenses_paid"]), float(t["net_cash_flow"])])
        headers = ["العقار", "الوحدات", "المستأجرون", "المستحق", "المحصل", "المتبقي", "المصاريف", "صافي التدفق"]
        path = build_excel("التقرير الشامل", [("العقارات", headers, rows)], f"report_overall_{start}_{end}.xlsx")
    elif kind == "property" and property_id:
        data = R.property_report(db, property_id, s, e)
        rows = [[c["period"], c["due_date"][:10], float(c["amount_due"]), float(c["amount_paid"]), c["status"]] for c in data["charges"]]
        headers = ["الفترة", "تاريخ الاستحقاق", "المستحق", "المدفوع", "الحالة"]
        exp_rows = [[x["expense_date"][:10], x["category"], float(x["amount"]), "مدفوع" if x["is_paid"] else "غير مدفوع", x["description"]] for x in data["expenses"]]
        sheets = [("الاستحقاقات", headers, rows), (["المصاريف"], ["التاريخ", "التصنيف", "المبلغ", "الحالة", "الوصف"], exp_rows)]
        # fix sheet tuple format
        sheets = [("الاستحقاقات", headers, rows), ("المصاريف", ["التاريخ", "التصنيف", "المبلغ", "الحالة", "الوصف"], exp_rows)]
        path = build_excel(f"تقرير العقار", sheets, f"report_property_{property_id}_{start}_{end}.xlsx")
    else:
        raise HTTPException(status_code=400, detail="نوع تقرير غير مدعوم")
    return FileResponse(path, filename=path.split("\\")[-1].split("/")[-1],
                        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


@router.get("/export/csv")
def export_csv(kind: str, start: str, end: str, property_id: Optional[int] = None,
               db: Session = Depends(get_db), user=Depends(require_user)):
    s = _parse(start); e = _parse(end)
    out_dir = __import__("pathlib").Path("data") / "exports"
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"report_{kind}_{start}_{end}.csv"
    if kind == "overall":
        data = R.overall_report(db, s, e, property_id)
        with open(path, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f)
            w.writerow(["العقار", "الوحدات", "المستأجرون", "المستحق", "المحصل", "المتبقي", "المصاريف", "صافي التدفق"])
            for p in data["properties"]:
                w.writerow([p["property"]["name"], p["units_count"], p["tenants_count"], p["total_due"],
                            p["total_collected"], p["total_remaining"], p["expenses_paid"], p["net_cash_flow"]])
            t = data["totals"]
            w.writerow(["الإجمالي", t["units_count"], t["tenants_count"], t["total_due"], t["total_collected"],
                        t["total_remaining"], t["expenses_paid"], t["net_cash_flow"]])
    else:
        raise HTTPException(status_code=400, detail="CSV متاح للتقرير الشامل")
    return FileResponse(str(path), filename=path.name, media_type="text/csv")
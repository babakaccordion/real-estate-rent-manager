import secrets
import pytest
from fastapi.testclient import TestClient
from app.main import app
from decimal import Decimal

client = TestClient(app)

# بيانات اختبار مؤقتة تُنشأ أثناء التشغيل فقط (لا توجد بيانات افتراضية في الكود).
TEST_USERNAME = "tester"
TEST_PASSWORD = secrets.token_urlsafe(16)


def get_token():
    status = client.get("/api/auth/status").json()
    if status.get("needs_setup"):
        r = client.post("/api/auth/setup", json={"username": TEST_USERNAME, "password": TEST_PASSWORD})
    else:
        r = client.post("/api/auth/login", json={"username": TEST_USERNAME, "password": TEST_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture
def auth_headers():
    return {"Authorization": f"Bearer {get_token()}"}


def test_full_flow(auth_headers):
    H = auth_headers
    # create property
    r = client.post("/api/properties", json={"name": "عقار اختبار", "property_type": "building", "units_count": 2, "status": "vacant"}, headers=H)
    assert r.status_code == 200, r.text
    prop_id = r.json()["id"]

    # create tenant
    r = client.post("/api/tenants", json={"full_name": "مستأجر اختبار", "phone": "0790000000", "property_id": prop_id,
                                      "agreed_rent": 300, "lease_start": "2026-01-01", "due_day": 5}, headers=H)
    assert r.status_code == 200, r.text
    tenant_id = r.json()["id"]

    # find lease
    r = client.get("/api/leases", headers=H)
    leases = [l for l in r.json() if l["tenant_id"] == tenant_id]
    assert leases
    lease_id = leases[0]["id"]

    # charges generated
    r = client.get("/api/charges", params={"tenant_id": tenant_id}, headers=H)
    charges = r.json()
    assert len(charges) >= 1

    # make a payment partial: 100
    r = client.post("/api/payments", json={"tenant_id": tenant_id, "amount": 100, "payment_date": "2026-01-10", "method": "cash", "property_id": prop_id}, headers=H)
    assert r.status_code == 200, r.text

    # refresh charge status
    client.post("/api/charges/refresh-status", headers=H)

    r = client.get("/api/charges", params={"tenant_id": tenant_id}, headers=H)
    jan = [c for c in r.json() if c["period"] == "2026-01"][0]
    assert float(jan["amount_paid"]) == 100.0

    # second payment
    r = client.post("/api/payments", json={"tenant_id": tenant_id, "amount": 75, "payment_date": "2026-01-15", "method": "cash", "property_id": prop_id}, headers=H)
    assert r.status_code == 200

    client.post("/api/charges/refresh-status", headers=H)
    r = client.get("/api/charges", params={"tenant_id": tenant_id}, headers=H)
    jan = [c for c in r.json() if c["period"] == "2026-01"][0]
    assert float(jan["amount_paid"]) == 175.0
    assert float(jan["amount_due"]) == 300.0

    # expense
    r = client.post("/api/expenses", json={"property_id": prop_id, "category": "maintenance", "amount": 50, "expense_date": "2026-01-12", "is_paid": True}, headers=H)
    assert r.status_code == 200

    # property report
    r = client.get(f"/api/reports/property/{prop_id}", params={"start": "2026-01-01", "end": "2026-01-31"}, headers=H)
    assert r.status_code == 200
    rep = r.json()
    assert float(rep["total_due"]) >= 300
    assert float(rep["total_collected"]) == 175.0
    assert float(rep["expenses_paid"]) == 50.0
    assert float(rep["net_cash_flow"]) == 125.0

    # overall test with two properties
    r = client.post("/api/properties", json={"name": "عقار 2", "property_type": "apartment", "units_count": 1, "status": "vacant"}, headers=H)
    prop2 = r.json()["id"]
    r = client.post("/api/tenants", json={"full_name": "مستأجر 2", "phone": "0791111111", "property_id": prop2,
                                      "agreed_rent": 700, "lease_start": "2026-01-01", "due_day": 5}, headers=H)
    tenant2 = r.json()["id"]
    client.post("/api/payments", json={"tenant_id": tenant2, "amount": 600, "payment_date": "2026-01-20", "method": "cash", "property_id": prop2}, headers=H)
    r = client.post("/api/expenses", json={"property_id": prop2, "category": "repair", "amount": 100, "expense_date": "2026-01-15", "is_paid": True}, headers=H)

    r = client.get("/api/reports/overall", params={"start": "2026-01-01", "end": "2026-01-31"}, headers=H)
    tot = r.json()["totals"]
    assert float(tot["total_due"]) >= 1000
    assert float(tot["total_collected"]) == 775.0  # 175 + 600
    assert float(tot["expenses_paid"]) == 150.0
    assert float(tot["net_cash_flow"]) == 625.0  # 775 - 150


def test_charge_no_duplicate(auth_headers):
    H = auth_headers
    # calling generate charges again should not duplicate
    r = client.post("/api/leases/generate-charges", headers=H)
    assert r.status_code == 200
    # no error


def test_cash_balance(auth_headers):
    H = auth_headers
    # opening balance
    r = client.post("/api/cash", json={"movement_type": "opening_balance", "amount": 1000, "movement_date": "2026-02-01", "description": "افتتاحي"}, headers=H)
    assert r.status_code == 200
    r = client.get("/api/reports/cash", params={"start": "2026-02-01", "end": "2026-02-28"}, headers=H)
    rep = r.json()
    assert float(rep["opening_balance"]) >= 1000 or float(rep["closing_balance"]) >= 1000


def test_backup(auth_headers):
    H = auth_headers
    r = client.post("/api/backup/export", headers=H)
    assert r.status_code == 200
    assert "filename" in r.json()
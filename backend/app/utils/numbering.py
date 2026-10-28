import uuid


def gen_property_number() -> str:
    return f"P-{uuid.uuid4().hex[:8].upper()}"


def gen_tenant_number() -> str:
    return f"T-{uuid.uuid4().hex[:8].upper()}"


def gen_receipt_number() -> str:
    return f"R-{uuid.uuid4().hex[:10].upper()}"


def gen_expense_number() -> str:
    return f"E-{uuid.uuid4().hex[:8].upper()}"


def gen_movement_number() -> str:
    return f"M-{uuid.uuid4().hex[:8].upper()}"
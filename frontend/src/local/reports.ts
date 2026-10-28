import type { Charge, LocalDB, Movement } from './types'
import { fromU, moneyStr } from './money'
import { DAY_MS, dateKey, endOfDay, startOfDay } from './engine'

/** مجموع المبالغ بوحدة 1/10000. */
const sumU = (vals: number[]): number => vals.reduce((s, v) => s + v, 0)

const num = (u: number): number => fromU(u)

/** نص مبلغ بالدينار (ليس بوحدات التخزين) بأربعة منازل كما في الخادم. */
const numStr = (v: number): string => (Number.isFinite(v) ? v : 0).toFixed(4)

const OPEN_CHARGE_STATES = ['due', 'partial', 'overdue']

function cashBalanceUpto(db: LocalDB, endMs: number, propertyId?: number | null): number {
  return sumU(
    db.movements
      .filter((m) => Date.parse(m.movement_date) <= endMs)
      .filter((m) => propertyId == null || m.property_id === propertyId)
      .map((m) => m.amount),
  )
}

function periodBounds(start: string, end: string): { startMs: number; endMs: number } {
  return { startMs: startOfDay(start), endMs: endOfDay(end) }
}

function inRange(iso: string, startMs: number, endMs: number): boolean {
  const t = Date.parse(iso)
  return t >= startMs && t <= endMs
}

/* ------------------------------------------------------------------ */
/* تقرير عقار                                                          */
/* ------------------------------------------------------------------ */

export function propertyReport(db: LocalDB, propertyId: number, start: string, end: string) {
  const prop = db.properties.find((p) => p.id === propertyId)
  if (!prop) throw new Error('العقار غير موجود')

  const { startMs, endMs } = periodBounds(start, end)
  const units = db.units.filter((u) => u.property_id === propertyId)
  const leases = db.leases.filter((l) => l.property_id === propertyId)
  const tenantIds = new Set(leases.map((l) => l.tenant_id))
  const tenants = db.tenants.filter((t) => tenantIds.has(t.id))

  const charges = db.charges.filter(
    (c) =>
      c.property_id === propertyId &&
      c.status !== 'cancelled' &&
      inRange(c.due_date, startMs, endMs),
  )
  const totalDue = sumU(charges.map((c) => c.amount_due))
  const totalRemainingRaw = sumU(charges.map((c) => c.amount_due - c.amount_paid))
  const totalRemaining = totalRemainingRaw < 0 ? 0 : totalRemainingRaw

  const payments = db.payments.filter(
    (p) => p.property_id === propertyId && inRange(p.payment_date, startMs, endMs),
  )
  const totalCollected = sumU(payments.map((p) => p.amount))

  const expenses = db.expenses.filter(
    (e) => e.property_id === propertyId && inRange(e.expense_date, startMs, endMs),
  )
  const expPaid = sumU(expenses.filter((e) => e.is_paid).map((e) => e.amount))
  const expUnpaid = sumU(expenses.filter((e) => !e.is_paid).map((e) => e.amount))

  const opening = cashBalanceUpto(db, startMs - 1, propertyId)
  const closing = cashBalanceUpto(db, endMs, propertyId)

  const overdueCharges = db.charges.filter(
    (c) =>
      c.property_id === propertyId &&
      Date.parse(c.due_date) <= endMs &&
      OPEN_CHARGE_STATES.includes(c.status),
  )
  const totalOverdue = sumU(overdueCharges.map((c) => c.amount_due - c.amount_paid))

  return {
    property: {
      id: prop.id,
      property_number: prop.property_number,
      name: prop.name,
      type: prop.property_type,
      address: prop.address,
      city: prop.city,
      district: prop.district,
      status: prop.status,
    },
    period: { start, end },
    units_count: units.length,
    tenants_count: tenants.length,
    active_leases: leases.filter((l) => l.status === 'active').length,
    total_due: num(totalDue),
    total_collected: num(totalCollected),
    total_remaining: num(totalRemaining),
    total_overdue: num(totalOverdue),
    expenses_paid: num(expPaid),
    expenses_unpaid: num(expUnpaid),
    net_cash_flow: num(totalCollected - expPaid),
    opening_balance: num(opening),
    closing_balance: num(closing),
    charges: charges.map((c) => ({
      id: c.id,
      period: c.period,
      due_date: c.due_date,
      amount_due: moneyStr(c.amount_due),
      amount_paid: moneyStr(c.amount_paid),
      status: c.status,
      tenant_id: c.tenant_id,
    })),
    payments: payments.map((p) => ({
      id: p.id,
      receipt_number: p.receipt_number,
      amount: moneyStr(p.amount),
      payment_date: p.payment_date,
      method: p.method,
      tenant_id: p.tenant_id,
    })),
    expenses: expenses.map((e) => ({
      id: e.id,
      expense_number: e.expense_number,
      category: e.category,
      amount: moneyStr(e.amount),
      expense_date: e.expense_date,
      is_paid: e.is_paid,
      description: e.description,
    })),
  }
}

/* ------------------------------------------------------------------ */
/* التقرير الشامل                                                      */
/* ------------------------------------------------------------------ */

export type PropertyReport = ReturnType<typeof propertyReport>

function totalsFromProperties(prs: PropertyReport[]) {
  const sum = (fn: (p: PropertyReport) => number) => prs.reduce((s, p) => s + fn(p), 0)
  return {
    properties_count: prs.length,
    units_count: sum((p) => p.units_count),
    tenants_count: sum((p) => p.tenants_count),
    total_due: sum((p) => p.total_due),
    total_collected: sum((p) => p.total_collected),
    total_remaining: sum((p) => p.total_remaining),
    total_overdue: sum((p) => p.total_overdue),
    expenses_paid: sum((p) => p.expenses_paid),
    expenses_unpaid: sum((p) => p.expenses_unpaid),
    net_cash_flow: sum((p) => p.net_cash_flow),
    opening_balance: sum((p) => p.opening_balance),
    closing_balance: sum((p) => p.closing_balance),
  }
}

export function overallReport(db: LocalDB, start: string, end: string, propertyId?: number | null) {
  if (propertyId != null) {
    const pr = propertyReport(db, propertyId, start, end)
    return { period: pr.period, properties: [pr], totals: totalsFromProperties([pr]) }
  }
  const props = [...db.properties].sort((a, b) => a.id - b.id)
  const propReports = props.map((p) => propertyReport(db, p.id, start, end))
  return {
    period: { start, end },
    properties: propReports,
    totals: totalsFromProperties(propReports),
  }
}

/* ------------------------------------------------------------------ */
/* تقرير مستأجر                                                        */
/* ------------------------------------------------------------------ */

export function tenantReport(db: LocalDB, tenantId: number, start: string, end: string) {
  const tenant = db.tenants.find((t) => t.id === tenantId)
  if (!tenant) throw new Error('المستأجر غير موجود')
  const { startMs, endMs } = periodBounds(start, end)

  const charges = db.charges.filter(
    (c) => c.tenant_id === tenantId && c.status !== 'cancelled' && inRange(c.due_date, startMs, endMs),
  )
  const payments = db.payments.filter(
    (p) => p.tenant_id === tenantId && inRange(p.payment_date, startMs, endMs),
  )
  const leases = db.leases.filter((l) => l.tenant_id === tenantId)

  const totalDue = sumU(charges.map((c) => c.amount_due))
  const totalPaid = sumU(charges.map((c) => c.amount_paid))
  const totalCollected = sumU(payments.map((p) => p.amount))
  const remaining = totalDue - totalPaid

  return {
    tenant: {
      id: tenant.id,
      tenant_number: tenant.tenant_number,
      full_name: tenant.full_name,
      phone: tenant.phone,
      status: tenant.status,
      credit_balance: moneyStr(tenant.credit_balance),
    },
    period: { start, end },
    leases: leases.map((l) => ({
      id: l.id,
      property_id: l.property_id,
      agreed_rent: moneyStr(l.agreed_rent),
      start_date: l.start_date,
      end_date: l.end_date,
      status: l.status,
    })),
    charges: charges.map((c) => ({
      id: c.id,
      period: c.period,
      due_date: c.due_date,
      amount_due: moneyStr(c.amount_due),
      amount_paid: moneyStr(c.amount_paid),
      status: c.status,
    })),
    payments: payments.map((p) => ({
      id: p.id,
      receipt_number: p.receipt_number,
      amount: moneyStr(p.amount),
      payment_date: p.payment_date,
      method: p.method,
    })),
    total_due: num(totalDue),
    total_collected: num(totalCollected),
    remaining: num(remaining < 0 ? 0 : remaining),
  }
}

/* ------------------------------------------------------------------ */
/* تقرير الصندوق                                                       */
/* ------------------------------------------------------------------ */

function movementOut(m: Movement) {
  return {
    id: m.id,
    movement_number: m.movement_number,
    movement_type: m.movement_type,
    amount: moneyStr(m.amount),
    movement_date: m.movement_date,
    property_id: m.property_id,
    tenant_id: m.tenant_id,
    category: m.category,
    description: m.description,
    method: m.method,
    receipt_ref: m.receipt_ref,
  }
}

export function cashReport(db: LocalDB, start: string, end: string, propertyId?: number | null) {
  const { startMs, endMs } = periodBounds(start, end)
  const opening = cashBalanceUpto(db, startMs - 1, propertyId)
  const closing = cashBalanceUpto(db, endMs, propertyId)
  const movements = db.movements
    .filter((m) => inRange(m.movement_date, startMs, endMs))
    .filter((m) => propertyId == null || m.property_id === propertyId)
    .sort((a, b) => Date.parse(a.movement_date) - Date.parse(b.movement_date) || a.id - b.id)

  const receipts = sumU(movements.filter((m) => m.movement_type === 'rent_receipt').map((m) => m.amount))
  const expenses = sumU(movements.filter((m) => m.movement_type === 'expense').map((m) => -m.amount))
  const adjustments = sumU(
    movements
      .filter((m) => ['adjustment', 'other', 'opening_balance'].includes(m.movement_type))
      .map((m) => m.amount),
  )

  return {
    period: { start, end },
    property_id: propertyId ?? null,
    opening_balance: num(opening),
    receipts: num(receipts),
    expenses_paid: num(expenses),
    adjustments: num(adjustments),
    closing_balance: num(closing),
    movements: movements.map(movementOut),
  }
}

/* ------------------------------------------------------------------ */
/* المتأخرات                                                           */
/* ------------------------------------------------------------------ */

export function arrearsReport(db: LocalDB, end: string, propertyId?: number | null) {
  const endMs = endOfDay(end)
  const charges = db.charges
    .filter((c) => Date.parse(c.due_date) <= endMs && OPEN_CHARGE_STATES.includes(c.status))
    .filter((c) => propertyId == null || c.property_id === propertyId)
    .sort((a, b) => Date.parse(a.due_date) - Date.parse(b.due_date) || a.id - b.id)

  const tenants = new Map(db.tenants.map((t) => [t.id, t]))
  const props = new Map(db.properties.map((p) => [p.id, p]))
  const endDay = startOfDay(end)
  const rows: Array<Record<string, unknown>> = []

  for (const c of charges) {
    const rem = c.amount_due - c.amount_paid
    if (rem <= 0) continue
    let days = Math.floor((endDay - startOfDay(dateKey(c.due_date))) / DAY_MS)
    if (days < 0) days = 0
    rows.push({
      charge_id: c.id,
      period: c.period,
      due_date: c.due_date,
      amount_due: moneyStr(c.amount_due),
      amount_paid: moneyStr(c.amount_paid),
      remaining: moneyStr(rem),
      days_overdue: days,
      tenant_id: c.tenant_id,
      tenant_name: tenants.get(c.tenant_id)?.full_name ?? '',
      property_id: c.property_id,
      property_name: props.get(c.property_id)?.name ?? '',
    })
  }
  return rows
}

/* ------------------------------------------------------------------ */
/* المصاريف والمقبوضات                                                 */
/* ------------------------------------------------------------------ */

export function expensesReport(db: LocalDB, start: string, end: string, propertyId?: number | null) {
  const { startMs, endMs } = periodBounds(start, end)
  return db.expenses
    .filter((e) => inRange(e.expense_date, startMs, endMs))
    .filter((e) => propertyId == null || e.property_id === propertyId)
    .sort((a, b) => Date.parse(a.expense_date) - Date.parse(b.expense_date) || a.id - b.id)
    .map((e) => ({
      id: e.id,
      expense_number: e.expense_number,
      property_id: e.property_id,
      category: e.category,
      amount: moneyStr(e.amount),
      expense_date: e.expense_date,
      is_paid: e.is_paid,
      description: e.description,
    }))
}

export function receiptsReport(db: LocalDB, start: string, end: string, propertyId?: number | null) {
  const { startMs, endMs } = periodBounds(start, end)
  const tenants = new Map(db.tenants.map((t) => [t.id, t]))
  const props = new Map(db.properties.map((p) => [p.id, p]))
  return db.payments
    .filter((p) => inRange(p.payment_date, startMs, endMs))
    .filter((p) => propertyId == null || p.property_id === propertyId)
    .sort((a, b) => Date.parse(a.payment_date) - Date.parse(b.payment_date) || a.id - b.id)
    .map((p) => ({
      id: p.id,
      receipt_number: p.receipt_number,
      amount: moneyStr(p.amount),
      payment_date: p.payment_date,
      method: p.method,
      tenant_id: p.tenant_id,
      tenant_name: p.tenant_id != null ? tenants.get(p.tenant_id)?.full_name ?? '' : '',
      property_id: p.property_id,
      property_name: p.property_id != null ? props.get(p.property_id)?.name ?? '' : '',
    }))
}

/* ------------------------------------------------------------------ */
/* لوحة التحكم                                                         */
/* ------------------------------------------------------------------ */

export function dashboardReport(db: LocalDB, start: string, end: string) {
  const props = db.properties
  const overall = overallReport(db, start, end)
  const totals = overall.totals
  const arrears = arrearsReport(db, end)
  const uniqueTenants = new Set(arrears.map((a) => a.tenant_id)).size

  const now = Date.now()
  const upcoming = db.charges
    .filter((c: Charge) => Date.parse(c.due_date) >= now && ['due', 'partial'].includes(c.status))
    .sort((a, b) => Date.parse(a.due_date) - Date.parse(b.due_date) || a.id - b.id)
    .slice(0, 5)
    .map((c) => ({
      id: c.id,
      period: c.period,
      due_date: c.due_date,
      amount_due: fromU(c.amount_due),
      amount_paid: fromU(c.amount_paid),
      tenant_id: c.tenant_id,
      property_id: c.property_id,
    }))

  return {
    totals: {
      properties_count: props.length,
      rented_properties: props.filter((p) => ['rented', 'partial'].includes(p.status)).length,
      vacant_units: props.filter((p) => p.status === 'vacant').length,
      total_due: numStr(totals.total_due),
      total_collected: numStr(totals.total_collected),
      total_remaining: numStr(totals.total_remaining),
      total_expenses: numStr(totals.expenses_paid),
      net_cash_flow: numStr(totals.net_cash_flow),
      opening_balance: numStr(totals.opening_balance),
      closing_balance: numStr(totals.closing_balance),
      arrears_tenants: uniqueTenants,
    },
    upcoming,
    arrears: arrears.slice(0, 10),
  }
}

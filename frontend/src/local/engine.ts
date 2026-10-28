import type { AuditEntry, Charge, Lease, LocalDB, Movement, Payment, Tenant } from './types'
import { nextId } from './db'
import { badRequest, notFound } from './errors'

export const DAY_MS = 86_400_000

/* ------------------------------------------------------------------ */
/* تواريخ                                                              */
/* ------------------------------------------------------------------ */

export function nowIso(): string {
  return new Date().toISOString()
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** يحوّل أي تاريخ/نص إلى ISO بتوقيت UTC. */
export function toIso(value: unknown, fallback: string = nowIso()): string {
  if (value === null || value === undefined || value === '') return fallback
  if (typeof value === 'number') {
    const t = new Date(value)
    return Number.isNaN(t.getTime()) ? fallback : t.toISOString()
  }
  const s = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00:00.000Z`
  // تواريخ الخادم تُخزَّن بتوقيت UTC بدون لاحقة منطقة زمنية (مثل 2026-10-01T00:00:00).
  // بدون إضافة Z سيُعاملها المتصفح كتوقيت محلي فتنزاح يومًا كاملًا في المناطق الموجبة.
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s)) {
    const t = new Date(`${s.replace(' ', 'T')}Z`)
    return Number.isNaN(t.getTime()) ? fallback : t.toISOString()
  }
  const t = Date.parse(s)
  return Number.isNaN(t) ? fallback : new Date(t).toISOString()
}

export function toIsoOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  return toIso(value)
}

/** جزء التاريخ YYYY-MM-DD (بتوقيت UTC كما في قاعدة البيانات). */
export function dateKey(value: string | null | undefined): string {
  if (!value) return ''
  return String(value).slice(0, 10)
}

export function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function startOfDay(key: string): number {
  return Date.parse(`${key}T00:00:00.000Z`)
}

export function endOfDay(key: string): number {
  return Date.parse(`${key}T23:59:59.999Z`)
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function addMonths(year: number, month: number): [number, number] {
  const m = month + 1
  return m > 12 ? [year + 1, 1] : [year, m]
}

export function isoYearsAgo(years: number, from = new Date()): string {
  const d = new Date(from)
  d.setUTCFullYear(d.getUTCFullYear() - years)
  return d.toISOString()
}

/* ------------------------------------------------------------------ */
/* أرقام مرجعية                                                        */
/* ------------------------------------------------------------------ */

function randHex(len: number): string {
  let out = ''
  const cryptoObj = typeof crypto !== 'undefined' ? crypto : undefined
  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(Math.ceil(len / 2))
    cryptoObj.getRandomValues(bytes)
    out = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  } else {
    for (let i = 0; i < len; i++) out += Math.floor(Math.random() * 16).toString(16)
  }
  return out.slice(0, len).toUpperCase()
}

export const genPropertyNumber = () => `P-${randHex(8)}`
export const genTenantNumber = () => `T-${randHex(8)}`
export const genReceiptNumber = () => `R-${randHex(10)}`
export const genExpenseNumber = () => `E-${randHex(8)}`
export const genMovementNumber = () => `M-${randHex(8)}`

/* ------------------------------------------------------------------ */
/* حالة الاستحقاق                                                      */
/* ------------------------------------------------------------------ */

export function chargeStatus(dueU: number, paidU: number, dueDate: string, now: number = Date.now()): string {
  if (dueU <= 0) return 'paid'
  if (paidU >= dueU) return 'paid'
  const due = Date.parse(dueDate)
  if (paidU > 0) return due < now ? 'overdue' : 'partial'
  return due < now ? 'overdue' : 'due'
}

/* ------------------------------------------------------------------ */
/* الاستحقاقات الشهرية                                                 */
/* ------------------------------------------------------------------ */

export function generateChargesForLease(db: LocalDB, lease: Lease, upToKey?: string): number {
  if (lease.status !== 'active') return 0
  const upTo = upToKey || todayKey()
  const endKey = lease.end_date ? dateKey(lease.end_date) : null
  const limit = endKey && endKey < upTo ? endKey : upTo
  const startKey = dateKey(lease.start_date)
  if (!startKey || !limit || startKey > limit) return 0

  let year = Number(startKey.slice(0, 4))
  let month = Number(startKey.slice(5, 7))
  const dueDay = Number(lease.due_day) || 1
  let created = 0

  for (let i = 0; i < 240; i++) {
    const curFirst = `${year}-${pad2(month)}-01`
    if (curFirst > limit) break
    const day = Math.min(dueDay, daysInMonth(year, month))
    const dueKey = `${year}-${pad2(month)}-${pad2(day)}`
    if (dueKey >= startKey && dueKey <= limit) {
      const period = `${year}-${pad2(month)}`
      const exists = db.charges.some((c) => c.lease_id === lease.id && c.period === period)
      if (!exists) {
        const charge: Charge = {
          id: nextId(db, 'charges'),
          lease_id: lease.id,
          property_id: lease.property_id,
          tenant_id: lease.tenant_id,
          period,
          due_date: `${dueKey}T00:00:00.000Z`,
          amount_due: lease.agreed_rent,
          amount_paid: 0,
          status: 'due',
          cancel_reason: null,
          created_at: nowIso(),
        }
        db.charges.push(charge)
        created++
      }
    }
    ;[year, month] = addMonths(year, month)
  }
  return created
}

export function generateAllCharges(db: LocalDB, upToKey?: string): number {
  let total = 0
  for (const lease of db.leases.filter((l) => l.status === 'active')) {
    total += generateChargesForLease(db, lease, upToKey)
  }
  return total
}

export function refreshChargeStatuses(db: LocalDB): number {
  const now = Date.now()
  let updated = 0
  for (const c of db.charges) {
    if (c.status === 'cancelled') continue
    const sum = db.allocations
      .filter((a) => a.charge_id === c.id)
      .reduce((s, a) => s + a.amount, 0)
    c.amount_paid = sum
    const st = chargeStatus(c.amount_due, c.amount_paid, c.due_date, now)
    if (st !== c.status) {
      c.status = st
      updated++
    }
  }
  return updated
}

/* ------------------------------------------------------------------ */
/* الدفعات                                                            */
/* ------------------------------------------------------------------ */

export interface PaymentInput {
  tenant_id: number
  /** بوحدة 1/10000 */
  amount: number
  payment_date: string
  method?: string
  property_id?: number | null
  notes?: string | null
  charge_id?: number | null
  username?: string
}

export function recordPayment(db: LocalDB, input: PaymentInput): Payment {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw badRequest('المبلغ يجب أن يكون أكبر من صفر')
  }
  const tenant = db.tenants.find((t) => t.id === input.tenant_id)
  if (!tenant) throw notFound('المستأجر غير موجود')

  let propertyId = input.property_id ?? null
  if (propertyId == null) {
    const lease = db.leases.find((l) => l.tenant_id === tenant.id && l.status === 'active')
    if (lease) propertyId = lease.property_id
  }

  const payment: Payment = {
    id: nextId(db, 'payments'),
    receipt_number: genReceiptNumber(),
    tenant_id: tenant.id,
    property_id: propertyId,
    amount: input.amount,
    payment_date: input.payment_date,
    method: input.method || 'cash',
    notes: input.notes ?? null,
    created_at: nowIso(),
  }
  db.payments.push(payment)

  // استحقاقات مرشحة للتخصيص مرتبة حسب تاريخ الاستحقاق
  let charges = db.charges
    .filter((c) => c.tenant_id === tenant.id && c.status !== 'cancelled' && c.status !== 'paid')
    .sort((a, b) => Date.parse(a.due_date) - Date.parse(b.due_date) || a.id - b.id)
  if (input.charge_id != null) {
    const selected = db.charges.find((c) => c.id === input.charge_id)
    if (selected) charges = [selected, ...charges.filter((c) => c.id !== selected.id)]
  }

  let remaining = input.amount
  for (const c of charges) {
    if (remaining <= 0) break
    const chargeRemaining = c.amount_due - c.amount_paid
    if (chargeRemaining <= 0) continue
    const alloc = Math.min(remaining, chargeRemaining)
    db.allocations.push({
      id: nextId(db, 'allocations'),
      payment_id: payment.id,
      charge_id: c.id,
      amount: alloc,
    })
    c.amount_paid += alloc
    c.status = chargeStatus(c.amount_due, c.amount_paid, c.due_date)
    remaining -= alloc
  }

  // الزيادة تصبح رصيدًا دائنًا للمستأجر
  if (remaining > 0) tenant.credit_balance += remaining

  const movement: Movement = {
    id: nextId(db, 'movements'),
    movement_number: genMovementNumber(),
    movement_type: 'rent_receipt',
    amount: input.amount,
    movement_date: input.payment_date,
    property_id: propertyId,
    tenant_id: tenant.id,
    payment_id: payment.id,
    expense_id: null,
    category: 'إيجار',
    description: `قبض إيجار - إيصال ${payment.receipt_number}`,
    notes: null,
    method: payment.method,
    receipt_ref: payment.receipt_number,
    created_at: nowIso(),
  }
  db.movements.push(movement)

  logAudit(db, input.username, 'payment.create', 'payment', payment.id, null, {
    amount: String(payment.amount),
    tenant_id: tenant.id,
    receipt: payment.receipt_number,
  })

  return payment
}

export function cancelPayment(db: LocalDB, paymentId: number, username?: string, reason?: string): void {
  const payment = db.payments.find((p) => p.id === paymentId)
  if (!payment) throw notFound('الدفعة غير موجودة')

  const allocations = db.allocations.filter((a) => a.payment_id === payment.id)
  let allocated = 0
  for (const alloc of allocations) {
    allocated += alloc.amount
    const charge = db.charges.find((c) => c.id === alloc.charge_id)
    if (charge) {
      charge.amount_paid -= alloc.amount
      charge.status = chargeStatus(charge.amount_due, charge.amount_paid, charge.due_date)
    }
  }

  const tenant = db.tenants.find((t) => t.id === payment.tenant_id)
  if (tenant) {
    const excess = payment.amount - allocated
    if (excess > 0) tenant.credit_balance = Math.max(0, tenant.credit_balance - excess)
  }

  db.movements = db.movements.filter((m) => m.payment_id !== payment.id)
  db.allocations = db.allocations.filter((a) => a.payment_id !== payment.id)
  db.payments = db.payments.filter((p) => p.id !== payment.id)

  logAudit(db, username, 'payment.cancel', 'payment', paymentId, { amount: String(payment.amount) }, {
    reason: reason ?? null,
  })
}

/* ------------------------------------------------------------------ */
/* المصاريف والحركات                                                   */
/* ------------------------------------------------------------------ */

export function findTenant(db: LocalDB, id: number): Tenant {
  const t = db.tenants.find((x) => x.id === id)
  if (!t) throw notFound('المستأجر غير موجود')
  return t
}

/* ------------------------------------------------------------------ */
/* سجل التدقيق                                                        */
/* ------------------------------------------------------------------ */

export function logAudit(
  db: LocalDB,
  username: string | undefined,
  action: string,
  entityType: string,
  entityId: number,
  oldValues: Record<string, unknown> | null,
  newValues: Record<string, unknown> | null,
): void {
  const entry: AuditEntry = {
    id: nextId(db, 'audit'),
    user_id: 1,
    username: username || 'admin',
    action,
    entity_type: entityType,
    entity_id: entityId,
    old_values: oldValues,
    new_values: newValues,
    created_at: nowIso(),
  }
  db.audit.push(entry)
}

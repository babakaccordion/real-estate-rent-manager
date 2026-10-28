import type { LocalDB } from './types'
import { emptyDB, loadDB, replaceDB } from './db'
import { badRequest } from './errors'
import { dateKey, toIso, toIsoOrNull } from './engine'
import { moneyStr, toU } from './money'

/**
 * نسخة احتياطية بصيغة متوافقة مع نسخة الكمبيوتر (نفس أسماء جداول الخادم)،
 * حتى يمكن نقل البيانات من الكمبيوتر إلى الآيفون وبالعكس.
 */

export interface BackupFile {
  app?: string
  mode?: string
  exported_at?: string
  users?: unknown[]
  properties?: any[]
  units?: any[]
  tenants?: any[]
  leases?: any[]
  charges?: any[]
  payments?: any[]
  payment_allocations?: any[]
  expenses?: any[]
  cash_movements?: any[]
  notes?: any[]
  audit_logs?: any[]
  app_settings?: any[]
  // صيغة داخلية مبسطة (احتياط)
  settings?: Record<string, string>
  allocations?: any[]
  movements?: any[]
  audit?: any[]
}

const iso = (v: unknown, fallback?: string) => (v ? toIso(v, fallback) : null)

export function buildBackup(db: LocalDB = loadDB()): BackupFile {
  return {
    app: 'real-estate-rent-manager',
    mode: 'local',
    exported_at: new Date().toISOString(),
    users: db.users.map((u) => ({
      id: u.id,
      username: u.username,
      email: null,
      full_name: u.full_name,
      hashed_password: null,
      role: u.role,
      is_active: true,
      created_at: new Date().toISOString(),
    })),
    properties: db.properties.map((p) => ({
      id: p.id,
      property_number: p.property_number,
      name: p.name,
      property_type: p.property_type,
      address: p.address,
      city: p.city,
      district: p.district,
      description: p.description,
      units_count: p.units_count,
      status: p.status,
      image_path: null,
      created_at: p.created_at,
      notes: p.notes,
    })),
    units: db.units.map((u) => ({
      id: u.id,
      property_id: u.property_id,
      unit_number: u.unit_number,
      unit_type: u.unit_type,
      agreed_rent: moneyStr(u.agreed_rent),
      status: u.status,
      current_tenant_id: u.current_tenant_id,
      lease_start: u.lease_start,
      lease_end: u.lease_end,
      notes: u.notes,
      created_at: new Date().toISOString(),
    })),
    tenants: db.tenants.map((t) => ({
      id: t.id,
      tenant_number: t.tenant_number,
      full_name: t.full_name,
      phone: t.phone,
      phone2: t.phone2,
      id_number: t.id_number,
      status: t.status,
      notes: t.notes,
      credit_balance: moneyStr(t.credit_balance),
      created_at: t.created_at,
    })),
    leases: db.leases.map((l) => ({
      id: l.id,
      tenant_id: l.tenant_id,
      property_id: l.property_id,
      unit_id: l.unit_id,
      agreed_rent: moneyStr(l.agreed_rent),
      start_date: l.start_date,
      end_date: l.end_date,
      due_day: l.due_day,
      frequency: l.frequency,
      status: l.status,
      notes: l.notes,
      created_at: l.created_at,
    })),
    charges: db.charges.map((c) => ({
      id: c.id,
      lease_id: c.lease_id,
      property_id: c.property_id,
      tenant_id: c.tenant_id,
      period: c.period,
      due_date: c.due_date,
      amount_due: moneyStr(c.amount_due),
      amount_paid: moneyStr(c.amount_paid),
      status: c.status,
      cancel_reason: c.cancel_reason,
      created_at: c.created_at,
    })),
    payments: db.payments.map((p) => ({
      id: p.id,
      receipt_number: p.receipt_number,
      tenant_id: p.tenant_id,
      property_id: p.property_id,
      amount: moneyStr(p.amount),
      payment_date: p.payment_date,
      method: p.method,
      notes: p.notes,
      created_by: null,
      created_at: p.created_at,
    })),
    payment_allocations: db.allocations.map((a) => ({
      id: a.id,
      payment_id: a.payment_id,
      charge_id: a.charge_id,
      amount: moneyStr(a.amount),
    })),
    expenses: db.expenses.map((e) => ({
      id: e.id,
      expense_number: e.expense_number,
      property_id: e.property_id,
      category: e.category,
      amount: moneyStr(e.amount),
      expense_date: e.expense_date,
      description: e.description,
      is_paid: e.is_paid,
      paid_date: e.paid_date,
      attachment_path: null,
      notes: e.notes,
      created_by: null,
      created_at: e.created_at,
    })),
    cash_movements: db.movements.map((m) => ({
      id: m.id,
      movement_number: m.movement_number,
      movement_type: m.movement_type,
      amount: moneyStr(m.amount),
      movement_date: m.movement_date,
      property_id: m.property_id,
      tenant_id: m.tenant_id,
      expense_id: m.expense_id,
      payment_id: m.payment_id,
      category: m.category,
      description: m.description,
      notes: m.notes,
      method: m.method,
      receipt_ref: m.receipt_ref,
      created_by: null,
      created_at: m.created_at,
    })),
    notes: db.notes.map((n) => ({
      id: n.id,
      entity_type: n.entity_type,
      entity_id: n.entity_id,
      content: n.content,
      created_by: null,
      created_at: n.created_at,
    })),
    audit_logs: db.audit.map((a) => ({
      id: a.id,
      user_id: a.user_id,
      username: a.username,
      action: a.action,
      entity_type: a.entity_type,
      entity_id: a.entity_id,
      old_values: a.old_values,
      new_values: a.new_values,
      created_at: a.created_at,
    })),
    app_settings: Object.entries(db.settings).map(([key, value]) => ({ key, value })),
  }
}

export function backupJSON(db: LocalDB = loadDB()): string {
  return JSON.stringify(buildBackup(db), null, 2)
}

function maxId(rows: Array<{ id?: unknown }>): number {
  return rows.reduce((max, row) => Math.max(max, Number(row?.id) || 0), 0)
}

function list(data: BackupFile, key: keyof BackupFile): any[] {
  const v = data[key]
  return Array.isArray(v) ? v : []
}

/** يستعيد البيانات من نص JSON (نسخة محلية أو نسخة الكمبيوتر). */
export function restoreBackup(text: string): { counts: Record<string, number> } {
  let data: BackupFile
  try {
    data = JSON.parse(text)
  } catch {
    throw badRequest('الملف ليس ملف JSON صالحًا')
  }
  if (!data || typeof data !== 'object') throw badRequest('الملف غير صالح')

  const properties = list(data, 'properties')
  if (!properties.length && !list(data, 'tenants').length && !list(data, 'charges').length) {
    throw badRequest('الملف لا يحتوي على بيانات هذا التطبيق')
  }

  const db = emptyDB()
  // بيانات الدخول الحالية تبقى كما هي
  const currentUsers = loadDB().users
  db.users = currentUsers

  db.properties = properties.map((p) => ({
    id: Number(p.id),
    property_number: String(p.property_number ?? ''),
    name: String(p.name ?? 'بدون اسم'),
    property_type: String(p.property_type ?? 'other'),
    address: p.address ?? null,
    city: p.city ?? null,
    district: p.district ?? null,
    description: p.description ?? null,
    units_count: Number(p.units_count) || 1,
    status: String(p.status ?? 'vacant'),
    notes: p.notes ?? null,
    created_at: iso(p.created_at) ?? new Date().toISOString(),
  }))

  db.units = list(data, 'units').map((u) => ({
    id: Number(u.id),
    property_id: Number(u.property_id),
    unit_number: String(u.unit_number ?? '1'),
    unit_type: String(u.unit_type ?? 'other'),
    agreed_rent: toU(u.agreed_rent),
    status: String(u.status ?? 'vacant'),
    current_tenant_id: u.current_tenant_id != null ? Number(u.current_tenant_id) : null,
    notes: u.notes ?? null,
    lease_start: iso(u.lease_start),
    lease_end: iso(u.lease_end),
  }))

  db.tenants = list(data, 'tenants').map((t) => ({
    id: Number(t.id),
    tenant_number: String(t.tenant_number ?? ''),
    full_name: String(t.full_name ?? 'بدون اسم'),
    phone: t.phone ?? null,
    phone2: t.phone2 ?? null,
    id_number: t.id_number ?? null,
    status: String(t.status ?? 'active'),
    notes: t.notes ?? null,
    credit_balance: toU(t.credit_balance),
    created_at: iso(t.created_at) ?? new Date().toISOString(),
  }))

  db.leases = list(data, 'leases').map((l) => ({
    id: Number(l.id),
    tenant_id: Number(l.tenant_id),
    property_id: Number(l.property_id),
    unit_id: l.unit_id != null ? Number(l.unit_id) : null,
    agreed_rent: toU(l.agreed_rent),
    start_date: iso(l.start_date) ?? new Date().toISOString(),
    end_date: iso(l.end_date),
    due_day: Number(l.due_day) || 1,
    frequency: String(l.frequency ?? 'monthly'),
    status: String(l.status ?? 'active'),
    notes: l.notes ?? null,
    created_at: iso(l.created_at) ?? new Date().toISOString(),
  }))

  db.charges = list(data, 'charges').map((c) => ({
    id: Number(c.id),
    lease_id: Number(c.lease_id),
    property_id: Number(c.property_id),
    tenant_id: Number(c.tenant_id),
    period: String(c.period ?? '').slice(0, 7),
    due_date: iso(c.due_date) ?? new Date().toISOString(),
    amount_due: toU(c.amount_due),
    amount_paid: toU(c.amount_paid),
    status: String(c.status ?? 'due'),
    cancel_reason: c.cancel_reason ?? null,
    created_at: iso(c.created_at) ?? new Date().toISOString(),
  }))

  db.payments = list(data, 'payments').map((p) => ({
    id: Number(p.id),
    receipt_number: String(p.receipt_number ?? ''),
    tenant_id: Number(p.tenant_id),
    property_id: p.property_id != null ? Number(p.property_id) : null,
    amount: toU(p.amount),
    payment_date: iso(p.payment_date) ?? new Date().toISOString(),
    method: String(p.method ?? 'cash'),
    notes: p.notes ?? null,
    created_at: iso(p.created_at) ?? new Date().toISOString(),
  }))

  const rawAllocations = list(data, 'payment_allocations').length
    ? list(data, 'payment_allocations')
    : list(data, 'allocations')
  db.allocations = rawAllocations.map((a) => ({
    id: Number(a.id),
    payment_id: Number(a.payment_id),
    charge_id: Number(a.charge_id),
    amount: toU(a.amount),
  }))

  db.expenses = list(data, 'expenses').map((e) => ({
    id: Number(e.id),
    expense_number: String(e.expense_number ?? ''),
    property_id: e.property_id != null ? Number(e.property_id) : null,
    category: String(e.category ?? 'other'),
    amount: toU(e.amount),
    expense_date: iso(e.expense_date) ?? new Date().toISOString(),
    description: e.description ?? null,
    is_paid: Boolean(e.is_paid),
    paid_date: iso(e.paid_date),
    notes: e.notes ?? null,
    created_at: iso(e.created_at) ?? new Date().toISOString(),
  }))

  const rawMovements = list(data, 'cash_movements').length
    ? list(data, 'cash_movements')
    : list(data, 'movements')
  db.movements = rawMovements.map((m) => ({
    id: Number(m.id),
    movement_number: String(m.movement_number ?? ''),
    movement_type: String(m.movement_type ?? 'other'),
    amount: toU(m.amount),
    movement_date: iso(m.movement_date) ?? new Date().toISOString(),
    property_id: m.property_id != null ? Number(m.property_id) : null,
    tenant_id: m.tenant_id != null ? Number(m.tenant_id) : null,
    expense_id: m.expense_id != null ? Number(m.expense_id) : null,
    payment_id: m.payment_id != null ? Number(m.payment_id) : null,
    category: m.category ?? null,
    description: m.description ?? null,
    notes: m.notes ?? null,
    method: m.method ?? null,
    receipt_ref: m.receipt_ref ?? null,
    created_at: iso(m.created_at) ?? new Date().toISOString(),
  }))

  db.notes = list(data, 'notes').map((n) => ({
    id: Number(n.id),
    entity_type: n.entity_type === 'tenant' ? ('tenant' as const) : ('property' as const),
    entity_id: Number(n.entity_id),
    content: String(n.content ?? ''),
    created_at: iso(n.created_at) ?? new Date().toISOString(),
  }))

  db.audit = list(data, 'audit_logs').length
    ? list(data, 'audit_logs').map((a) => ({
        id: Number(a.id),
        user_id: a.user_id != null ? Number(a.user_id) : null,
        username: String(a.username ?? ''),
        action: String(a.action ?? ''),
        entity_type: String(a.entity_type ?? ''),
        entity_id: Number(a.entity_id) || 0,
        old_values: a.old_values ?? null,
        new_values: a.new_values ?? null,
        created_at: iso(a.created_at) ?? new Date().toISOString(),
      }))
    : list(data, 'audit').map((a) => ({
        id: Number(a.id),
        user_id: a.user_id != null ? Number(a.user_id) : null,
        username: String(a.username ?? ''),
        action: String(a.action ?? ''),
        entity_type: String(a.entity_type ?? ''),
        entity_id: Number(a.entity_id) || 0,
        old_values: a.old_values ?? null,
        new_values: a.new_values ?? null,
        created_at: iso(a.created_at) ?? new Date().toISOString(),
      }))

  const settings: Record<string, string> = { ...db.settings }
  const rawSettings = list(data, 'app_settings')
  if (rawSettings.length) {
    for (const s of rawSettings) {
      if (s && s.key) settings[String(s.key)] = String(s.value ?? '')
    }
  } else if (data.settings && typeof data.settings === 'object') {
    for (const [k, v] of Object.entries(data.settings)) settings[k] = String(v ?? '')
  }
  db.settings = settings

  // إعادة بناء العدّادات من أعلى معرف موجود
  db.counters = {
    properties: maxId(db.properties),
    units: maxId(db.units),
    tenants: maxId(db.tenants),
    leases: maxId(db.leases),
    charges: maxId(db.charges),
    payments: maxId(db.payments),
    allocations: maxId(db.allocations),
    expenses: maxId(db.expenses),
    movements: maxId(db.movements),
    notes: maxId(db.notes),
    audit: maxId(db.audit),
  }

  // التحقق من سلامة المراجع الأساسية
  const propertyIds = new Set(db.properties.map((p) => p.id))
  const tenantIds = new Set(db.tenants.map((t) => t.id))
  for (const l of db.leases) {
    if (!propertyIds.has(l.property_id) || !tenantIds.has(l.tenant_id)) {
      throw badRequest('الملف غير متوافق: عقد يشير إلى عقار أو مستأجر غير موجود')
    }
  }

  replaceDB(db)

  return {
    counts: {
      properties: db.properties.length,
      units: db.units.length,
      tenants: db.tenants.length,
      leases: db.leases.length,
      charges: db.charges.length,
      payments: db.payments.length,
      expenses: db.expenses.length,
      movements: db.movements.length,
    },
  }
}

export function backupFilename(): string {
  const now = new Date()
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate(),
  ).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(
    2,
    '0',
  )}${String(now.getSeconds()).padStart(2, '0')}`
  return `backup_${stamp}.json`
}

export function downloadBackup(): string {
  const filename = backupFilename()
  const blob = new Blob([backupJSON()], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return filename
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('تعذّر قراءة الملف'))
    reader.readAsText(file, 'utf-8')
  })
}

/* ------------------------------------------------------------------ */
/* الحفظ التلقائي (نسخة داخل المتصفح بعد كل إضافة أو تعديل)            */
/* ------------------------------------------------------------------ */

export const AUTOSAVE_KEY = 'rr-autosave-v1'
const AUTOSAVE_META_KEY = 'rr-autosave-meta-v1'

export interface AutosaveInfo {
  at: string | null
  bytes: number
}

/** يحفظ لقطة كاملة من البيانات الحالية في التخزين المحلي. */
export function saveAutosave(db: LocalDB = loadDB()): boolean {
  try {
    const text = backupJSON(db)
    localStorage.setItem(AUTOSAVE_KEY, text)
    localStorage.setItem(AUTOSAVE_META_KEY, JSON.stringify({ at: new Date().toISOString(), bytes: text.length }))
    return true
  } catch {
    return false
  }
}

export function autosaveText(): string | null {
  try {
    return localStorage.getItem(AUTOSAVE_KEY)
  } catch {
    return null
  }
}

export function autosaveInfo(): AutosaveInfo {
  try {
    const meta = JSON.parse(localStorage.getItem(AUTOSAVE_META_KEY) || 'null')
    const text = localStorage.getItem(AUTOSAVE_KEY) || ''
    return {
      at: meta?.at ? String(meta.at) : null,
      bytes: Number(meta?.bytes) || text.length,
    }
  } catch {
    return { at: null, bytes: 0 }
  }
}

/** اسم مختصر للعرض: آخر شهرين في البيانات. */
export function dataRangeLabel(db: LocalDB = loadDB()): string {
  const dates = [
    ...db.charges.map((c) => dateKey(c.due_date)),
    ...db.payments.map((p) => dateKey(p.payment_date)),
  ].filter(Boolean)
  if (!dates.length) return 'لا توجد بيانات بعد'
  dates.sort()
  return `${dates[0]} — ${dates[dates.length - 1]}`
}

export { toIsoOrNull }

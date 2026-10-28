import type { LocalDB, LocalUser, Movement, Note } from './types'
import { loadDB, nextId, saveDB } from './db'
import { saveAutosave } from './backup'
import { hashPassword, verifyPassword } from './auth'
import { ApiError, badRequest, notFound, unauthorized } from './errors'
import { fromU, toU } from './money'
import {
  cancelPayment,
  dateKey,
  findTenant,
  generateAllCharges,
  generateChargesForLease,
  genExpenseNumber,
  genMovementNumber,
  genPropertyNumber,
  genTenantNumber,
  logAudit,
  nowIso,
  recordPayment,
  refreshChargeStatuses,
  toIso,
  toIsoOrNull,
} from './engine'
import {
  arrearsReport,
  cashReport,
  dashboardReport,
  expensesReport,
  overallReport,
  propertyReport,
  receiptsReport,
  tenantReport,
} from './reports'

type Params = Record<string, unknown>
type Body = Record<string, any> | null

const USER: LocalUser = { id: 1, username: '', password_hash: '', full_name: 'مدير النظام', role: 'admin' }

function userOut(u: LocalUser) {
  return {
    id: u.id,
    username: u.username,
    full_name: u.full_name,
    email: null,
    role: u.role,
    is_active: true,
  }
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

function intOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

function requireInt(v: unknown, message: string): number {
  const n = intOrNull(v)
  if (n === null) throw badRequest(message)
  return n
}

function requireStr(v: unknown, message: string): string {
  const s = str(v)
  if (!s) throw badRequest(message)
  return s
}

/** ترتيب تنازلي حسب حقل تاريخ (نصوص ISO). */
function byDateDesc<T>(rows: T[], get: (row: T) => string | null): T[] {
  return [...rows].sort((a, b) => {
    const av = get(a)
    const bv = get(b)
    const at = av ? Date.parse(av) : 0
    const bt = bv ? Date.parse(bv) : 0
    return bt - at
  })
}

/* ------------------------------------------------------------------ */
/* محوّلات الإخراج (بنفس أشكال الخادم)                                  */
/* ------------------------------------------------------------------ */

function propertyOut(p: LocalDB['properties'][number]) {
  return {
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
    notes: p.notes,
    created_at: p.created_at,
  }
}

function unitOut(u: LocalDB['units'][number]) {
  return {
    id: u.id,
    property_id: u.property_id,
    unit_number: u.unit_number,
    unit_type: u.unit_type,
    agreed_rent: fromU(u.agreed_rent),
    status: u.status,
    current_tenant_id: u.current_tenant_id,
    notes: u.notes,
  }
}

function tenantOut(t: LocalDB['tenants'][number]) {
  return {
    id: t.id,
    tenant_number: t.tenant_number,
    full_name: t.full_name,
    phone: t.phone,
    phone2: t.phone2,
    id_number: t.id_number,
    status: t.status,
    notes: t.notes,
    credit_balance: fromU(t.credit_balance),
    created_at: t.created_at,
  }
}

function leaseOut(l: LocalDB['leases'][number]) {
  return {
    id: l.id,
    tenant_id: l.tenant_id,
    property_id: l.property_id,
    unit_id: l.unit_id,
    agreed_rent: fromU(l.agreed_rent),
    start_date: l.start_date,
    end_date: l.end_date,
    due_day: l.due_day,
    frequency: l.frequency,
    status: l.status,
    notes: l.notes,
  }
}

function chargeOut(c: LocalDB['charges'][number]) {
  return {
    id: c.id,
    lease_id: c.lease_id,
    property_id: c.property_id,
    tenant_id: c.tenant_id,
    period: c.period,
    due_date: c.due_date,
    amount_due: fromU(c.amount_due),
    amount_paid: fromU(c.amount_paid),
    status: c.status,
    cancel_reason: c.cancel_reason,
  }
}

function paymentOut(p: LocalDB['payments'][number]) {
  return {
    id: p.id,
    receipt_number: p.receipt_number,
    tenant_id: p.tenant_id,
    property_id: p.property_id,
    amount: fromU(p.amount),
    payment_date: p.payment_date,
    method: p.method,
    notes: p.notes,
  }
}

function expenseOut(e: LocalDB['expenses'][number]) {
  return {
    id: e.id,
    expense_number: e.expense_number,
    property_id: e.property_id,
    category: e.category,
    amount: fromU(e.amount),
    expense_date: e.expense_date,
    description: e.description,
    is_paid: e.is_paid,
    paid_date: e.paid_date,
    notes: e.notes,
  }
}

function movementOut(m: Movement) {
  return {
    id: m.id,
    movement_number: m.movement_number,
    movement_type: m.movement_type,
    amount: fromU(m.amount),
    movement_date: m.movement_date,
    property_id: m.property_id,
    tenant_id: m.tenant_id,
    category: m.category,
    description: m.description,
    notes: m.notes,
    method: m.method,
    receipt_ref: m.receipt_ref,
  }
}

function noteOut(n: Note) {
  return { id: n.id, content: n.content, created_at: n.created_at }
}

/* ------------------------------------------------------------------ */
/* المسارات                                                            */
/* ------------------------------------------------------------------ */

/** يُنفَّذ مرة واحدة عند فتح التطبيق (توليد الاستحقاقات الجديدة وتحديث حالات التأخير). */
let bootstrapped = false

export function handleRequest(method: string, path: string, params: Params, body: Body): unknown {
  const db = loadDB()
  USER.username = db.users[0]?.username ?? USER.username
  if (!bootstrapped) {
    bootstrapped = true
    // عند فتح التطبيق: أنشئ استحقاقات الأشهر الجديدة وحدّث حالات التأخير تلقائيًا.
    generateAllCharges(db)
    refreshChargeStatuses(db)
  }
  const verb = method.toLowerCase()
  const routePath = normalizePath(path)
  const finish = (result: unknown) => {
    saveDB(db)
    // حفظ تلقائي بعد كل إضافة أو تعديل أو حذف (يمكن تعطيله من الإعدادات).
    if (
      verb !== 'get' &&
      db.settings.auto_backup !== '0' &&
      !routePath.startsWith('/auth') &&
      !routePath.startsWith('/backup')
    ) {
      saveAutosave(db)
    }
    return result
  }
  const result = route(db, verb, routePath, params || {}, body || {})
  return result instanceof Promise ? result.then(finish) : finish(result)
}

function normalizePath(path: string): string {
  let p = path.split('?')[0]
  if (p.startsWith('/api/')) p = p.slice(4)
  else if (p === '/api') p = '/'
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)
  return p
}

function route(db: LocalDB, method: string, path: string, params: Params, body: Body): unknown {
  let m: RegExpMatchArray | null

  /* ---------------------------- المصادقة --------------------------- */
  // حالة الإعداد: هل توجد بيانات دخول على هذا الجهاز؟
  if (method === 'get' && path === '/auth/status') {
    return { needs_setup: db.users.length === 0 }
  }

  // أول تشغيل فقط: إنشاء بيانات الدخول (اسم المستخدم + كلمة مرور خاصة بالمستخدم).
  if (method === 'post' && path === '/auth/setup') {
    if (db.users.length > 0) throw badRequest('بيانات الدخول مُعدّة مسبقًا على هذا الجهاز')
    const username = String(body?.username ?? '').trim()
    const password = String(body?.password ?? '')
    if (username.length < 3) throw badRequest('اسم المستخدم يجب أن يكون 3 أحرف على الأقل')
    if (password.length < 8) throw badRequest('كلمة المرور يجب أن تكون 8 أحرف على الأقل')
    return (async () => {
      const user: LocalUser = {
        id: 1,
        username,
        password_hash: await hashPassword(password),
        full_name: 'مدير النظام',
        role: 'admin',
      }
      db.users.push(user)
      logAudit(db, user.username, 'auth.setup', 'user', user.id, null, { username: user.username })
      return { access_token: `local-${user.id}-${Date.now()}`, token_type: 'bearer', user: userOut(user) }
    })()
  }

  if (method === 'post' && path === '/auth/login') {
    const username = String(body?.username ?? '').trim()
    const password = String(body?.password ?? '')
    const user = db.users.find((u) => u.username === username)
    if (!user) throw new ApiError(401, 'اسم المستخدم أو كلمة المرور غير صحيحة')
    return (async () => {
      if (!(await verifyPassword(password, user.password_hash))) {
        throw new ApiError(401, 'اسم المستخدم أو كلمة المرور غير صحيحة')
      }
      return {
        access_token: `local-${user.id}-${Date.now()}`,
        token_type: 'bearer',
        user: userOut(user),
      }
    })()
  }

  if (method === 'get' && path === '/auth/me') {
    const user = db.users[0]
    if (!user) throw unauthorized()
    return userOut(user)
  }

  if (method === 'post' && path === '/auth/change-credentials') {
    const user = db.users[0]
    if (!user) throw unauthorized()
    return (async () => {
      if (!(await verifyPassword(String(body?.current_password ?? ''), user.password_hash))) {
        throw badRequest('كلمة المرور الحالية غير صحيحة')
      }
      const username = String(body?.username ?? '').trim()
      if (username && username !== user.username) {
        if (username.length < 3) throw badRequest('اسم المستخدم يجب أن يكون 3 أحرف على الأقل')
        if (db.users.some((u) => u.username === username)) throw badRequest('اسم المستخدم مستخدم مسبقًا')
        user.username = username
      }
      const newPassword = String(body?.new_password ?? '')
      if (newPassword) {
        if (newPassword.length < 8) throw badRequest('كلمة المرور يجب أن تكون 8 أحرف على الأقل')
        user.password_hash = await hashPassword(newPassword)
      }
      logAudit(db, user.username, 'auth.credentials', 'user', user.id, null, { username: user.username })
      return userOut(user)
    })()
  }

  if (method === 'get' && path === '/auth/users') {
    return db.users.map(userOut)
  }

  if (method === 'post' && path === '/auth/users') {
    const username = requireStr(body?.username, 'اسم المستخدم مطلوب')
    if (db.users.some((u) => u.username === username)) throw badRequest('اسم المستخدم موجود')
    const password = String(body?.password ?? '')
    if (password.length < 8) throw badRequest('كلمة المرور يجب أن تكون 8 أحرف على الأقل')
    return (async () => {
      const user: LocalUser = {
        id: db.users.reduce((max, u) => Math.max(max, u.id), 0) + 1,
        username,
        password_hash: await hashPassword(password),
        full_name: String(body?.full_name ?? username),
        role: String(body?.role ?? 'viewer'),
      }
      db.users.push(user)
      return userOut(user)
    })()
  }

  /* ---------------------------- الإعدادات -------------------------- */
  if (path === '/settings' && method === 'get') return { ...db.settings }

  if (path === '/settings' && method === 'put') {
    const key = requireStr(body?.key, 'المفتاح مطلوب')
    db.settings[key] = String(body?.value ?? '')
    return { message: 'تم' }
  }

  /* ---------------------------- العقارات --------------------------- */
  if (path === '/properties' && method === 'get') {
    return byDateDesc(db.properties, (p) => p.created_at).map(propertyOut)
  }

  if (path === '/properties' && method === 'post') {
    const name = requireStr(body?.name, 'اسم العقار مطلوب')
    const p = {
      id: nextId(db, 'properties'),
      property_number: genPropertyNumber(),
      name,
      property_type: String(body?.property_type ?? 'other'),
      address: str(body?.address),
      city: str(body?.city),
      district: str(body?.district),
      description: str(body?.description),
      units_count: requireInt(body?.units_count ?? 1, 'عدد الوحدات غير صحيح'),
      status: String(body?.status ?? 'vacant'),
      notes: str(body?.notes),
      created_at: nowIso(),
    }
    db.properties.push(p)
    if (p.units_count <= 1) {
      db.units.push({
        id: nextId(db, 'units'),
        property_id: p.id,
        unit_number: '1',
        unit_type: 'other',
        agreed_rent: 0,
        status: 'vacant',
        current_tenant_id: null,
        notes: null,
        lease_start: null,
        lease_end: null,
      })
    }
    logAudit(db, USER.username, 'property.create', 'property', p.id, null, { name: p.name })
    return propertyOut(p)
  }

  if ((m = path.match(/^\/properties\/units\/(\d+)$/)) && method === 'put') {
    const unit = db.units.find((u) => u.id === Number(m![1]))
    if (!unit) throw notFound('الوحدة غير موجودة')
    unit.unit_number = requireStr(body?.unit_number, 'رقم الوحدة مطلوب')
    unit.unit_type = String(body?.unit_type ?? 'other')
    unit.agreed_rent = toU(body?.agreed_rent ?? 0)
    unit.status = String(body?.status ?? 'vacant')
    unit.notes = str(body?.notes)
    unit.lease_start = toIsoOrNull(body?.lease_start)
    unit.lease_end = toIsoOrNull(body?.lease_end)
    return unitOut(unit)
  }

  if ((m = path.match(/^\/properties\/(\d+)$/))) {
    const id = Number(m[1])
    const p = db.properties.find((x) => x.id === id)
    if (!p) throw notFound('العقار غير موجود')

    if (method === 'get') return propertyOut(p)

    if (method === 'put') {
      const old = { name: p.name, status: p.status }
      p.name = requireStr(body?.name, 'اسم العقار مطلوب')
      p.property_type = String(body?.property_type ?? p.property_type)
      p.address = str(body?.address)
      p.city = str(body?.city)
      p.district = str(body?.district)
      p.description = str(body?.description)
      p.units_count = requireInt(body?.units_count ?? p.units_count, 'عدد الوحدات غير صحيح')
      p.status = String(body?.status ?? p.status)
      p.notes = str(body?.notes)
      logAudit(db, USER.username, 'property.update', 'property', p.id, old, {
        name: p.name,
        status: p.status,
      })
      return propertyOut(p)
    }

    if (method === 'delete') {
      const hasRecords =
        db.charges.some((c) => c.property_id === id) ||
        db.expenses.some((e) => e.property_id === id) ||
        db.leases.some((l) => l.property_id === id)
      if (hasRecords) {
        p.status = 'inactive'
        return { message: 'تم أرشفة العقار (يحتوي على سجلات مالية)' }
      }
      db.properties = db.properties.filter((x) => x.id !== id)
      db.units = db.units.filter((u) => u.property_id !== id)
      db.notes = db.notes.filter((n) => !(n.entity_type === 'property' && n.entity_id === id))
      return { message: 'تم حذف العقار' }
    }
  }

  if ((m = path.match(/^\/properties\/(\d+)\/units$/))) {
    const pid = Number(m[1])
    if (!db.properties.some((p) => p.id === pid)) throw notFound('العقار غير موجود')
    if (method === 'get') return db.units.filter((u) => u.property_id === pid).map(unitOut)
    if (method === 'post') {
      const unit = {
        id: nextId(db, 'units'),
        property_id: pid,
        unit_number: requireStr(body?.unit_number, 'رقم الوحدة مطلوب'),
        unit_type: String(body?.unit_type ?? 'other'),
        agreed_rent: toU(body?.agreed_rent ?? 0),
        status: String(body?.status ?? 'vacant'),
        current_tenant_id: null,
        notes: str(body?.notes),
        lease_start: toIsoOrNull(body?.lease_start),
        lease_end: toIsoOrNull(body?.lease_end),
      }
      db.units.push(unit)
      return unitOut(unit)
    }
  }

  if ((m = path.match(/^\/properties\/(\d+)\/notes$/))) {
    const pid = Number(m[1])
    if (!db.properties.some((p) => p.id === pid)) throw notFound('العقار غير موجود')
    if (method === 'get') {
      return byDateDesc(
        db.notes.filter((n) => n.entity_type === 'property' && n.entity_id === pid),
        (n) => n.created_at,
      ).map(noteOut)
    }
    if (method === 'post') {
      const note: Note = {
        id: nextId(db, 'notes'),
        entity_type: 'property',
        entity_id: pid,
        content: requireStr(body?.content, 'الملاحظة مطلوبة'),
        created_at: nowIso(),
      }
      db.notes.push(note)
      return noteOut(note)
    }
  }

  /* ---------------------------- المستأجرون ------------------------- */
  if (path === '/tenants' && method === 'get') {
    const search = str(params.search)
    let rows = db.tenants
    if (search) {
      const needle = search.toLowerCase()
      rows = rows.filter(
        (t) =>
          t.full_name.toLowerCase().includes(needle) ||
          (t.phone ?? '').toLowerCase().includes(needle) ||
          t.tenant_number.toLowerCase().includes(needle),
      )
    }
    return byDateDesc(rows, (t) => t.created_at).map(tenantOut)
  }

  if (path === '/tenants' && method === 'post') {
    const t = {
      id: nextId(db, 'tenants'),
      tenant_number: genTenantNumber(),
      full_name: requireStr(body?.full_name, 'اسم المستأجر مطلوب'),
      phone: str(body?.phone),
      phone2: str(body?.phone2),
      id_number: str(body?.id_number),
      status: String(body?.status ?? 'active'),
      notes: str(body?.notes),
      credit_balance: 0,
      created_at: nowIso(),
    }
    db.tenants.push(t)

    const propertyId = intOrNull(body?.property_id)
    if (propertyId !== null && body?.agreed_rent !== undefined && body?.agreed_rent !== null && body?.agreed_rent !== '') {
      if (!db.properties.some((p) => p.id === propertyId)) throw notFound('العقار غير موجود')
      const unitId = intOrNull(body?.unit_id)
      const lease = {
        id: nextId(db, 'leases'),
        tenant_id: t.id,
        property_id: propertyId,
        unit_id: unitId,
        agreed_rent: toU(body?.agreed_rent ?? 0),
        start_date: toIso(body?.lease_start ?? nowIso()),
        end_date: toIsoOrNull(body?.lease_end),
        due_day: requireInt(body?.due_day ?? 1, 'يوم الاستحقاق غير صحيح'),
        frequency: 'monthly',
        status: 'active',
        notes: null,
        created_at: nowIso(),
      }
      db.leases.push(lease)
      generateChargesForLease(db, lease)

      if (unitId !== null) {
        const unit = db.units.find((u) => u.id === unitId)
        if (unit) {
          unit.status = 'occupied'
          unit.current_tenant_id = t.id
          unit.agreed_rent = lease.agreed_rent
        }
      }
    }

    logAudit(db, USER.username, 'tenant.create', 'tenant', t.id, null, { name: t.full_name })
    return tenantOut(t)
  }

  if (path === '/tenants/search/query' && method === 'get') {
    const q = String(params.q ?? '').toLowerCase()
    return db.tenants
      .filter(
        (t) =>
          t.full_name.toLowerCase().includes(q) ||
          (t.phone ?? '').toLowerCase().includes(q) ||
          t.tenant_number.toLowerCase().includes(q),
      )
      .slice(0, 20)
      .map((t) => ({ id: t.id, tenant_number: t.tenant_number, full_name: t.full_name, phone: t.phone }))
  }

  if ((m = path.match(/^\/tenants\/(\d+)\/notes$/)) && method === 'post') {
    const tid = Number(m[1])
    findTenant(db, tid)
    const note: Note = {
      id: nextId(db, 'notes'),
      entity_type: 'tenant',
      entity_id: tid,
      content: requireStr(params.content ?? body?.content, 'الملاحظة مطلوبة'),
      created_at: nowIso(),
    }
    db.notes.push(note)
    return noteOut(note)
  }

  if ((m = path.match(/^\/tenants\/(\d+)$/))) {
    const id = Number(m[1])
    const t = db.tenants.find((x) => x.id === id)
    if (!t) throw notFound('المستأجر غير موجود')

    if (method === 'get') {
      const leases = db.leases.filter((l) => l.tenant_id === id)
      const notes = byDateDesc(
        db.notes.filter((n) => n.entity_type === 'tenant' && n.entity_id === id),
        (n) => n.created_at,
      )
      return {
        ...tenantOut(t),
        leases: leases.map((l) => ({
          id: l.id,
          property_id: l.property_id,
          unit_id: l.unit_id,
          agreed_rent: fromU(l.agreed_rent),
          start_date: l.start_date,
          end_date: l.end_date,
          due_day: l.due_day,
          status: l.status,
        })),
        notes_list: notes.map(noteOut),
      }
    }

    if (method === 'put') {
      t.full_name = requireStr(body?.full_name, 'اسم المستأجر مطلوب')
      t.phone = str(body?.phone)
      t.phone2 = str(body?.phone2)
      t.id_number = str(body?.id_number)
      t.status = String(body?.status ?? t.status)
      t.notes = str(body?.notes)
      logAudit(db, USER.username, 'tenant.update', 'tenant', t.id, null, { name: t.full_name })
      return tenantOut(t)
    }

    if (method === 'delete') {
      const hasRecords =
        db.charges.some((c) => c.tenant_id === id) ||
        db.payments.some((p) => p.tenant_id === id) ||
        db.leases.some((l) => l.tenant_id === id)
      if (hasRecords) {
        t.status = 'inactive'
        return { message: 'تم أرشفة المستأجر (يحتوي على سجلات مالية)' }
      }
      db.tenants = db.tenants.filter((x) => x.id !== id)
      db.notes = db.notes.filter((n) => !(n.entity_type === 'tenant' && n.entity_id === id))
      return { message: 'تم حذف المستأجر' }
    }
  }

  /* ---------------------------- العقود ----------------------------- */
  if (path === '/leases' && method === 'get') {
    return [...db.leases].sort((a, b) => b.id - a.id).map(leaseOut)
  }

  if (path === '/leases' && method === 'post') {
    const tenantId = requireInt(body?.tenant_id, 'المستأجر مطلوب')
    const propertyId = requireInt(body?.property_id, 'العقار مطلوب')
    if (!db.tenants.some((t) => t.id === tenantId)) throw notFound('المستأجر غير موجود')
    if (!db.properties.some((p) => p.id === propertyId)) throw notFound('العقار غير موجود')

    const lease = {
      id: nextId(db, 'leases'),
      tenant_id: tenantId,
      property_id: propertyId,
      unit_id: intOrNull(body?.unit_id),
      agreed_rent: toU(body?.agreed_rent ?? 0),
      start_date: toIso(body?.start_date),
      end_date: toIsoOrNull(body?.end_date),
      due_day: requireInt(body?.due_day ?? 1, 'يوم الاستحقاق غير صحيح'),
      frequency: String(body?.frequency ?? 'monthly'),
      status: 'active',
      notes: str(body?.notes),
      created_at: nowIso(),
    }
    db.leases.push(lease)
    generateChargesForLease(db, lease)
    logAudit(db, USER.username, 'lease.create', 'lease', lease.id, null, {
      tenant_id: tenantId,
      property_id: propertyId,
    })
    return leaseOut(lease)
  }

  if ((m = path.match(/^\/leases\/(\d+)\/status$/)) && method === 'put') {
    const lease = db.leases.find((l) => l.id === Number(m![1]))
    if (!lease) throw notFound('العقد غير موجود')
    lease.status = String(params.status ?? body?.status ?? lease.status)
    return { message: 'تم' }
  }

  if (path === '/leases/generate-charges' && method === 'post') {
    const upTo = str(params.up_to)
    return { created: generateAllCharges(db, upTo ?? undefined) }
  }

  /* ---------------------------- الاستحقاقات ------------------------ */
  if (path === '/charges' && method === 'get') {
    const propertyId = intOrNull(params.property_id)
    const tenantId = intOrNull(params.tenant_id)
    const status = str(params.status)
    return byDateDesc(
      db.charges.filter(
        (c) =>
          (propertyId === null || c.property_id === propertyId) &&
          (tenantId === null || c.tenant_id === tenantId) &&
          (!status || c.status === status),
      ),
      (c) => c.due_date,
    ).map(chargeOut)
  }

  if (path === '/charges/refresh-status' && method === 'post') {
    return { updated: refreshChargeStatuses(db) }
  }

  if ((m = path.match(/^\/charges\/(\d+)\/cancel$/)) && method === 'post') {
    const charge = db.charges.find((c) => c.id === Number(m![1]))
    if (!charge) throw notFound('الاستحقاق غير موجود')
    charge.status = 'cancelled'
    charge.cancel_reason = str(body?.reason)
    return { message: 'تم إلغاء الاستحقاق' }
  }

  /* ---------------------------- الدفعات ---------------------------- */
  if (path === '/payments' && method === 'get') {
    const propertyId = intOrNull(params.property_id)
    const tenantId = intOrNull(params.tenant_id)
    return byDateDesc(
      db.payments.filter(
        (p) =>
          (propertyId === null || p.property_id === propertyId) &&
          (tenantId === null || p.tenant_id === tenantId),
      ),
      (p) => p.payment_date,
    ).map(paymentOut)
  }

  if (path === '/payments' && method === 'post') {
    const payment = recordPayment(db, {
      tenant_id: requireInt(body?.tenant_id, 'المستأجر مطلوب'),
      amount: toU(body?.amount),
      payment_date: toIso(body?.payment_date),
      method: String(body?.method ?? 'cash'),
      property_id: intOrNull(body?.property_id),
      notes: str(body?.notes),
      charge_id: intOrNull(body?.charge_id),
      username: USER.username,
    })
    return paymentOut(payment)
  }

  if ((m = path.match(/^\/payments\/(\d+)$/)) && method === 'delete') {
    cancelPayment(db, Number(m[1]), USER.username, 'حذف')
    return { message: 'تم حذف الدفعة' }
  }

  /* ---------------------------- المصاريف --------------------------- */
  if (path === '/expenses' && method === 'get') {
    const propertyId = intOrNull(params.property_id)
    return byDateDesc(
      db.expenses.filter((e) => propertyId === null || e.property_id === propertyId),
      (e) => e.expense_date,
    ).map(expenseOut)
  }

  if (path === '/expenses' && method === 'post') {
    const expenseDate = toIso(body?.expense_date)
    const isPaid = Boolean(body?.is_paid ?? true)
    const paidDate = toIsoOrNull(body?.paid_date) ?? (isPaid ? expenseDate : null)
    const amount = toU(body?.amount)
    const expense = {
      id: nextId(db, 'expenses'),
      expense_number: genExpenseNumber(),
      property_id: intOrNull(body?.property_id),
      category: String(body?.category ?? 'other'),
      amount,
      expense_date: expenseDate,
      description: str(body?.description),
      is_paid: isPaid,
      paid_date: paidDate,
      notes: str(body?.notes),
      created_at: nowIso(),
    }
    db.expenses.push(expense)
    if (isPaid) {
      db.movements.push({
        id: nextId(db, 'movements'),
        movement_number: genMovementNumber(),
        movement_type: 'expense',
        amount: -amount,
        movement_date: paidDate ?? expenseDate,
        property_id: expense.property_id,
        tenant_id: null,
        expense_id: expense.id,
        payment_id: null,
        category: expense.category,
        description: expense.description || 'مصروف',
        notes: null,
        method: null,
        receipt_ref: null,
        created_at: nowIso(),
      })
    }
    logAudit(db, USER.username, 'expense.create', 'expense', expense.id, null, {
      amount: fromU(amount),
    })
    return expenseOut(expense)
  }

  if ((m = path.match(/^\/expenses\/(\d+)$/))) {
    const id = Number(m[1])
    const expense = db.expenses.find((e) => e.id === id)
    if (!expense) throw notFound('المصروف غير موجود')

    if (method === 'put') {
      db.movements = db.movements.filter((mv) => mv.expense_id !== id)
      const expenseDate = toIso(body?.expense_date)
      const isPaid = Boolean(body?.is_paid ?? true)
      const paidDate = toIsoOrNull(body?.paid_date) ?? (isPaid ? expenseDate : null)
      expense.property_id = intOrNull(body?.property_id)
      expense.category = String(body?.category ?? expense.category)
      expense.amount = toU(body?.amount)
      expense.expense_date = expenseDate
      expense.description = str(body?.description)
      expense.is_paid = isPaid
      expense.paid_date = paidDate
      expense.notes = str(body?.notes)
      if (isPaid) {
        db.movements.push({
          id: nextId(db, 'movements'),
          movement_number: genMovementNumber(),
          movement_type: 'expense',
          amount: -expense.amount,
          movement_date: paidDate ?? expenseDate,
          property_id: expense.property_id,
          tenant_id: null,
          expense_id: expense.id,
          payment_id: null,
          category: expense.category,
          description: expense.description || 'مصروف',
          notes: null,
          method: null,
          receipt_ref: null,
          created_at: nowIso(),
        })
      }
      logAudit(db, USER.username, 'expense.update', 'expense', id, null, {
        amount: fromU(expense.amount),
      })
      return expenseOut(expense)
    }

    if (method === 'delete') {
      db.movements = db.movements.filter((mv) => mv.expense_id !== id)
      db.expenses = db.expenses.filter((e) => e.id !== id)
      logAudit(db, USER.username, 'expense.delete', 'expense', id, null, null)
      return { message: 'تم حذف المصروف' }
    }
  }

  /* ---------------------------- الصندوق ---------------------------- */
  if (path === '/cash' && method === 'get') {
    const propertyId = intOrNull(params.property_id)
    return byDateDesc(
      db.movements.filter((mv) => propertyId === null || mv.property_id === propertyId),
      (mv) => mv.movement_date,
    ).map(movementOut)
  }

  if (path === '/cash' && method === 'post') {
    const type = String(body?.movement_type ?? 'other')
    let amount = toU(body?.amount)
    if (type === 'expense' && amount > 0) amount = -amount
    const movement: Movement = {
      id: nextId(db, 'movements'),
      movement_number: genMovementNumber(),
      movement_type: type,
      amount,
      movement_date: toIso(body?.movement_date),
      property_id: intOrNull(body?.property_id),
      tenant_id: intOrNull(body?.tenant_id),
      expense_id: null,
      payment_id: null,
      category: str(body?.category),
      description: str(body?.description),
      notes: str(body?.notes),
      method: str(body?.method),
      receipt_ref: str(body?.receipt_ref),
      created_at: nowIso(),
    }
    db.movements.push(movement)
    logAudit(db, USER.username, 'cash.create', 'cash_movement', movement.id, null, {
      amount: fromU(amount),
    })
    return movementOut(movement)
  }

  if ((m = path.match(/^\/cash\/(\d+)$/)) && method === 'delete') {
    const id = Number(m[1])
    const movement = db.movements.find((mv) => mv.id === id)
    if (!movement) throw notFound('الحركة غير موجودة')
    db.movements = db.movements.filter((mv) => mv.id !== id)
    logAudit(db, USER.username, 'cash.delete', 'cash_movement', id, { amount: fromU(movement.amount) }, null)
    return { message: 'تم حذف الحركة' }
  }

  /* ---------------------------- التقارير --------------------------- */
  if ((m = path.match(/^\/reports\/property\/(\d+)$/)) && method === 'get') {
    const { start, end } = requirePeriod(params)
    return propertyReport(db, Number(m[1]), start, end)
  }

  if (path === '/reports/overall' && method === 'get') {
    const { start, end } = requirePeriod(params)
    return overallReport(db, start, end, intOrNull(params.property_id))
  }

  if ((m = path.match(/^\/reports\/tenant\/(\d+)$/)) && method === 'get') {
    const { start, end } = requirePeriod(params)
    return tenantReport(db, Number(m[1]), start, end)
  }

  if (path === '/reports/cash' && method === 'get') {
    const { start, end } = requirePeriod(params)
    return cashReport(db, start, end, intOrNull(params.property_id))
  }

  if (path === '/reports/arrears' && method === 'get') {
    const end = requireDate(params.end, 'تاريخ النهاية مطلوب')
    return arrearsReport(db, end, intOrNull(params.property_id))
  }

  if (path === '/reports/expenses' && method === 'get') {
    const { start, end } = requirePeriod(params)
    return expensesReport(db, start, end, intOrNull(params.property_id))
  }

  if (path === '/reports/receipts' && method === 'get') {
    const { start, end } = requirePeriod(params)
    return receiptsReport(db, start, end, intOrNull(params.property_id))
  }

  if (path === '/reports/dashboard' && method === 'get') {
    const { start, end } = requirePeriod(params)
    return dashboardReport(db, start, end)
  }

  /* ---------------------------- البحث ------------------------------ */
  if (path === '/search' && method === 'get') {
    const q = String(params.q ?? '').trim().toLowerCase()
    const like = (v: string | null | undefined) => (v ?? '').toLowerCase().includes(q)
    if (!q) return { properties: [], tenants: [], payments: [], movements: [] }
    return {
      properties: db.properties
        .filter((p) => like(p.name) || like(p.property_number) || like(p.address) || like(p.city))
        .slice(0, 20)
        .map((p) => ({
          id: p.id,
          property_number: p.property_number,
          name: p.name,
          address: p.address,
          city: p.city,
        })),
      tenants: db.tenants
        .filter((t) => like(t.full_name) || like(t.phone) || like(t.tenant_number))
        .slice(0, 20)
        .map((t) => ({
          id: t.id,
          tenant_number: t.tenant_number,
          full_name: t.full_name,
          phone: t.phone,
        })),
      payments: db.payments
        .filter((p) => like(p.receipt_number))
        .slice(0, 20)
        .map((p) => ({
          id: p.id,
          receipt_number: p.receipt_number,
          amount: fromU(p.amount),
          payment_date: p.payment_date,
          tenant_id: p.tenant_id,
        })),
      movements: db.movements
        .filter((mv) => like(mv.movement_number) || like(mv.description))
        .slice(0, 20)
        .map((mv) => ({
          id: mv.id,
          movement_number: mv.movement_number,
          amount: fromU(mv.amount),
          movement_date: mv.movement_date,
        })),
    }
  }

  /* ---------------------------- التدقيق ---------------------------- */
  if (path === '/audit' && method === 'get') {
    const limit = intOrNull(params.limit) ?? 200
    return byDateDesc(db.audit, (a) => a.created_at)
      .slice(0, limit)
      .map((a) => ({
        id: a.id,
        username: a.username,
        action: a.action,
        entity_type: a.entity_type,
        entity_id: a.entity_id,
        old_values: a.old_values,
        new_values: a.new_values,
        created_at: a.created_at,
      }))
  }

  /* ---------------------------- النسخ الاحتياطي --------------------- */
  if (path === '/backup/export' && method === 'post') {
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15)
    return { path: '', filename: `backup_${stamp}.json` }
  }

  if (path === '/backup/list' && method === 'get') return []

  throw new ApiError(404, `المسار غير موجود: ${method.toUpperCase()} ${path}`)
}

function requireDate(value: unknown, message: string): string {
  const s = str(value)
  if (!s) throw badRequest(message)
  return dateKey(s)
}

function requirePeriod(params: Params): { start: string; end: string } {
  return {
    start: requireDate(params.start, 'تاريخ البداية مطلوب'),
    end: requireDate(params.end, 'تاريخ النهاية مطلوب'),
  }
}

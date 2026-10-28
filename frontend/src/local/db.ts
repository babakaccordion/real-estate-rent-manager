import type { LocalDB } from './types'

export const STORAGE_KEY = 'rr-local-db-v1'
const DB_VERSION = 1

export const LOCAL_STORAGE_NOTE =
  'هذه النسخة تعمل بالكامل داخل المتصفح: لا تحتاج خادمًا ولا إنترنت بعد التحميل، وكل البيانات محفوظة على هذا الجهاز فقط.'

export const DOWNLOAD_HINT =
  'في الآيفون: يُحفظ الملف في تطبيق «الملفات» → التنزيلات. احتفظ به في iCloud أو أرسله لنفسك.'

export const DEFAULT_USERNAME = 'admin'
export const DEFAULT_PASSWORD = 'REMOVED'

const DEFAULT_SETTINGS: Record<string, string> = {
  app_name: 'العقارات والإيجارات',
  currency: 'JOD',
  decimal_places: '3',
  timezone: 'Asia/Amman',
  auto_backup: '1',
  general_notes: '',
}

let cache: LocalDB | null = null

export function emptyDB(): LocalDB {
  return {
    version: DB_VERSION,
    counters: {},
    users: [
      {
        id: 1,
        username: DEFAULT_USERNAME,
        password: DEFAULT_PASSWORD,
        full_name: 'مدير النظام',
        role: 'admin',
      },
    ],
    settings: { ...DEFAULT_SETTINGS },
    properties: [],
    units: [],
    tenants: [],
    leases: [],
    charges: [],
    payments: [],
    allocations: [],
    expenses: [],
    movements: [],
    notes: [],
    audit: [],
  }
}

function isDB(v: unknown): v is LocalDB {
  if (!v || typeof v !== 'object') return false
  const d = v as Partial<LocalDB>
  return Array.isArray(d.properties) && Array.isArray(d.charges) && !!d.counters && !!d.settings
}

function normalize(db: LocalDB): LocalDB {
  const base = emptyDB()
  const out: LocalDB = { ...base, ...db }
  out.settings = { ...DEFAULT_SETTINGS, ...(db.settings || {}) }
  out.counters = db.counters || {}
  out.users = db.users && db.users.length ? db.users : base.users
  for (const key of ['properties', 'units', 'tenants', 'leases', 'charges', 'payments', 'allocations', 'expenses', 'movements', 'notes', 'audit'] as const) {
    if (!Array.isArray(out[key])) (out as any)[key] = []
  }
  // ضمان وجود العدّادات لكل مجموعة (في حال استيراد نسخة قديمة)
  for (const key of ['properties', 'units', 'tenants', 'leases', 'charges', 'payments', 'allocations', 'expenses', 'movements', 'notes', 'audit'] as const) {
    if (!out.counters[key]) {
      out.counters[key] = out[key].reduce((max, row: any) => Math.max(max, Number(row.id) || 0), 0)
    }
  }
  return out
}

export function loadDB(): LocalDB {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (isDB(parsed)) {
        cache = normalize(parsed)
        return cache
      }
    }
  } catch {
    // بيانات تالفة: نبدأ بقاعدة فارغة بدل تعطيل التطبيق
  }
  cache = emptyDB()
  saveDB(cache)
  return cache
}

export function saveDB(db: LocalDB = loadDB()): void {
  cache = db
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch (e) {
    const err = new Error('تعذّر حفظ البيانات: مساحة التخزين في المتصفح ممتلئة. صدّر نسخة احتياطية ثم احذف سجلات قديمة.')
    ;(err as any).cause = e
    throw err
  }
}

export function nextId(db: LocalDB, collection: keyof LocalDB): number {
  const key = String(collection)
  const current = Number(db.counters[key] || 0) + 1
  db.counters[key] = current
  return current
}

export function replaceDB(next: LocalDB): void {
  cache = normalize(next)
  saveDB(cache)
}

export function resetDB(): void {
  cache = emptyDB()
  saveDB(cache)
}

export function dbSnapshot(): LocalDB {
  return JSON.parse(JSON.stringify(loadDB()))
}

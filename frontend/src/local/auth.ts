/**
 * تخزين كلمة المرور في النسخة المحلية (المتصفح) بصيغة مشفّرة أحادية الاتجاه.
 * لا تُحفظ كلمة المرور نصًا صريحًا، ولا توجد أي كلمة مرور افتراضية داخل الكود.
 */

const ITERATIONS = 210_000
const KEY_BYTES = 32

function toBase64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i])
  return btoa(out)
}

function fromBase64(value: string): Uint8Array {
  const raw = atob(value)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

function subtle(): SubtleCrypto {
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined
  if (!c?.subtle) {
    throw new Error('يُشترط فتح البرنامج عبر اتصال آمن (https) لإنشاء بيانات الدخول وحفظها بشكل مشفّر.')
  }
  return c.subtle
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await subtle().importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await subtle().deriveBits(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash: 'SHA-256' },
    key,
    KEY_BYTES * 8
  )
  return new Uint8Array(bits)
}

/** إنشاء بصمة مشفّرة جديدة: pbkdf2$iterations$salt$hash */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derive(password, salt, ITERATIONS)
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** التحقق من كلمة المرور مقابل البصمة المخزّنة. */
export async function verifyPassword(password: string, stored?: string | null): Promise<boolean> {
  if (!stored) return false
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iterations = Number(parts[1])
  if (!Number.isFinite(iterations) || iterations < 10_000 || iterations > 2_000_000) return false
  try {
    const salt = fromBase64(parts[2])
    const actual = toBase64(await derive(password, salt, iterations))
    return safeEqual(actual, parts[3])
  } catch {
    return false
  }
}

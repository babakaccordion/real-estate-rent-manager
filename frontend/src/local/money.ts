/** وحدات نقدية دقيقة: نخزّن المبالغ كأعداد صحيحة من فئة 1/10000 لتجنّب أخطاء الفاصلة العائمة. */
export const SCALE = 10000

export const toU = (v: unknown): number => Math.round((Number(v) || 0) * SCALE)
export const fromU = (u: number): number => u / SCALE

/** يقرّب المبلغ إلى 4 منازل عشرية كما في قاعدة البيانات (Numeric(18,4)). */
export const money = (v: unknown): number => fromU(toU(v))

export const addMoney = (...vals: unknown[]): number => fromU(vals.reduce<number>((s, v) => s + toU(v), 0))
export const subMoney = (a: unknown, b: unknown): number => fromU(toU(a) - toU(b))
export const sumMoney = (vals: unknown[]): number => vals.reduce<number>((s, v) => s + toU(v), 0) / SCALE
export const minMoney = (a: unknown, b: unknown): number => (toU(a) <= toU(b) ? money(a) : money(b))
export const gteMoney = (a: unknown, b: unknown): boolean => toU(a) >= toU(b)
export const lteMoney = (a: unknown, b: unknown): boolean => toU(a) <= toU(b)

/** نص المبلغ (من وحدات 1/10000) بنفس شكل الخادم (Decimal) لاستخدامه في التقارير. */
export const moneyStr = (u: unknown): string => fromU(Math.round(Number(u) || 0)).toFixed(4)

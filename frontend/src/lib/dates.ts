const pad = (n: number) => String(n).padStart(2, '0')

/** تاريخ اليوم بالتوقيت المحلي بصيغة YYYY-MM-DD (بدون إزاحة UTC). */
export function localDateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** أول وآخر يوم في الشهر المحلي. */
export function monthRange(year: number, monthIndex: number): [string, string] {
  return [localDateKey(new Date(year, monthIndex, 1)), localDateKey(new Date(year, monthIndex + 1, 0))]
}

/** نطاق فترة جاهزة (اليوم/الشهر/السنة...) حسب التوقيت المحلي. */
export function periodRange(key: string): [string, string] {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  switch (key) {
    case 'today':
      return [localDateKey(now), localDateKey(now)]
    case 'month':
      return monthRange(y, m)
    case 'prevMonth':
      return monthRange(y, m - 1)
    case 'year':
      return [`${y}-01-01`, `${y}-12-31`]
    case 'prevYear':
      return [`${y - 1}-01-01`, `${y - 1}-12-31`]
    default:
      return monthRange(y, m)
  }
}

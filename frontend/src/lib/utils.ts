import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMoney(value: number | string, decimals = 3) {
  const n = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(n)) return '0'
  return n.toLocaleString('ar-JO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  try {
    const dt = new Date(d)
    return dt.toLocaleDateString('ar-JO', { year: 'numeric', month: '2-digit', day: '2-digit' })
  } catch {
    return d
  }
}
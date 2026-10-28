/**
 * أنواع البيانات للنسخة المحلية (تعمل داخل المتصفح بدون خادم).
 * جميع المبالغ مخزّنة كأعداد صحيحة بوحدة 1/10000 (انظر money.ts).
 */

export type Id = number

export interface Property {
  id: Id
  property_number: string
  name: string
  property_type: string
  address: string | null
  city: string | null
  district: string | null
  description: string | null
  units_count: number
  status: string
  notes: string | null
  created_at: string
}

export interface Unit {
  id: Id
  property_id: Id
  unit_number: string
  unit_type: string
  agreed_rent: number
  status: string
  current_tenant_id: Id | null
  notes: string | null
  lease_start: string | null
  lease_end: string | null
}

export interface Tenant {
  id: Id
  tenant_number: string
  full_name: string
  phone: string | null
  phone2: string | null
  id_number: string | null
  status: string
  notes: string | null
  credit_balance: number
  created_at: string
}

export interface Lease {
  id: Id
  tenant_id: Id
  property_id: Id
  unit_id: Id | null
  agreed_rent: number
  start_date: string
  end_date: string | null
  due_day: number
  frequency: string
  status: string
  notes: string | null
  created_at: string
}

export interface Charge {
  id: Id
  lease_id: Id
  property_id: Id
  tenant_id: Id
  period: string
  due_date: string
  amount_due: number
  amount_paid: number
  status: string
  cancel_reason: string | null
  created_at: string
}

export interface Payment {
  id: Id
  receipt_number: string
  tenant_id: Id
  property_id: Id | null
  amount: number
  payment_date: string
  method: string
  notes: string | null
  created_at: string
}

export interface Allocation {
  id: Id
  payment_id: Id
  charge_id: Id
  amount: number
}

export interface Expense {
  id: Id
  expense_number: string
  property_id: Id | null
  category: string
  amount: number
  expense_date: string
  description: string | null
  is_paid: boolean
  paid_date: string | null
  notes: string | null
  created_at: string
}

export interface Movement {
  id: Id
  movement_number: string
  movement_type: string
  /** المبلغ موقّع: مقبوضات + ومصاريف − */
  amount: number
  movement_date: string
  property_id: Id | null
  tenant_id: Id | null
  expense_id: Id | null
  payment_id: Id | null
  category: string | null
  description: string | null
  notes: string | null
  method: string | null
  receipt_ref: string | null
  created_at: string
}

export interface Note {
  id: Id
  entity_type: 'property' | 'tenant'
  entity_id: Id
  content: string
  created_at: string
}

export interface AuditEntry {
  id: Id
  user_id: Id | null
  username: string
  action: string
  entity_type: string
  entity_id: Id
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  created_at: string
}

export interface LocalUser {
  id: Id
  username: string
  password: string
  full_name: string
  role: string
}

export interface LocalDB {
  version: number
  counters: Record<string, number>
  users: LocalUser[]
  settings: Record<string, string>
  properties: Property[]
  units: Unit[]
  tenants: Tenant[]
  leases: Lease[]
  charges: Charge[]
  payments: Payment[]
  allocations: Allocation[]
  expenses: Expense[]
  movements: Movement[]
  notes: Note[]
  audit: AuditEntry[]
}

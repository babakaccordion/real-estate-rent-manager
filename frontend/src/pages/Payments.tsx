import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { useToast } from '../contexts/ToastContext'
import { Card, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input, Label } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Modal } from '../components/ui/Modal'
import { formatMoney, formatDate } from '../lib/utils'
import { localDateKey } from '../lib/dates'
import { Plus, Trash2 } from 'lucide-react'

export default function Payments() {
  const qc = useQueryClient()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<any>({ tenant_id: '', amount: '', payment_date: localDateKey(), method: 'cash', property_id: '', notes: '', charge_id: '' })
  const [filters, setFilters] = useState<any>({ property_id: '', tenant_id: '' })

  const { data: payments = [] } = useQuery({
    queryKey: ['payments', filters],
    queryFn: () => api.get('/payments', { params: Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')) }).then((r) => r.data),
  })
  const { data: tenants = [] } = useQuery({ queryKey: ['tenants'], queryFn: () => api.get('/tenants').then((r) => r.data) })
  const { data: props = [] } = useQuery({ queryKey: ['properties'], queryFn: () => api.get('/properties').then((r) => r.data) })

  const create = useMutation({
    mutationFn: (d: any) => api.post('/payments', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payments'] }); qc.invalidateQueries({ queryKey: ['charges'] }); setOpen(false); toast.show('تم تسجيل الدفعة') },
    onError: (e: any) => toast.show(e.response?.data?.detail || 'خطأ', 'error'),
  })
  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/payments/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payments'] }); qc.invalidateQueries({ queryKey: ['charges'] }); toast.show('تم حذف الدفعة') },
    onError: (e: any) => toast.show(e.response?.data?.detail || 'خطأ', 'error'),
  })

  const submit = () => {
    const payload: any = {
      tenant_id: parseInt(form.tenant_id),
      amount: parseFloat(form.amount),
      payment_date: form.payment_date,
      method: form.method,
      notes: form.notes,
    }
    if (form.property_id) payload.property_id = parseInt(form.property_id)
    if (form.charge_id) payload.charge_id = parseInt(form.charge_id)
    create.mutate(payload)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">المقبوضات</h2>
        <Button onClick={() => setOpen(true)}><Plus size={16} /> تسجيل دفعة</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Select value={filters.property_id} onChange={(e) => setFilters({ ...filters, property_id: e.target.value })} className="w-44">
          <option value="">كل العقارات</option>
          {props.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Select value={filters.tenant_id} onChange={(e) => setFilters({ ...filters, tenant_id: e.target.value })} className="w-44">
          <option value="">كل المستأجرين</option>
          {tenants.map((t: any) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
        </Select>
      </div>

      <Card>
        <CardContent className="py-4">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-gray-500"><th className="py-2 text-right">الإيصال</th><th className="py-2 text-right">المستأجر</th><th className="py-2 text-right">العقار</th><th className="py-2 text-right">التاريخ</th><th className="py-2 text-right">المبلغ</th><th className="py-2 text-right">الطريقة</th><th className="py-2 text-right">إجراءات</th></tr></thead>
            <tbody>
              {payments.map((p: any) => {
                const tenant = tenants.find((t: any) => t.id === p.tenant_id)
                const prop = props.find((pr: any) => pr.id === p.property_id)
                return (
                  <tr key={p.id} className="border-b">
                    <td className="py-2">{p.receipt_number}</td>
                    <td className="py-2">{tenant?.full_name || p.tenant_id}</td>
                    <td className="py-2">{prop?.name || '—'}</td>
                    <td className="py-2">{formatDate(p.payment_date)}</td>
                    <td className="py-2 font-mono-nums">{formatMoney(p.amount)}</td>
                    <td className="py-2">{p.method}</td>
                    <td className="py-2"><Button size="sm" variant="ghost" onClick={() => { if (confirm('حذف الدفعة؟')) del.mutate(p.id) }}><Trash2 size={14} /></Button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {payments.length === 0 && <div className="text-gray-400 text-sm py-6 text-center">لا توجد مقبوضات</div>}
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="تسجيل دفعة">
        <div className="space-y-3">
          <div>
            <Label>المستأجر *</Label>
            <Select value={form.tenant_id} onChange={(e) => setForm({ ...form, tenant_id: e.target.value })}>
              <option value="">اختر مستأجر</option>
              {tenants.map((t: any) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </Select>
          </div>
          <div><Label>المبلغ *</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
          <div><Label>تاريخ الدفع *</Label><Input type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} /></div>
          <div>
            <Label>العقار</Label>
            <Select value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })}>
              <option value="">—</option>
              {props.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>
          <div>
            <Label>طريقة الدفع</Label>
            <Select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              <option value="cash">نقدًا</option>
              <option value="bank">تحويل بنكي</option>
              <option value="other">أخرى</option>
            </Select>
          </div>
          <div><Label>ملاحظات</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={submit} disabled={create.isPending}>{create.isPending ? 'جارٍ...' : 'حفظ'}</Button>
        </div>
      </Modal>
    </div>
  )
}
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
import { XCircle } from 'lucide-react'

const STATUS_LABELS: Record<string,string> = { due:'مستحق', partial:'مدفوع جزئيًا', paid:'مدفوع بالكامل', overdue:'متأخر', cancelled:'ملغى' }

export default function Charges() {
  const qc = useQueryClient()
  const toast = useToast()
  const [filters, setFilters] = useState<any>({ property_id: '', tenant_id: '', status: '' })
  const [payOpen, setPayOpen] = useState(false)
  const [payForm, setPayForm] = useState<any>({ amount: '', payment_date: localDateKey(), method: 'cash', notes: '' })

  const { data: charges = [] } = useQuery({
    queryKey: ['charges', filters],
    queryFn: () => api.get('/charges', { params: Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')) }).then((r) => r.data),
  })
  const { data: tenants = [] } = useQuery({ queryKey: ['tenants'], queryFn: () => api.get('/tenants').then((r) => r.data) })
  const { data: props = [] } = useQuery({ queryKey: ['properties'], queryFn: () => api.get('/properties').then((r) => r.data) })

  const cancel = useMutation({
    mutationFn: (id: number) => api.post(`/charges/${id}/cancel`, { reason: 'إلغاء يدوي' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['charges'] }); toast.show('تم إلغاء الاستحقاق') },
  })

  const pay = useMutation({
    mutationFn: (d: any) => api.post('/payments', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['charges'] }); qc.invalidateQueries({ queryKey: ['payments'] }); setPayOpen(false); toast.show('تم تسجيل الدفعة') },
    onError: (e: any) => toast.show(e.response?.data?.detail || 'خطأ', 'error'),
  })

  const openPay = (c: any) => {
    const remaining = (c.amount_due - c.amount_paid)
    setPayForm({ amount: remaining.toFixed(3), payment_date: localDateKey(), method: 'cash', notes: '', charge_id: c.id, tenant_id: c.tenant_id, property_id: c.property_id })
    setPayOpen(true)
  }

  const submitPay = () => {
    pay.mutate({
      tenant_id: payForm.tenant_id,
      amount: parseFloat(payForm.amount),
      payment_date: payForm.payment_date,
      method: payForm.method,
      property_id: payForm.property_id,
      notes: payForm.notes,
      charge_id: payForm.charge_id,
    })
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-800">الاستحقاقات</h2>

      <div className="flex flex-wrap gap-2">
        <Select value={filters.property_id} onChange={(e) => setFilters({ ...filters, property_id: e.target.value })} className="w-44">
          <option value="">كل العقارات</option>
          {props.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Select value={filters.tenant_id} onChange={(e) => setFilters({ ...filters, tenant_id: e.target.value })} className="w-44">
          <option value="">كل المستأجرين</option>
          {tenants.map((t: any) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
        </Select>
        <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="w-40">
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </div>

      <Card>
        <CardContent className="py-4">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-gray-500"><th className="py-2 text-right">الفترة</th><th className="py-2 text-right">المستأجر</th><th className="py-2 text-right">العقار</th><th className="py-2 text-right">الاستحقاق</th><th className="py-2 text-right">المستحق</th><th className="py-2 text-right">المدفوع</th><th className="py-2 text-right">المتبقي</th><th className="py-2 text-right">الحالة</th><th className="py-2 text-right">إجراءات</th></tr></thead>
            <tbody>
              {charges.map((c: any) => {
                const tenant = tenants.find((t: any) => t.id === c.tenant_id)
                const prop = props.find((p: any) => p.id === c.property_id)
                return (
                  <tr key={c.id} className="border-b">
                    <td className="py-2">{c.period}</td>
                    <td className="py-2">{tenant?.full_name || c.tenant_id}</td>
                    <td className="py-2">{prop?.name || c.property_id}</td>
                    <td className="py-2">{formatDate(c.due_date)}</td>
                    <td className="py-2 font-mono-nums">{formatMoney(c.amount_due)}</td>
                    <td className="py-2 font-mono-nums">{formatMoney(c.amount_paid)}</td>
                    <td className="py-2 font-mono-nums">{formatMoney(c.amount_due - c.amount_paid)}</td>
                    <td className="py-2">{STATUS_LABELS[c.status]}</td>
                    <td className="py-2 flex gap-1">
                      {c.status !== 'paid' && c.status !== 'cancelled' && (
                        <Button size="sm" onClick={() => openPay(c)}>تسجيل دفعة</Button>
                      )}
                      {c.status !== 'cancelled' && c.status !== 'paid' && (
                        <Button size="sm" variant="ghost" onClick={() => cancel.mutate(c.id)}><XCircle size={14} /></Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {charges.length === 0 && <div className="text-gray-400 text-sm py-6 text-center">لا توجد استحقاقات</div>}
        </CardContent>
      </Card>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="تسجيل دفعة">
        <div className="space-y-3">
          <div><Label>المبلغ</Label><Input type="number" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} /></div>
          <div><Label>تاريخ الدفع</Label><Input type="date" value={payForm.payment_date} onChange={(e) => setPayForm({ ...payForm, payment_date: e.target.value })} /></div>
          <div>
            <Label>طريقة الدفع</Label>
            <Select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
              <option value="cash">نقدًا</option>
              <option value="bank">تحويل بنكي</option>
              <option value="other">أخرى</option>
            </Select>
          </div>
          <div><Label>ملاحظات</Label><Input value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} /></div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setPayOpen(false)}>إلغاء</Button>
          <Button onClick={submitPay} disabled={pay.isPending}>{pay.isPending ? 'جارٍ...' : 'حفظ'}</Button>
        </div>
      </Modal>
    </div>
  )
}
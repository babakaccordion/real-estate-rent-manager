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

const TYPE_LABELS: Record<string,string> = { opening_balance:'رصيد افتتاحي', rent_receipt:'قبض إيجار', expense:'مصروف', adjustment:'تسوية', other:'أخرى' }

export default function Cash() {
  const qc = useQueryClient()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [filters, setFilters] = useState<any>({ property_id: '' })
  const [form, setForm] = useState<any>({ movement_type: 'opening_balance', amount: '', movement_date: localDateKey(), property_id: '', category: '', description: '', notes: '', method: '', receipt_ref: '' })

  const { data: movements = [] } = useQuery({
    queryKey: ['cash', filters],
    queryFn: () => api.get('/cash', { params: Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')) }).then((r) => r.data),
  })
  const { data: props = [] } = useQuery({ queryKey: ['properties'], queryFn: () => api.get('/properties').then((r) => r.data) })

  const create = useMutation({
    mutationFn: (d: any) => api.post('/cash', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cash'] }); setOpen(false); toast.show('تم تسجيل الحركة') },
    onError: (e: any) => toast.show(e.response?.data?.detail || 'خطأ', 'error'),
  })
  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/cash/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cash'] }); toast.show('تم حذف الحركة') },
  })

  const submit = () => {
    const payload: any = {
      movement_type: form.movement_type,
      amount: parseFloat(form.amount),
      movement_date: form.movement_date,
      property_id: form.property_id ? parseInt(form.property_id) : null,
      category: form.category || null,
      description: form.description || null,
      notes: form.notes || null,
      method: form.method || null,
      receipt_ref: form.receipt_ref || null,
    }
    create.mutate(payload)
  }

  // balance calc
  const balance = movements.reduce((s: number, m: any) => s + m.amount, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">الصندوق والحركة المالية</h2>
        <Button onClick={() => setOpen(true)}><Plus size={16} /> حركة جديدة</Button>
      </div>
      <Select value={filters.property_id} onChange={(e) => setFilters({ ...filters, property_id: e.target.value })} className="w-44">
        <option value="">كل العقارات</option>
        {props.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </Select>

      <Card>
        <CardContent className="py-4">
          <div className="text-sm text-gray-500">الرصيد (بحسب الحركات المفلترة) = <span className="font-bold text-[#1e3a5f]">{formatMoney(balance)}</span></div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-gray-500"><th className="py-2 text-right">الرقم</th><th className="py-2 text-right">التاريخ</th><th className="py-2 text-right">النوع</th><th className="py-2 text-right">المبلغ</th><th className="py-2 text-right">التصنيف</th><th className="py-2 text-right">الوصف</th><th className="py-2 text-right">إجراءات</th></tr></thead>
            <tbody>
              {movements.map((m: any) => (
                <tr key={m.id} className="border-b">
                  <td className="py-2">{m.movement_number}</td>
                  <td className="py-2">{formatDate(m.movement_date)}</td>
                  <td className="py-2">{TYPE_LABELS[m.movement_type]}</td>
                  <td className={`py-2 font-mono-nums ${m.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatMoney(m.amount)}</td>
                  <td className="py-2">{m.category || '—'}</td>
                  <td className="py-2">{m.description || '—'}</td>
                  <td className="py-2"><Button size="sm" variant="ghost" onClick={() => { if (confirm('حذف؟')) del.mutate(m.id) }}><Trash2 size={14} /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {movements.length === 0 && <div className="text-gray-400 text-sm py-6 text-center">لا توجد حركات</div>}
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="حركة مالية جديدة">
        <div className="space-y-3">
          <div>
            <Label>نوع الحركة</Label>
            <Select value={form.movement_type} onChange={(e) => setForm({ ...form, movement_type: e.target.value })}>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </div>
          <div><Label>المبلغ</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
          <div><Label>التاريخ</Label><Input type="date" value={form.movement_date} onChange={(e) => setForm({ ...form, movement_date: e.target.value })} /></div>
          <div>
            <Label>العقار (اختياري)</Label>
            <Select value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })}>
              <option value="">— عام —</option>
              {props.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>
          <div><Label>التصنيف</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
          <div><Label>الوصف</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
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
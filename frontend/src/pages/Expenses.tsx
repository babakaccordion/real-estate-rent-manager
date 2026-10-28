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

const CAT_LABELS: Record<string,string> = { maintenance:'صيانة', repair:'إصلاح أعطال', utilities:'أجور خدمات', water_electric:'فواتير المياه والكهرباء', taxes_fees:'رسوم وضرائب', cleaning:'تنظيف', other:'أخرى' }

export default function Expenses() {
  const qc = useQueryClient()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [filters, setFilters] = useState<any>({ property_id: '' })
  const [form, setForm] = useState<any>({ property_id: '', category: 'other', amount: '', expense_date: localDateKey(), description: '', is_paid: true, notes: '' })

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', filters],
    queryFn: () => api.get('/expenses', { params: Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')) }).then((r) => r.data),
  })
  const { data: props = [] } = useQuery({ queryKey: ['properties'], queryFn: () => api.get('/properties').then((r) => r.data) })

  const create = useMutation({
    mutationFn: (d: any) => api.post('/expenses', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['cash'] }); setOpen(false); toast.show('تم تسجيل المصروف') },
    onError: (e: any) => toast.show(e.response?.data?.detail || 'خطأ', 'error'),
  })
  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/expenses/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); toast.show('تم حذف المصروف') },
  })

  const submit = () => {
    const payload: any = {
      property_id: form.property_id ? parseInt(form.property_id) : null,
      category: form.category,
      amount: parseFloat(form.amount),
      expense_date: form.expense_date,
      description: form.description,
      is_paid: form.is_paid,
      notes: form.notes,
    }
    create.mutate(payload)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">المصاريف</h2>
        <Button onClick={() => setOpen(true)}><Plus size={16} /> تسجيل مصروف</Button>
      </div>
      <Select value={filters.property_id} onChange={(e) => setFilters({ ...filters, property_id: e.target.value })} className="w-44">
        <option value="">كل العقارات (بما فيها العامة)</option>
        {props.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </Select>

      <Card>
        <CardContent className="py-4">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-gray-500"><th className="py-2 text-right">التاريخ</th><th className="py-2 text-right">العقار</th><th className="py-2 text-right">التصنيف</th><th className="py-2 text-right">المبلغ</th><th className="py-2 text-right">الحالة</th><th className="py-2 text-right">الوصف</th><th className="py-2 text-right">إجراءات</th></tr></thead>
            <tbody>
              {expenses.map((e: any) => {
                const prop = props.find((p: any) => p.id === e.property_id)
                return (
                  <tr key={e.id} className="border-b">
                    <td className="py-2">{formatDate(e.expense_date)}</td>
                    <td className="py-2">{prop?.name || 'عام'}</td>
                    <td className="py-2">{CAT_LABELS[e.category]}</td>
                    <td className="py-2 font-mono-nums">{formatMoney(e.amount)}</td>
                    <td className="py-2">{e.is_paid ? 'مدفوع' : 'غير مدفوع'}</td>
                    <td className="py-2">{e.description}</td>
                    <td className="py-2"><Button size="sm" variant="ghost" onClick={() => { if (confirm('حذف؟')) del.mutate(e.id) }}><Trash2 size={14} /></Button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {expenses.length === 0 && <div className="text-gray-400 text-sm py-6 text-center">لا توجد مصاريف</div>}
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="تسجيل مصروف">
        <div className="space-y-3">
          <div>
            <Label>العقار (اختياري)</Label>
            <Select value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })}>
              <option value="">— عام (غير مرتبط) —</option>
              {props.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>
          <div>
            <Label>التصنيف</Label>
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {Object.entries(CAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </div>
          <div><Label>المبلغ *</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
          <div><Label>التاريخ *</Label><Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} /></div>
          <div>
            <Label>مدفوع؟</Label>
            <Select value={form.is_paid ? '1' : '0'} onChange={(e) => setForm({ ...form, is_paid: e.target.value === '1' })}>
              <option value="1">مدفوع</option>
              <option value="0">غير مدفوع</option>
            </Select>
          </div>
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
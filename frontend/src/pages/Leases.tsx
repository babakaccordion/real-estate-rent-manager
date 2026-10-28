import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { useToast } from '../contexts/ToastContext'
import { Card, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input, Label } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Modal } from '../components/ui/Modal'
import { Plus } from 'lucide-react'
import { formatMoney, formatDate } from '../lib/utils'

const STATUS_LABELS: Record<string,string> = { active:'نشط', ended:'منتهٍ', cancelled:'ملغى' }

export default function Leases() {
  const qc = useQueryClient()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<any>({ tenant_id: '', property_id: '', unit_id: '', agreed_rent: '', start_date: '', end_date: '', due_day: 1, frequency: 'monthly', notes: '' })

  const { data: leases = [] } = useQuery({ queryKey: ['leases'], queryFn: () => api.get('/leases').then((r) => r.data) })
  const { data: tenants = [] } = useQuery({ queryKey: ['tenants'], queryFn: () => api.get('/tenants').then((r) => r.data) })
  const { data: props = [] } = useQuery({ queryKey: ['properties'], queryFn: () => api.get('/properties').then((r) => r.data) })

  const create = useMutation({
    mutationFn: (d: any) => api.post('/leases', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leases'] }); qc.invalidateQueries({ queryKey: ['charges'] }); setOpen(false); toast.show('تم إضافة العقد وإنشاء الاستحقاقات') },
    onError: (e: any) => toast.show(e.response?.data?.detail || 'خطأ', 'error'),
  })

  const submit = () => {
    const payload: any = {
      tenant_id: parseInt(form.tenant_id),
      property_id: parseInt(form.property_id),
      agreed_rent: parseFloat(form.agreed_rent) || 0,
      start_date: form.start_date,
      due_day: parseInt(form.due_day) || 1,
      frequency: form.frequency,
      notes: form.notes,
    }
    if (form.unit_id) payload.unit_id = parseInt(form.unit_id)
    if (form.end_date) payload.end_date = form.end_date
    create.mutate(payload)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">العقود</h2>
        <Button onClick={() => setOpen(true)}><Plus size={16} /> إضافة عقد</Button>
      </div>

      <Card>
        <CardContent className="py-4">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-gray-500"><th className="py-2 text-right">العقد</th><th className="py-2 text-right">المستأجر</th><th className="py-2 text-right">العقار</th><th className="py-2 text-right">الإيجار</th><th className="py-2 text-right">البداية</th><th className="py-2 text-right">النهاية</th><th className="py-2 text-right">الحالة</th></tr></thead>
            <tbody>
              {leases.map((l: any) => {
                const tenant = tenants.find((t: any) => t.id === l.tenant_id)
                const prop = props.find((p: any) => p.id === l.property_id)
                return (
                  <tr key={l.id} className="border-b">
                    <td className="py-2">#{l.id}</td>
                    <td className="py-2">{tenant?.full_name || l.tenant_id}</td>
                    <td className="py-2">{prop?.name || l.property_id}</td>
                    <td className="py-2 font-mono-nums">{formatMoney(l.agreed_rent)}</td>
                    <td className="py-2">{formatDate(l.start_date)}</td>
                    <td className="py-2">{l.end_date ? formatDate(l.end_date) : '—'}</td>
                    <td className="py-2">{STATUS_LABELS[l.status]}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {leases.length === 0 && <div className="text-gray-400 text-sm py-6 text-center">لا توجد عقود</div>}
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="إضافة عقد إيجار" size="lg">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>المستأجر *</Label>
            <Select value={form.tenant_id} onChange={(e) => setForm({ ...form, tenant_id: e.target.value })}>
              <option value="">اختر مستأجر</option>
              {tenants.map((t: any) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </Select>
          </div>
          <div>
            <Label>العقار *</Label>
            <Select value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })}>
              <option value="">اختر عقار</option>
              {props.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>
          <div><Label>قيمة الإيجار *</Label><Input type="number" value={form.agreed_rent} onChange={(e) => setForm({ ...form, agreed_rent: e.target.value })} /></div>
          <div><Label>يوم الاستحقاق</Label><Input type="number" value={form.due_day} onChange={(e) => setForm({ ...form, due_day: e.target.value })} /></div>
          <div><Label>بداية الإيجار *</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
          <div><Label>نهاية العقد</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
          <div>
            <Label>الدورية</Label>
            <Select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
              <option value="monthly">شهري</option>
              <option value="quarterly">ربع سنوي</option>
              <option value="yearly">سنوي</option>
            </Select>
          </div>
          <div><Label>ملاحظات</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={submit} disabled={create.isPending}>{create.isPending ? 'جارٍ الحفظ...' : 'حفظ وإنشاء الاستحقاقات'}</Button>
        </div>
      </Modal>
    </div>
  )
}
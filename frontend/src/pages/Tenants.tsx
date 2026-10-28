import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { useToast } from '../contexts/ToastContext'
import { Card, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input, Label } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Modal } from '../components/ui/Modal'
import { Link } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'

const STATUS_LABELS: Record<string,string> = { active:'نشط', former:'سابق', inactive:'غير نشط' }

export default function Tenants() {
  const qc = useQueryClient()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<any>({ full_name: '', phone: '', phone2: '', id_number: '', status: 'active', notes: '', property_id: '', unit_id: '', agreed_rent: '', lease_start: '', lease_end: '', due_day: 1 })

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants', search],
    queryFn: () => api.get('/tenants', { params: search ? { search } : {} }).then((r) => r.data),
  })
  const { data: props = [] } = useQuery({ queryKey: ['properties'], queryFn: () => api.get('/properties').then((r) => r.data) })

  const create = useMutation({
    mutationFn: (d: any) => api.post('/tenants', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenants'] }); setOpen(false); toast.show('تم إضافة المستأجر') },
    onError: (e: any) => toast.show(e.response?.data?.detail || 'خطأ', 'error'),
  })

  const submit = () => {
    const payload: any = { full_name: form.full_name, phone: form.phone, phone2: form.phone2, id_number: form.id_number, status: form.status, notes: form.notes }
    if (form.property_id) {
      payload.property_id = parseInt(form.property_id)
      payload.agreed_rent = parseFloat(form.agreed_rent) || 0
      payload.due_day = parseInt(form.due_day) || 1
      if (form.unit_id) payload.unit_id = parseInt(form.unit_id)
      if (form.lease_start) payload.lease_start = form.lease_start
      if (form.lease_end) payload.lease_end = form.lease_end
    }
    create.mutate(payload)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">المستأجرون</h2>
        <Button onClick={() => setOpen(true)}><Plus size={16} /> إضافة مستأجر</Button>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input className="pr-9" placeholder="بحث بالاسم أو الهاتف..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardContent className="py-4">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-gray-500"><th className="py-2 text-right">الرقم</th><th className="py-2 text-right">الاسم</th><th className="py-2 text-right">الهاتف</th><th className="py-2 text-right">الحالة</th><th className="py-2 text-right">الرصيد الدائن</th></tr></thead>
            <tbody>
              {tenants.map((t: any) => (
                <tr key={t.id} className="border-b hover:bg-gray-50">
                  <td className="py-2">{t.tenant_number}</td>
                  <td className="py-2"><Link to={`/tenants/${t.id}`} className="text-[#1e3a5f] hover:underline">{t.full_name}</Link></td>
                  <td className="py-2">{t.phone}</td>
                  <td className="py-2">{STATUS_LABELS[t.status]}</td>
                  <td className="py-2 font-mono-nums">{t.credit_balance}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {tenants.length === 0 && <div className="text-gray-400 text-sm py-6 text-center">لا يوجد مستأجرون</div>}
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="إضافة مستأجر" size="lg">
        <div className="grid md:grid-cols-2 gap-3">
          <div><Label>الاسم الكامل *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div><Label>الهاتف</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><Label>هاتف إضافي</Label><Input value={form.phone2} onChange={(e) => setForm({ ...form, phone2: e.target.value })} /></div>
          <div><Label>رقم الهوية</Label><Input value={form.id_number} onChange={(e) => setForm({ ...form, id_number: e.target.value })} /></div>
          <div>
            <Label>الحالة</Label>
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </div>
          <div>
            <Label>العقار (اختياري)</Label>
            <Select value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })}>
              <option value="">— بدون عقار —</option>
              {props.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>
          {form.property_id && (
            <>
              <div><Label>قيمة الإيجار</Label><Input type="number" value={form.agreed_rent} onChange={(e) => setForm({ ...form, agreed_rent: e.target.value })} /></div>
              <div><Label>يوم الاستحقاق</Label><Input type="number" value={form.due_day} onChange={(e) => setForm({ ...form, due_day: e.target.value })} /></div>
              <div><Label>بداية الإيجار</Label><Input type="date" value={form.lease_start} onChange={(e) => setForm({ ...form, lease_start: e.target.value })} /></div>
              <div><Label>نهاية العقد</Label><Input type="date" value={form.lease_end} onChange={(e) => setForm({ ...form, lease_end: e.target.value })} /></div>
            </>
          )}
          <div className="md:col-span-2"><Label>ملاحظات</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={submit} disabled={create.isPending}>{create.isPending ? 'جارٍ الحفظ...' : 'حفظ'}</Button>
        </div>
      </Modal>
    </div>
  )
}
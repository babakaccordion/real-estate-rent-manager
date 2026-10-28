import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { useToast } from '../contexts/ToastContext'
import { Card, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input, Label } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Modal } from '../components/ui/Modal'
import { Building2, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'

// labels
const TYPE_LABELS: Record<string,string> = { apartment:'شقة', building:'عمارة', house:'منزل', shop:'محل تجاري', office:'مكتب', warehouse:'مستودع', land:'أرض', other:'أخرى' }
const STATUS_LABELS: Record<string,string> = { rented:'مؤجر', partial:'مؤجر جزئيًا', vacant:'شاغر', inactive:'غير نشط' }

export default function Properties() {
  const qc = useQueryClient()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<any>({ name: '', property_type: 'other', address: '', city: '', district: '', units_count: 1, status: 'vacant', notes: '' })

  const { data: props = [], isLoading } = useQuery({
    queryKey: ['properties'],
    queryFn: () => api.get('/properties').then((r) => r.data),
  })

  const create = useMutation({
    mutationFn: (d: any) => api.post('/properties', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['properties'] }); setOpen(false); toast.show('تم إضافة العقار') },
    onError: (e: any) => toast.show(e.response?.data?.detail || 'خطأ', 'error'),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">العقارات</h2>
        <Button onClick={() => setOpen(true)}><Plus size={16} /> إضافة عقار</Button>
      </div>

      {isLoading ? <div>جارٍ التحميل...</div> : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {props.map((p: any) => (
            <Card key={p.id} className="hover:shadow-md transition">
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-gray-400">{p.property_number}</div>
                    <Link to={`/properties/${p.id}`} className="text-lg font-semibold text-[#1e3a5f] hover:underline">{p.name}</Link>
                    <div className="text-sm text-gray-500 mt-1">{TYPE_LABELS[p.property_type]} — {p.city || ''}</div>
                  </div>
                  <Building2 className="text-gray-300" />
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-gray-500">الوحدات: {p.units_count}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${p.status === 'rented' ? 'bg-green-100 text-green-700' : p.status === 'vacant' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABELS[p.status]}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
          {props.length === 0 && <div className="col-span-full text-center text-gray-400 py-10">لا توجد عقارات. ابدأ بإضافة عقار جديد.</div>}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="إضافة عقار جديد" size="lg">
        <div className="grid md:grid-cols-2 gap-3">
          <div><Label>اسم العقار *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div>
            <Label>نوع العقار</Label>
            <Select value={form.property_type} onChange={(e) => setForm({ ...form, property_type: e.target.value })}>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </div>
          <div><Label>المدينة</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          <div><Label>المنطقة</Label><Input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>العنوان بالتفصيل</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div><Label>عدد الوحدات</Label><Input type="number" value={form.units_count} onChange={(e) => setForm({ ...form, units_count: parseInt(e.target.value) || 1 })} /></div>
          <div>
            <Label>الحالة</Label>
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </div>
          <div className="md:col-span-2"><Label>ملاحظات</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={() => create.mutate(form)} disabled={create.isPending}>{create.isPending ? 'جارٍ الحفظ...' : 'حفظ'}</Button>
        </div>
      </Modal>
    </div>
  )
}
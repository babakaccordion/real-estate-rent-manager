import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { useToast } from '../contexts/ToastContext'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { formatMoney, formatDate } from '../lib/utils'
import { ArrowRight } from 'lucide-react'

export default function TenantDetail() {
  const { id } = useParams()
  const qc = useQueryClient()
  const toast = useToast()
  const [noteText, setNoteText] = useState('')
  const { data: tenant } = useQuery({ queryKey: ['tenant', id], queryFn: () => api.get(`/tenants/${id}`).then((r) => r.data) })
  const { data: charges = [] } = useQuery({ queryKey: ['charges', 't', id], queryFn: () => api.get('/charges', { params: { tenant_id: id } }).then((r) => r.data) })
  const { data: payments = [] } = useQuery({ queryKey: ['payments', 't', id], queryFn: () => api.get('/payments', { params: { tenant_id: id } }).then((r) => r.data) })

  const addNote = useMutation({
    mutationFn: (content: string) => api.post(`/tenants/${id}/notes`, null, { params: { content } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenant', id] }); setNoteText(''); toast.show('تم إضافة الملاحظة') },
    onError: (e: any) => toast.show(e.response?.data?.detail || 'خطأ', 'error'),
  })

  if (!tenant) return <div>جارٍ التحميل...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/tenants" className="hover:text-[#1e3a5f]">المستأجرون</Link>
        <ArrowRight size={14} />
        <span className="text-gray-800">{tenant.full_name}</span>
      </div>

      <Card>
        <CardContent className="py-4">
          <h2 className="text-2xl font-bold text-[#1e3a5f]">{tenant.full_name}</h2>
          <div className="text-xs text-gray-400">{tenant.tenant_number}</div>
          <div className="grid md:grid-cols-2 gap-3 mt-3 text-sm">
            <div><span className="text-gray-500">الهاتف:</span> {tenant.phone}</div>
            <div><span className="text-gray-500">هاتف إضافي:</span> {tenant.phone2}</div>
            <div><span className="text-gray-500">رقم الهوية:</span> {tenant.id_number}</div>
            <div><span className="text-gray-500">الحالة:</span> {tenant.status}</div>
            <div><span className="text-gray-500">الرصيد الدائن:</span> {formatMoney(tenant.credit_balance)}</div>
            {tenant.notes && <div className="md:col-span-2"><span className="text-gray-500">ملاحظات:</span> {tenant.notes}</div>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>العقود</CardTitle></CardHeader>
        <CardContent>
          {tenant.leases?.map((l: any) => (
            <div key={l.id} className="border-b py-2 text-sm">
              عقد #{l.id} — عقار {l.property_id} — إيجار {formatMoney(l.agreed_rent)} — من {formatDate(l.start_date)} إلى {l.end_date ? formatDate(l.end_date) : '—'} — {l.status}
            </div>
          ))}
          {(!tenant.leases || tenant.leases.length === 0) && <div className="text-gray-400 text-sm">لا توجد عقود</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>الاستحقاقات</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-gray-500"><th className="py-2 text-right">الفترة</th><th className="py-2 text-right">المستحق</th><th className="py-2 text-right">المدفوع</th><th className="py-2 text-right">الحالة</th></tr></thead>
            <tbody>
              {charges.map((c: any) => (
                <tr key={c.id} className="border-b">
                  <td className="py-2">{c.period}</td>
                  <td className="py-2 font-mono-nums">{formatMoney(c.amount_due)}</td>
                  <td className="py-2 font-mono-nums">{formatMoney(c.amount_paid)}</td>
                  <td className="py-2">{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>المقبوضات</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-gray-500"><th className="py-2 text-right">الإيصال</th><th className="py-2 text-right">التاريخ</th><th className="py-2 text-right">المبلغ</th><th className="py-2 text-right">الطريقة</th></tr></thead>
            <tbody>
              {payments.map((p: any) => (
                <tr key={p.id} className="border-b">
                  <td className="py-2">{p.receipt_number}</td>
                  <td className="py-2">{formatDate(p.payment_date)}</td>
                  <td className="py-2 font-mono-nums">{formatMoney(p.amount)}</td>
                  <td className="py-2">{p.method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>الملاحظات</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-3">
            <Input value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="أضف ملاحظة..." />
            <Button onClick={() => { if (noteText.trim()) addNote.mutate(noteText) }}>إضافة</Button>
          </div>
          <div className="space-y-2">
            {tenant.notes_list?.map((n: any) => (
              <div key={n.id} className="border-b py-2 text-sm">
                <div>{n.content}</div>
                <div className="text-xs text-gray-400">{formatDate(n.created_at)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
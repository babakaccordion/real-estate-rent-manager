import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { Card, CardContent } from '../components/ui/Card'
import { formatMoney, formatDate } from '../lib/utils'
import { ArrowRight, Building2 } from 'lucide-react'

const TYPE_LABELS: Record<string,string> = { apartment:'شقة', building:'عمارة', house:'منزل', shop:'محل تجاري', office:'مكتب', warehouse:'مستودع', land:'أرض', other:'أخرى' }
const STATUS_LABELS: Record<string,string> = { rented:'مؤجر', partial:'مؤجر جزئيًا', vacant:'شاغر', inactive:'غير نشط' }

export default function PropertyDetail() {
  const { id } = useParams()
  const [tab, setTab] = useState('info')
  const { data: prop } = useQuery({ queryKey: ['property', id], queryFn: () => api.get(`/properties/${id}`).then((r) => r.data) })
  const { data: units = [] } = useQuery({ queryKey: ['units', id], queryFn: () => api.get(`/properties/${id}/units`).then((r) => r.data) })
  const { data: notes = [] } = useQuery({ queryKey: ['propnotes', id], queryFn: () => api.get(`/properties/${id}/notes`).then((r) => r.data) })
  const { data: charges = [] } = useQuery({ queryKey: ['charges', id], queryFn: () => api.get('/charges', { params: { property_id: id } }).then((r) => r.data) })
  const { data: payments = [] } = useQuery({ queryKey: ['payments', id], queryFn: () => api.get('/payments', { params: { property_id: id } }).then((r) => r.data) })
  const { data: expenses = [] } = useQuery({ queryKey: ['expenses', id], queryFn: () => api.get('/expenses', { params: { property_id: id } }).then((r) => r.data) })

  if (!prop) return <div>جارٍ التحميل...</div>

  const tabs = ['info', 'units', 'charges', 'payments', 'expenses', 'notes']

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/properties" className="hover:text-[#1e3a5f]">العقارات</Link>
        <ArrowRight size={14} />
        <span className="text-gray-800">{prop.name}</span>
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-gray-400">{prop.property_number}</div>
              <h2 className="text-2xl font-bold text-[#1e3a5f]">{prop.name}</h2>
              <div className="text-sm text-gray-500 mt-1">{TYPE_LABELS[prop.property_type]} — {prop.city} {prop.district}</div>
              {prop.address && <div className="text-sm text-gray-500">{prop.address}</div>}
            </div>
            <Building2 size={32} className="text-gray-200" />
          </div>
          <div className="mt-3 flex gap-2">
            <span className={`px-2 py-0.5 rounded text-xs ${prop.status === 'rented' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{STATUS_LABELS[prop.status]}</span>
            <span className="text-xs text-gray-400">الوحدات: {prop.units_count}</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-sm ${tab === t ? 'bg-[#1e3a5f] text-white' : 'bg-white border border-gray-200'}`}>
            {t === 'info' ? 'معلومات' : t === 'units' ? 'الوحدات' : t === 'charges' ? 'الاستحقاقات' : t === 'payments' ? 'المقبوضات' : t === 'expenses' ? 'المصاريف' : 'الملاحظات'}
          </button>
        ))}
      </div>

      {tab === 'units' && (
        <Card>
          <CardContent className="py-4">
            {units.length === 0 ? <div className="text-gray-400">لا توجد وحدات</div> : (
              <table className="w-full text-sm">
                <thead><tr className="border-b text-gray-500"><th className="py-2 text-right">الوحدة</th><th className="py-2 text-right">النوع</th><th className="py-2 text-right">الإيجار</th><th className="py-2 text-right">الحالة</th></tr></thead>
                <tbody>
                  {units.map((u: any) => (
                    <tr key={u.id} className="border-b">
                      <td className="py-2">{u.unit_number}</td>
                      <td className="py-2">{u.unit_type}</td>
                      <td className="py-2 font-mono-nums">{formatMoney(u.agreed_rent)}</td>
                      <td className="py-2">{u.status === 'occupied' ? 'مشغولة' : 'شاغرة'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'charges' && (
        <Card>
          <CardContent className="py-4">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-gray-500"><th className="py-2 text-right">الفترة</th><th className="py-2 text-right">الاستحقاق</th><th className="py-2 text-right">المستحق</th><th className="py-2 text-right">المدفوع</th><th className="py-2 text-right">الحالة</th></tr></thead>
              <tbody>
                {charges.map((c: any) => (
                  <tr key={c.id} className="border-b">
                    <td className="py-2">{c.period}</td>
                    <td className="py-2">{formatDate(c.due_date)}</td>
                    <td className="py-2 font-mono-nums">{formatMoney(c.amount_due)}</td>
                    <td className="py-2 font-mono-nums">{formatMoney(c.amount_paid)}</td>
                    <td className="py-2">{c.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {charges.length === 0 && <div className="text-gray-400 text-sm py-4">لا توجد استحقاقات</div>}
          </CardContent>
        </Card>
      )}

      {tab === 'payments' && (
        <Card>
          <CardContent className="py-4">
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
            {payments.length === 0 && <div className="text-gray-400 text-sm py-4">لا توجد مقبوضات</div>}
          </CardContent>
        </Card>
      )}

      {tab === 'expenses' && (
        <Card>
          <CardContent className="py-4">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-gray-500"><th className="py-2 text-right">التاريخ</th><th className="py-2 text-right">التصنيف</th><th className="py-2 text-right">المبلغ</th><th className="py-2 text-right">الحالة</th><th className="py-2 text-right">الوصف</th></tr></thead>
              <tbody>
                {expenses.map((e: any) => (
                  <tr key={e.id} className="border-b">
                    <td className="py-2">{formatDate(e.expense_date)}</td>
                    <td className="py-2">{e.category}</td>
                    <td className="py-2 font-mono-nums">{formatMoney(e.amount)}</td>
                    <td className="py-2">{e.is_paid ? 'مدفوع' : 'غير مدفوع'}</td>
                    <td className="py-2">{e.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {expenses.length === 0 && <div className="text-gray-400 text-sm py-4">لا توجد مصاريف</div>}
          </CardContent>
        </Card>
      )}

      {tab === 'notes' && (
        <Card>
          <CardContent className="py-4 space-y-2">
            {notes.map((n: any) => (
              <div key={n.id} className="border-b py-2">
                <div className="text-sm">{n.content}</div>
                <div className="text-xs text-gray-400">{formatDate(n.created_at)}</div>
              </div>
            ))}
            {notes.length === 0 && <div className="text-gray-400 text-sm">لا توجد ملاحظات</div>}
          </CardContent>
        </Card>
      )}

      {tab === 'info' && (
        <Card>
          <CardContent className="py-4">
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">الاسم:</span> {prop.name}</div>
              <div><span className="text-gray-500">النوع:</span> {TYPE_LABELS[prop.property_type]}</div>
              <div><span className="text-gray-500">المدينة:</span> {prop.city}</div>
              <div><span className="text-gray-500">المنطقة:</span> {prop.district}</div>
              <div className="md:col-span-2"><span className="text-gray-500">العنوان:</span> {prop.address}</div>
              <div className="md:col-span-2"><span className="text-gray-500">الوصف:</span> {prop.description}</div>
              <div className="md:col-span-2"><span className="text-gray-500">ملاحظات:</span> {prop.notes}</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
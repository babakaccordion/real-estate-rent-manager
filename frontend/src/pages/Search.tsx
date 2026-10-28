import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { Card, CardContent } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Link } from 'react-router-dom'

export default function SearchPage() {
  const [q, setQ] = useState('')
  const [trigger, setTrigger] = useState('')
  const { data } = useQuery({
    queryKey: ['search', trigger],
    queryFn: () => api.get('/search', { params: { q: trigger } }).then((r) => r.data),
    enabled: !!trigger,
  })

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-800">البحث</h2>
      <div className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="اسم العقار، رقم العقار، عنوان، اسم المستأجر، هاتف، رقم المستأجر، رقم الإيصال، رقم الحركة..." />
        <Button onClick={() => setTrigger(q)}>بحث</Button>
      </div>

      {data && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card><CardContent className="py-4">
            <h3 className="font-semibold mb-2">العقارات</h3>
            {data.properties.map((p: any) => (
              <div key={p.id} className="py-1 text-sm"><Link to={`/properties/${p.id}`} className="text-[#1e3a5f] hover:underline">{p.name}</Link> — {p.property_number}</div>
            ))}
            {data.properties.length === 0 && <div className="text-gray-400 text-sm">لا نتائج</div>}
          </CardContent></Card>
          <Card><CardContent className="py-4">
            <h3 className="font-semibold mb-2">المستأجرون</h3>
            {data.tenants.map((t: any) => (
              <div key={t.id} className="py-1 text-sm"><Link to={`/tenants/${t.id}`} className="text-[#1e3a5f] hover:underline">{t.full_name}</Link> — {t.tenant_number} — {t.phone}</div>
            ))}
            {data.tenants.length === 0 && <div className="text-gray-400 text-sm">لا نتائج</div>}
          </CardContent></Card>
          <Card><CardContent className="py-4">
            <h3 className="font-semibold mb-2">المقبوضات</h3>
            {data.payments.map((p: any) => (
              <div key={p.id} className="py-1 text-sm">{p.receipt_number} — {p.amount}</div>
            ))}
            {data.payments.length === 0 && <div className="text-gray-400 text-sm">لا نتائج</div>}
          </CardContent></Card>
          <Card><CardContent className="py-4">
            <h3 className="font-semibold mb-2">الحركات</h3>
            {data.movements.map((m: any) => (
              <div key={m.id} className="py-1 text-sm">{m.movement_number} — {m.amount}</div>
            ))}
            {data.movements.length === 0 && <div className="text-gray-400 text-sm">لا نتائج</div>}
          </CardContent></Card>
        </div>
      )}
    </div>
  )
}
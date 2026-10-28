import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { Input } from '../components/ui/Input'
import { formatMoney, formatDate } from '../lib/utils'

function periodRange(key: string): [string, string] {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth()
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  switch (key) {
    case 'today': { const d = new Date(); return [fmt(d), fmt(d)] }
    case 'month': return [fmt(new Date(y, m, 1)), fmt(new Date(y, m + 1, 0))]
    case 'prevMonth': return [fmt(new Date(y, m - 1, 1)), fmt(new Date(y, m, 0))]
    case 'year': return [fmt(new Date(y, 0, 1)), fmt(new Date(y, 11, 31))]
    case 'prevYear': return [fmt(new Date(y - 1, 0, 1)), fmt(new Date(y - 1, 11, 31))]
    default: return [fmt(new Date(y, m, 1)), fmt(new Date(y, m + 1, 0))]
  }
}

export default function Reports() {
  const [kind, setKind] = useState('overall')
  const [period, setPeriod] = useState('month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [propId, setPropId] = useState('')
  const [tenantId, setTenantId] = useState('')

  const [start, end] = useMemo(() => {
    if (period === 'custom' && customStart && customEnd) return [customStart, customEnd]
    return periodRange(period)
  }, [period, customStart, customEnd])

  const { data: props = [] } = useQuery({ queryKey: ['properties'], queryFn: () => api.get('/properties').then((r) => r.data) })
  const { data: tenants = [] } = useQuery({ queryKey: ['tenants'], queryFn: () => api.get('/tenants').then((r) => r.data) })

  const { data: report, isLoading } = useQuery({
    queryKey: ['report', kind, start, end, propId, tenantId],
    queryFn: () => {
      if (kind === 'overall') return api.get('/reports/overall', { params: { start, end, property_id: propId || undefined } }).then((r) => r.data)
      if (kind === 'property' && propId) return api.get(`/reports/property/${propId}`, { params: { start, end } }).then((r) => r.data)
      if (kind === 'tenant' && tenantId) return api.get(`/reports/tenant/${tenantId}`, { params: { start, end } }).then((r) => r.data)
      if (kind === 'cash') return api.get('/reports/cash', { params: { start, end, property_id: propId || undefined } }).then((r) => r.data)
      if (kind === 'arrears') return api.get('/reports/arrears', { params: { end, property_id: propId || undefined } }).then((r) => r.data)
      if (kind === 'expenses') return api.get('/reports/expenses', { params: { start, end, property_id: propId || undefined } }).then((r) => r.data)
      if (kind === 'receipts') return api.get('/reports/receipts', { params: { start, end, property_id: propId || undefined } }).then((r) => r.data)
      return null
    },
    enabled: true,
  })

  const exportFile = (format: 'pdf' | 'excel' | 'csv') => {
    const params = new URLSearchParams({ kind: kind === 'property' ? 'property' : kind === 'overall' ? 'overall' : kind === 'cash' ? 'cash' : kind === 'arrears' ? 'arrears' : 'overall', start, end })
    if (propId) params.set('property_id', propId)
    const url = `/api/reports/export/${format}?${params.toString()}`
    window.open(url, '_blank')
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-800">التقارير</h2>

      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={kind} onChange={(e) => setKind(e.target.value)} className="w-44">
              <option value="overall">شامل (جميع العقارات)</option>
              <option value="property">عقار واحد</option>
              <option value="tenant">مستأجر</option>
              <option value="cash">حركة الصندوق</option>
              <option value="arrears">المتأخرات</option>
              <option value="expenses">المصاريف</option>
              <option value="receipts">المقبوضات</option>
            </Select>
            <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-40">
              <option value="today">اليوم</option>
              <option value="month">هذا الشهر</option>
              <option value="prevMonth">الشهر السابق</option>
              <option value="year">هذا العام</option>
              <option value="prevYear">العام السابق</option>
              <option value="custom">فترة مخصصة</option>
            </Select>
            {period === 'custom' && (
              <>
                <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-40" />
                <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-40" />
              </>
            )}
            {(kind === 'property' || kind === 'overall' || kind === 'cash' || kind === 'arrears' || kind === 'expenses' || kind === 'receipts') && (
              <Select value={propId} onChange={(e) => setPropId(e.target.value)} className="w-44">
                <option value="">جميع العقارات</option>
                {props.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            )}
            {kind === 'tenant' && (
              <Select value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="w-44">
                <option value="">اختر مستأجر</option>
                {tenants.map((t: any) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </Select>
            )}
          </div>
          <div className="flex gap-2 mt-3">
            <Button variant="outline" onClick={() => exportFile('pdf')}>تصدير PDF</Button>
            <Button variant="outline" onClick={() => exportFile('excel')}>تصدير Excel</Button>
            <Button variant="outline" onClick={() => exportFile('csv')}>تصدير CSV</Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? <div>جارٍ التحميل...</div> : report && (
        <Card>
          <CardHeader><CardTitle>نتائج التقرير ({start} — {end})</CardTitle></CardHeader>
          <CardContent className="py-4">
            {kind === 'overall' && report.properties && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-gray-500">
                    <th className="py-2 text-right">العقار</th><th className="py-2 text-right">الوحدات</th><th className="py-2 text-right">المستأجرون</th>
                    <th className="py-2 text-right">المستحق</th><th className="py-2 text-right">المحصل</th><th className="py-2 text-right">المتبقي</th>
                    <th className="py-2 text-right">المصاريف</th><th className="py-2 text-right">صافي التدفق</th>
                  </tr></thead>
                  <tbody>
                    {report.properties.map((p: any) => (
                      <tr key={p.property.id} className="border-b">
                        <td className="py-2">{p.property.name}</td>
                        <td className="py-2">{p.units_count}</td>
                        <td className="py-2">{p.tenants_count}</td>
                        <td className="py-2 font-mono-nums">{formatMoney(p.total_due)}</td>
                        <td className="py-2 font-mono-nums">{formatMoney(p.total_collected)}</td>
                        <td className="py-2 font-mono-nums">{formatMoney(p.total_remaining)}</td>
                        <td className="py-2 font-mono-nums">{formatMoney(p.expenses_paid)}</td>
                        <td className="py-2 font-mono-nums">{formatMoney(p.net_cash_flow)}</td>
                      </tr>
                    ))}
                    <tr className="font-bold bg-gray-50">
                      <td className="py-2">الإجمالي</td>
                      <td className="py-2">{report.totals.units_count}</td>
                      <td className="py-2">{report.totals.tenants_count}</td>
                      <td className="py-2 font-mono-nums">{formatMoney(report.totals.total_due)}</td>
                      <td className="py-2 font-mono-nums">{formatMoney(report.totals.total_collected)}</td>
                      <td className="py-2 font-mono-nums">{formatMoney(report.totals.total_remaining)}</td>
                      <td className="py-2 font-mono-nums">{formatMoney(report.totals.expenses_paid)}</td>
                      <td className="py-2 font-mono-nums">{formatMoney(report.totals.net_cash_flow)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {kind === 'property' && report.property && (
              <div className="space-y-3">
                <div className="grid md:grid-cols-2 gap-2 text-sm">
                  <div>العقار: <b>{report.property.name}</b></div>
                  <div>الوحدات: {report.units_count} — المستأجرون: {report.tenants_count}</div>
                  <div>المستحق: {formatMoney(report.total_due)}</div>
                  <div>المحصل: {formatMoney(report.total_collected)}</div>
                  <div>المتبقي: {formatMoney(report.total_remaining)}</div>
                  <div>المتأخرات: {formatMoney(report.total_overdue)}</div>
                  <div>المصاريف المدفوعة: {formatMoney(report.expenses_paid)}</div>
                  <div>المصاريف غير المدفوعة: {formatMoney(report.expenses_unpaid)}</div>
                  <div>صافي التدفق: {formatMoney(report.net_cash_flow)}</div>
                  <div>الرصيد الافتتاحي: {formatMoney(report.opening_balance)}</div>
                  <div>الرصيد الختامي: {formatMoney(report.closing_balance)}</div>
                </div>
                <h4 className="font-semibold mt-3">الاستحقاقات</h4>
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-gray-500"><th className="py-2 text-right">الفترة</th><th className="py-2 text-right">الاستحقاق</th><th className="py-2 text-right">المستحق</th><th className="py-2 text-right">المدفوع</th><th className="py-2 text-right">الحالة</th></tr></thead>
                  <tbody>
                    {report.charges.map((c: any) => (
                      <tr key={c.id} className="border-b">
                        <td className="py-2">{c.period}</td><td className="py-2">{formatDate(c.due_date)}</td>
                        <td className="py-2 font-mono-nums">{formatMoney(c.amount_due)}</td>
                        <td className="py-2 font-mono-nums">{formatMoney(c.amount_paid)}</td>
                        <td className="py-2">{c.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {kind === 'tenant' && report.tenant && (
              <div className="space-y-2 text-sm">
                <div>المستأجر: <b>{report.tenant.full_name}</b> ({report.tenant.tenant_number})</div>
                <div>المستحق: {formatMoney(report.total_due)} — المحصل: {formatMoney(report.total_collected)} — المتبقي: {formatMoney(report.remaining)}</div>
                <div>الرصيد الدائن: {formatMoney(report.tenant.credit_balance)}</div>
              </div>
            )}

            {kind === 'cash' && report.movements && (
              <div className="space-y-2">
                <div className="grid md:grid-cols-3 gap-2 text-sm">
                  <div>الرصيد الافتتاحي: {formatMoney(report.opening_balance)}</div>
                  <div>المقبوضات: {formatMoney(report.receipts)}</div>
                  <div>المصاريف المدفوعة: {formatMoney(report.expenses_paid)}</div>
                  <div>التسويات: {formatMoney(report.adjustments)}</div>
                  <div>الرصيد الختامي: {formatMoney(report.closing_balance)}</div>
                </div>
                <table className="w-full text-sm mt-3">
                  <thead><tr className="border-b text-gray-500"><th className="py-2 text-right">التاريخ</th><th className="py-2 text-right">النوع</th><th className="py-2 text-right">المبلغ</th><th className="py-2 text-right">الوصف</th></tr></thead>
                  <tbody>
                    {report.movements.map((m: any) => (
                      <tr key={m.id} className="border-b">
                        <td className="py-2">{formatDate(m.movement_date)}</td>
                        <td className="py-2">{m.movement_type}</td>
                        <td className="py-2 font-mono-nums">{formatMoney(m.amount)}</td>
                        <td className="py-2">{m.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {kind === 'arrears' && Array.isArray(report) && (
              <table className="w-full text-sm">
                <thead><tr className="border-b text-gray-500"><th className="py-2 text-right">المستأجر</th><th className="py-2 text-right">العقار</th><th className="py-2 text-right">الفترة</th><th className="py-2 text-right">الاستحقاق</th><th className="py-2 text-right">المتبقي</th><th className="py-2 text-right">أيام التأخير</th></tr></thead>
                <tbody>
                  {report.map((a: any) => (
                    <tr key={a.charge_id} className="border-b">
                      <td className="py-2">{a.tenant_name}</td>
                      <td className="py-2">{a.property_name}</td>
                      <td className="py-2">{a.period}</td>
                      <td className="py-2">{formatDate(a.due_date)}</td>
                      <td className="py-2 font-mono-nums text-red-600">{formatMoney(a.remaining)}</td>
                      <td className="py-2">{a.days_overdue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {kind === 'expenses' && Array.isArray(report) && (
              <table className="w-full text-sm">
                <thead><tr className="border-b text-gray-500"><th className="py-2 text-right">التاريخ</th><th className="py-2 text-right">التصنيف</th><th className="py-2 text-right">المبلغ</th><th className="py-2 text-right">الحالة</th><th className="py-2 text-right">الوصف</th></tr></thead>
                <tbody>
                  {report.map((e: any) => (
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
            )}

            {kind === 'receipts' && Array.isArray(report) && (
              <table className="w-full text-sm">
                <thead><tr className="border-b text-gray-500"><th className="py-2 text-right">الإيصال</th><th className="py-2 text-right">المستأجر</th><th className="py-2 text-right">العقار</th><th className="py-2 text-right">التاريخ</th><th className="py-2 text-right">المبلغ</th><th className="py-2 text-right">الطريقة</th></tr></thead>
                <tbody>
                  {report.map((r: any) => (
                    <tr key={r.id} className="border-b">
                      <td className="py-2">{r.receipt_number}</td>
                      <td className="py-2">{r.tenant_name}</td>
                      <td className="py-2">{r.property_name}</td>
                      <td className="py-2">{formatDate(r.payment_date)}</td>
                      <td className="py-2 font-mono-nums">{formatMoney(r.amount)}</td>
                      <td className="py-2">{r.method}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { useToast } from '../contexts/ToastContext'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Select } from '../components/ui/Select'
import { Textarea } from '../components/ui/Input'
import { formatMoney, formatDate } from '../lib/utils'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Building2, Home, Users, DollarSign, AlertTriangle, TrendingUp } from 'lucide-react'

import { periodRange } from '../lib/dates'

export default function Dashboard() {
  const qc = useQueryClient()
  const toast = useToast()
  const [period, setPeriod] = useState('month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [start, end] = useMemo(() => {
    if (period === 'custom' && customStart && customEnd) return [customStart, customEnd]
    return periodRange(period)
  }, [period, customStart, customEnd])

  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: () => api.get('/settings').then((r) => r.data) })
  const [generalNotes, setGeneralNotes] = useState('')
  const [notesState, setNotesState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const notesLoaded = useRef(false)
  const notesTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (settings && !notesLoaded.current) {
      setGeneralNotes(settings.general_notes ?? '')
      notesLoaded.current = true
    }
  }, [settings])

  const saveNotes = useMutation({
    mutationFn: (value: string) => api.put('/settings', { key: 'general_notes', value }),
    onSuccess: () => {
      setNotesState('saved')
      qc.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: (e: any) => {
      setNotesState('idle')
      toast.show(e?.response?.data?.detail || 'تعذّر حفظ الملاحظات', 'error')
    },
  })

  const changeNotes = (value: string) => {
    setGeneralNotes(value)
    setNotesState('idle')
    if (notesTimer.current) window.clearTimeout(notesTimer.current)
    notesTimer.current = window.setTimeout(() => {
      setNotesState('saving')
      saveNotes.mutate(value)
    }, 800)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', start, end],
    queryFn: () => api.get('/reports/dashboard', { params: { start, end } }).then((r) => r.data),
  })

  const { data: overall } = useQuery({
    queryKey: ['overall', start, end],
    queryFn: () => api.get('/reports/overall', { params: { start, end } }).then((r) => r.data),
  })

  const t = data?.totals || {}
  const chartData = (overall?.properties || []).map((p: any) => ({
    name: p.property.name,
    مستحق: parseFloat(p.total_due),
    محصل: parseFloat(p.total_collected),
    مصاريف: parseFloat(p.expenses_paid),
  }))

  const cards = [
    { label: 'عدد العقارات', value: t.properties_count ?? 0, icon: Building2, color: 'text-[#1e3a5f]' },
    { label: 'العقارات المؤجرة', value: t.rented_properties ?? 0, icon: Home, color: 'text-green-600' },
    { label: 'الوحدات الشاغرة', value: t.vacant_units ?? 0, icon: Home, color: 'text-orange-500' },
    { label: 'إجمالي المستحق', value: formatMoney(t.total_due ?? 0), icon: DollarSign, color: 'text-[#1e3a5f]' },
    { label: 'إجمالي المحصل', value: formatMoney(t.total_collected ?? 0), icon: DollarSign, color: 'text-green-600' },
    { label: 'المتبقي', value: formatMoney(t.total_remaining ?? 0), icon: AlertTriangle, color: 'text-orange-500' },
    { label: 'إجمالي المصاريف', value: formatMoney(t.total_expenses ?? 0), icon: DollarSign, color: 'text-red-600' },
    { label: 'صافي التدفق', value: formatMoney(t.net_cash_flow ?? 0), icon: TrendingUp, color: 'text-[#1e3a5f]' },
    { label: 'مستأجرون متأخرون', value: t.arrears_tenants ?? 0, icon: Users, color: 'text-red-600' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-800">لوحة التحكم</h2>
        <div className="flex items-center gap-2">
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
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="border rounded px-2 py-1 text-sm" />
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="border rounded px-2 py-1 text-sm" />
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>ملاحظاتي العامة</CardTitle></CardHeader>
        <CardContent className="py-4 space-y-2">
          <Textarea
            rows={4}
            value={generalNotes}
            onChange={(e) => changeNotes(e.target.value)}
            placeholder="اكتب هنا ملاحظاتك العامة: مواعيد، تذكيرات، أفكار، أي شيء تريد حفظه..."
          />
          <div className="text-xs text-gray-500">
            {notesState === 'saving'
              ? 'جارٍ الحفظ...'
              : notesState === 'saved'
                ? 'تم حفظ الملاحظات تلقائيًا'
                : 'تُحفظ الملاحظات تلقائيًا أثناء الكتابة.'}
          </div>
        </CardContent>
      </Card>

      {isLoading ? <div className="text-center py-10">جارٍ التحميل...</div> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {cards.map((c, i) => (
              <Card key={i}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-gray-500">{c.label}</div>
                      <div className={`text-xl font-bold mt-1 ${c.color}`}>{c.value}</div>
                    </div>
                    <c.icon size={20} className="text-gray-300" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>الإيجارات المستحقة مقابل المحصلة</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="مستحق" fill="#1e3a5f" />
                    <Bar dataKey="محصل" fill="#16a34a" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>المصاريف حسب العقار</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="مصاريف" fill="#dc2626" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>أقرب تواريخ الاستحقاق</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(data?.upcoming || []).map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between text-sm border-b py-2">
                    <span>استحقاق #{c.id} — مستأجر {c.tenant_id}</span>
                    <span className="text-gray-500">{formatDate(c.due_date)}</span>
                    <span className="font-semibold text-[#1e3a5f]">{formatMoney(c.amount_due - c.amount_paid)}</span>
                  </div>
                ))}
                {(!data?.upcoming || data.upcoming.length === 0) && <div className="text-gray-400 text-sm">لا توجد استحقاقات قادمة</div>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>المتأخرات</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(data?.arrears || []).map((a: any) => (
                  <div key={a.charge_id} className="flex items-center justify-between text-sm border-b py-2">
                    <span>{a.tenant_name} — {a.property_name}</span>
                    <span className="text-gray-500">{a.days_overdue} يوم</span>
                    <span className="font-semibold text-red-600">{formatMoney(a.remaining)}</span>
                  </div>
                ))}
                {(!data?.arrears || data.arrears.length === 0) && <div className="text-gray-400 text-sm">لا توجد متأخرات</div>}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
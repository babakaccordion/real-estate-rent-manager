import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, LOCAL_MODE } from '../api/client'
import { useToast } from '../contexts/ToastContext'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input, Label } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { DOWNLOAD_HINT, LOCAL_STORAGE_NOTE, STORAGE_KEY, loadDB, resetDB } from '../local/db'
import { dataRangeLabel, downloadBackup, readFileAsText, restoreBackup } from '../local/backup'

export default function SettingsPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: () => api.get('/settings').then((r) => r.data) })
  const [currency, setCurrency] = useState('JOD')
  const [decimals, setDecimals] = useState('3')
  const [tz, setTz] = useState('Asia/Amman')
  const [stats, setStats] = useState(() =>
    LOCAL_MODE
      ? statsOf()
      : { properties: 0, tenants: 0, leases: 0, charges: 0, payments: 0, expenses: 0, movements: 0, bytes: 0, range: '' },
  )
  const [restoring, setRestoring] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!settings) return
    if (settings.currency) setCurrency(settings.currency)
    if (settings.decimal_places) setDecimals(settings.decimal_places)
    if (settings.timezone) setTz(settings.timezone)
  }, [settings])

  const save = useMutation({
    mutationFn: (d: any) => api.put('/settings', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); toast.show('تم حفظ الإعداد') },
  })

  const sizeLabel = useMemo(() => `${Math.max(1, Math.round(stats.bytes / 1024))} كيلوبايت`, [stats.bytes])

  const doExport = () => {
    const filename = downloadBackup()
    toast.show('تم تنزيل نسخة احتياطية: ' + filename)
  }

  const doRestore = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) {
      toast.show('اختر ملف النسخة الاحتياطية أولاً', 'error')
      return
    }
    if (!confirm('سيتم استبدال جميع البيانات الموجودة في هذا الجهاز بالنسخة المختارة. هل تريد المتابعة؟')) return
    setRestoring(true)
    try {
      const result = restoreBackup(await readFileAsText(file))
      qc.clear()
      setStats(statsOf())
      toast.show(
        `تمت الاستعادة: ${result.counts.properties} عقار، ${result.counts.tenants} مستأجر، ${result.counts.charges} استحقاق`,
      )
    } catch (e: any) {
      toast.show(e?.response?.data?.detail || e?.message || 'فشل استعادة النسخة', 'error')
    } finally {
      setRestoring(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const doReset = () => {
    if (!confirm('سيتم حذف جميع البيانات نهائيًا من هذا الجهاز. تأكد من تنزيل نسخة احتياطية أولاً.')) return
    if (!confirm('تأكيد أخير: حذف كل العقارات والمستأجرين والدفعات؟')) return
    resetDB()
    qc.clear()
    setStats(statsOf())
    toast.show('تم حذف جميع البيانات المحلية')
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-800">الإعدادات</h2>

      {LOCAL_MODE && (
        <Card>
          <CardHeader><CardTitle>النسخة المحلية (تعمل بدون إنترنت)</CardTitle></CardHeader>
          <CardContent className="py-4 space-y-3 text-sm text-gray-600">
            <p>{LOCAL_STORAGE_NOTE}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Stat label="العقارات" value={stats.properties} />
              <Stat label="المستأجرون" value={stats.tenants} />
              <Stat label="العقود" value={stats.leases} />
              <Stat label="الاستحقاقات" value={stats.charges} />
              <Stat label="الدفعات" value={stats.payments} />
              <Stat label="المصاريف" value={stats.expenses} />
              <Stat label="حركات الصندوق" value={stats.movements} />
              <Stat label="حجم البيانات" value={sizeLabel} />
            </div>
            <div className="text-xs text-gray-500">آخر بيانات مسجّلة: {stats.range}</div>
            <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 text-xs">
              البيانات محفوظة داخل هذا المتصفح فقط. إذا حذفت بيانات الموقع أو غيّرت الجهاز فستفقد البيانات،
              لذلك نزّل نسخة احتياطية بانتظام.
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>إعدادات البرنامج</CardTitle></CardHeader>
        <CardContent className="py-4 space-y-3 max-w-md">
          <div>
            <Label>العملة</Label>
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="JOD">دينار أردني (JOD)</option>
              <option value="USD">دولار (USD)</option>
              <option value="EUR">يورو (EUR)</option>
              <option value="SAR">ريال سعودي (SAR)</option>
            </Select>
          </div>
          <div>
            <Label>عدد المنازل العشرية</Label>
            <Input type="number" value={decimals} onChange={(e) => setDecimals(e.target.value)} />
          </div>
          <div>
            <Label>المنطقة الزمنية</Label>
            <Input value={tz} onChange={(e) => setTz(e.target.value)} />
          </div>
          <Button onClick={() => { save.mutate({ key: 'currency', value: currency }); save.mutate({ key: 'decimal_places', value: decimals }); save.mutate({ key: 'timezone', value: tz }) }}>حفظ</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>النسخ الاحتياطي</CardTitle></CardHeader>
        <CardContent className="py-4 space-y-3">
          {LOCAL_MODE ? (
            <>
              <Button onClick={doExport}>تنزيل نسخة احتياطية (JSON)</Button>
              <div className="text-xs text-gray-500">{DOWNLOAD_HINT}</div>
              <div className="border-t pt-3 space-y-2">
                <Label>استعادة من ملف نسخة احتياطية</Label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json,application/json"
                  className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#1e3a5f] file:px-3 file:py-2 file:text-white"
                />
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={doRestore} disabled={restoring}>
                    {restoring ? 'جارٍ الاستعادة...' : 'استعادة النسخة المختارة'}
                  </Button>
                  <Button variant="danger" onClick={doReset}>حذف جميع البيانات المحلية</Button>
                </div>
                <div className="text-xs text-gray-500">
                  يمكن استعادة نسخة منسوخة من نسخة الكمبيوتر أيضًا (نفس صيغة ملف JSON).
                </div>
              </div>
            </>
          ) : (
            <>
              <Button onClick={async () => {
                const r = await api.post('/backup/export')
                toast.show('تم إنشاء نسخة احتياطية: ' + r.data.filename)
              }}>إنشاء نسخة احتياطية</Button>
              <div className="text-sm text-gray-500">النسخ الاحتياطية محفوظة في data/backups</div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="font-semibold text-[#1e3a5f]">{value}</div>
    </div>
  )
}

function statsOf() {
  const db = loadDB()
  return {
    properties: db.properties.length,
    tenants: db.tenants.length,
    leases: db.leases.length,
    charges: db.charges.length,
    payments: db.payments.length,
    expenses: db.expenses.length,
    movements: db.movements.length,
    bytes: (localStorage.getItem(STORAGE_KEY) ?? '').length,
    range: dataRangeLabel(db),
  }
}

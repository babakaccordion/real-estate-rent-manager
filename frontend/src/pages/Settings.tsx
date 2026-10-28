import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, LOCAL_MODE } from '../api/client'
import { useToast } from '../contexts/ToastContext'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input, Label } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { DOWNLOAD_HINT, LOCAL_STORAGE_NOTE, STORAGE_KEY, loadDB, resetDB } from '../local/db'
import { autosaveInfo, autosaveText, dataRangeLabel, downloadBackup, readFileAsText, restoreBackup } from '../local/backup'
import { useAuth } from '../contexts/AuthContext'

export default function SettingsPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const { user, refreshUser } = useAuth()
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: () => api.get('/settings').then((r) => r.data) })
  const { data: autoInfo, refetch: refetchAuto } = useQuery({
    queryKey: ['auto-info'],
    queryFn: () => api.get('/backup/auto-info').then((r) => r.data),
    enabled: !LOCAL_MODE,
  })
  const [currency, setCurrency] = useState('JOD')
  const [decimals, setDecimals] = useState('3')
  const [tz, setTz] = useState('Asia/Amman')
  const [stats, setStats] = useState(() =>
    LOCAL_MODE
      ? statsOf()
      : { properties: 0, tenants: 0, leases: 0, charges: 0, payments: 0, expenses: 0, movements: 0, bytes: 0, range: '' },
  )
  const [restoring, setRestoring] = useState(false)
  const [autoAt, setAutoAt] = useState<string | null>(() => (LOCAL_MODE ? autosaveInfo().at : null))
  const [autoRestoring, setAutoRestoring] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingCreds, setSavingCreds] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const autoEnabled = (settings?.auto_backup ?? '1') !== '0'

  useEffect(() => {
    if (!settings) return
    if (settings.currency) setCurrency(settings.currency)
    if (settings.decimal_places) setDecimals(settings.decimal_places)
    if (settings.timezone) setTz(settings.timezone)
  }, [settings])

  useEffect(() => {
    if (user?.username) setNewUsername(user.username)
  }, [user?.username])

  const save = useMutation({
    mutationFn: (d: any) => api.put('/settings', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); toast.show('تم حفظ الإعداد') },
  })

  const sizeLabel = useMemo(() => `${Math.max(1, Math.round(stats.bytes / 1024))} كيلوبايت`, [stats.bytes])

  const autoLabel = useMemo(() => {
    const at = LOCAL_MODE ? autoAt : autoInfo?.last_at
    if (!at) return 'لم يتم بعد'
    try {
      return new Date(at).toLocaleString('ar-JO')
    } catch {
      return String(at)
    }
  }, [autoAt, autoInfo])

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

  const toggleAuto = useMutation({
    mutationFn: (enabled: boolean) => api.put('/settings', { key: 'auto_backup', value: enabled ? '1' : '0' }),
    onSuccess: (_data, enabled) => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      toast.show(enabled ? 'تم تفعيل الحفظ التلقائي' : 'تم تعطيل الحفظ التلقائي')
    },
    onError: (e: any) => toast.show(e?.response?.data?.detail || 'تعذّر تغيير الإعداد', 'error'),
  })

  const submitCredentials = async () => {
    if (!currentPassword) {
      toast.show('أدخل كلمة المرور الحالية أولاً', 'error')
      return
    }
    if (newPassword && newPassword !== confirmPassword) {
      toast.show('كلمتا المرور الجديدتان غير متطابقتين', 'error')
      return
    }
    if (!newUsername.trim() && !newPassword) {
      toast.show('أدخل اسم المستخدم أو كلمة مرور جديدة', 'error')
      return
    }
    setSavingCreds(true)
    try {
      await api.post('/auth/change-credentials', {
        current_password: currentPassword,
        username: newUsername.trim() || user?.username,
        new_password: newPassword || undefined,
      })
      await refreshUser()
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast.show('تم تحديث بيانات الدخول بنجاح')
    } catch (e: any) {
      toast.show(e?.response?.data?.detail || e?.message || 'فشل تحديث بيانات الدخول', 'error')
    } finally {
      setSavingCreds(false)
    }
  }

  const restoreAuto = async () => {
    if (!confirm('سيتم استبدال البيانات الحالية بآخر حفظ تلقائي. هل تريد المتابعة؟')) return
    setAutoRestoring(true)
    try {
      if (LOCAL_MODE) {
        const text = autosaveText()
        if (!text) throw new Error('لا يوجد حفظ تلقائي بعد')
        const result = restoreBackup(text)
        qc.clear()
        setStats(statsOf())
        setAutoAt(autosaveInfo().at)
        toast.show(`تمت استعادة آخر حفظ تلقائي: ${result.counts.properties} عقار، ${result.counts.tenants} مستأجر`)
      } else {
        const r = await api.post('/backup/auto-restore')
        qc.clear()
        refetchAuto()
        toast.show(`تمت استعادة آخر حفظ تلقائي (${r.data?.counts?.properties ?? 0} عقار)`)
      }
    } catch (e: any) {
      toast.show(e?.response?.data?.detail || e?.message || 'فشل استعادة الحفظ التلقائي', 'error')
    } finally {
      setAutoRestoring(false)
    }
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
        <CardHeader><CardTitle>الأمان وبيانات الدخول</CardTitle></CardHeader>
        <CardContent className="py-4 space-y-3 max-w-md">
          <p className="text-xs text-gray-500">
            اسم المستخدم (رمز الدخول) وكلمة المرور المطلوبان عند فتح البرنامج. لتغيير أي منهما أدخل كلمة المرور الحالية.
          </p>
          <div>
            <Label>كلمة المرور الحالية *</Label>
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
          </div>
          <div>
            <Label>اسم المستخدم (رمز الدخول)</Label>
            <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} autoComplete="username" />
          </div>
          <div>
            <Label>كلمة مرور جديدة (اتركها فارغة إذا لا تريد تغييرها)</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
          </div>
          <div>
            <Label>تأكيد كلمة المرور الجديدة</Label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
          </div>
          <Button onClick={submitCredentials} disabled={savingCreds}>
            {savingCreds ? 'جارٍ الحفظ...' : 'حفظ بيانات الدخول'}
          </Button>
          <div className="text-xs text-gray-500">كلمة المرور الافتراضية: REMOVED — يُنصح بتغييرها.</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>الحفظ التلقائي</CardTitle></CardHeader>
        <CardContent className="py-4 space-y-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={autoEnabled}
              onChange={(e) => toggleAuto.mutate(e.target.checked)}
              disabled={toggleAuto.isPending || !settings}
            />
            حفظ نسخة احتياطية تلقائيًا بعد كل إضافة أو تعديل أو حذف
          </label>
          <div className="text-sm text-gray-600">آخر حفظ تلقائي: <span className="font-semibold text-[#1e3a5f]">{autoLabel}</span></div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={restoreAuto} disabled={autoRestoring}>
              {autoRestoring ? 'جارٍ الاستعادة...' : 'استعادة آخر حفظ تلقائي'}
            </Button>
          </div>
          <div className="text-xs text-gray-500">
            {LOCAL_MODE
              ? 'النسخة التلقائية محفوظة داخل هذا المتصفح، وتُحدَّث بعد كل عملية حفظ.'
              : `النسخ التلقائية محفوظة في مجلد data/backups (آخر 30 نسخة)${autoInfo?.count ? ` — العدد الحالي: ${autoInfo.count}` : ''}.`}
          </div>
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

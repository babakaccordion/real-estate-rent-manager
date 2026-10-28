import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { useToast } from '../contexts/ToastContext'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input, Label } from '../components/ui/Input'
import { Select } from '../components/ui/Select'

export default function SettingsPage() {
  const qc = useQueryClient()
  const toast = useToast()
  useQuery({ queryKey: ['settings'], queryFn: () => api.get('/settings').then((r) => r.data) })
  const [currency, setCurrency] = useState('JOD')
  const [decimals, setDecimals] = useState('3')
  const [tz, setTz] = useState('Asia/Amman')

  const save = useMutation({
    mutationFn: (d: any) => api.put('/settings', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); toast.show('تم حفظ الإعداد') },
  })

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-800">الإعدادات</h2>
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
        <CardContent className="py-4 space-y-2">
          <Button onClick={async () => {
            const r = await api.post('/backup/export')
            toast.show('تم إنشاء نسخة احتياطية: ' + r.data.filename)
          }}>إنشاء نسخة احتياطية</Button>
          <div className="text-sm text-gray-500">النسخ الاحتياطية محفوظة في data/backups</div>
        </CardContent>
      </Card>
    </div>
  )
}
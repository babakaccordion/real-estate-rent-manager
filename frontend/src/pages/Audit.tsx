import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { Card, CardContent } from '../components/ui/Card'
import { formatDate } from '../lib/utils'

export default function AuditPage() {
  const { data: logs = [] } = useQuery({ queryKey: ['audit'], queryFn: () => api.get('/audit').then((r) => r.data) })
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-800">سجل التدقيق</h2>
      <Card><CardContent className="py-4">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-gray-500"><th className="py-2 text-right">التاريخ</th><th className="py-2 text-right">المستخدم</th><th className="py-2 text-right">العملية</th><th className="py-2 text-right">النوع</th><th className="py-2 text-right">المعرف</th></tr></thead>
          <tbody>
            {logs.map((l: any) => (
              <tr key={l.id} className="border-b">
                <td className="py-2">{formatDate(l.created_at)}</td>
                <td className="py-2">{l.username}</td>
                <td className="py-2">{l.action}</td>
                <td className="py-2">{l.entity_type}</td>
                <td className="py-2">{l.entity_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <div className="text-gray-400 text-sm py-6 text-center">لا توجد سجلات</div>}
      </CardContent></Card>
    </div>
  )
}
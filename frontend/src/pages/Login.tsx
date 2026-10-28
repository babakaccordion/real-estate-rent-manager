import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Label } from '../components/ui/Input'

export default function Login() {
  const [mode, setMode] = useState<'checking' | 'login' | 'setup'>('checking')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, setup } = useAuth()
  const navigate = useNavigate()

  // هل هذا أول تشغيل على هذا الجهاز (لا توجد بيانات دخول بعد)؟
  useEffect(() => {
    let active = true
    api
      .get('/auth/status')
      .then((r) => {
        if (!active) return
        setMode(r.data?.needs_setup ? 'setup' : 'login')
      })
      .catch(() => {
        if (active) setMode('login')
      })
    return () => {
      active = false
    }
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (mode === 'setup') {
      if (password.length < 8) return setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل')
      if (password !== confirm) return setError('كلمتا المرور غير متطابقتين')
    }
    setLoading(true)
    try {
      if (mode === 'setup') {
        await setup(username.trim(), password)
      } else {
        await login(username, password)
      }
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'فشل تسجيل الدخول')
    } finally {
      setLoading(false)
    }
  }

  const isSetup = mode === 'setup'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1e3a5f] to-[#0f172a] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#1e3a5f]">العقارات والإيجارات</h1>
          <p className="text-sm text-gray-500 mt-1">Real Estate & Rent Manager</p>
        </div>

        {mode === 'checking' ? (
          <div className="text-center text-sm text-gray-500 py-6">جارٍ التحميل...</div>
        ) : (
          <>
            {isSetup && (
              <div className="mb-5 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 leading-relaxed">
                أول تشغيل على هذا الجهاز. اختر اسم المستخدم (رمز الدخول) وكلمة المرور الخاصة بك.
                لا توجد كلمة مرور افتراضية، وتُحفظ بياناتك مشفّرة على هذا الجهاز فقط.
              </div>
            )}
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label>اسم المستخدم</Label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  minLength={3}
                  required
                />
              </div>
              <div>
                <Label>كلمة المرور</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isSetup ? 'new-password' : 'current-password'}
                  required
                />
              </div>
              {isSetup && (
                <div>
                  <Label>تأكيد كلمة المرور</Label>
                  <Input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
              )}
              {error && <div className="text-red-600 text-sm">{error}</div>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'جارٍ المعالجة...' : isSetup ? 'إنشاء بيانات الدخول' : 'تسجيل الدخول'}
              </Button>
            </form>
            {!isSetup && (
              <p className="text-xs text-gray-400 mt-5 text-center leading-relaxed">
                بيانات الدخول خاصة بك ولا تُنشر في أي مكان. يمكنك تغييرها من الإعدادات ← الأمان وبيانات الدخول.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

interface Toast { id: number; msg: string; type: 'success' | 'error' | 'info' }

const Ctx = createContext<{ show: (msg: string, type?: Toast['type']) => void } | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const show = (msg: string, type: Toast['type'] = 'success') => {
    const id = Date.now()
    setToasts((t) => [...t, { id, msg, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }
  const colors = { success: 'bg-green-600', error: 'bg-red-600', info: 'bg-[#1e3a5f]' }
  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div className="fixed top-4 left-4 z-[100] space-y-2">
        {toasts.map((t) => (
          <div key={t.id} className={`${colors[t.type]} text-white px-4 py-3 rounded-lg shadow-lg text-sm`}>{t.msg}</div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const c = useContext(Ctx)
  if (!c) throw new Error('no toast')
  return c
}
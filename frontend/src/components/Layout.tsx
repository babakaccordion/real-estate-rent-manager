import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  Home, Building2, Users, FileText, Receipt, Wallet, BarChart3, Search, Settings, LogOut, Menu, X
} from 'lucide-react'

const nav = [
  { to: '/', label: 'الرئيسية', icon: Home },
  { to: '/properties', label: 'العقارات', icon: Building2 },
  { to: '/tenants', label: 'المستأجرون', icon: Users },
  { to: '/leases', label: 'العقود', icon: FileText },
  { to: '/charges', label: 'الاستحقاقات', icon: Receipt },
  { to: '/payments', label: 'المقبوضات', icon: Wallet },
  { to: '/expenses', label: 'المصاريف', icon: Wallet },
  { to: '/cash', label: 'الصندوق', icon: Wallet },
  { to: '/reports', label: 'التقارير', icon: BarChart3 },
  { to: '/search', label: 'البحث', icon: Search },
  { to: '/settings', label: 'الإعدادات', icon: Settings },
]

const bottomNav = [
  { to: '/', label: 'الرئيسية', icon: Home },
  { to: '/properties', label: 'العقارات', icon: Building2 },
  { to: '/tenants', label: 'المستأجرون', icon: Users },
  { to: '/charges', label: 'الاستحقاقات', icon: Receipt },
  { to: '/reports', label: 'التقارير', icon: BarChart3 },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar (desktop) */}
      <aside className={`fixed top-0 right-0 h-full w-64 bg-[#1e3a5f] text-white z-40 transform transition-transform ${open ? 'translate-x-0' : 'translate-x-full'} md:translate-x-0`}>
        <div className="p-5 border-b border-white/10">
          <h1 className="text-xl font-bold">العقارات والإيجارات</h1>
          <p className="text-xs text-white/60 mt-1">Real Estate & Rent Manager</p>
        </div>
        <nav className="p-3 space-y-1 overflow-y-auto h-[calc(100%-140px)]">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${isActive ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10'}`}
              onClick={() => setOpen(false)}>
              <n.icon size={18} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-0 right-0 left-0 p-4 border-t border-white/10">
          <div className="text-xs text-white/70 mb-2">{user?.full_name} ({user?.role})</div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-white/80 hover:text-white">
            <LogOut size={16} /> تسجيل الخروج
          </button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex-1 md:mr-64 pb-16 md:pb-0">
        <header className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <button className="md:hidden p-2" onClick={() => setOpen(!open)}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex-1" />
          <Link to="/search" className="text-sm text-gray-500 hover:text-[#1e3a5f]">بحث سريع…</Link>
        </header>
        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="md:hidden fixed bottom-0 right-0 left-0 bg-white border-t border-gray-200 z-30 flex justify-around py-2">
        {bottomNav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'}
            className={({ isActive }) => `flex flex-col items-center text-xs ${isActive ? 'text-[#1e3a5f]' : 'text-gray-500'}`}>
            <n.icon size={20} />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
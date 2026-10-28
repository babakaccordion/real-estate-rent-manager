import type { ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Properties from './pages/Properties'
import PropertyDetail from './pages/PropertyDetail'
import Tenants from './pages/Tenants'
import TenantDetail from './pages/TenantDetail'
import Leases from './pages/Leases'
import Charges from './pages/Charges'
import Payments from './pages/Payments'
import Expenses from './pages/Expenses'
import Cash from './pages/Cash'
import Reports from './pages/Reports'
import SearchPage from './pages/Search'
import SettingsPage from './pages/Settings'
import AuditPage from './pages/Audit'

function Protected({ children }: { children: ReactNode }) {
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Protected><Layout /></Protected>}>
              <Route index element={<Dashboard />} />
              <Route path="properties" element={<Properties />} />
              <Route path="properties/:id" element={<PropertyDetail />} />
              <Route path="tenants" element={<Tenants />} />
              <Route path="tenants/:id" element={<TenantDetail />} />
              <Route path="leases" element={<Leases />} />
              <Route path="charges" element={<Charges />} />
              <Route path="payments" element={<Payments />} />
              <Route path="expenses" element={<Expenses />} />
              <Route path="cash" element={<Cash />} />
              <Route path="reports" element={<Reports />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="audit" element={<AuditPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}
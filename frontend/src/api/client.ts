import axios from 'axios'
import { localAdapter } from '../local/adapter'

/** وضع النسخة المحلية (GitHub Pages): البيانات داخل المتصفح بدون خادم. */
export const LOCAL_MODE = import.meta.env.VITE_LOCAL_MODE === '1'

const API_BASE = import.meta.env.VITE_API_URL || (LOCAL_MODE ? '' : '/api')

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  ...(LOCAL_MODE ? { adapter: localAdapter } : {}),
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      if (LOCAL_MODE) {
        if (!window.location.hash.startsWith('#/login')) window.location.hash = '#/login'
      } else {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export function unwrap<T>(p: Promise<{ data: T }>) {
  return p.then((r) => r.data)
}

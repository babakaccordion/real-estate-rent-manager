import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const base = env.VITE_BASE || '/'
  const isLocalMode = env.VITE_LOCAL_MODE === '1'

  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      // PWA/Service Worker needed only for the standalone mobile build (GitHub Pages).
      // The desktop app is served by the local backend, and a service worker there
      // could keep serving old cached files after an update.
      ...(isLocalMode
        ? [
            VitePWA({
              registerType: 'autoUpdate',
              includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
              manifest: {
                name: 'العقارات والإيجارات',
                short_name: 'العقارات',
                description: 'إدارة العقارات والإيجارات والمستأجرين والدفعات',
                theme_color: '#1e3a5f',
                background_color: '#f5f7fa',
                display: 'standalone',
                orientation: 'portrait',
                dir: 'rtl',
                lang: 'ar',
                start_url: base,
                scope: base,
                icons: [
                  { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                  { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                  { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                ],
              },
              workbox: {
                // ملفات JavaScript كبيرة نسبيًا (المكتبات) — ارفع حد التخزين المؤقت
                maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
                navigateFallback: `${base}index.html`,
                // تخزين صورة شاشة الترحيب للعمل دون إنترنت (صور إقلاع iOS تُترك لذاكرة المتصفح)
                globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg}'],
                globIgnores: ['**/apple-splash/**'],
              },
            }),
          ]
        : []),
    ],
    server: {
      port: 5173,
      proxy: isLocalMode
        ? undefined
        : {
            '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
          },
    },
  }
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Dev: http://localhost:5173/  Production: GitHub Pages base /Moneta-
export default defineConfig(({ command }) => {
  const base = command === 'serve' ? '/' : '/Moneta-'
  const scope = base === '/' ? '/' : `${base.replace(/\/$/, '')}/`
  const iconRoot = base === '/' ? '' : base.replace(/\/$/, '')

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['vite.svg', 'icon-192x192.png', 'icon-512x512.png'],
        manifest: {
          name: 'Moneta - SaaS Accounting',
          short_name: 'Moneta',
          description:
            'Professional accounting app for SaaS businesses and personal finance tracking',
          display: 'standalone',
          theme_color: '#ffffff',
          background_color: '#ffffff',
          start_url: scope,
          scope,
          icons: [
            {
              src: `${iconRoot}/icon-192x192.png`,
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: `${iconRoot}/icon-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          navigateFallback: 'index.html',
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    base,
    build: {
      outDir: 'dist',
    },
  }
})

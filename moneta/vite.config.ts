import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// Dev: root URL (http://localhost:5173/). Production: GitHub Pages-style base.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'serve' ? '/' : '/Moneta-',
  build: {
    outDir: 'dist',
  },
}))
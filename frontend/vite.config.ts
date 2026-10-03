import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // API servie sur la même origine que le frontend : requis pour les cookies SameSite=Strict
    proxy: {
      '/api': { target: process.env.API_PROXY_TARGET ?? 'http://localhost:5000', changeOrigin: true },
    },
  },
})

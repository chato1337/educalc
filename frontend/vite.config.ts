import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

const backendProxyTarget =
  process.env.VITE_BACKEND_PROXY_TARGET || 'http://127.0.0.1:8000'

const allowedHostsFromEnv = (process.env.VITE_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean)

// Hosts permitidos en dev (reverse proxy / túnel). Ver VITE_ALLOWED_HOSTS en .env.example
const defaultAllowedHosts = ['ineac.chatuzpark.store']

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    allowedHosts: [...defaultAllowedHosts, ...allowedHostsFromEnv],
    proxy: {
      '/api': {
        target: backendProxyTarget,
        changeOrigin: true,
      },
    },
  },
})

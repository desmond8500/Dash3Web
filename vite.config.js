import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [vue()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      // En dev, /api est relayé vers le serveur Dash3 (production par défaut) : pas de souci de CORS.
      // Pour un Laravel local : VITE_DEV_API_TARGET=http://127.0.0.1:8000
      proxy: {
        '/api': {
          target: env.VITE_DEV_API_TARGET || 'https://dash3.yonkou.info',
          changeOrigin: true,
          secure: true,
        },
      },
    },
  }
})

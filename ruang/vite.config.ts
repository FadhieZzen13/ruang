import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const upstream = env.LLM_UPSTREAM || 'https://rootsys.cloud/v1'
  const key = env.LLM_API_KEY || ''

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'RUANG',
          short_name: 'RUANG',
          description: 'Takes the work off your plate.',
          theme_color: '#FAF6F0',
          background_color: '#E8E0D6',
          display: 'standalone',
          start_url: '/',
          icons: [
            {
              src: '/icon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any',
            },
          ],
        },
      }),
    ],
    server: {
      // The browser can't call the LLM gateway directly (no CORS headers).
      // So the browser hits same-origin /llm/*, and Vite proxies it upstream
      // with the API key injected here — the key never reaches the client.
      proxy: {
        '/llm': {
          target: upstream,
          changeOrigin: true,
          secure: true,
          rewrite: (p) => p.replace(/^\/llm/, ''),
          headers: key ? { Authorization: `Bearer ${key}` } : {},
        },
      },
    },
  }
})

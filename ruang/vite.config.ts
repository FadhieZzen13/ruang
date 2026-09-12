import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const upstream = env.LLM_UPSTREAM || 'https://rootsys.cloud/v1'
  const key = env.LLM_API_KEY || ''
  // Primary provider: DeepSeek (OpenAI-compatible). Falls back to the gateway
  // above if the key is missing or the call fails.
  const dsUpstream = env.DEEPSEEK_UPSTREAM || 'https://api.deepseek.com'
  const dsKey = env.DEEPSEEK_API_KEY || ''
  // Voicebox — local TTS app (returns WAV). Proxied to dodge CORS.
  const voicebox = env.VOICEBOX_URL || 'http://localhost:17493'

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
        // Local Voicebox TTS (WAV audio). No key.
        '/voicebox': {
          target: voicebox,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/voicebox/, ''),
        },
        // Primary: DeepSeek. Key injected here, never reaches the browser.
        '/deepseek': {
          target: dsUpstream,
          changeOrigin: true,
          secure: true,
          timeout: 12000,
          proxyTimeout: 12000,
          rewrite: (p) => p.replace(/^\/deepseek/, ''),
          headers: dsKey ? { Authorization: `Bearer ${dsKey}` } : {},
        },
        // Fallback: the existing gateway.
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

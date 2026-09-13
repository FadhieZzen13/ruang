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
  // The Ruang bot's API. Proxied so the browser calls same-origin /bot/* —
  // "localhost" in a phone's browser is the phone, not this machine.
  const bot = env.BOT_URL || 'http://localhost:8788'

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
      // Bind every interface so a phone on the same Wi-Fi can reach the dev
      // server at http://<your-lan-ip>:5173 — no `--host` flag needed.
      host: true,
      port: 5173,
      // Vite rejects requests whose Host header it doesn't recognise (DNS
      // rebinding protection). Tunnel domains have to be named explicitly, or
      // cloudflared/ngrok just return "Blocked request".
      allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.ngrok.io', '.loca.lt'],
      // The browser can't call the LLM gateway directly (no CORS headers).
      // So the browser hits same-origin /llm/*, and Vite proxies it upstream
      // with the API key injected here — the key never reaches the client.
      proxy: {
        // The bot's local API (pending invites, decisions, schedule sync).
        // Runs on this machine, so localhost resolves correctly here even when
        // the page itself is being viewed on a phone.
        '/bot': {
          target: bot,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/bot/, ''),
        },
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

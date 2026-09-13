// The shared way to ask a model for JSON.
//
// Providers are tried in order — DeepSeek first, the existing gateway as
// fallback. Each is an OpenAI-compatible /chat/completions endpoint reached
// through a Vite proxy (see vite.config.ts) that injects its key server-side.
// Each gets a timeout so a slow or unreachable provider fails fast and we fall
// to the next instead of hanging.

const env = import.meta.env as Record<string, string | undefined>

interface Provider {
  name: string
  base: string
  model: string
}

export const PROVIDERS: Provider[] = [
  { name: 'DeepSeek', base: '/deepseek', model: env.VITE_DEEPSEEK_MODEL || 'deepseek-chat' },
  { name: 'Kimi', base: '/llm', model: env.VITE_LLM_MODEL || 'kimi-k2.7' },
]

const TIMEOUT_MS = 12000

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export function stripFences(s: string): string {
  return s.replace(/```json\s*|\s*```/g, '').trim()
}

export async function chatJson(
  messages: ChatMessage[],
  opts: { temperature?: number } = {},
): Promise<{ json: unknown; provider: string }> {
  let lastError: unknown

  for (const p of PROVIDERS) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(`${p.base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: p.model,
          temperature: opts.temperature ?? 0,
          response_format: { type: 'json_object' },
          messages,
        }),
        signal: ctrl.signal,
      })
      if (!res.ok) throw new Error(`${p.name} failed: ${res.status}`)
      // These paths are Vite dev-server proxies. On a static host with an SPA
      // catch-all they resolve to index.html with a 200, so without this check
      // every provider "succeeds" into a JSON parse error and the whole chain
      // reads as "no model" — see ruang/vercel.json.
      if (!res.headers.get('content-type')?.includes('application/json')) {
        throw new Error(`${p.name} returned HTML, not JSON — ${p.base} is not proxied on this host`)
      }
      const data = await res.json()
      const content: string = data.choices?.[0]?.message?.content ?? '{}'
      return { json: JSON.parse(stripFences(content)), provider: p.name }
    } catch (e) {
      lastError = e // fall through to the next provider
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastError ?? new Error('all providers failed')
}

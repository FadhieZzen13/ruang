// The production half of the Vite dev proxy.
//
// `npm run dev` proxies /bot, /deepseek and /llm upstream and injects each
// secret server-side (see vite.config.ts). A static build has no dev server, so
// on Vercel those paths fell through to the SPA catch-all and answered 200 with
// index.html — which parses as a failure and reads exactly like "the bot is
// offline" or "there is no model". vercel.json rewrites them here instead.
//
// One file on purpose: Vercel's edge bundler will not pull in a shared module
// from a sibling directory, and its tsc rejects a '.ts' import extension. No
// imports means neither can bite.

export const config = { runtime: 'edge' }

// Declared rather than imported: @types/node isn't in the function's tsconfig,
// and pulling it in for two property reads is not worth it. process.env is
// available in Vercel's edge runtime.
declare const process: { env: Record<string, string | undefined> }

interface Upstream {
  origin: string | undefined
  token: string | undefined
}

function upstreamFor(name: string): Upstream | null {
  switch (name) {
    // Must be an https origin — a Cloudflare tunnel to the home server, not
    // http://localhost:8788, which on a deployed page means the visitor's own
    // machine. Going through here also keeps the token off the client.
    case 'bot':
      return { origin: process.env.BOT_ORIGIN, token: process.env.BOT_AUTH_TOKEN }
    case 'deepseek':
      return {
        origin: process.env.DEEPSEEK_UPSTREAM || 'https://api.deepseek.com',
        token: process.env.DEEPSEEK_API_KEY,
      }
    case 'llm':
      return {
        origin: process.env.LLM_UPSTREAM || 'https://rootsys.cloud/v1',
        token: process.env.LLM_API_KEY,
      }
    default:
      return null
  }
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)
  // Accept both the rewritten path and the original, since which one reaches
  // the function depends on how the rewrite is applied.
  const [, name = '', ...rest] = url.pathname.replace(/^\/api\/proxy/, '').split('/')

  const upstream = upstreamFor(name)
  if (!upstream) return Response.json({ error: `unknown upstream "${name}"` }, { status: 404 })
  if (!upstream.origin) {
    return Response.json({ error: `/${name} is not configured on this deployment` }, { status: 503 })
  }

  const headers = new Headers()
  const contentType = req.headers.get('content-type')
  if (contentType) headers.set('content-type', contentType)
  if (upstream.token) headers.set('authorization', `Bearer ${upstream.token}`)

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
  const target = `${upstream.origin.replace(/\/$/, '')}/${rest.join('/')}${url.search}`

  let res: Response
  try {
    res = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? await req.text() : undefined,
    })
  } catch {
    // The home server being asleep must not read as a 200 of something else.
    return Response.json({ error: `${name} upstream unreachable` }, { status: 502 })
  }

  // Pass the upstream content-type through verbatim: a shared plan is served as
  // text/calendar, and rewriting it to JSON would stop phones handing it to the
  // calendar app.
  return new Response(res.body, {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/json',
      'cache-control': 'no-store',
    },
  })
}

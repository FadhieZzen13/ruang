// The production half of the Vite dev proxy.
//
// `npm run dev` proxies /bot, /deepseek and /llm upstream and injects each
// secret server-side (see vite.config.ts). A static build has no dev server, so
// on Vercel those same paths fell through to the SPA catch-all and answered 200
// with index.html — which parses as a failure and reads exactly like "the bot
// is offline" or "there is no model". These functions restore the proxy with
// the same rule: the key is read here and never reaches the browser.

export async function forward(
  req: Request,
  prefix: string,
  origin: string | undefined,
  token: string | undefined,
): Promise<Response> {
  if (!origin) {
    return Response.json(
      { error: `/${prefix} is not configured on this deployment` },
      { status: 503 },
    )
  }

  const url = new URL(req.url)
  const path = url.pathname.replace(new RegExp(`^/(?:api/)?${prefix}`), '')
  const headers = new Headers()
  const contentType = req.headers.get('content-type')
  if (contentType) headers.set('content-type', contentType)
  if (token) headers.set('authorization', `Bearer ${token}`)

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
  const upstream = await fetch(`${origin.replace(/\/$/, '')}${path}${url.search}`, {
    method: req.method,
    headers,
    body: hasBody ? await req.text() : undefined,
  })

  // Pass the upstream content-type through verbatim: a shared plan is served as
  // text/calendar, and rewriting it to JSON would stop phones handing it to the
  // calendar app.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
      'cache-control': 'no-store',
    },
  })
}

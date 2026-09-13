import { forward } from '../_forward.ts'

export const config = { runtime: 'edge' }

// BOT_ORIGIN must be an https origin the browser could never reach directly —
// a Cloudflare tunnel to the home server, not http://localhost:8788. Going
// through here is also what stops the https page being blocked as mixed
// content, and keeps BOT_AUTH_TOKEN off the client (unlike VITE_BOT_TOKEN).
export default function handler(req: Request): Promise<Response> {
  return forward(req, 'bot', process.env.BOT_ORIGIN, process.env.BOT_AUTH_TOKEN)
}

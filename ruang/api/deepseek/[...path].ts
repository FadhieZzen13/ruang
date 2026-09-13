import { forward } from '../_forward.ts'

export const config = { runtime: 'edge' }

export default function handler(req: Request): Promise<Response> {
  return forward(
    req,
    'deepseek',
    process.env.DEEPSEEK_UPSTREAM || 'https://api.deepseek.com',
    process.env.DEEPSEEK_API_KEY,
  )
}

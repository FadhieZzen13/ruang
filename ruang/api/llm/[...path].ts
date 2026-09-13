import { forward } from '../_forward.ts'

export const config = { runtime: 'edge' }

export default function handler(req: Request): Promise<Response> {
  return forward(
    req,
    'llm',
    process.env.LLM_UPSTREAM || 'https://rootsys.cloud/v1',
    process.env.LLM_API_KEY,
  )
}

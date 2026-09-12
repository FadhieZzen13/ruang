// Text-to-speech so Ruang talks back. Prefers the local Voicebox app (natural
// voice, WAV over a Vite proxy — see vite.config.ts); falls back to the
// browser's built-in speechSynthesis if Voicebox isn't running. Muteable.

const env = import.meta.env as Record<string, string | undefined>
const VB_PROFILE = env.VITE_VOICEBOX_PROFILE || ''
const VB_ENGINE = env.VITE_VOICEBOX_ENGINE || 'kokoro'
const MUTE_KEY = 'ruang.mute.v1'

let current: HTMLAudioElement | null = null

export function ttsSupported(): boolean {
  // Either path counts — Voicebox (needs a profile) or the browser voice.
  return (typeof window !== 'undefined' && 'speechSynthesis' in window) || !!VB_PROFILE
}

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export function setMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
  } catch {
    /* no storage — in-memory only */
  }
  if (muted) stopSpeaking()
}

export function speak(text: string): void {
  if (isMuted() || !text) return
  stopSpeaking()
  if (VB_PROFILE) {
    voiceboxSpeak(text).catch(() => browserSpeak(text)) // fall back if Voicebox fails
  } else {
    browserSpeak(text)
  }
}

export function stopSpeaking(): void {
  if (current) {
    current.pause()
    current.src = ''
    current = null
  }
  try {
    window.speechSynthesis?.cancel()
  } catch {
    /* ignore */
  }
}

async function voiceboxSpeak(text: string): Promise<void> {
  const res = await fetch('/voicebox/generate/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile_id: VB_PROFILE, text, engine: VB_ENGINE, normalize: true }),
  })
  if (!res.ok) throw new Error(`voicebox ${res.status}`)
  const url = URL.createObjectURL(await res.blob())
  const audio = new Audio(url)
  current = audio
  audio.onended = audio.onerror = () => URL.revokeObjectURL(url)
  await audio.play()
}

function browserSpeak(text: string): void {
  try {
    const s = window.speechSynthesis
    if (!s) return
    s.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 1.05
    u.lang = 'en-US'
    s.speak(u)
  } catch {
    /* speech unavailable — the text is on screen anyway */
  }
}

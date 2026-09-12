// Browser-native speech-to-text. No Python sidecar, no API key — the Web
// Speech API does the transcription on-device / via the browser's own service.
// Chrome + Edge support it; elsewhere we fall back to the "type it" input.

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyWindow = typeof window & {
  SpeechRecognition?: any
  webkitSpeechRecognition?: any
}

function getCtor(): any {
  const w = window as AnyWindow
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export function isSpeechSupported(): boolean {
  return getCtor() !== null
}

export interface SpeechController {
  stop: () => void
}

export function startListening(opts: {
  onInterim: (text: string) => void
  onFinal: (text: string) => void
  onError: (message: string) => void
}): SpeechController | null {
  const Ctor = getCtor()
  if (!Ctor) return null

  const rec = new Ctor()
  rec.lang = 'en-US'
  rec.interimResults = true
  // Click to start, click to stop — keep listening until stop() (don't cut off
  // on the first pause). Better on a laptop where you can't press-and-hold.
  rec.continuous = true

  let finalText = ''

  // Auto-stop after a few seconds of silence, so you don't have to click stop
  // and it can't run on forever repeating. Reset on every bit of speech.
  const SILENCE_MS = 3000
  let silence: ReturnType<typeof setTimeout> | null = null
  const clearSilence = () => {
    if (silence) clearTimeout(silence)
    silence = null
  }
  const armSilence = () => {
    clearSilence()
    silence = setTimeout(() => {
      try {
        rec.stop()
      } catch {
        /* already stopped */
      }
    }, SILENCE_MS)
  }

  rec.onstart = () => armSilence()

  rec.onresult = (e: any) => {
    armSilence() // heard something — restart the silence clock
    let interim = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const chunk = e.results[i][0].transcript
      if (e.results[i].isFinal) finalText += chunk
      else interim += chunk
    }
    opts.onInterim((finalText + interim).trim())
  }

  let hardError = false
  rec.onerror = (e: any) => {
    // 'aborted' / 'no-speech' are benign — the user stopped or paused. Don't
    // shout; just let onend finalize whatever we heard.
    if (e.error === 'aborted' || e.error === 'no-speech') return
    clearSilence()
    hardError = true
    const map: Record<string, string> = {
      'not-allowed': 'Microphone blocked — allow mic access in the address bar, then try again.',
      'service-not-allowed': 'This browser blocked its speech service. Use Chrome, or just type below.',
      'network': "Voice needs a connection (the browser's speech service is offline). Type below instead.",
      'audio-capture': 'No microphone found. Type below instead.',
      'language-not-supported': 'Language not supported here — type below instead.',
    }
    opts.onError(map[e.error] || `Voice unavailable here (${e.error || 'unknown'}). Type below instead.`)
  }

  rec.onend = () => {
    clearSilence()
    // If we errored, onError already fired; don't also push an empty final.
    if (!hardError) opts.onFinal(finalText.trim())
  }

  try {
    rec.start()
  } catch {
    opts.onError('Could not start recording.')
    return null
  }

  return { stop: () => rec.stop() }
}

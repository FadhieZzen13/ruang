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

  rec.onresult = (e: any) => {
    let interim = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const chunk = e.results[i][0].transcript
      if (e.results[i].isFinal) finalText += chunk
      else interim += chunk
    }
    opts.onInterim((finalText + interim).trim())
  }

  rec.onerror = (e: any) => {
    const map: Record<string, string> = {
      'not-allowed': 'Microphone blocked — allow mic access and try again.',
      'no-speech': "Didn't catch that — try again.",
      'audio-capture': 'No microphone found.',
    }
    opts.onError(map[e.error] || 'Speech recognition failed. Try typing it instead.')
  }

  rec.onend = () => {
    opts.onFinal(finalText.trim())
  }

  try {
    rec.start()
  } catch {
    opts.onError('Could not start recording.')
    return null
  }

  return { stop: () => rec.stop() }
}

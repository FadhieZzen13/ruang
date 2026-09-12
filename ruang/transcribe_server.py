#!/usr/bin/env python3
"""RUANG transcribe sidecar.

A thin HTTP wrapper around the whisper transcription logic extracted from
Jarvis/backtalk's `ears.py`. The PWA records audio with MediaRecorder and
POSTs raw int16 mono 16kHz PCM bytes here; this returns the transcript.

Local-only (127.0.0.1), single purpose. The transcription path is the same
one Zen already verified: mlx-whisper on the Apple GPU when available,
faster-whisper on CPU otherwise, model `small.en`.

Run:
    python transcribe_server.py
    # or with a port:  PORT=8765 python transcribe_server.py
"""

import os
import re
import sys

import numpy as np

RATE = 16000
MODEL_NAME = os.environ.get("RUANG_STT_MODEL", "small.en")
PORT = int(os.environ.get("PORT", "8765"))

_NONSPEECH = re.compile(r"[\[(][^\])]*[\])]")

_model = None
_backend = None


def _apple_gpu_available() -> bool:
    """Apple Silicon only: mlx-whisper runs the same model on the GPU."""
    if sys.platform != "darwin" or os.uname().machine != "arm64":
        return False
    try:
        import mlx_whisper  # noqa: F401
    except ImportError:
        return False
    return True


def warm():
    global _model, _backend
    if _model is None:
        if _apple_gpu_available():
            import mlx_whisper
            repo = f"mlx-community/whisper-{MODEL_NAME}-mlx"
            print(f"[transcribe] loading {MODEL_NAME} on the Apple GPU...", flush=True)
            mlx_whisper.transcribe(np.zeros(RATE // 10, dtype=np.float32),
                                   path_or_hf_repo=repo, language="en", verbose=None)
            _model, _backend = repo, "mlx"
        else:
            from faster_whisper import WhisperModel
            print(f"[transcribe] loading {MODEL_NAME} on CPU...", flush=True)
            _model = WhisperModel(MODEL_NAME, device="cpu", compute_type="int8")
            _backend = "faster-whisper"
        print(f"[transcribe] model ready ({_backend})", flush=True)
    return _model


def transcribe(pcm: np.ndarray) -> str:
    """int16 mono 16kHz -> text. Strips whisper's bracketed non-speech markers."""
    model = warm()
    audio = pcm.astype(np.float32) / 32768.0
    lang = "en" if MODEL_NAME.endswith(".en") else None
    if _backend == "mlx":
        import mlx_whisper
        text = mlx_whisper.transcribe(audio, path_or_hf_repo=model,
                                      temperature=0.0, language=lang,
                                      verbose=None)["text"].strip()
    else:
        segments, _ = model.transcribe(audio, temperature=0.0, language=lang)
        text = "".join(s.text for s in segments).strip()
    return _NONSPEECH.sub("", text).strip()


def main():
    from http.server import BaseHTTPRequestHandler, HTTPServer

    warm()

    class Handler(BaseHTTPRequestHandler):
        def _cors(self):
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")

        def do_OPTIONS(self):
            self.send_response(204)
            self._cors()
            self.end_headers()

        def do_POST(self):
            if self.path.rstrip("/") != "/transcribe":
                self.send_response(404)
                self._cors()
                self.end_headers()
                return
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length)
            if not raw:
                self.send_response(400)
                self._cors()
                self.end_headers()
                self.wfile.write(b'{"error":"empty body"}')
                return
            pcm = np.frombuffer(raw, dtype=np.int16)
            text = transcribe(pcm)
            body = ('{"text": ' + __import__("json").dumps(text) + '}').encode()
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args):
            pass

    print(f"[transcribe] listening on 127.0.0.1:{PORT}", flush=True)
    HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()

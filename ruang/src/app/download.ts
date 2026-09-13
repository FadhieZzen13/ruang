// Hand the browser a file. Used for the .ics that carries a whole plan.
//
// On a phone this is the useful path: Android offers "open with Calendar",
// and iOS Safari hands the .ics straight to Calendar, which shows every event
// in it and adds them together.
export function downloadFile(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Give the browser a moment to start the download before dropping the blob.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

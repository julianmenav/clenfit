export type DeliverOutcome = 'shared' | 'downloaded' | 'cancelled' | 'failed'

export function reportFilename(fromKey: string, toKey: string): string {
  return `informe-${fromKey}-a-${toKey}.md`
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * Hands a text file to the OS share sheet when the browser can share files
 * (iOS/Android: «Guardar en Archivos» sits next to the LLM apps), otherwise
 * triggers a plain download. A dismissed share sheet is 'cancelled', not an
 * error. Must be called from a user gesture (share requires it).
 */
export async function deliverTextFile(
  filename: string,
  text: string,
  mime = 'text/markdown',
): Promise<DeliverOutcome> {
  const file = new File([text], filename, { type: mime })
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
      // e.g. NotAllowedError when the gesture expired: fall through to a download
    }
  }
  return downloadBlob(file, filename)
}

function downloadBlob(blob: Blob, filename: string): DeliverOutcome {
  try {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    // the click has already captured the URL; revoke once the download has started
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    return 'downloaded'
  } catch {
    return 'failed'
  }
}

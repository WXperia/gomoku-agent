let cachedFingerprint: string | null = null

export async function getBrowserFingerprint(): Promise<string> {
  if (cachedFingerprint) return cachedFingerprint
  if (typeof window === 'undefined') return ''

  try {
    const FingerprintJS = await import('@fingerprintjs/fingerprintjs')
    const fp = await FingerprintJS.load()
    const result = await fp.get()
    cachedFingerprint = result.visitorId
    return cachedFingerprint
  } catch {
    const fallback = [
      navigator.userAgent,
      navigator.language,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      `${screen.width}x${screen.height}`,
      String(window.devicePixelRatio),
    ].join('|')
    const bytes = new TextEncoder().encode(fallback)
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    cachedFingerprint = Array.from(new Uint8Array(digest))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('')
    return cachedFingerprint
  }
}

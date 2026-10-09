import { open } from '@tauri-apps/plugin-shell'

export const DEVELOPER_LINKEDIN_URL = 'https://www.linkedin.com/in/khaledeldaoudy/'
export const DEVELOPER_NAME = 'Khaled Eldaoudy'

/**
 * Opens a URL in the system's default browser.
 * Works in both Tauri (desktop) and browser (dev).
 */
export async function openUrl(url: string): Promise<boolean> {
  if (!url) return false

  // Normalize URL
  let normalizedUrl = url.trim()
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://') && !normalizedUrl.startsWith('mailto:')) {
    normalizedUrl = 'https://' + normalizedUrl
  }

  // Try Tauri shell plugin first
  if (typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)) {
    try {
      await open(normalizedUrl)
      return true
    } catch (err) {
      console.error('[openUrl] Tauri shell failed:', err)
      // Try native Rust command fallback
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('open_external_url', { url: normalizedUrl })
        return true
      } catch (invokeErr) {
        console.error('[openUrl] Tauri invoke fallback failed:', invokeErr)
      }
    }
  }

  // Browser fallback
  try {
    const newWindow = window.open(normalizedUrl, '_blank', 'noopener,noreferrer')
    if (!newWindow) {
      console.warn('[openUrl] Popup blocked — trying location')
      // Last resort
      window.location.href = normalizedUrl
    }
    return true
  } catch (err) {
    console.error('[openUrl] Browser fallback failed:', err)
    return false
  }
}

/**
 * Alias for openUrl for backward compatibility.
 */
export async function openExternalUrl(url: string): Promise<void> {
  await openUrl(url)
}

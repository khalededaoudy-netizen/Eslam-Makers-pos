export const DEVELOPER_LINKEDIN_URL = 'https://www.linkedin.com/in/khaledeldaoudy/'
export const DEVELOPER_NAME = 'Khaled Eldaoudy'

/**
 * Safely opens an external URL in the user's default system browser.
 * 1. Uses Tauri 2 native open_external_url backend command.
 * 2. Falls back to @tauri-apps/plugin-shell if available.
 * 3. Falls back to window.open for web/browser environments.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (!url) return
  const cleanUrl = url.trim()

  const isTauri = typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)

  if (isTauri) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('open_external_url', { url: cleanUrl })
      return
    } catch (invokeErr) {
      console.warn('[openExternalUrl] Native open_external_url command error, attempting fallback:', invokeErr)
    }

    try {
      const { open } = await import('@tauri-apps/plugin-shell')
      await open(cleanUrl)
      return
    } catch (shellErr) {
      console.warn('[openExternalUrl] plugin-shell open fallback error:', shellErr)
    }
  }

  // Web / Browser environment fallback
  try {
    const win = window.open(cleanUrl, '_blank', 'noopener,noreferrer')
    if (!win) {
      console.warn('[openExternalUrl] window.open returned null or was blocked by popup blocker')
    }
  } catch (webErr) {
    console.error('[openExternalUrl] Failed to open external URL in browser:', webErr)
  }
}

import { open } from '@tauri-apps/plugin-shell'

export const DEVELOPER_LINKEDIN_URL = 'https://www.linkedin.com/in/khaledeldaoudy/'
export const DEVELOPER_NAME = 'Khaled Eldaoudy'

/**
 * Safely opens an external URL in the user's default system browser.
 * Integrates with Tauri 2 plugin-shell with standard web fallback.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (!url) return
  try {
    await open(url)
  } catch (err) {
    console.warn('[openExternalUrl] Tauri shell open failed, using browser fallback:', err)
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

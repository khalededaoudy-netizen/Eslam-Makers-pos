/**
 * MAKERS POS — Settings Helper
 * High-performance cached accessor for application settings stored in SQLite.
 */

import { getDb } from '../db/database'

let cache: Record<string, string> = {}
let cacheTime = 0
const CACHE_TTL = 5000

export async function getSetting(key: string): Promise<string | null> {
  if (Date.now() - cacheTime > CACHE_TTL || !(key in cache)) {
    try {
      const db = getDb()
      const rows = await db.select<{ key: string; value: string }[]>('SELECT key, value FROM settings')
      cache = Object.fromEntries(rows.map(r => [r.key, r.value]))
      cacheTime = Date.now()
    } catch (err) {
      console.warn('[getSetting] Failed to fetch settings from DB:', err)
      return cache[key] ?? null
    }
  }
  return cache[key] ?? null
}

export async function getSettingBool(key: string, defaultValue = false): Promise<boolean> {
  const v = await getSetting(key)
  if (v === null || v === undefined) return defaultValue
  return v === '1' || v === 'true'
}

export async function getSettingNumber(key: string, defaultValue = 0): Promise<number> {
  const v = await getSetting(key)
  if (v === null || v === undefined) return defaultValue
  const n = Number(v)
  return isNaN(n) ? defaultValue : n
}

export function invalidateSettingsCache(): void {
  cache = {}
  cacheTime = 0
}

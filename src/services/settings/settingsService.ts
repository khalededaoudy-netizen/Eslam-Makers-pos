/**
 * MAKERS POS — Settings Service
 * Persistent SQLite-backed configuration management with RBAC and Audit Logging
 */

import { getDb } from '../db/database'
import { auditService } from '../audit/auditService'
import type { AuthUser } from '../auth/authService'

export interface SystemSettings {
  language: 'ar' | 'en'
  theme: 'dark' | 'light'
  store_name: string
  store_name_ar: string
  store_subtitle: string
  store_subtitle_ar: string
  store_phone: string
  store_address: string
  store_address_ar: string
  currency: string
  currency_symbol: string
  tax_enabled: boolean
  tax_rate: number
  low_stock_threshold: number
  receipt_header: string
  receipt_footer: string
  receipt_paper_width: '58mm' | '80mm'
  default_printer: string
  barcode_format: string
  auto_open_drawer: boolean
  allow_negative_stock: boolean
}

export const DEFAULT_SETTINGS: Record<string, { value: string; category: string; description?: string }> = {
  language: { value: 'ar', category: 'general', description: 'Application UI Language' },
  theme: { value: 'dark', category: 'general', description: 'Application Theme (dark/light)' },
  store_name: { value: 'MAKERS', category: 'store', description: 'Store Name (English)' },
  store_name_ar: { value: 'ميكرز', category: 'store', description: 'Store Name (Arabic)' },
  store_subtitle: { value: 'Electronics Components & Makers Store', category: 'store', description: 'Store Subtitle' },
  store_subtitle_ar: { value: 'مكونات إلكترونية ومتجر المبدعين', category: 'store', description: 'Store Subtitle Arabic' },
  store_phone: { value: '+20 100 000 0000', category: 'store', description: 'Contact Phone' },
  store_address: { value: 'Cairo, Egypt', category: 'store', description: 'Store Address' },
  store_address_ar: { value: 'القاهرة، مصر', category: 'store', description: 'Store Address Arabic' },
  currency: { value: 'EGP', category: 'pos', description: 'Currency Code' },
  currency_symbol: { value: 'ج.م', category: 'pos', description: 'Currency Symbol' },
  tax_enabled: { value: '0', category: 'pos', description: 'Enable Sales Tax (1/0)' },
  tax_rate: { value: '14', category: 'pos', description: 'Sales Tax Rate %' },
  low_stock_threshold: { value: '5', category: 'pos', description: 'Default Low Stock Alert Threshold' },
  receipt_header: { value: 'MAKERS Electronics\nمكونات إلكترونية ومشاريع', category: 'receipt', description: 'Receipt Top Header' },
  receipt_footer: { value: 'Thank you for shopping with us!\nشكراً لزيارتكم', category: 'receipt', description: 'Receipt Bottom Footer' },
  receipt_paper_width: { value: '80mm', category: 'receipt', description: 'Receipt Paper Width (58mm/80mm)' },
  default_printer: { value: 'Default', category: 'receipt', description: 'Default Receipt Printer Name' },
  barcode_format: { value: 'CODE128', category: 'barcode', description: 'Barcode Symbology Format' },
  auto_open_drawer: { value: '1', category: 'hardware', description: 'Open Cash Drawer on Sale' },
  allow_negative_stock: { value: '0', category: 'inventory', description: 'Allow Selling Out of Stock Items' },
}

class SettingsService {
  /**
   * Initializes settings in SQLite.
   * Handles migration from localStorage if SQLite is missing entries.
   */
  async initSettings(): Promise<void> {
    const db = getDb()

    // 1. Fetch existing settings from SQLite
    const rows = await db.select<Array<{ key: string; value: string; category: string }>>(
      'SELECT key, value, category FROM settings'
    )
    const existingKeys = new Set(rows.map(r => r.key))

    // 2. Check if localStorage has old settings for initial migration
    let localCache: any = null
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem('makers-pos-settings')
        if (raw) {
          const parsed = JSON.parse(raw)
          localCache = parsed?.state ?? parsed
        }
      }
    } catch {
      // Ignore localStorage parse errors
    }

    // 3. Ensure every default setting exists in SQLite
    for (const [key, meta] of Object.entries(DEFAULT_SETTINGS)) {
      if (!existingKeys.has(key)) {
        let initialVal = meta.value

        // Migrate from localStorage if available
        if (localCache) {
          if (key === 'language' && (localCache.language === 'ar' || localCache.language === 'en')) {
            initialVal = localCache.language
          } else if (key === 'theme' && (localCache.theme === 'dark' || localCache.theme === 'light')) {
            initialVal = localCache.theme
          } else if (key === 'store_name' && localCache.storeName) {
            initialVal = localCache.storeName
          } else if (key === 'store_name_ar' && localCache.storeNameAr) {
            initialVal = localCache.storeNameAr
          } else if (key === 'currency' && localCache.currency) {
            initialVal = localCache.currency
          } else if (key === 'currency_symbol' && localCache.currencySymbol) {
            initialVal = localCache.currencySymbol
          }
        }

        await db.execute(
          `INSERT OR IGNORE INTO settings (key, value, category, description) VALUES (?, ?, ?, ?)`,
          [key, initialVal, meta.category, meta.description ?? '']
        )
      }
    }
  }

  /**
   * Fetches all settings from SQLite and returns a strongly-typed SystemSettings object.
   */
  async getAllSettings(): Promise<SystemSettings> {
    const db = getDb()
    const rows = await db.select<Array<{ key: string; value: string; category: string }>>(
      'SELECT key, value, category FROM settings'
    )

    const map: Record<string, string> = {}
    for (const r of rows) {
      map[r.key] = r.value
    }

    return {
      language: (map['language'] === 'en' ? 'en' : 'ar') as 'ar' | 'en',
      theme: (map['theme'] === 'light' ? 'light' : 'dark') as 'dark' | 'light',
      store_name: map['store_name'] ?? DEFAULT_SETTINGS.store_name.value,
      store_name_ar: map['store_name_ar'] ?? DEFAULT_SETTINGS.store_name_ar.value,
      store_subtitle: map['store_subtitle'] ?? DEFAULT_SETTINGS.store_subtitle.value,
      store_subtitle_ar: map['store_subtitle_ar'] ?? DEFAULT_SETTINGS.store_subtitle_ar.value,
      store_phone: map['store_phone'] ?? DEFAULT_SETTINGS.store_phone.value,
      store_address: map['store_address'] ?? DEFAULT_SETTINGS.store_address.value,
      store_address_ar: map['store_address_ar'] ?? DEFAULT_SETTINGS.store_address_ar.value,
      currency: map['currency'] ?? DEFAULT_SETTINGS.currency.value,
      currency_symbol: map['currency_symbol'] ?? DEFAULT_SETTINGS.currency_symbol.value,
      tax_enabled: map['tax_enabled'] === '1' || map['tax_enabled'] === 'true',
      tax_rate: isNaN(Number(map['tax_rate'])) ? 14 : Number(map['tax_rate']),
      low_stock_threshold: isNaN(Number(map['low_stock_threshold'])) ? 5 : Number(map['low_stock_threshold']),
      receipt_header: map['receipt_header'] ?? DEFAULT_SETTINGS.receipt_header.value,
      receipt_footer: map['receipt_footer'] ?? DEFAULT_SETTINGS.receipt_footer.value,
      receipt_paper_width: (map['receipt_paper_width'] === '58mm' ? '58mm' : '80mm'),
      default_printer: map['default_printer'] ?? DEFAULT_SETTINGS.default_printer.value,
      barcode_format: map['barcode_format'] ?? DEFAULT_SETTINGS.barcode_format.value,
      auto_open_drawer: map['auto_open_drawer'] !== '0',
      allow_negative_stock: map['allow_negative_stock'] === '1',
    }
  }

  /**
   * Retrieves a single setting by key.
   */
  async getSetting(key: string, defaultValue = ''): Promise<string> {
    const db = getDb()
    const rows = await db.select<Array<{ value: string }>>(
      'SELECT value FROM settings WHERE key = ? LIMIT 1',
      [key]
    )
    return rows.length > 0 ? rows[0].value : defaultValue
  }

  /**
   * Updates a single setting with validation and RBAC enforcement.
   */
  async updateSetting(
    key: string,
    value: string,
    category = 'general',
    description = '',
    actor?: AuthUser | null
  ): Promise<void> {
    await this.updateSettings({ [key]: value }, actor, category)
  }

  /**
   * Updates multiple settings in SQLite with input validation, RBAC check, and audit logging.
   */
  async updateSettings(
    updates: Record<string, string | number | boolean>,
    actor?: AuthUser | null,
    category = 'general'
  ): Promise<void> {
    // 1. RBAC enforcement
    if (!actor || !actor.isActive) {
      throw new Error('unauthenticated')
    }

    const isAdmin = actor.roleName === 'admin'
    const hasPermission = isAdmin || (actor.permissions && (
      actor.permissions.includes('*') ||
      actor.permissions.includes('settings:*') ||
      actor.permissions.includes('settings:update') ||
      actor.permissions.includes('settings:edit')
    ))

    if (!hasPermission) {
      throw new Error('permission_denied')
    }

    // 2. Input validation
    if ('store_name' in updates) {
      const name = String(updates.store_name).trim()
      if (!name) throw new Error('store_name_required')
    }

    if ('tax_rate' in updates) {
      const rate = Number(updates.tax_rate)
      if (isNaN(rate) || rate < 0 || rate > 100) {
        throw new Error('invalid_tax_rate')
      }
    }

    if ('low_stock_threshold' in updates) {
      const threshold = Number(updates.low_stock_threshold)
      if (isNaN(threshold) || threshold < 0) {
        throw new Error('invalid_low_stock_threshold')
      }
    }

    if ('receipt_paper_width' in updates) {
      const width = String(updates.receipt_paper_width)
      if (width !== '58mm' && width !== '80mm') {
        throw new Error('invalid_paper_width')
      }
    }

    if ('store_phone' in updates && updates.store_phone) {
      const phone = String(updates.store_phone).trim()
      if (phone && !/^[+0-9\s\-()]{6,25}$/.test(phone)) {
        throw new Error('invalid_phone')
      }
    }

    // 3. Persist to SQLite
    const db = getDb()
    const safeChanges: Record<string, string> = {}

    for (const [k, v] of Object.entries(updates)) {
      let strVal = ''
      if (typeof v === 'boolean') {
        strVal = v ? '1' : '0'
      } else {
        strVal = String(v)
      }

      const itemCategory = DEFAULT_SETTINGS[k]?.category ?? category
      const itemDesc = DEFAULT_SETTINGS[k]?.description ?? ''

      await db.execute(
        `INSERT INTO settings (key, value, category, description, updated_at)
         VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           category = excluded.category,
           updated_at = excluded.updated_at`,
        [k, strVal, itemCategory, itemDesc]
      )

      safeChanges[k] = strVal
    }

    // 4. Audit logging
    await auditService.log({
      userId: actor.id,
      userFullName: actor.fullName || actor.username,
      action: 'update_settings',
      resource: 'settings',
      resourceId: category,
      details: {
        category,
        updatedKeys: Object.keys(safeChanges),
        changes: safeChanges,
      },
    })
  }
}

export const settingsService = new SettingsService()

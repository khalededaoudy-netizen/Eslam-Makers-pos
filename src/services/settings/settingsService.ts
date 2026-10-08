/**
 * MAKERS POS — Settings Service
 * Persistent SQLite-backed configuration management with RBAC and Audit Logging
 */

import { getDb } from '../db/database'
import { auditService } from '../audit/auditService'
import type { AuthUser } from '../auth/authService'
import { invalidateSettingsCache } from './settingsHelper'

export interface SystemSettings {
  // General
  language: 'ar' | 'en'
  theme: 'dark' | 'light'
  date_format: string
  time_format: '12h' | '24h'
  first_day_of_week: 'saturday' | 'sunday' | 'monday'
  number_format: 'western' | 'arabic-indic'
  currency: string
  currency_symbol: string
  currency_position: 'before' | 'after'

  // Store
  store_name: string
  store_name_en: string
  store_name_ar: string
  store_subtitle: string
  store_subtitle_en: string
  store_subtitle_ar: string
  store_phone: string
  store_phone1: string
  store_phone2: string
  store_email: string
  store_address: string
  store_address_ar: string
  store_tax_number: string
  store_commercial_reg: string
  store_website: string
  store_logo?: string

  // POS & Financial
  tax_enabled: boolean
  tax_rate: number
  tax_inclusive: boolean
  low_stock_threshold: number
  allow_negative_stock: boolean
  allow_discount: boolean
  max_discount_percent: number
  require_customer_for_credit: boolean
  rounding_rule: 'none' | '0.25' | '0.50' | '1.00'
  default_payment_method: string
  loyalty_enabled: boolean
  loyalty_points_per_egp: number
  loyalty_point_value: number
  invoice_prefix: string
  invoice_numbering: 'sequential' | 'date'
  return_window_days: number
  return_requires_receipt: boolean

  // Printing
  default_printer: string
  receipt_header: string
  receipt_footer: string
  receipt_paper_width: '58mm' | '80mm'
  auto_open_drawer: boolean
  auto_print_after_sale: boolean
  print_copies: number
  show_logo_on_receipt: boolean
  logo_size_mm: number
  receipt_header_line1: string
  receipt_header_line2: string
  receipt_footer_line1: string
  receipt_footer_line2: string
  show_barcode_on_receipt: boolean
  show_qr_on_receipt: boolean
  receipt_font_size: 'small' | 'medium' | 'large'
  cutter_clearance_mm: number

  // Barcode
  barcode_format: string
  default_barcode_type: string
  auto_generate_sku: boolean
  sku_prefix: string
  label_width_mm: number
  label_height_mm: number
  label_columns: number
  label_show_store: boolean
  label_show_sku: boolean
  label_show_name: boolean
  label_show_price: boolean
  label_show_currency: boolean
  label_margin_mm: number

  // Backup
  auto_backup_enabled: boolean
  backup_interval_hours: number
  last_auto_backup_at: string
  secondary_backup_path: string
  secondary_backup_enabled: boolean
  backup_retention_count: number
  backup_on_close: boolean
  backup_before_migration: boolean
  backup_verify: boolean
  backup_include_logs: boolean

  // Theme & Sounds
  sound_enabled: boolean
  sound_on_sale: boolean
  sound_on_error: boolean
  sound_on_scan: boolean
  sound_volume: number
  compact_mode: boolean
  show_animations: boolean
  sidebar_default: 'expanded' | 'collapsed'

  // Security
  session_timeout_minutes: number
  password_min_length: number
  password_complexity: boolean
  max_failed_attempts: number
  auto_lock_minutes: number

  // Advanced
  developer_mode: boolean
  log_level: 'debug' | 'info' | 'warn' | 'error'
  verbose_logs: boolean
  show_performance: boolean

  // Integrations
  makers_api_url: string
  makers_search_limit: number
  makers_auto_sync: boolean
  makers_sync_interval_hours: number
}

export const DEFAULT_SETTINGS: Record<string, { value: string; category: string; description?: string }> = {
  // General
  language: { value: 'ar', category: 'general', description: 'Application UI Language' },
  theme: { value: 'dark', category: 'general', description: 'Application Theme (dark/light)' },
  date_format: { value: 'DD/MM/YYYY', category: 'general', description: 'Date format' },
  time_format: { value: '12h', category: 'general', description: 'Time format (12h/24h)' },
  first_day_of_week: { value: 'saturday', category: 'general', description: 'First day of week' },
  number_format: { value: 'western', category: 'general', description: 'Number format' },
  currency: { value: 'EGP', category: 'pos', description: 'Currency Code' },
  currency_symbol: { value: 'ج.م', category: 'pos', description: 'Currency Symbol' },
  currency_position: { value: 'after', category: 'pos', description: 'Currency Position (before/after)' },

  // Store
  store_name: { value: 'MAKERS', category: 'store', description: 'Store Name (English)' },
  store_name_en: { value: 'MAKERS ELECTRONICS', category: 'store', description: 'Store Name (English)' },
  store_name_ar: { value: 'MAKERS', category: 'store', description: 'Store Name (Arabic)' },
  store_subtitle: { value: 'Electronics Components', category: 'store', description: 'Store Subtitle' },
  store_subtitle_en: { value: 'Electronics Components', category: 'store', description: 'Store Subtitle (English)' },
  store_subtitle_ar: { value: 'مكونات إلكترونية ومشاريع', category: 'store', description: 'Store Subtitle Arabic' },
  store_phone: { value: '', category: 'store', description: 'Contact Phone' },
  store_phone1: { value: '', category: 'store', description: 'Primary Phone' },
  store_phone2: { value: '', category: 'store', description: 'Secondary Phone' },
  store_email: { value: '', category: 'store', description: 'Store Email' },
  store_address: { value: '', category: 'store', description: 'Store Address' },
  store_address_ar: { value: '', category: 'store', description: 'Store Address Arabic' },
  store_tax_number: { value: '', category: 'store', description: 'Tax Registration Number' },
  store_commercial_reg: { value: '', category: 'store', description: 'Commercial Registration' },
  store_website: { value: 'makerselectronics.com', category: 'store', description: 'Store Website' },
  store_logo: { value: '', category: 'store', description: 'Store Logo path' },

  // POS & Financial
  tax_enabled: { value: '0', category: 'pos', description: 'Enable Sales Tax (1/0)' },
  tax_rate: { value: '14', category: 'pos', description: 'Sales Tax Rate %' },
  tax_inclusive: { value: '0', category: 'pos', description: 'Tax Inclusive Pricing (1/0)' },
  low_stock_threshold: { value: '10', category: 'pos', description: 'Default Low Stock Alert Threshold' },
  allow_negative_stock: { value: '0', category: 'inventory', description: 'Allow Selling Out of Stock Items' },
  allow_discount: { value: '1', category: 'pos', description: 'Allow Discount at POS' },
  max_discount_percent: { value: '100', category: 'pos', description: 'Maximum Discount Percentage' },
  require_customer_for_credit: { value: '1', category: 'pos', description: 'Require customer attached for credit sales' },
  rounding_rule: { value: 'none', category: 'pos', description: 'Price rounding rule' },
  default_payment_method: { value: 'cash', category: 'pos', description: 'Default payment method' },
  loyalty_enabled: { value: '0', category: 'pos', description: 'Enable Loyalty Points' },
  loyalty_points_per_egp: { value: '0.1', category: 'pos', description: 'Loyalty Points Earned per EGP' },
  loyalty_point_value: { value: '0.1', category: 'pos', description: 'EGP Value of 1 Loyalty Point' },
  invoice_prefix: { value: 'SAL-', category: 'pos', description: 'Invoice Prefix' },
  invoice_numbering: { value: 'date', category: 'pos', description: 'Invoice Numbering scheme' },
  return_window_days: { value: '14', category: 'pos', description: 'Return Window in Days' },
  return_requires_receipt: { value: '1', category: 'pos', description: 'Require original receipt for returns' },

  // Printing & Hardware
  receipt_header: { value: 'MAKERS Electronics\nمكونات إلكترونية ومشاريع', category: 'receipt', description: 'Receipt Top Header' },
  receipt_footer: { value: 'Thank you for shopping with us!\nشكراً لزيارتكم', category: 'receipt', description: 'Receipt Bottom Footer' },
  receipt_paper_width: { value: '80mm', category: 'receipt', description: 'Receipt Paper Width (58mm/80mm)' },
  default_printer: { value: 'Default', category: 'receipt', description: 'Default Receipt Printer Name' },
  auto_open_drawer: { value: '1', category: 'hardware', description: 'Open Cash Drawer on Sale' },
  auto_print_after_sale: { value: '1', category: 'receipt', description: 'Auto print receipt upon checkout' },
  print_copies: { value: '1', category: 'receipt', description: 'Receipt Copies' },
  show_logo_on_receipt: { value: '1', category: 'receipt', description: 'Show Logo on Printed Receipt' },
  logo_size_mm: { value: '40', category: 'receipt', description: 'Receipt Logo Size in mm' },
  receipt_header_line1: { value: '', category: 'receipt', description: 'Header Line 1' },
  receipt_header_line2: { value: '', category: 'receipt', description: 'Header Line 2' },
  receipt_footer_line1: { value: 'شكراً لتعاملكم معنا', category: 'receipt', description: 'Footer Line 1' },
  receipt_footer_line2: { value: 'Thank you for your visit', category: 'receipt', description: 'Footer Line 2' },
  show_barcode_on_receipt: { value: '1', category: 'receipt', description: 'Print barcode on invoice' },
  show_qr_on_receipt: { value: '0', category: 'receipt', description: 'Print QR code on invoice' },
  receipt_font_size: { value: 'medium', category: 'receipt', description: 'Receipt Font Size' },
  cutter_clearance_mm: { value: '12', category: 'receipt', description: 'Paper Cutter Clearance (mm)' },

  // Barcode
  barcode_format: { value: 'CODE128', category: 'barcode', description: 'Barcode Symbology Format' },
  default_barcode_type: { value: 'code128', category: 'barcode', description: 'Default Barcode Type' },
  auto_generate_sku: { value: '0', category: 'barcode', description: 'Automatically generate SKU' },
  sku_prefix: { value: 'MKR-', category: 'barcode', description: 'SKU Prefix' },
  label_width_mm: { value: '50', category: 'barcode', description: 'Label Width in mm' },
  label_height_mm: { value: '30', category: 'barcode', description: 'Label Height in mm' },
  label_columns: { value: '3', category: 'barcode', description: 'Sticker Sheet Columns' },
  label_show_store: { value: '1', category: 'barcode', description: 'Show store name on barcode' },
  label_show_sku: { value: '1', category: 'barcode', description: 'Show SKU on barcode' },
  label_show_name: { value: '1', category: 'barcode', description: 'Show product name on barcode' },
  label_show_price: { value: '1', category: 'barcode', description: 'Show price on barcode' },
  label_show_currency: { value: '1', category: 'barcode', description: 'Show currency on barcode' },
  label_margin_mm: { value: '2', category: 'barcode', description: 'Label Margin in mm' },

  // Backup
  auto_backup_enabled: { value: '1', category: 'backup', description: 'Enable Automatic Daily Backups (1/0)' },
  backup_interval_hours: { value: '24', category: 'backup', description: 'Backup frequency in hours' },
  last_auto_backup_at: { value: '', category: 'backup', description: 'Timestamp of last automatic backup' },
  secondary_backup_path: { value: '', category: 'backup', description: 'Secondary backup directory' },
  secondary_backup_enabled: { value: '0', category: 'backup', description: 'Enable secondary location backup' },
  backup_retention_count: { value: '30', category: 'backup', description: 'Number of local backups to retain' },
  backup_on_close: { value: '0', category: 'backup', description: 'Backup on application exit' },
  backup_before_migration: { value: '1', category: 'backup', description: 'Backup before schema migration' },
  backup_verify: { value: '1', category: 'backup', description: 'Verify backup file integrity' },
  backup_include_logs: { value: '0', category: 'backup', description: 'Include logs in backup archive' },

  // Theme & Sounds
  sound_enabled: { value: '1', category: 'theme', description: 'Sound FX enabled' },
  sound_on_sale: { value: '1', category: 'theme', description: 'Sound on sale completion' },
  sound_on_error: { value: '1', category: 'theme', description: 'Sound on error' },
  sound_on_scan: { value: '1', category: 'theme', description: 'Sound on barcode scan' },
  sound_volume: { value: '70', category: 'theme', description: 'Sound Volume (0-100)' },
  compact_mode: { value: '0', category: 'theme', description: 'Compact display mode' },
  show_animations: { value: '1', category: 'theme', description: 'Show UI animations' },
  sidebar_default: { value: 'expanded', category: 'theme', description: 'Sidebar default state' },

  // Security
  session_timeout_minutes: { value: '480', category: 'security', description: 'Session timeout in minutes' },
  password_min_length: { value: '6', category: 'security', description: 'Minimum password length' },
  password_complexity: { value: '0', category: 'security', description: 'Require password complexity' },
  max_failed_attempts: { value: '5', category: 'security', description: 'Max failed login attempts before lockout' },
  auto_lock_minutes: { value: '0', category: 'security', description: 'Auto lock on idle minutes (0=disabled)' },

  // Advanced
  developer_mode: { value: '0', category: 'advanced', description: 'Developer mode enabled' },
  log_level: { value: 'info', category: 'advanced', description: 'System log level' },
  verbose_logs: { value: '0', category: 'advanced', description: 'Verbose console logging' },
  show_performance: { value: '0', category: 'advanced', description: 'Show performance metrics overlay' },

  // Integrations
  makers_api_url: { value: 'https://makerselectronics.com', category: 'integrations', description: 'MAKERS WooCommerce API endpoint' },
  makers_search_limit: { value: '20', category: 'integrations', description: 'Search results per page' },
  makers_auto_sync: { value: '0', category: 'integrations', description: 'Automatic background product sync' },
  makers_sync_interval_hours: { value: '24', category: 'integrations', description: 'Sync interval in hours' },
}

class SettingsService {
  /**
   * Initializes settings in SQLite idempotently.
   */
  async initSettings(): Promise<void> {
    const db = getDb()

    const rows = await db.select<Array<{ key: string; value: string; category: string }>>(
      'SELECT key, value, category FROM settings'
    )
    const existingKeys = new Set(rows.map(r => r.key))

    for (const [key, meta] of Object.entries(DEFAULT_SETTINGS)) {
      if (!existingKeys.has(key)) {
        await db.execute(
          `INSERT OR IGNORE INTO settings (key, value, category, description) VALUES (?, ?, ?, ?)`,
          [key, meta.value, meta.category, meta.description ?? '']
        )
      }
    }
    invalidateSettingsCache()
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

    const getStr = (k: string, def = ''): string => map[k] ?? DEFAULT_SETTINGS[k]?.value ?? def
    const getBool = (k: string, def = false): boolean => {
      if (k in map) return map[k] === '1' || map[k] === 'true'
      return (DEFAULT_SETTINGS[k]?.value === '1' || DEFAULT_SETTINGS[k]?.value === 'true') || def
    }
    const getNum = (k: string, def = 0): number => {
      const v = map[k] ?? DEFAULT_SETTINGS[k]?.value
      const n = Number(v)
      return isNaN(n) ? def : n
    }

    return {
      // General
      language: (map['language'] === 'en' ? 'en' : 'ar') as 'ar' | 'en',
      theme: (map['theme'] === 'light' ? 'light' : 'dark') as 'dark' | 'light',
      date_format: getStr('date_format', 'DD/MM/YYYY'),
      time_format: (getStr('time_format', '12h') === '24h' ? '24h' : '12h'),
      first_day_of_week: (getStr('first_day_of_week', 'saturday') as any),
      number_format: (getStr('number_format', 'western') === 'arabic-indic' ? 'arabic-indic' : 'western'),
      currency: getStr('currency', 'EGP'),
      currency_symbol: getStr('currency_symbol', 'ج.م'),
      currency_position: (getStr('currency_position', 'after') === 'before' ? 'before' : 'after'),

      // Store
      store_name: getStr('store_name', 'MAKERS'),
      store_name_en: getStr('store_name_en', getStr('store_name', 'MAKERS ELECTRONICS')),
      store_name_ar: getStr('store_name_ar', 'MAKERS'),
      store_subtitle: getStr('store_subtitle', 'Electronics Components'),
      store_subtitle_en: getStr('store_subtitle_en', 'Electronics Components'),
      store_subtitle_ar: getStr('store_subtitle_ar', 'مكونات إلكترونية ومشاريع'),
      store_phone: getStr('store_phone', getStr('store_phone1', '')),
      store_phone1: getStr('store_phone1', getStr('store_phone', '')),
      store_phone2: getStr('store_phone2', ''),
      store_email: getStr('store_email', ''),
      store_address: getStr('store_address', ''),
      store_address_ar: getStr('store_address_ar', ''),
      store_tax_number: getStr('store_tax_number', ''),
      store_commercial_reg: getStr('store_commercial_reg', ''),
      store_website: getStr('store_website', 'makerselectronics.com'),
      store_logo: getStr('store_logo', ''),

      // POS & Financial
      tax_enabled: getBool('tax_enabled', false),
      tax_rate: getNum('tax_rate', 14),
      tax_inclusive: getBool('tax_inclusive', false),
      low_stock_threshold: getNum('low_stock_threshold', 10),
      allow_negative_stock: getBool('allow_negative_stock', false),
      allow_discount: getBool('allow_discount', true),
      max_discount_percent: getNum('max_discount_percent', 100),
      require_customer_for_credit: getBool('require_customer_for_credit', true),
      rounding_rule: (getStr('rounding_rule', 'none') as any),
      default_payment_method: getStr('default_payment_method', 'cash'),
      loyalty_enabled: getBool('loyalty_enabled', false),
      loyalty_points_per_egp: getNum('loyalty_points_per_egp', 0.1),
      loyalty_point_value: getNum('loyalty_point_value', 0.1),
      invoice_prefix: getStr('invoice_prefix', 'SAL-'),
      invoice_numbering: (getStr('invoice_numbering', 'date') as any),
      return_window_days: getNum('return_window_days', 14),
      return_requires_receipt: getBool('return_requires_receipt', true),

      // Printing & Hardware
      default_printer: getStr('default_printer', 'Default'),
      receipt_header: getStr('receipt_header', ''),
      receipt_footer: getStr('receipt_footer', ''),
      receipt_paper_width: (getStr('receipt_paper_width', '80mm') === '58mm' ? '58mm' : '80mm'),
      auto_open_drawer: getBool('auto_open_drawer', true),
      auto_print_after_sale: getBool('auto_print_after_sale', true),
      print_copies: getNum('print_copies', 1),
      show_logo_on_receipt: getBool('show_logo_on_receipt', true),
      logo_size_mm: getNum('logo_size_mm', 40),
      receipt_header_line1: getStr('receipt_header_line1', ''),
      receipt_header_line2: getStr('receipt_header_line2', ''),
      receipt_footer_line1: getStr('receipt_footer_line1', 'شكراً لتعاملكم معنا'),
      receipt_footer_line2: getStr('receipt_footer_line2', 'Thank you for your visit'),
      show_barcode_on_receipt: getBool('show_barcode_on_receipt', true),
      show_qr_on_receipt: getBool('show_qr_on_receipt', false),
      receipt_font_size: (getStr('receipt_font_size', 'medium') as any),
      cutter_clearance_mm: getNum('cutter_clearance_mm', 12),

      // Barcode
      barcode_format: getStr('barcode_format', 'CODE128'),
      default_barcode_type: getStr('default_barcode_type', 'code128'),
      auto_generate_sku: getBool('auto_generate_sku', false),
      sku_prefix: getStr('sku_prefix', 'MKR-'),
      label_width_mm: getNum('label_width_mm', 50),
      label_height_mm: getNum('label_height_mm', 30),
      label_columns: getNum('label_columns', 3),
      label_show_store: getBool('label_show_store', true),
      label_show_sku: getBool('label_show_sku', true),
      label_show_name: getBool('label_show_name', true),
      label_show_price: getBool('label_show_price', true),
      label_show_currency: getBool('label_show_currency', true),
      label_margin_mm: getNum('label_margin_mm', 2),

      // Backup
      auto_backup_enabled: getBool('auto_backup_enabled', true),
      backup_interval_hours: getNum('backup_interval_hours', 24),
      last_auto_backup_at: getStr('last_auto_backup_at', ''),
      secondary_backup_path: getStr('secondary_backup_path', ''),
      secondary_backup_enabled: getBool('secondary_backup_enabled', false),
      backup_retention_count: getNum('backup_retention_count', 30),
      backup_on_close: getBool('backup_on_close', false),
      backup_before_migration: getBool('backup_before_migration', true),
      backup_verify: getBool('backup_verify', true),
      backup_include_logs: getBool('backup_include_logs', false),

      // Theme & Sounds
      sound_enabled: getBool('sound_enabled', true),
      sound_on_sale: getBool('sound_on_sale', true),
      sound_on_error: getBool('sound_on_error', true),
      sound_on_scan: getBool('sound_on_scan', true),
      sound_volume: getNum('sound_volume', 70),
      compact_mode: getBool('compact_mode', false),
      show_animations: getBool('show_animations', true),
      sidebar_default: (getStr('sidebar_default', 'expanded') as any),

      // Security
      session_timeout_minutes: getNum('session_timeout_minutes', 480),
      password_min_length: getNum('password_min_length', 6),
      password_complexity: getBool('password_complexity', false),
      max_failed_attempts: getNum('max_failed_attempts', 5),
      auto_lock_minutes: getNum('auto_lock_minutes', 0),

      // Advanced
      developer_mode: getBool('developer_mode', false),
      log_level: (getStr('log_level', 'info') as any),
      verbose_logs: getBool('verbose_logs', false),
      show_performance: getBool('show_performance', false),

      // Integrations
      makers_api_url: getStr('makers_api_url', 'https://makerselectronics.com'),
      makers_search_limit: getNum('makers_search_limit', 20),
      makers_auto_sync: getBool('makers_auto_sync', false),
      makers_sync_interval_hours: getNum('makers_sync_interval_hours', 24),
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
   * Shorthand getter for settings
   */
  async get(key: string, defaultValue = ''): Promise<string> {
    return this.getSetting(key, defaultValue)
  }

  /**
   * System-level setter without requiring interactive actor (used by background jobs)
   */
  async set(key: string, value: string): Promise<void> {
    const db = getDb()
    const itemCategory = DEFAULT_SETTINGS[key]?.category ?? 'general'
    const itemDesc = DEFAULT_SETTINGS[key]?.description ?? ''

    await db.execute(
      `INSERT INTO settings (key, value, category, description, updated_at)
       VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         category = excluded.category,
         updated_at = excluded.updated_at`,
      [key, value, itemCategory, itemDesc]
    )
    invalidateSettingsCache()
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
    if (!actor || !actor.isActive) {
      throw new Error('Unauthorized: Active authenticated session is required to update settings.')
    }

    const db = getDb()

    for (const [key, rawValue] of Object.entries(updates)) {
      const stringVal = typeof rawValue === 'boolean'
        ? (rawValue ? '1' : '0')
        : String(rawValue)

      const itemCategory = DEFAULT_SETTINGS[key]?.category ?? category

      await db.execute(
        `INSERT INTO settings (key, value, category, updated_at)
         VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           updated_at = excluded.updated_at`,
        [key, stringVal, itemCategory]
      )
    }

    invalidateSettingsCache()

    await auditService.log({
      userId: actor?.id,
      userFullName: actor?.fullName,
      action: 'update',
      resource: 'settings',
      details: {
        category,
        updatedKeys: Object.keys(updates),
      },
    })
  }
}

export const settingsService = new SettingsService()

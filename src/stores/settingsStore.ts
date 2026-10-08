/**
 * MAKERS POS — Settings Store
 * Manages app-wide settings with real SQLite persistence as the authoritative source of truth.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import i18n from '../services/i18n/i18n'
import { settingsService, SystemSettings } from '../services/settings/settingsService'
import { useAuthStore } from './authStore'
import type { AuthUser } from '../services/auth/authService'

export type Language = 'ar' | 'en'
export type Theme = 'dark' | 'light'
export type PaperWidth = '58mm' | '80mm'

export interface SettingsState {
  // General (Tab 1)
  language: Language
  theme: Theme
  dateFormat: string
  timeFormat: '12h' | '24h'
  firstDayOfWeek: 'saturday' | 'sunday' | 'monday'
  numberFormat: 'western' | 'arabic-indic'
  currency: string
  currencySymbol: string
  currencyPosition: 'before' | 'after'

  // Store Information (Tab 2)
  storeName: string
  storeNameEn: string
  storeNameAr: string
  storeSubtitle: string
  storeSubtitleEn: string
  storeSubtitleAr: string
  storePhone: string
  storePhone1: string
  storePhone2: string
  storeEmail: string
  storeAddress: string
  storeAddressAr: string
  storeTaxNumber: string
  storeCommercialReg: string
  storeWebsite: string
  storeLogo: string

  // POS & Financial (Tab 3)
  taxEnabled: boolean
  taxRate: number
  taxInclusive: boolean
  lowStockThreshold: number
  allowNegativeStock: boolean
  allowDiscount: boolean
  maxDiscountPercent: number
  requireCustomerForCredit: boolean
  roundingRule: 'none' | '0.25' | '0.50' | '1.00'
  defaultPaymentMethod: string
  loyaltyEnabled: boolean
  loyaltyPointsPerEgp: number
  loyaltyPointValue: number
  invoicePrefix: string
  invoiceNumbering: 'sequential' | 'date'
  returnWindowDays: number
  returnRequiresReceipt: boolean

  // Receipt & Printer (Tab 4)
  defaultPrinter: string
  receiptPaperWidth: PaperWidth
  autoPrintAfterSale: boolean
  printCopies: number
  showLogoOnReceipt: boolean
  logoSizeMm: number
  receiptHeader: string
  receiptFooter: string
  receiptHeaderLine1: string
  receiptHeaderLine2: string
  receiptFooterLine1: string
  receiptFooterLine2: string
  showBarcodeOnReceipt: boolean
  showQrOnReceipt: boolean
  receiptFontSize: 'small' | 'medium' | 'large'
  autoOpenDrawer: boolean
  cutterClearanceMm: number

  // Barcode (Tab 5)
  barcodeFormat: string
  defaultBarcodeType: string
  autoGenerateSku: boolean
  skuPrefix: string
  labelWidthMm: number
  labelHeightMm: number
  labelColumns: number
  labelShowStore: boolean
  labelShowSku: boolean
  labelShowName: boolean
  labelShowPrice: boolean
  labelShowCurrency: boolean
  labelMarginMm: number

  // DB & Backup (Tab 6)
  autoBackupEnabled: boolean
  backupIntervalHours: number
  lastAutoBackupAt: string
  secondaryBackupPath: string
  secondaryBackupEnabled: boolean
  backupRetentionCount: number
  backupOnClose: boolean
  backupBeforeMigration: boolean
  backupVerify: boolean
  backupIncludeLogs: boolean

  // Theme & Sounds (Tab 7)
  soundEnabled: boolean
  soundOnSale: boolean
  soundOnError: boolean
  soundOnScan: boolean
  soundVolume: number
  compactMode: boolean
  showAnimations: boolean
  sidebarDefault: 'expanded' | 'collapsed'

  // Security (Tab 8)
  sessionTimeoutMinutes: number
  passwordMinLength: number
  passwordComplexity: boolean
  maxFailedAttempts: number
  autoLockMinutes: number

  // Advanced (Tab 9)
  developerMode: boolean
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  verboseLogs: boolean
  showPerformance: boolean

  // Integrations (Tab 10)
  makersApiUrl: string
  makersSearchLimit: number
  makersAutoSync: boolean
  makersSyncIntervalHours: number

  // State flag
  isLoaded: boolean

  // Actions
  loadFromDb: () => Promise<void>
  setLanguage: (lang: Language, actor?: AuthUser | null) => Promise<void>
  setTheme: (theme: Theme, actor?: AuthUser | null) => Promise<void>
  setCurrency: (currency: string, symbol: string, actor?: AuthUser | null) => Promise<void>
  setStoreInfo: (name: string, nameAr: string, actor?: AuthUser | null) => Promise<void>
  saveSettings: (updates: Partial<SettingsState>, actor?: AuthUser | null) => Promise<void>
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // General Defaults
      language: 'ar',
      theme: 'dark',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '12h',
      firstDayOfWeek: 'saturday',
      numberFormat: 'western',
      currency: 'EGP',
      currencySymbol: 'ج.م',
      currencyPosition: 'after',

      // Store Defaults
      storeName: 'MAKERS',
      storeNameEn: 'MAKERS ELECTRONICS',
      storeNameAr: 'MAKERS',
      storeSubtitle: 'Electronics Components',
      storeSubtitleEn: 'Electronics Components',
      storeSubtitleAr: 'مكونات إلكترونية ومشاريع',
      storePhone: '',
      storePhone1: '',
      storePhone2: '',
      storeEmail: '',
      storeAddress: '',
      storeAddressAr: '',
      storeTaxNumber: '',
      storeCommercialReg: '',
      storeWebsite: 'makerselectronics.com',
      storeLogo: '',

      // POS Defaults
      taxEnabled: false,
      taxRate: 14,
      taxInclusive: false,
      lowStockThreshold: 10,
      allowNegativeStock: false,
      allowDiscount: true,
      maxDiscountPercent: 100,
      requireCustomerForCredit: true,
      roundingRule: 'none',
      defaultPaymentMethod: 'cash',
      loyaltyEnabled: false,
      loyaltyPointsPerEgp: 0.1,
      loyaltyPointValue: 0.1,
      invoicePrefix: 'SAL-',
      invoiceNumbering: 'date',
      returnWindowDays: 14,
      returnRequiresReceipt: true,

      // Receipt Defaults
      defaultPrinter: 'Default',
      receiptPaperWidth: '80mm',
      autoPrintAfterSale: true,
      printCopies: 1,
      showLogoOnReceipt: true,
      logoSizeMm: 40,
      receiptHeader: '',
      receiptFooter: '',
      receiptHeaderLine1: '',
      receiptHeaderLine2: '',
      receiptFooterLine1: 'شكراً لتعاملكم معنا',
      receiptFooterLine2: 'Thank you for your visit',
      showBarcodeOnReceipt: true,
      showQrOnReceipt: false,
      receiptFontSize: 'medium',
      autoOpenDrawer: true,
      cutterClearanceMm: 12,

      // Barcode Defaults
      barcodeFormat: 'CODE128',
      defaultBarcodeType: 'code128',
      autoGenerateSku: false,
      skuPrefix: 'MKR-',
      labelWidthMm: 50,
      labelHeightMm: 30,
      labelColumns: 3,
      labelShowStore: true,
      labelShowSku: true,
      labelShowName: true,
      labelShowPrice: true,
      labelShowCurrency: true,
      labelMarginMm: 2,

      // Backup Defaults
      autoBackupEnabled: true,
      backupIntervalHours: 24,
      lastAutoBackupAt: '',
      secondaryBackupPath: '',
      secondaryBackupEnabled: false,
      backupRetentionCount: 30,
      backupOnClose: false,
      backupBeforeMigration: true,
      backupVerify: true,
      backupIncludeLogs: false,

      // Theme & Sounds Defaults
      soundEnabled: true,
      soundOnSale: true,
      soundOnError: true,
      soundOnScan: true,
      soundVolume: 70,
      compactMode: false,
      showAnimations: true,
      sidebarDefault: 'expanded',

      // Security Defaults
      sessionTimeoutMinutes: 480,
      passwordMinLength: 6,
      passwordComplexity: false,
      maxFailedAttempts: 5,
      autoLockMinutes: 0,

      // Advanced Defaults
      developerMode: false,
      logLevel: 'info',
      verboseLogs: false,
      showPerformance: false,

      // Integrations Defaults
      makersApiUrl: 'https://makerselectronics.com',
      makersSearchLimit: 20,
      makersAutoSync: false,
      makersSyncIntervalHours: 24,

      isLoaded: false,

      /**
       * Loads all settings from the authoritative SQLite database.
       */
      loadFromDb: async () => {
        try {
          const s: SystemSettings = await settingsService.getAllSettings()

          // Synchronize DOM & i18n
          i18n.changeLanguage(s.language)
          document.documentElement.lang = s.language
          document.documentElement.dir = s.language === 'ar' ? 'rtl' : 'ltr'
          const isLight = s.theme === 'light'
          document.documentElement.classList.toggle('light', isLight)
          document.documentElement.classList.toggle('dark', !isLight)
          document.documentElement.setAttribute('data-theme', s.theme)

          set({
            // General
            language: s.language,
            theme: s.theme,
            dateFormat: s.date_format,
            timeFormat: s.time_format,
            firstDayOfWeek: s.first_day_of_week,
            numberFormat: s.number_format,
            currency: s.currency,
            currencySymbol: s.currency_symbol,
            currencyPosition: s.currency_position,

            // Store
            storeName: s.store_name,
            storeNameEn: s.store_name_en,
            storeNameAr: s.store_name_ar,
            storeSubtitle: s.store_subtitle,
            storeSubtitleEn: s.store_subtitle_en,
            storeSubtitleAr: s.store_subtitle_ar,
            storePhone: s.store_phone,
            storePhone1: s.store_phone1,
            storePhone2: s.store_phone2,
            storeEmail: s.store_email,
            storeAddress: s.store_address,
            storeAddressAr: s.store_address_ar,
            storeTaxNumber: s.store_tax_number,
            storeCommercialReg: s.store_commercial_reg,
            storeWebsite: s.store_website,
            storeLogo: s.store_logo || '',

            // POS & Financial
            taxEnabled: s.tax_enabled,
            taxRate: s.tax_rate,
            taxInclusive: s.tax_inclusive,
            lowStockThreshold: s.low_stock_threshold,
            allowNegativeStock: s.allow_negative_stock,
            allowDiscount: s.allow_discount,
            maxDiscountPercent: s.max_discount_percent,
            requireCustomerForCredit: s.require_customer_for_credit,
            roundingRule: s.rounding_rule,
            defaultPaymentMethod: s.default_payment_method,
            loyaltyEnabled: s.loyalty_enabled,
            loyaltyPointsPerEgp: s.loyalty_points_per_egp,
            loyaltyPointValue: s.loyalty_point_value,
            invoicePrefix: s.invoice_prefix,
            invoiceNumbering: s.invoice_numbering,
            returnWindowDays: s.return_window_days,
            returnRequiresReceipt: s.return_requires_receipt,

            // Printing
            defaultPrinter: s.default_printer,
            receiptPaperWidth: s.receipt_paper_width,
            autoPrintAfterSale: s.auto_print_after_sale,
            printCopies: s.print_copies,
            showLogoOnReceipt: s.show_logo_on_receipt,
            logoSizeMm: s.logo_size_mm,
            receiptHeader: s.receipt_header,
            receiptFooter: s.receipt_footer,
            receiptHeaderLine1: s.receipt_header_line1,
            receiptHeaderLine2: s.receipt_header_line2,
            receiptFooterLine1: s.receipt_footer_line1,
            receiptFooterLine2: s.receipt_footer_line2,
            showBarcodeOnReceipt: s.show_barcode_on_receipt,
            showQrOnReceipt: s.show_qr_on_receipt,
            receiptFontSize: s.receipt_font_size,
            autoOpenDrawer: s.auto_open_drawer,
            cutterClearanceMm: s.cutter_clearance_mm,

            // Barcode
            barcodeFormat: s.barcode_format,
            defaultBarcodeType: s.default_barcode_type,
            autoGenerateSku: s.auto_generate_sku,
            skuPrefix: s.sku_prefix,
            labelWidthMm: s.label_width_mm,
            labelHeightMm: s.label_height_mm,
            labelColumns: s.label_columns,
            labelShowStore: s.label_show_store,
            labelShowSku: s.label_show_sku,
            labelShowName: s.label_show_name,
            labelShowPrice: s.label_show_price,
            labelShowCurrency: s.label_show_currency,
            labelMarginMm: s.label_margin_mm,

            // Backup
            autoBackupEnabled: s.auto_backup_enabled,
            backupIntervalHours: s.backup_interval_hours,
            lastAutoBackupAt: s.last_auto_backup_at,
            secondaryBackupPath: s.secondary_backup_path,
            secondaryBackupEnabled: s.secondary_backup_enabled,
            backupRetentionCount: s.backup_retention_count,
            backupOnClose: s.backup_on_close,
            backupBeforeMigration: s.backup_before_migration,
            backupVerify: s.backup_verify,
            backupIncludeLogs: s.backup_include_logs,

            // Theme & Sounds
            soundEnabled: s.sound_enabled,
            soundOnSale: s.sound_on_sale,
            soundOnError: s.sound_on_error,
            soundOnScan: s.sound_on_scan,
            soundVolume: s.sound_volume,
            compactMode: s.compact_mode,
            showAnimations: s.show_animations,
            sidebarDefault: s.sidebar_default,

            // Security
            sessionTimeoutMinutes: s.session_timeout_minutes,
            passwordMinLength: s.password_min_length,
            passwordComplexity: s.password_complexity,
            maxFailedAttempts: s.max_failed_attempts,
            autoLockMinutes: s.auto_lock_minutes,

            // Advanced
            developerMode: s.developer_mode,
            logLevel: s.log_level,
            verboseLogs: s.verbose_logs,
            showPerformance: s.show_performance,

            // Integrations
            makersApiUrl: s.makers_api_url,
            makersSearchLimit: s.makers_search_limit,
            makersAutoSync: s.makers_auto_sync,
            makersSyncIntervalHours: s.makers_sync_interval_hours,

            isLoaded: true,
          })
        } catch (err) {
          console.error('Failed to load settings from SQLite:', err)
        }
      },

      setLanguage: async (lang, actor) => {
        set({ language: lang })
        i18n.changeLanguage(lang)
        document.documentElement.lang = lang
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
        const currentActor = actor ?? useAuthStore.getState().user
        if (currentActor && currentActor.isActive) {
          await settingsService.updateSettings({ language: lang }, currentActor, 'general')
        }
      },

      setTheme: async (theme, actor) => {
        set({ theme })
        const isLight = theme === 'light'
        document.documentElement.classList.toggle('light', isLight)
        document.documentElement.classList.toggle('dark', !isLight)
        document.documentElement.setAttribute('data-theme', theme)
        const currentActor = actor ?? useAuthStore.getState().user
        if (currentActor && currentActor.isActive) {
          await settingsService.updateSettings({ theme }, currentActor, 'general')
        }
      },

      setCurrency: async (currency, currencySymbol, actor) => {
        set({ currency, currencySymbol })
        const currentActor = actor ?? useAuthStore.getState().user
        if (currentActor && currentActor.isActive) {
          await settingsService.updateSettings({ currency, currency_symbol: currencySymbol }, currentActor, 'pos')
        }
      },

      setStoreInfo: async (storeName, storeNameAr, actor) => {
        set({ storeName, storeNameAr })
        const currentActor = actor ?? useAuthStore.getState().user
        if (currentActor && currentActor.isActive) {
          await settingsService.updateSettings({ store_name: storeName, store_name_ar: storeNameAr }, currentActor, 'store')
        }
      },

      saveSettings: async (updates, actor) => {
        const currentActor = actor ?? useAuthStore.getState().user
        if (!currentActor) {
          throw new Error('unauthenticated')
        }

        const camelToSnakeMap: Record<string, string> = {
          dateFormat: 'date_format',
          timeFormat: 'time_format',
          firstDayOfWeek: 'first_day_of_week',
          numberFormat: 'number_format',
          currencyPosition: 'currency_position',
          storeName: 'store_name',
          storeNameEn: 'store_name_en',
          storeNameAr: 'store_name_ar',
          storeSubtitle: 'store_subtitle',
          storeSubtitleEn: 'store_subtitle_en',
          storeSubtitleAr: 'store_subtitle_ar',
          storePhone: 'store_phone',
          storePhone1: 'store_phone1',
          storePhone2: 'store_phone2',
          storeEmail: 'store_email',
          storeAddress: 'store_address',
          storeAddressAr: 'store_address_ar',
          storeTaxNumber: 'store_tax_number',
          storeCommercialReg: 'store_commercial_reg',
          storeWebsite: 'store_website',
          storeLogo: 'store_logo',
          currencySymbol: 'currency_symbol',
          taxEnabled: 'tax_enabled',
          taxRate: 'tax_rate',
          taxInclusive: 'tax_inclusive',
          lowStockThreshold: 'low_stock_threshold',
          allowNegativeStock: 'allow_negative_stock',
          allowDiscount: 'allow_discount',
          maxDiscountPercent: 'max_discount_percent',
          requireCustomerForCredit: 'require_customer_for_credit',
          roundingRule: 'rounding_rule',
          defaultPaymentMethod: 'default_payment_method',
          loyaltyEnabled: 'loyalty_enabled',
          loyaltyPointsPerEgp: 'loyalty_points_per_egp',
          loyaltyPointValue: 'loyalty_point_value',
          invoicePrefix: 'invoice_prefix',
          invoiceNumbering: 'invoice_numbering',
          returnWindowDays: 'return_window_days',
          returnRequiresReceipt: 'return_requires_receipt',
          defaultPrinter: 'default_printer',
          receiptPaperWidth: 'receipt_paper_width',
          autoPrintAfterSale: 'auto_print_after_sale',
          printCopies: 'print_copies',
          showLogoOnReceipt: 'show_logo_on_receipt',
          logoSizeMm: 'logo_size_mm',
          receiptHeader: 'receipt_header',
          receiptFooter: 'receipt_footer',
          receiptHeaderLine1: 'receipt_header_line1',
          receiptHeaderLine2: 'receipt_header_line2',
          receiptFooterLine1: 'receipt_footer_line1',
          receiptFooterLine2: 'receipt_footer_line2',
          showBarcodeOnReceipt: 'show_barcode_on_receipt',
          showQrOnReceipt: 'show_qr_on_receipt',
          receiptFontSize: 'receipt_font_size',
          autoOpenDrawer: 'auto_open_drawer',
          cutterClearanceMm: 'cutter_clearance_mm',
          barcodeFormat: 'barcode_format',
          defaultBarcodeType: 'default_barcode_type',
          autoGenerateSku: 'auto_generate_sku',
          skuPrefix: 'sku_prefix',
          labelWidthMm: 'label_width_mm',
          labelHeightMm: 'label_height_mm',
          labelColumns: 'label_columns',
          labelShowStore: 'label_show_store',
          labelShowSku: 'label_show_sku',
          labelShowName: 'label_show_name',
          labelShowPrice: 'label_show_price',
          labelShowCurrency: 'label_show_currency',
          labelMarginMm: 'label_margin_mm',
          autoBackupEnabled: 'auto_backup_enabled',
          backupIntervalHours: 'backup_interval_hours',
          lastAutoBackupAt: 'last_auto_backup_at',
          secondaryBackupPath: 'secondary_backup_path',
          secondaryBackupEnabled: 'secondary_backup_enabled',
          backupRetentionCount: 'backup_retention_count',
          backupOnClose: 'backup_on_close',
          backupBeforeMigration: 'backup_before_migration',
          backupVerify: 'backup_verify',
          backupIncludeLogs: 'backup_include_logs',
          soundEnabled: 'sound_enabled',
          soundOnSale: 'sound_on_sale',
          soundOnError: 'sound_on_error',
          soundOnScan: 'sound_on_scan',
          soundVolume: 'sound_volume',
          compactMode: 'compact_mode',
          showAnimations: 'show_animations',
          sidebarDefault: 'sidebar_default',
          sessionTimeoutMinutes: 'session_timeout_minutes',
          passwordMinLength: 'password_min_length',
          passwordComplexity: 'password_complexity',
          maxFailedAttempts: 'max_failed_attempts',
          autoLockMinutes: 'auto_lock_minutes',
          developerMode: 'developer_mode',
          logLevel: 'log_level',
          verboseLogs: 'verbose_logs',
          showPerformance: 'show_performance',
          makersApiUrl: 'makers_api_url',
          makersSearchLimit: 'makers_search_limit',
          makersAutoSync: 'makers_auto_sync',
          makersSyncIntervalHours: 'makers_sync_interval_hours',
        }

        const dbUpdates: Record<string, string | number | boolean> = {}

        for (const [key, val] of Object.entries(updates)) {
          if (val === undefined) continue
          const snakeKey = camelToSnakeMap[key] || key.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`)
          dbUpdates[snakeKey] = val as any

          // Sync dual keys
          if (key === 'storeName') {
            dbUpdates['store_name_en'] = val as any
          }
          if (key === 'storePhone1') {
            dbUpdates['store_phone'] = val as any
          }
        }

        await settingsService.updateSettings(dbUpdates, currentActor)
        set(updates)

        if (updates.language) {
          i18n.changeLanguage(updates.language)
          document.documentElement.lang = updates.language
          document.documentElement.dir = updates.language === 'ar' ? 'rtl' : 'ltr'
        }
        if (updates.theme) {
          const isLight = updates.theme === 'light'
          document.documentElement.classList.toggle('light', isLight)
          document.documentElement.classList.toggle('dark', !isLight)
          document.documentElement.setAttribute('data-theme', updates.theme)
        }
      },
    }),
    {
      name: 'makers-pos-settings',
      storage: createJSONStorage(() => localStorage),
    }
  )
)

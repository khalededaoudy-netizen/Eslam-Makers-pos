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
  // General
  language: Language
  theme: Theme

  // Store Information
  storeName: string
  storeNameAr: string
  storeSubtitle: string
  storeSubtitleAr: string
  storePhone: string
  storeAddress: string
  storeAddressAr: string

  // POS & Financial
  currency: string
  currencySymbol: string
  taxEnabled: boolean
  taxRate: number
  lowStockThreshold: number

  // Receipt & Printer
  receiptHeader: string
  receiptFooter: string
  receiptPaperWidth: PaperWidth
  defaultPrinter: string
  autoOpenDrawer: boolean

  // Barcode & Inventory
  barcodeFormat: string
  allowNegativeStock: boolean

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
      // Default state
      language: 'ar',
      theme: 'dark',
      storeName: 'MAKERS',
      storeNameAr: 'ميكرز',
      storeSubtitle: 'Electronics Components & Makers Store',
      storeSubtitleAr: 'مكونات إلكترونية ومتجر المبدعين',
      storePhone: '+20 100 000 0000',
      storeAddress: 'Cairo, Egypt',
      storeAddressAr: 'القاهرة، مصر',
      currency: 'EGP',
      currencySymbol: 'ج.م',
      taxEnabled: false,
      taxRate: 14,
      lowStockThreshold: 5,
      receiptHeader: 'MAKERS Electronics\nمكونات إلكترونية ومشاريع',
      receiptFooter: 'Thank you for shopping with us!\nشكراً لزيارتكم',
      receiptPaperWidth: '80mm',
      defaultPrinter: 'Default',
      autoOpenDrawer: true,
      barcodeFormat: 'CODE128',
      allowNegativeStock: false,
      isLoaded: false,

      /**
       * Loads all settings from the authoritative SQLite database.
       * Applies DOM styles and i18n immediately.
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
            language: s.language,
            theme: s.theme,
            storeName: s.store_name,
            storeNameAr: s.store_name_ar,
            storeSubtitle: s.store_subtitle,
            storeSubtitleAr: s.store_subtitle_ar,
            storePhone: s.store_phone,
            storeAddress: s.store_address,
            storeAddressAr: s.store_address_ar,
            currency: s.currency,
            currencySymbol: s.currency_symbol,
            taxEnabled: s.tax_enabled,
            taxRate: s.tax_rate,
            lowStockThreshold: s.low_stock_threshold,
            receiptHeader: s.receipt_header,
            receiptFooter: s.receipt_footer,
            receiptPaperWidth: s.receipt_paper_width,
            defaultPrinter: s.default_printer,
            barcodeFormat: s.barcode_format,
            autoOpenDrawer: s.auto_open_drawer,
            allowNegativeStock: s.allow_negative_stock,
            isLoaded: true,
          })
        } catch (err) {
          console.error('Failed to load settings from SQLite:', err)
        }
      },

      /**
       * Sets UI language, updates DOM immediately, and persists to SQLite.
       */
      setLanguage: async (lang, actor) => {
        set({ language: lang })
        i18n.changeLanguage(lang)
        document.documentElement.lang = lang
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'

        const currentActor = actor ?? useAuthStore.getState().user
        if (currentActor && currentActor.isActive) {
          try {
            await settingsService.updateSetting('language', lang, 'general', 'UI Language', currentActor)
          } catch (err) {
            console.warn('Could not persist language to SQLite:', err)
          }
        }
      },

      /**
       * Sets UI theme, updates DOM immediately, and persists to SQLite.
       */
      setTheme: async (theme, actor) => {
        set({ theme })
        const isLight = theme === 'light'
        document.documentElement.classList.toggle('light', isLight)
        document.documentElement.classList.toggle('dark', !isLight)
        document.documentElement.setAttribute('data-theme', theme)

        const currentActor = actor ?? useAuthStore.getState().user
        if (currentActor && currentActor.isActive) {
          try {
            await settingsService.updateSetting('theme', theme, 'general', 'UI Theme', currentActor)
          } catch (err) {
            console.warn('Could not persist theme to SQLite:', err)
          }
        }
      },

      /**
       * Legacy helper for currency setting
       */
      setCurrency: async (currency, currencySymbol, actor) => {
        set({ currency, currencySymbol })
        const currentActor = actor ?? useAuthStore.getState().user
        if (currentActor && currentActor.isActive) {
          await settingsService.updateSettings({ currency, currency_symbol: currencySymbol }, currentActor, 'pos')
        }
      },

      /**
       * Legacy helper for store info setting
       */
      setStoreInfo: async (storeName, storeNameAr, actor) => {
        set({ storeName, storeNameAr })
        const currentActor = actor ?? useAuthStore.getState().user
        if (currentActor && currentActor.isActive) {
          await settingsService.updateSettings({ store_name: storeName, store_name_ar: storeNameAr }, currentActor, 'store')
        }
      },

      /**
       * Comprehensive settings update.
       * Validates inputs, persists to SQLite, logs to audit, and updates Zustand.
       */
      saveSettings: async (updates, actor) => {
        const currentActor = actor ?? useAuthStore.getState().user
        if (!currentActor) {
          throw new Error('unauthenticated')
        }

        // Map frontend camelCase to SQLite snake_case
        const dbUpdates: Record<string, string | number | boolean> = {}

        if (updates.language !== undefined) dbUpdates['language'] = updates.language
        if (updates.theme !== undefined) dbUpdates['theme'] = updates.theme
        if (updates.storeName !== undefined) dbUpdates['store_name'] = updates.storeName
        if (updates.storeNameAr !== undefined) dbUpdates['store_name_ar'] = updates.storeNameAr
        if (updates.storeSubtitle !== undefined) dbUpdates['store_subtitle'] = updates.storeSubtitle
        if (updates.storeSubtitleAr !== undefined) dbUpdates['store_subtitle_ar'] = updates.storeSubtitleAr
        if (updates.storePhone !== undefined) dbUpdates['store_phone'] = updates.storePhone
        if (updates.storeAddress !== undefined) dbUpdates['store_address'] = updates.storeAddress
        if (updates.storeAddressAr !== undefined) dbUpdates['store_address_ar'] = updates.storeAddressAr
        if (updates.currency !== undefined) dbUpdates['currency'] = updates.currency
        if (updates.currencySymbol !== undefined) dbUpdates['currency_symbol'] = updates.currencySymbol
        if (updates.taxEnabled !== undefined) dbUpdates['tax_enabled'] = updates.taxEnabled
        if (updates.taxRate !== undefined) dbUpdates['tax_rate'] = updates.taxRate
        if (updates.lowStockThreshold !== undefined) dbUpdates['low_stock_threshold'] = updates.lowStockThreshold
        if (updates.receiptHeader !== undefined) dbUpdates['receipt_header'] = updates.receiptHeader
        if (updates.receiptFooter !== undefined) dbUpdates['receipt_footer'] = updates.receiptFooter
        if (updates.receiptPaperWidth !== undefined) dbUpdates['receipt_paper_width'] = updates.receiptPaperWidth
        if (updates.defaultPrinter !== undefined) dbUpdates['default_printer'] = updates.defaultPrinter
        if (updates.autoOpenDrawer !== undefined) dbUpdates['auto_open_drawer'] = updates.autoOpenDrawer
        if (updates.barcodeFormat !== undefined) dbUpdates['barcode_format'] = updates.barcodeFormat
        if (updates.allowNegativeStock !== undefined) dbUpdates['allow_negative_stock'] = updates.allowNegativeStock

        // Persist to SQLite with RBAC & Audit
        await settingsService.updateSettings(dbUpdates, currentActor)

        // Update local Zustand state
        set(updates)

        // Apply DOM effects if language or theme changed
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

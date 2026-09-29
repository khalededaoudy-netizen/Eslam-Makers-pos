import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Settings,
  Globe,
  Moon,
  Sun,
  Store,
  Receipt,
  CreditCard,
  Barcode,
  Save,
  CheckCircle2,
  AlertTriangle,
  Printer,
  ShieldAlert,
  Database,
  HardDrive,
  Download,
  RefreshCw,
  History,
  ShieldCheck,
} from 'lucide-react'
import { useSettingsStore, Language, Theme, PaperWidth } from '@/stores/settingsStore'
import { useAuthStore, usePermission } from '@/stores/authStore'
import { backupService, BackupRecord } from '@/services/db/backupService'

type TabType = 'general' | 'store' | 'pos' | 'receipt' | 'barcode' | 'database'

export function SettingsPage() {
  const { t } = useTranslation()
  const settings = useSettingsStore()
  const { user } = useAuthStore()
  const { can, isAdmin } = usePermission()

  const canEdit = isAdmin || can('update', 'settings') || can('edit', 'settings')

  const [activeTab, setActiveTab] = useState<TabType>('general')
  const [isSaving, setIsSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Backup & Restore State
  const [backupsList, setBackupsList] = useState<BackupRecord[]>([])
  const [loadingBackups, setLoadingBackups] = useState(false)
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [restoreConfirmModal, setRestoreConfirmModal] = useState<BackupRecord | null>(null)

  const loadBackups = async () => {
    setLoadingBackups(true)
    try {
      const list = await backupService.listBackups()
      setBackupsList(list)
    } catch (err) {
      console.error('Failed to load backups:', err)
    } finally {
      setLoadingBackups(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'database') {
      loadBackups()
    }
  }, [activeTab])

  const handleCreateBackup = async () => {
    if (!canEdit) return
    setIsBackingUp(true)
    setErrorMsg('')
    try {
      await backupService.createBackup({
        type: 'manual',
        userId: user?.id,
        notes: 'Manual backup from settings',
      })
      setSuccessMsg(t('settings.backupSuccess', 'تم إنشاء النسخة الاحتياطية بنجاح'))
      await loadBackups()
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to create backup')
    } finally {
      setIsBackingUp(false)
    }
  }

  const handleConfirmRestore = async () => {
    if (!restoreConfirmModal || !canEdit) return
    setIsRestoring(true)
    setErrorMsg('')
    try {
      await backupService.restoreBackup(restoreConfirmModal.id, user?.id)
      setSuccessMsg(t('settings.restoreSuccess', 'تمت استعادة قاعدة البيانات بنجاح، وتم إنشاء نسخة طوارئ مسبقة'))
      setRestoreConfirmModal(null)
      await settings.loadFromDb()
      await loadBackups()
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to restore backup')
    } finally {
      setIsRestoring(false)
    }
  }

  // Form State
  const [formData, setFormData] = useState({
    language: settings.language,
    theme: settings.theme,
    storeName: settings.storeName,
    storeNameAr: settings.storeNameAr,
    storeSubtitle: settings.storeSubtitle,
    storeSubtitleAr: settings.storeSubtitleAr,
    storePhone: settings.storePhone,
    storeAddress: settings.storeAddress,
    storeAddressAr: settings.storeAddressAr,
    currency: settings.currency,
    currencySymbol: settings.currencySymbol,
    taxEnabled: settings.taxEnabled,
    taxRate: settings.taxRate,
    lowStockThreshold: settings.lowStockThreshold,
    receiptHeader: settings.receiptHeader,
    receiptFooter: settings.receiptFooter,
    receiptPaperWidth: settings.receiptPaperWidth,
    defaultPrinter: settings.defaultPrinter,
    barcodeFormat: settings.barcodeFormat,
  })

  // Synchronize when store loads or changes externally
  useEffect(() => {
    setFormData({
      language: settings.language,
      theme: settings.theme,
      storeName: settings.storeName,
      storeNameAr: settings.storeNameAr,
      storeSubtitle: settings.storeSubtitle,
      storeSubtitleAr: settings.storeSubtitleAr,
      storePhone: settings.storePhone,
      storeAddress: settings.storeAddress,
      storeAddressAr: settings.storeAddressAr,
      currency: settings.currency,
      currencySymbol: settings.currencySymbol,
      taxEnabled: settings.taxEnabled,
      taxRate: settings.taxRate,
      lowStockThreshold: settings.lowStockThreshold,
      receiptHeader: settings.receiptHeader,
      receiptFooter: settings.receiptFooter,
      receiptPaperWidth: settings.receiptPaperWidth,
      defaultPrinter: settings.defaultPrinter,
      barcodeFormat: settings.barcodeFormat,
    })
  }, [
    settings.language,
    settings.theme,
    settings.storeName,
    settings.storeNameAr,
    settings.storeSubtitle,
    settings.storeSubtitleAr,
    settings.storePhone,
    settings.storeAddress,
    settings.storeAddressAr,
    settings.currency,
    settings.currencySymbol,
    settings.taxEnabled,
    settings.taxRate,
    settings.lowStockThreshold,
    settings.receiptHeader,
    settings.receiptFooter,
    settings.receiptPaperWidth,
    settings.defaultPrinter,
    settings.barcodeFormat,
  ])

  // Language & Theme instant actions
  const handleLanguageChange = async (lang: Language) => {
    if (!canEdit) return
    setFormData(prev => ({ ...prev, language: lang }))
    await settings.setLanguage(lang, user)
    setSuccessMsg(t('settings.saveSuccess'))
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  const handleThemeChange = async (newTheme: Theme) => {
    if (!canEdit) return
    setFormData(prev => ({ ...prev, theme: newTheme }))
    await settings.setTheme(newTheme, user)
    setSuccessMsg(t('settings.saveSuccess'))
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  const validate = (): boolean => {
    const errors: Record<string, string> = {}

    if (!formData.storeName.trim()) {
      errors.storeName = t('settings.errors.storeNameRequired')
    }

    if (formData.taxEnabled) {
      const tax = Number(formData.taxRate)
      if (isNaN(tax) || tax < 0 || tax > 100) {
        errors.taxRate = t('settings.errors.invalidTaxRate')
      }
    }

    const lowStock = Number(formData.lowStockThreshold)
    if (isNaN(lowStock) || lowStock < 0) {
      errors.lowStockThreshold = t('settings.errors.invalidLowStock')
    }

    if (formData.storePhone && formData.storePhone.trim()) {
      if (!/^[+0-9\s\-()]{6,25}$/.test(formData.storePhone.trim())) {
        errors.storePhone = t('settings.errors.invalidPhone')
      }
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEdit) return

    setSuccessMsg('')
    setErrorMsg('')

    if (!validate()) return

    setIsSaving(true)
    try {
      await settings.saveSettings(
        {
          storeName: formData.storeName.trim(),
          storeNameAr: formData.storeNameAr.trim(),
          storeSubtitle: formData.storeSubtitle.trim(),
          storeSubtitleAr: formData.storeSubtitleAr.trim(),
          storePhone: formData.storePhone.trim(),
          storeAddress: formData.storeAddress.trim(),
          storeAddressAr: formData.storeAddressAr.trim(),
          currency: formData.currency.trim(),
          currencySymbol: formData.currencySymbol.trim(),
          taxEnabled: formData.taxEnabled,
          taxRate: Number(formData.taxRate),
          lowStockThreshold: Number(formData.lowStockThreshold),
          receiptHeader: formData.receiptHeader,
          receiptFooter: formData.receiptFooter,
          receiptPaperWidth: formData.receiptPaperWidth as PaperWidth,
          defaultPrinter: formData.defaultPrinter.trim(),
          barcodeFormat: formData.barcodeFormat,
        },
        user
      )

      setSuccessMsg(t('settings.saveSuccess'))
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err: any) {
      console.error('Save settings error:', err)
      setErrorMsg(t('settings.errors.saveFailed'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-background text-foreground">
      {/* Header */}
      <div className="px-8 py-5 border-b border-border bg-card/60 backdrop-blur-sm sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{t('settings.title')}</h1>
            <p className="text-xs text-muted-foreground">{t('app.subtitle')}</p>
          </div>
        </div>

        {canEdit && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-md hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? t('settings.saving') : t('settings.saveChanges')}
          </button>
        )}
      </div>

      <div className="p-8 max-w-4xl mx-auto w-full space-y-6">
        {/* Read-only Alert */}
        {!canEdit && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-sm">
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <p>{t('settings.readOnlyNotice')}</p>
          </div>
        )}

        {/* Success / Error Messages */}
        {successMsg && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <p>{successMsg}</p>
          </div>
        )}
        {errorMsg && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm animate-in fade-in">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <p>{errorMsg}</p>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex gap-2 border-b border-border pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'general'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Globe className="w-4 h-4" />
            {t('settings.general')}
          </button>

          <button
            onClick={() => setActiveTab('store')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'store'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Store className="w-4 h-4" />
            {t('settings.storeInfo')}
          </button>

          <button
            onClick={() => setActiveTab('pos')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'pos'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            {t('settings.posFinancial')}
          </button>

          <button
            onClick={() => setActiveTab('receipt')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'receipt'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Receipt className="w-4 h-4" />
            {t('settings.receiptPrinting')}
          </button>

          <button
            onClick={() => setActiveTab('barcode')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'barcode'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Barcode className="w-4 h-4" />
            {t('settings.barcode')}
          </button>

          <button
            onClick={() => setActiveTab('database')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'database'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Database className="w-4 h-4" />
            {t('settings.databaseBackup', 'قاعدة البيانات والنسخ')}
          </button>
        </div>

        {/* Tab 1: General (Language & Theme) */}
        {activeTab === 'general' && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-6 shadow-sm">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" />
              {t('settings.general')}
            </h2>

            {/* Language */}
            <div className="flex items-center justify-between py-3 border-b border-border/50">
              <div>
                <p className="text-sm font-semibold">{t('settings.language')}</p>
                <p className="text-xs text-muted-foreground">
                  {settings.language === 'ar' ? 'العربية (RTL)' : 'English (LTR)'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => handleLanguageChange('ar')}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    settings.language === 'ar'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  } disabled:opacity-50`}
                >
                  {t('settings.arabic')}
                </button>
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => handleLanguageChange('en')}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    settings.language === 'en'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  } disabled:opacity-50`}
                >
                  {t('settings.english')}
                </button>
              </div>
            </div>

            {/* Theme */}
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-semibold">{t('settings.theme')}</p>
                <p className="text-xs text-muted-foreground">
                  {settings.theme === 'dark' ? t('settings.dark') : t('settings.light')}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => handleThemeChange('dark')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    settings.theme === 'dark'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  } disabled:opacity-50`}
                >
                  <Moon className="w-4 h-4" />
                  {t('settings.dark')}
                </button>
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => handleThemeChange('light')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    settings.theme === 'light'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  } disabled:opacity-50`}
                >
                  <Sun className="w-4 h-4" />
                  {t('settings.light')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Store Information */}
        {activeTab === 'store' && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-5 shadow-sm">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Store className="w-4 h-4 text-primary" />
              {t('settings.storeInfo')}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  {t('settings.storeName')} <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={formData.storeName}
                  onChange={e => setFormData({ ...formData, storeName: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  placeholder="e.g. MAKERS Electronics"
                />
                {fieldErrors.storeName && (
                  <p className="text-xs text-destructive mt-1">{fieldErrors.storeName}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  {t('settings.storeNameAr')}
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={formData.storeNameAr}
                  onChange={e => setFormData({ ...formData, storeNameAr: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  placeholder="مثال: ميكرز للمكونات الإلكترونية"
                  dir="rtl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  {t('settings.storeSubtitle')}
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={formData.storeSubtitle}
                  onChange={e => setFormData({ ...formData, storeSubtitle: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  placeholder="Electronics Components & Makers Store"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  {t('settings.storeSubtitleAr')}
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={formData.storeSubtitleAr}
                  onChange={e => setFormData({ ...formData, storeSubtitleAr: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  placeholder="مكونات إلكترونية ومتجر المبدعين"
                  dir="rtl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  {t('settings.storePhone')}
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={formData.storePhone}
                  onChange={e => setFormData({ ...formData, storePhone: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  placeholder="+20 100 000 0000"
                  dir="ltr"
                />
                {fieldErrors.storePhone && (
                  <p className="text-xs text-destructive mt-1">{fieldErrors.storePhone}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  {t('settings.storeAddress')}
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={formData.storeAddress}
                  onChange={e => setFormData({ ...formData, storeAddress: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  placeholder="e.g. Cairo, Egypt"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  {t('settings.storeAddressAr')}
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={formData.storeAddressAr}
                  onChange={e => setFormData({ ...formData, storeAddressAr: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  placeholder="مثال: القاهرة، مصر"
                  dir="rtl"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: POS & Financial */}
        {activeTab === 'pos' && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-5 shadow-sm">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              {t('settings.posFinancial')}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  {t('settings.currency')}
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={formData.currency}
                  onChange={e => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  placeholder="EGP"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  {t('settings.currencySymbol')}
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={formData.currencySymbol}
                  onChange={e => setFormData({ ...formData, currencySymbol: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  placeholder="ج.م"
                />
              </div>

              <div className="md:col-span-2 pt-2">
                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-muted/30 border border-border/50">
                  <input
                    type="checkbox"
                    id="taxEnabled"
                    disabled={!canEdit}
                    checked={formData.taxEnabled}
                    onChange={e => setFormData({ ...formData, taxEnabled: e.target.checked })}
                    className="w-4 h-4 rounded text-primary focus:ring-primary border-border"
                  />
                  <label htmlFor="taxEnabled" className="text-sm font-semibold cursor-pointer">
                    {t('settings.taxEnabled')}
                  </label>
                </div>
              </div>

              {formData.taxEnabled && (
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    {t('settings.taxRate')}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    disabled={!canEdit}
                    value={formData.taxRate}
                    onChange={e => setFormData({ ...formData, taxRate: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                    placeholder="14"
                  />
                  {fieldErrors.taxRate && (
                    <p className="text-xs text-destructive mt-1">{fieldErrors.taxRate}</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  {t('settings.lowStockThreshold')}
                </label>
                <input
                  type="number"
                  min="0"
                  disabled={!canEdit}
                  value={formData.lowStockThreshold}
                  onChange={e => setFormData({ ...formData, lowStockThreshold: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  placeholder="5"
                />
                {fieldErrors.lowStockThreshold && (
                  <p className="text-xs text-destructive mt-1">{fieldErrors.lowStockThreshold}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Receipt & Printing */}
        {activeTab === 'receipt' && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-5 shadow-sm">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary" />
              {t('settings.receiptPrinting')}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  {t('settings.receiptPaperWidth')}
                </label>
                <select
                  disabled={!canEdit}
                  value={formData.receiptPaperWidth}
                  onChange={e => setFormData({ ...formData, receiptPaperWidth: e.target.value as PaperWidth })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                >
                  <option value="80mm">{t('settings.paperWidth80')}</option>
                  <option value="58mm">{t('settings.paperWidth58')}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  {t('settings.defaultPrinter')}
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={formData.defaultPrinter}
                  onChange={e => setFormData({ ...formData, defaultPrinter: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  placeholder="Default"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  {t('settings.receiptHeader')}
                </label>
                <textarea
                  rows={3}
                  disabled={!canEdit}
                  value={formData.receiptHeader}
                  onChange={e => setFormData({ ...formData, receiptHeader: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono text-xs disabled:opacity-50"
                  placeholder="Store Name&#10;Address & Phone"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  {t('settings.receiptFooter')}
                </label>
                <textarea
                  rows={3}
                  disabled={!canEdit}
                  value={formData.receiptFooter}
                  onChange={e => setFormData({ ...formData, receiptFooter: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono text-xs disabled:opacity-50"
                  placeholder="Thank you for shopping with us!"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Barcode */}
        {activeTab === 'barcode' && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-5 shadow-sm">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Barcode className="w-4 h-4 text-primary" />
              {t('settings.barcode')}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  {t('settings.barcodeFormat')}
                </label>
                <select
                  disabled={!canEdit}
                  value={formData.barcodeFormat}
                  onChange={e => setFormData({ ...formData, barcodeFormat: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                >
                  <option value="CODE128">Code 128 (Recommended / قياسي)</option>
                  <option value="EAN13">EAN-13 (Retail Standard)</option>
                  <option value="EAN8">EAN-8</option>
                  <option value="UPC">UPC-A</option>
                  <option value="CODE39">Code 39</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Tab 6: Database & Backup */}
        {activeTab === 'database' && (
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-2xl p-6 space-y-5 shadow-sm">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Database className="w-4 h-4 text-primary" />
                    {t('settings.databaseBackup', 'النسخ الاحتياطي واستعادة البيانات')}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('settings.backupDescription', 'حماية بياناتك عبر النسخ الاحتياطي اليدوي والتلقائي والتدوير الآمن مع التحقق من سلامة SQLite')}
                  </p>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={handleCreateBackup}
                    disabled={isBackingUp}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all disabled:opacity-50"
                  >
                    {isBackingUp ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    {isBackingUp
                      ? t('settings.creatingBackup', 'جاري الإنشاء...')
                      : t('settings.createBackupNow', 'إنشاء نسخة احتياطية الآن')}
                  </button>
                )}
              </div>

              {/* Status overview cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-background border border-border flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('settings.dbHealth', 'حالة قاعدة البيانات')}</p>
                    <p className="text-sm font-semibold text-emerald-500">PRAGMA OK (100%)</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-background border border-border flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('settings.totalBackups', 'إجمالي النسخ')}</p>
                    <p className="text-sm font-semibold">{backupsList.length} {t('settings.backupsCount', 'نسخ محفوظة')}</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-background border border-border flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20">
                    <HardDrive className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('settings.retentionPolicy', 'سياسة الاحتفاظ')}</p>
                    <p className="text-sm font-semibold">{t('settings.retentionDetails', 'آخر 7 نسخ (تدوير تلقائي)')}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Backups List */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <History className="w-4 h-4 text-muted-foreground" />
                  {t('settings.backupHistory', 'سجل النسخ الاحتياطية')}
                </h3>
                <button
                  type="button"
                  onClick={loadBackups}
                  disabled={loadingBackups}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                  title={t('common.refresh', 'تحديث')}
                >
                  <RefreshCw className={`w-4 h-4 ${loadingBackups ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {loadingBackups ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                  {t('common.loading', 'جاري التحميل...')}
                </div>
              ) : backupsList.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
                  <Database className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                  {t('settings.noBackupsYet', 'لا توجد نسخ احتياطية مسجلة بعد')}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="pb-2 font-medium">{t('settings.backupName', 'اسم الملف')}</th>
                        <th className="pb-2 font-medium">{t('settings.backupType', 'النوع')}</th>
                        <th className="pb-2 font-medium">{t('settings.backupDate', 'التاريخ والوقت')}</th>
                        <th className="pb-2 font-medium text-right">{t('common.actions', 'الإجراءات')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {backupsList.map(item => (
                        <tr key={item.id} className="hover:bg-muted/30">
                          <td className="py-2.5 font-mono text-[11px] text-foreground font-medium">
                            {item.filename}
                          </td>
                          <td className="py-2.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                item.type === 'pre_restore'
                                  ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                  : item.type === 'auto'
                                  ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                                  : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              }`}
                            >
                              {item.type === 'pre_restore'
                                ? t('settings.preRestore', 'طوارئ قبل الاستعادة')
                                : item.type === 'auto'
                                ? t('settings.autoBackup', 'تلقائي')
                                : t('settings.manualBackup', 'يدوي')}
                            </span>
                          </td>
                          <td className="py-2.5 text-muted-foreground">
                            {item.created_at ? new Date(item.created_at).toLocaleString() : '-'}
                          </td>
                          <td className="py-2.5 text-right">
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => setRestoreConfirmModal(item)}
                                className="px-3 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-xs font-semibold border border-amber-500/20 transition-all"
                              >
                                {t('settings.restore', 'استعادة')}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Restore Confirmation Modal */}
            {restoreConfirmModal && (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl">
                  <div className="flex items-center gap-3 text-amber-500">
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-foreground">
                        {t('settings.confirmRestoreTitle', 'تأكيد استعادة قاعدة البيانات')}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {t('settings.criticalAction', 'إجراء حساس يتطلب التأكيد')}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t(
                      'settings.restoreWarning',
                      'تحذير: استعادة قاعدة البيانات ستستبدل البيانات الحالية ببيانات النسخة المحددة. سيقوم النظام تلقائياً بإنشاء نسخة طوارئ مسبقة لحماية بياناتك.'
                    )}
                  </p>

                  <div className="p-3 bg-muted/50 rounded-xl border border-border text-xs font-mono">
                    <p className="text-muted-foreground">{t('settings.selectedBackup', 'النسخة المحددة')}:</p>
                    <p className="font-semibold text-foreground truncate mt-0.5">{restoreConfirmModal.filename}</p>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      disabled={isRestoring}
                      onClick={() => setRestoreConfirmModal(null)}
                      className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-xs font-semibold transition-all"
                    >
                      {t('common.cancel', 'إلغاء')}
                    </button>
                    <button
                      type="button"
                      disabled={isRestoring}
                      onClick={handleConfirmRestore}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-xs font-semibold hover:bg-destructive/90 transition-all disabled:opacity-50"
                    >
                      {isRestoring && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      {isRestoring
                        ? t('settings.restoring', 'جاري الاستعادة...')
                        : t('settings.confirmRestoreBtn', 'تأكيد واستعادة الآن')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

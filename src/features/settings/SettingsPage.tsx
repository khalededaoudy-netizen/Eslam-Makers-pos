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
  Info,
  Linkedin,
  ArrowUpRight,
  Code2,
  Cpu,
  Sparkles,
  FolderOpen,
  Cloud,
  FileText,
  CheckCircle,
  XCircle,
  Trash2,
} from 'lucide-react'
import { useSettingsStore, Language, Theme, PaperWidth } from '@/stores/settingsStore'
import { useAuthStore, usePermission } from '@/stores/authStore'
import { backupService, BackupRecord } from '@/services/db/backupService'
import { autoBackupService } from '@/services/db/autoBackupService'
import { settingsService } from '@/services/settings/settingsService'
import { resetOperationalData, getOperationalDataCounts } from '@/services/db/resetService'
import { logger } from '@/services/db/loggerService'
import { invoke } from '@tauri-apps/api/core'
import { openExternalUrl, DEVELOPER_LINKEDIN_URL } from '@/lib/openUrl'
import { getAvailablePrinters, printTestReceiptDirect } from '@/services/printer/directPrint'

type TabType = 'general' | 'store' | 'pos' | 'receipt' | 'barcode' | 'database' | 'advanced' | 'about'

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

  // Printer List State
  const [printersList, setPrintersList] = useState<string[]>([])
  const [loadingPrinters, setLoadingPrinters] = useState(false)
  const [isTestingPrinter, setIsTestingPrinter] = useState(false)

  const loadPrinters = async () => {
    setLoadingPrinters(true)
    try {
      const list = await getAvailablePrinters()
      setPrintersList(list)
    } catch (err) {
      console.error('Failed to load printers list:', err)
    } finally {
      setLoadingPrinters(false)
    }
  }

  useEffect(() => {
    loadPrinters()
  }, [])

  useEffect(() => {
    if (activeTab === 'receipt') {
      loadPrinters()
    }
  }, [activeTab])

  const handleTestPrint = async () => {
    setIsTestingPrinter(true)
    setErrorMsg('')
    setSuccessMsg('')
    try {
      const targetPrinter = formData.defaultPrinter || 'Default'
      const res = await printTestReceiptDirect(targetPrinter)
      if (res.success) {
        setSuccessMsg(t('settings.testPrintSuccess', 'تم إرسال أمر الطباعة التجريبية بنجاح'))
        setTimeout(() => setSuccessMsg(''), 4000)
      } else {
        setErrorMsg(res.message || t('settings.testPrintError', 'فشل في الطباعة التجريبية'))
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'فشل في الطباعة التجريبية')
    } finally {
      setIsTestingPrinter(false)
    }
  }

  // Backup & Restore State
  const [backupsList, setBackupsList] = useState<BackupRecord[]>([])
  const [loadingBackups, setLoadingBackups] = useState(false)
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [restoreConfirmModal, setRestoreConfirmModal] = useState<BackupRecord | null>(null)

  // Auto Backup & Secondary Path State
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true)
  const [secondaryBackupPath, setSecondaryBackupPath] = useState('')
  const [lastAutoBackupAt, setLastAutoBackupAt] = useState('')
  const [localBackupDir, setLocalBackupDir] = useState('')
  const [secondaryPathStatus, setSecondaryPathStatus] = useState<'idle' | 'testing' | 'valid' | 'invalid'>('idle')
  const [secondaryStatusMsg, setSecondaryStatusMsg] = useState('')
  const [isTestingSecondary, setIsTestingSecondary] = useState(false)
  const [isSavingBackupConfig, setIsSavingBackupConfig] = useState(false)
  const [isRunningAutoNow, setIsRunningAutoNow] = useState(false)

  const loadBackups = async () => {
    setLoadingBackups(true)
    try {
      const list = await backupService.listBackups()
      setBackupsList(list)

      const enabledStr = await settingsService.get('auto_backup_enabled', '1')
      setAutoBackupEnabled(enabledStr === '1' || enabledStr === 'true')

      const secPath = await settingsService.get('secondary_backup_path', '')
      setSecondaryBackupPath(secPath)

      const lastAt = await settingsService.get('last_auto_backup_at', '')
      setLastAutoBackupAt(lastAt)

      const locDir = await backupService.getLocalBackupDir()
      setLocalBackupDir(locDir)
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

  // Danger Zone / Reset State
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [resetConfirmationInput, setResetConfirmationInput] = useState('')
  const [keepAuditLogsSetting, setKeepAuditLogsSetting] = useState(true)
  const [isResetting, setIsResetting] = useState(false)
  const [operationalCounts, setOperationalCounts] = useState<Record<string, number>>({})
  const [loadingCounts, setLoadingCounts] = useState(false)

  const loadOperationalCounts = async () => {
    setLoadingCounts(true)
    try {
      const counts = await getOperationalDataCounts()
      setOperationalCounts(counts)
    } catch (err) {
      console.error('Failed to load operational data counts:', err)
    } finally {
      setLoadingCounts(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'advanced') {
      loadOperationalCounts()
    }
  }, [activeTab])

  const handleExecuteReset = async () => {
    if (resetConfirmationInput.trim().toUpperCase() !== 'RESET') {
      return
    }

    setIsResetting(true)
    setErrorMsg('')
    setSuccessMsg('')
    try {
      const res = await resetOperationalData({
        userId: user?.id || 'admin',
        keepAuditLogs: keepAuditLogsSetting,
      })
      if (res.success) {
        setSuccessMsg(t('settings.resetSuccess', 'تمت إعادة ضبط جميع البيانات التشغيلية بنجاح وتم إنشاء نسخة احتياطية إجبارية!'))
        setResetModalOpen(false)
        setResetConfirmationInput('')
        await loadOperationalCounts()
        await loadBackups()
      }
    } catch (err: any) {
      setErrorMsg(err?.message || (settings.language === 'ar' ? 'فشل إعادة ضبط البيانات' : 'Failed to reset operational data'))
    } finally {
      setIsResetting(false)
    }
  }

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

  const handleTestSecondaryPath = async () => {
    if (!secondaryBackupPath.trim()) {
      setSecondaryPathStatus('invalid')
      setSecondaryStatusMsg('يرجى إدخال مسار المجلد أولاً')
      return
    }
    setIsTestingSecondary(true)
    setSecondaryPathStatus('testing')
    try {
      const accessible = await invoke<boolean>('check_path_accessible', {
        path: secondaryBackupPath.trim(),
      })
      if (accessible) {
        setSecondaryPathStatus('valid')
        setSecondaryStatusMsg('✅ المسار متاح')
      } else {
        setSecondaryPathStatus('invalid')
        setSecondaryStatusMsg('❌ المسار غير متاح')
      }
    } catch (err: any) {
      setSecondaryPathStatus('invalid')
      setSecondaryStatusMsg('❌ المسار غير متاح')
    } finally {
      setIsTestingSecondary(false)
    }
  }

  const handleSaveBackupConfig = async () => {
    if (!canEdit) return
    setIsSavingBackupConfig(true)
    setErrorMsg('')
    setSuccessMsg('')
    try {
      await settingsService.set('auto_backup_enabled', autoBackupEnabled ? '1' : '0')
      await settingsService.set('secondary_backup_path', secondaryBackupPath.trim())
      setSuccessMsg('تم حفظ إعدادات النسخ الاحتياطي التلقائي بنجاح')
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err: any) {
      setErrorMsg(err?.message || 'فشل في حفظ إعدادات النسخ')
    } finally {
      setIsSavingBackupConfig(false)
    }
  }

  const handleTriggerAutoBackupNow = async () => {
    if (!canEdit) return
    setIsRunningAutoNow(true)
    setErrorMsg('')
    setSuccessMsg('')
    try {
      const res = await autoBackupService.createBackup()
      if (res.success) {
        const msg = res.secondary
          ? 'تم إنشاء النسخة محلياً وتم نسخها إلى المسار الثانوي بنجاح'
          : 'تم إنشاء النسخة الاحتياطية محلياً بنجاح'
        setSuccessMsg(msg)
        setTimeout(() => setSuccessMsg(''), 5000)
        await loadBackups()
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'فشل تشغيل النسخ التلقائي')
    } finally {
      setIsRunningAutoNow(false)
    }
  }

  const handleExportDiagnostics = () => {
    try {
      const jsonStr = logger.exportLogsAsJson()
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `makers_pos_diagnostics_${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setSuccessMsg('تم تصدير سجلات التشخيص بنجاح')
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err: any) {
      setErrorMsg('تعذر تصدير السجلات')
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

        {canEdit && activeTab !== 'about' && (
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

          <button
            onClick={() => setActiveTab('advanced')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'advanced'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            {t('settings.advanced', 'متقدم (منطقة الخطر)')}
          </button>

          <button
            onClick={() => setActiveTab('about')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'about'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Info className="w-4 h-4" />
            {t('settings.about', 'عن النظام')}
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
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-muted-foreground">
                    {t('settings.defaultPrinter', 'طابعة الإيصالات')}
                  </label>
                  <button
                    type="button"
                    onClick={loadPrinters}
                    disabled={loadingPrinters}
                    className="text-xs text-primary hover:underline flex items-center gap-1 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingPrinters ? 'animate-spin' : ''}`} />
                    <span>تحديث</span>
                  </button>
                </div>
                <div className="flex gap-2">
                  <select
                    disabled={!canEdit || loadingPrinters}
                    value={formData.defaultPrinter}
                    onChange={e => setFormData({ ...formData, defaultPrinter: e.target.value })}
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  >
                    <option value="Default">Default (الطابعة الافتراضية للنظام)</option>
                    {printersList.map((printerName) => (
                      <option key={printerName} value={printerName}>
                        {printerName}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleTestPrint}
                    disabled={isTestingPrinter}
                    className="px-3.5 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    title="طباعة تجريبية سريعة"
                  >
                    <Printer className={`w-3.5 h-3.5 ${isTestingPrinter ? 'animate-spin' : ''}`} />
                    <span>{isTestingPrinter ? 'جاري الاختبار...' : 'طباعة تجريبية'}</span>
                  </button>
                </div>
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
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary font-mono text-xs disabled:opacity-50"
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
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary font-mono text-xs disabled:opacity-50"
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
                    <p className="text-sm font-semibold">آخر 30 نسخة (تدوير تلقائي)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Auto Backup & Secondary Location Configuration Card */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
                    <Cloud className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      إعدادات النسخ الاحتياطي التلقائي والمواقع
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      نسخ محلي إلزامي دائمًا + خيار نسخ ثانوي إلى (Google Drive / OneDrive / USB)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportDiagnostics}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-medium transition-all"
                    title="تصدير سجل التشخيص لتتبع أي أخطاء"
                  >
                    <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>سجل التشخيص</span>
                  </button>

                  {canEdit && (
                    <button
                      type="button"
                      onClick={handleTriggerAutoBackupNow}
                      disabled={isRunningAutoNow}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 border border-blue-500/30 text-xs font-semibold transition-all disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRunningAutoNow ? 'animate-spin' : ''}`} />
                      <span>{isRunningAutoNow ? 'جاري التنفيذ...' : 'تشغيل النسخ التلقائي الآن'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Toggle Auto Backup */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-background border border-border">
                <div className="space-y-0.5">
                  <label htmlFor="autoBackupToggle" className="text-sm font-semibold text-foreground cursor-pointer">
                    تفعيل النسخ التلقائي اليومي
                  </label>
                  <p className="text-xs text-muted-foreground">
                    يقوم النظام بأخذ نسخة احتياطية يومياً كل 24 ساعة في الخلفية تلقائياً
                  </p>
                </div>
                <input
                  id="autoBackupToggle"
                  type="checkbox"
                  disabled={!canEdit}
                  checked={autoBackupEnabled}
                  onChange={(e) => setAutoBackupEnabled(e.target.checked)}
                  className="w-5 h-5 rounded text-primary focus:ring-primary border-border cursor-pointer disabled:opacity-50"
                />
              </div>

              {/* 1. Mandatory Local Location */}
              <div className="p-4 rounded-xl bg-background border border-border/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
                    <HardDrive className="w-4 h-4 text-emerald-500" />
                    <span>1. الموقع المحلي الأساسي (إجباري دائمًا)</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    نشط دائمًا
                  </span>
                </div>
                <p className="font-mono text-xs text-muted-foreground bg-muted/40 p-2 rounded-lg border border-border/50 break-all select-all">
                  {localBackupDir || '%APPDATA%\\com.makers.pos\\backups\\'}
                </p>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                  <span>آخر نسخة: {lastAutoBackupAt ? new Date(lastAutoBackupAt).toLocaleString() : 'لم يتم بعد'}</span>
                  <span>الحد الأقصى المحلي: 30 نسخة (يتم تدوير وحذف الأقدم تلقائياً)</span>
                </div>
              </div>

              {/* 2. Optional Secondary Location */}
              <div className="p-4 rounded-xl bg-background border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
                    <Cloud className="w-4 h-4 text-primary" />
                    <span>2. الموقع الثانوي (اختياري — Google Drive / OneDrive / USB)</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    مزامنة بدون أي تعقيد أو مفاتيح API
                  </span>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  ضع مسار مجلد متزامن مع خدمة السحاب المفضلة لديك (مثل مجلد Google Drive أو OneDrive على جهازك) أو مسار فلاشة USB. سيقوم التطبيق بنسخ ملف النسخة الاحتياطية مباشرة إلى هذا المسار فور إتمامه.
                </p>

                <div className="flex gap-2 items-center flex-wrap sm:flex-nowrap">
                  <div className="relative flex-1 w-full">
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={secondaryBackupPath}
                      onChange={(e) => {
                        setSecondaryBackupPath(e.target.value)
                        setSecondaryPathStatus('idle')
                        setSecondaryStatusMsg('')
                      }}
                      placeholder="مثال: D:\Google Drive\POS Backups أو E:\Backups"
                      className="w-full px-3.5 py-2 rounded-xl bg-card border border-border text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleTestSecondaryPath}
                    disabled={isTestingSecondary || !secondaryBackupPath.trim()}
                    className="px-3.5 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTestingSecondary ? 'animate-spin' : ''}`} />
                    <span>فحص المسار</span>
                  </button>
                </div>

                {secondaryPathStatus !== 'idle' && (
                  <div className={`text-xs flex items-center gap-1.5 p-2 rounded-lg border ${
                    secondaryPathStatus === 'valid'
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      : secondaryPathStatus === 'invalid'
                      ? 'bg-destructive/10 text-destructive border-destructive/20'
                      : 'bg-muted text-muted-foreground border-border'
                  }`}>
                    {secondaryPathStatus === 'valid' ? (
                      <CheckCircle className="w-4 h-4 shrink-0" />
                    ) : secondaryPathStatus === 'invalid' ? (
                      <XCircle className="w-4 h-4 shrink-0" />
                    ) : null}
                    <span>{secondaryStatusMsg}</span>
                  </div>
                )}
              </div>

              {/* Save Configuration Button */}
              {canEdit && (
                <div className="flex justify-end pt-2 border-t border-border/50">
                  <button
                    type="button"
                    onClick={handleSaveBackupConfig}
                    disabled={isSavingBackupConfig}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSavingBackupConfig ? 'جاري الحفظ...' : 'حفظ إعدادات النسخ الاحتياطي'}</span>
                  </button>
                </div>
              )}
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

        {/* Tab: Advanced / Danger Zone */}
        {activeTab === 'advanced' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {!isAdmin ? (
              <div className="bg-card border border-destructive/20 rounded-2xl p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-foreground">
                  {settings.language === 'ar' ? 'غير مصرح لك بالدخول' : 'Access Restricted'}
                </h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  {settings.language === 'ar'
                    ? 'منطقة الخطر وإعادة ضبط البيانات متاحة فقط لحساب المدير المسؤول (Admin).'
                    : 'The Danger Zone and data reset features are restricted to administrator accounts only.'}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Danger Zone Red Card */}
                <div className="bg-rose-500/5 dark:bg-rose-950/20 border-2 border-rose-500/30 rounded-2xl p-6 shadow-sm space-y-6">
                  <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-rose-500/20">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                        <ShieldAlert className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                          <span>{settings.language === 'ar' ? 'منطقة الخطر (Danger Zone) — إعادة ضبط البيانات' : 'Danger Zone — Operational Data Reset'}</span>
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {settings.language === 'ar'
                            ? 'إعادة تعيين ومسح كافة البيانات التشغيلية مع الحفاظ التام على حسابات المستخدمين والإعدادات'
                            : 'Wipe all operational data while strictly keeping user accounts, roles, and settings intact.'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setResetConfirmationInput('')
                        setResetModalOpen(true)
                      }}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md transition-all active:scale-[0.98]"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>{settings.language === 'ar' ? 'إعادة ضبط البيانات' : 'Reset All Operational Data'}</span>
                    </button>
                  </div>

                  {/* Warning Box */}
                  <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs space-y-2 leading-relaxed">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{settings.language === 'ar' ? 'تحذير هام جداً وقواعد العملية:' : 'Critical Warning & Process Rules:'}</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 ps-2">
                      <li>
                        {settings.language === 'ar'
                          ? 'سيتم مسح جميع المنتجات، الأصناف، المخزون، المبيعات، المشتريات، المرتجعات، المصروفات، الورديات، حركات الخزينة، العملاء، والموردين.'
                          : 'All products, inventory movements, sales, purchases, returns, expenses, cash shifts, customers, and suppliers will be wiped.'}
                      </li>
                      <li>
                        <strong className="text-foreground">
                          {settings.language === 'ar'
                            ? 'حسابات المستخدمين (Users)، الصلاحيات (Permissions)، وإعدادات النظام (Settings) لن تُمَس وستبقى سليمة بالكامل.'
                            : 'User accounts, permissions, and system settings will remain completely intact.'}
                        </strong>
                      </li>
                      <li>
                        {settings.language === 'ar'
                          ? 'يقوم النظام تلقائياً بإنشاء نسخة احتياطية إجبارية سابقة للضبط (Pre-reset Backup) وحفظها في مجلد النسخ الاحتياطية قبل تنفيذ أي حذف.'
                          : 'A mandatory pre-reset backup snapshot is automatically created before any deletion occurs.'}
                      </li>
                    </ul>
                  </div>

                  {/* Table Counts Preview */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground flex items-center gap-2">
                        <span>{settings.language === 'ar' ? 'الجداول التشغيلية وعدد السجلات الحالية:' : 'Operational Tables & Current Counts:'}</span>
                      </span>
                      <button
                        type="button"
                        onClick={loadOperationalCounts}
                        disabled={loadingCounts}
                        className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-xs"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loadingCounts ? 'animate-spin' : ''}`} />
                        <span>{settings.language === 'ar' ? 'تحديث' : 'Refresh'}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                      {Object.entries(operationalCounts).map(([tbl, cnt]) => (
                        <div
                          key={tbl}
                          className="p-2.5 rounded-xl bg-background border border-border flex items-center justify-between text-xs"
                        >
                          <span className="font-mono text-muted-foreground truncate" title={tbl}>
                            {tbl}
                          </span>
                          <span
                            className={`font-bold px-2 py-0.5 rounded-md ${
                              cnt > 0
                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {cnt}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Reset Confirmation Modal Dialog */}
            {resetModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-card border-2 border-rose-500/40 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5">
                  <div className="flex items-center gap-3 text-rose-600">
                    <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30">
                      <AlertTriangle className="w-6 h-6 text-rose-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-foreground">
                        {settings.language === 'ar' ? 'تأكيد إعادة ضبط البيانات' : 'Confirm Operational Reset'}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {settings.language === 'ar'
                          ? 'إجراء غير قابل للتراجع (سيتم أخذ نسخة احتياطية أولاً)'
                          : 'Irreversible action (pre-reset backup will be taken first)'}
                      </p>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-2 leading-relaxed bg-muted/30 p-3.5 rounded-xl border border-border">
                    <p className="font-semibold text-foreground">
                      {settings.language === 'ar'
                        ? 'لتأكيد المسح، يرجى كتابة كلمة RESET في الحقل أدناه:'
                        : 'To confirm the reset, please type "RESET" in the box below:'}
                    </p>
                    <input
                      type="text"
                      value={resetConfirmationInput}
                      onChange={(e) => setResetConfirmationInput(e.target.value)}
                      placeholder="RESET"
                      className="w-full h-10 px-3 rounded-lg bg-input border border-border text-center font-mono font-bold tracking-widest text-sm text-foreground focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>

                  <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={keepAuditLogsSetting}
                      onChange={(e) => setKeepAuditLogsSetting(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                    />
                    <span>
                      {settings.language === 'ar'
                        ? 'الاحتفاظ بآخر 100 عملية في سجل المراقبة (Audit Logs)'
                        : 'Keep last 100 entries in Audit Logs'}
                    </span>
                  </label>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                    <button
                      type="button"
                      disabled={isResetting}
                      onClick={() => setResetModalOpen(false)}
                      className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
                    >
                      {t('common.cancel', 'إلغاء')}
                    </button>
                    <button
                      type="button"
                      disabled={resetConfirmationInput.trim().toUpperCase() !== 'RESET' || isResetting}
                      onClick={handleExecuteReset}
                      className="flex items-center gap-2 px-5 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isResetting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>
                        {isResetting
                          ? (settings.language === 'ar' ? 'جاري النسخ والمسح...' : 'Resetting...')
                          : (settings.language === 'ar' ? 'تأكيد المسح بالكامل' : 'Confirm & Wipe')}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 7: About / Credits */}
        {activeTab === 'about' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* System Overview Header Card */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm relative overflow-hidden">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center p-2.5 flex-shrink-0 shadow-inner">
                  <img src="/logo.png" alt="MAKERS" className="w-full h-full object-contain" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-xl font-bold text-foreground">MAKERS POS</h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/15 text-primary border border-primary/20">
                      v1.0.0
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      {t('settings.releaseStatus')}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t('settings.aboutDesc')}
                  </p>
                </div>
              </div>
            </div>

            {/* Dedicated Developer / Credits Section */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-border/60">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                  {t('settings.developerSection')}
                </h3>
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary flex-shrink-0 shadow-sm">
                    <Code2 className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-bold text-foreground">
                      {t('settings.developerCredit')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {settings.language === 'ar'
                        ? 'هندسة وتطوير النظم والبرمجيات · MAKERS POS'
                        : 'System Architecture & Full-Stack Development · MAKERS POS'}
                    </p>
                  </div>
                </div>

                <a
                  href={DEVELOPER_LINKEDIN_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.preventDefault()
                    openExternalUrl(DEVELOPER_LINKEDIN_URL)
                  }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-md transition-all group focus:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] w-fit"
                  aria-label={`${t('settings.linkedinProfile')} - Khaled Eldaoudy`}
                >
                  <Linkedin className="w-4 h-4" aria-hidden="true" />
                  <span>{t('settings.linkedinProfile')}</span>
                  <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" aria-hidden="true" />
                </a>
              </div>
            </div>

            {/* Architecture & Tech Stack Specs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-primary">
                  <HardDrive className="w-4 h-4" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    {t('settings.systemArchitecture')}
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('settings.systemArchitectureDesc')}
                </p>
                <div className="pt-2 flex items-center gap-2 text-xs text-emerald-500 font-medium">
                  <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                  <span>{t('settings.offlineStorage')}</span>
                </div>
              </div>

              <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-primary">
                  <Cpu className="w-4 h-4" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    {t('settings.techStack')}
                  </h4>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {['Tauri v2 (Rust Core)', 'React 18', 'TypeScript', 'SQLite', 'Tailwind CSS', 'Drizzle ORM'].map(tag => (
                    <span key={tag} className="px-2.5 py-1 rounded-lg bg-muted text-[11px] font-medium text-foreground border border-border/60">
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground pt-1">
                  {t('settings.allRightsReserved')}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

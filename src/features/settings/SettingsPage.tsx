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
  UserX,
  KeyRound,
  Volume2,
  VolumeX,
  Sliders,
  Lock,
  Share2,
  Play,
  Percent,
  Calendar,
  Clock,
  Layers,
  Wifi,
  Check,
  Laptop,
} from 'lucide-react'
import { useSettingsStore, Language, Theme, PaperWidth } from '@/stores/settingsStore'
import { useAuthStore, usePermission } from '@/stores/authStore'
import { backupService, BackupRecord } from '@/services/db/backupService'
import { autoBackupService } from '@/services/db/autoBackupService'
import { settingsService } from '@/services/settings/settingsService'
import { resetOperationalData, getOperationalDataCounts } from '@/services/db/resetService'
import { authService, UserListItem } from '@/services/auth/authService'
import { logger } from '@/services/db/loggerService'
import { invoke } from '@tauri-apps/api/core'
import { openExternalUrl, DEVELOPER_LINKEDIN_URL } from '@/lib/openUrl'
import { getAvailablePrinters, printTestReceiptDirect } from '@/services/printer/directPrint'
import { playScanSound, playSaleSuccessSound, playErrorSound } from '@/lib/soundService'
import { fetchMakersProducts } from '@/services/makers/client'

export type SettingsTabType =
  | 'general'
  | 'store'
  | 'pos'
  | 'receipt'
  | 'barcode'
  | 'database'
  | 'theme_sounds'
  | 'security'
  | 'advanced'
  | 'integrations'
  | 'about'

export function SettingsPage() {
  const { t } = useTranslation()
  const settings = useSettingsStore()
  const { user } = useAuthStore()
  const { can, isAdmin } = usePermission()

  const canEdit = isAdmin || can('update', 'settings') || can('edit', 'settings')
  const isAr = settings.language === 'ar'

  const [activeTab, setActiveTab] = useState<SettingsTabType>('general')
  const [isSaving, setIsSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Form Data covering all 11 tabs / 109 settings
  const [formData, setFormData] = useState({
    // Tab 1: General
    language: settings.language,
    theme: settings.theme,
    dateFormat: settings.dateFormat,
    timeFormat: settings.timeFormat,
    firstDayOfWeek: settings.firstDayOfWeek,
    numberFormat: settings.numberFormat,
    currency: settings.currency,
    currencySymbol: settings.currencySymbol,
    currencyPosition: settings.currencyPosition,

    // Tab 2: Store
    storeName: settings.storeName,
    storeNameAr: settings.storeNameAr,
    storeNameEn: settings.storeNameEn,
    storeSubtitle: settings.storeSubtitle,
    storeSubtitleAr: settings.storeSubtitleAr,
    storeSubtitleEn: settings.storeSubtitleEn,
    storePhone: settings.storePhone,
    storePhone1: settings.storePhone1,
    storePhone2: settings.storePhone2,
    storeEmail: settings.storeEmail,
    storeAddress: settings.storeAddress,
    storeAddressAr: settings.storeAddressAr,
    storeTaxNumber: settings.storeTaxNumber,
    storeCommercialReg: settings.storeCommercialReg,
    storeWebsite: settings.storeWebsite,
    storeLogo: settings.storeLogo,

    // Tab 3: POS & Financial
    taxEnabled: settings.taxEnabled,
    taxRate: settings.taxRate,
    taxInclusive: settings.taxInclusive,
    lowStockThreshold: settings.lowStockThreshold,
    allowNegativeStock: settings.allowNegativeStock,
    allowDiscount: settings.allowDiscount,
    maxDiscountPercent: settings.maxDiscountPercent,
    requireCustomerForCredit: settings.requireCustomerForCredit,
    roundingRule: settings.roundingRule,
    defaultPaymentMethod: settings.defaultPaymentMethod,
    loyaltyEnabled: settings.loyaltyEnabled,
    loyaltyPointsPerEgp: settings.loyaltyPointsPerEgp,
    loyaltyPointValue: settings.loyaltyPointValue,
    invoicePrefix: settings.invoicePrefix,
    invoiceNumbering: settings.invoiceNumbering,
    returnWindowDays: settings.returnWindowDays,
    returnRequiresReceipt: settings.returnRequiresReceipt,

    // Tab 4: Receipt & Print
    defaultPrinter: settings.defaultPrinter,
    receiptPaperWidth: settings.receiptPaperWidth,
    autoPrintAfterSale: settings.autoPrintAfterSale,
    printCopies: settings.printCopies,
    showLogoOnReceipt: settings.showLogoOnReceipt,
    logoSizeMm: settings.logoSizeMm,
    receiptHeader: settings.receiptHeader,
    receiptFooter: settings.receiptFooter,
    receiptHeaderLine1: settings.receiptHeaderLine1,
    receiptHeaderLine2: settings.receiptHeaderLine2,
    receiptFooterLine1: settings.receiptFooterLine1,
    receiptFooterLine2: settings.receiptFooterLine2,
    showBarcodeOnReceipt: settings.showBarcodeOnReceipt,
    showQrOnReceipt: settings.showQrOnReceipt,
    receiptFontSize: settings.receiptFontSize,
    autoOpenDrawer: settings.autoOpenDrawer,
    cutterClearanceMm: settings.cutterClearanceMm,

    // Tab 5: Barcode
    barcodeFormat: settings.barcodeFormat,
    defaultBarcodeType: settings.defaultBarcodeType,
    autoGenerateSku: settings.autoGenerateSku,
    skuPrefix: settings.skuPrefix,
    labelWidthMm: settings.labelWidthMm,
    labelHeightMm: settings.labelHeightMm,
    labelColumns: settings.labelColumns,
    labelShowStore: settings.labelShowStore,
    labelShowSku: settings.labelShowSku,
    labelShowName: settings.labelShowName,
    labelShowPrice: settings.labelShowPrice,
    labelShowCurrency: settings.labelShowCurrency,
    labelMarginMm: settings.labelMarginMm,

    // Tab 6: DB & Backup
    autoBackupEnabled: settings.autoBackupEnabled,
    backupIntervalHours: settings.backupIntervalHours,
    secondaryBackupPath: settings.secondaryBackupPath,
    secondaryBackupEnabled: settings.secondaryBackupEnabled,
    backupRetentionCount: settings.backupRetentionCount,
    backupOnClose: settings.backupOnClose,
    backupBeforeMigration: settings.backupBeforeMigration,
    backupVerify: settings.backupVerify,
    backupIncludeLogs: settings.backupIncludeLogs,

    // Tab 7: Theme & Sounds
    soundEnabled: settings.soundEnabled,
    soundOnSale: settings.soundOnSale,
    soundOnError: settings.soundOnError,
    soundOnScan: settings.soundOnScan,
    soundVolume: settings.soundVolume,
    compactMode: settings.compactMode,
    showAnimations: settings.showAnimations,
    sidebarDefault: settings.sidebarDefault,

    // Tab 8: Security
    sessionTimeoutMinutes: settings.sessionTimeoutMinutes,
    passwordMinLength: settings.passwordMinLength,
    passwordComplexity: settings.passwordComplexity,
    maxFailedAttempts: settings.maxFailedAttempts,
    autoLockMinutes: settings.autoLockMinutes,

    // Tab 9: Advanced
    developerMode: settings.developerMode,
    logLevel: settings.logLevel,
    verboseLogs: settings.verboseLogs,
    showPerformance: settings.showPerformance,

    // Tab 10: Integrations
    makersApiUrl: settings.makersApiUrl,
    makersSearchLimit: settings.makersSearchLimit,
    makersAutoSync: settings.makersAutoSync,
    makersSyncIntervalHours: settings.makersSyncIntervalHours,
  })

  // Synchronize when store loads or changes externally
  useEffect(() => {
    setFormData({
      language: settings.language,
      theme: settings.theme,
      dateFormat: settings.dateFormat,
      timeFormat: settings.timeFormat,
      firstDayOfWeek: settings.firstDayOfWeek,
      numberFormat: settings.numberFormat,
      currency: settings.currency,
      currencySymbol: settings.currencySymbol,
      currencyPosition: settings.currencyPosition,

      storeName: settings.storeName,
      storeNameAr: settings.storeNameAr,
      storeNameEn: settings.storeNameEn,
      storeSubtitle: settings.storeSubtitle,
      storeSubtitleAr: settings.storeSubtitleAr,
      storeSubtitleEn: settings.storeSubtitleEn,
      storePhone: settings.storePhone,
      storePhone1: settings.storePhone1,
      storePhone2: settings.storePhone2,
      storeEmail: settings.storeEmail,
      storeAddress: settings.storeAddress,
      storeAddressAr: settings.storeAddressAr,
      storeTaxNumber: settings.storeTaxNumber,
      storeCommercialReg: settings.storeCommercialReg,
      storeWebsite: settings.storeWebsite,
      storeLogo: settings.storeLogo,

      taxEnabled: settings.taxEnabled,
      taxRate: settings.taxRate,
      taxInclusive: settings.taxInclusive,
      lowStockThreshold: settings.lowStockThreshold,
      allowNegativeStock: settings.allowNegativeStock,
      allowDiscount: settings.allowDiscount,
      maxDiscountPercent: settings.maxDiscountPercent,
      requireCustomerForCredit: settings.requireCustomerForCredit,
      roundingRule: settings.roundingRule,
      defaultPaymentMethod: settings.defaultPaymentMethod,
      loyaltyEnabled: settings.loyaltyEnabled,
      loyaltyPointsPerEgp: settings.loyaltyPointsPerEgp,
      loyaltyPointValue: settings.loyaltyPointValue,
      invoicePrefix: settings.invoicePrefix,
      invoiceNumbering: settings.invoiceNumbering,
      returnWindowDays: settings.returnWindowDays,
      returnRequiresReceipt: settings.returnRequiresReceipt,

      defaultPrinter: settings.defaultPrinter,
      receiptPaperWidth: settings.receiptPaperWidth,
      autoPrintAfterSale: settings.autoPrintAfterSale,
      printCopies: settings.printCopies,
      showLogoOnReceipt: settings.showLogoOnReceipt,
      logoSizeMm: settings.logoSizeMm,
      receiptHeader: settings.receiptHeader,
      receiptFooter: settings.receiptFooter,
      receiptHeaderLine1: settings.receiptHeaderLine1,
      receiptHeaderLine2: settings.receiptHeaderLine2,
      receiptFooterLine1: settings.receiptFooterLine1,
      receiptFooterLine2: settings.receiptFooterLine2,
      showBarcodeOnReceipt: settings.showBarcodeOnReceipt,
      showQrOnReceipt: settings.showQrOnReceipt,
      receiptFontSize: settings.receiptFontSize,
      autoOpenDrawer: settings.autoOpenDrawer,
      cutterClearanceMm: settings.cutterClearanceMm,

      barcodeFormat: settings.barcodeFormat,
      defaultBarcodeType: settings.defaultBarcodeType,
      autoGenerateSku: settings.autoGenerateSku,
      skuPrefix: settings.skuPrefix,
      labelWidthMm: settings.labelWidthMm,
      labelHeightMm: settings.labelHeightMm,
      labelColumns: settings.labelColumns,
      labelShowStore: settings.labelShowStore,
      labelShowSku: settings.labelShowSku,
      labelShowName: settings.labelShowName,
      labelShowPrice: settings.labelShowPrice,
      labelShowCurrency: settings.labelShowCurrency,
      labelMarginMm: settings.labelMarginMm,

      autoBackupEnabled: settings.autoBackupEnabled,
      backupIntervalHours: settings.backupIntervalHours,
      secondaryBackupPath: settings.secondaryBackupPath,
      secondaryBackupEnabled: settings.secondaryBackupEnabled,
      backupRetentionCount: settings.backupRetentionCount,
      backupOnClose: settings.backupOnClose,
      backupBeforeMigration: settings.backupBeforeMigration,
      backupVerify: settings.backupVerify,
      backupIncludeLogs: settings.backupIncludeLogs,

      soundEnabled: settings.soundEnabled,
      soundOnSale: settings.soundOnSale,
      soundOnError: settings.soundOnError,
      soundOnScan: settings.soundOnScan,
      soundVolume: settings.soundVolume,
      compactMode: settings.compactMode,
      showAnimations: settings.showAnimations,
      sidebarDefault: settings.sidebarDefault,

      sessionTimeoutMinutes: settings.sessionTimeoutMinutes,
      passwordMinLength: settings.passwordMinLength,
      passwordComplexity: settings.passwordComplexity,
      maxFailedAttempts: settings.maxFailedAttempts,
      autoLockMinutes: settings.autoLockMinutes,

      developerMode: settings.developerMode,
      logLevel: settings.logLevel,
      verboseLogs: settings.verboseLogs,
      showPerformance: settings.showPerformance,

      makersApiUrl: settings.makersApiUrl,
      makersSearchLimit: settings.makersSearchLimit,
      makersAutoSync: settings.makersAutoSync,
      makersSyncIntervalHours: settings.makersSyncIntervalHours,
    })
  }, [
    settings.language,
    settings.theme,
    settings.dateFormat,
    settings.timeFormat,
    settings.firstDayOfWeek,
    settings.numberFormat,
    settings.currency,
    settings.currencySymbol,
    settings.currencyPosition,
    settings.storeName,
    settings.storeNameAr,
    settings.storeNameEn,
    settings.storeSubtitle,
    settings.storeSubtitleAr,
    settings.storeSubtitleEn,
    settings.storePhone,
    settings.storePhone1,
    settings.storePhone2,
    settings.storeEmail,
    settings.storeAddress,
    settings.storeAddressAr,
    settings.storeTaxNumber,
    settings.storeCommercialReg,
    settings.storeWebsite,
    settings.storeLogo,
    settings.taxEnabled,
    settings.taxRate,
    settings.taxInclusive,
    settings.lowStockThreshold,
    settings.allowNegativeStock,
    settings.allowDiscount,
    settings.maxDiscountPercent,
    settings.requireCustomerForCredit,
    settings.roundingRule,
    settings.defaultPaymentMethod,
    settings.loyaltyEnabled,
    settings.loyaltyPointsPerEgp,
    settings.loyaltyPointValue,
    settings.invoicePrefix,
    settings.invoiceNumbering,
    settings.returnWindowDays,
    settings.returnRequiresReceipt,
    settings.defaultPrinter,
    settings.receiptPaperWidth,
    settings.autoPrintAfterSale,
    settings.printCopies,
    settings.showLogoOnReceipt,
    settings.logoSizeMm,
    settings.receiptHeader,
    settings.receiptFooter,
    settings.receiptHeaderLine1,
    settings.receiptHeaderLine2,
    settings.receiptFooterLine1,
    settings.receiptFooterLine2,
    settings.showBarcodeOnReceipt,
    settings.showQrOnReceipt,
    settings.receiptFontSize,
    settings.autoOpenDrawer,
    settings.cutterClearanceMm,
    settings.barcodeFormat,
    settings.defaultBarcodeType,
    settings.autoGenerateSku,
    settings.skuPrefix,
    settings.labelWidthMm,
    settings.labelHeightMm,
    settings.labelColumns,
    settings.labelShowStore,
    settings.labelShowSku,
    settings.labelShowName,
    settings.labelShowPrice,
    settings.labelShowCurrency,
    settings.labelMarginMm,
    settings.autoBackupEnabled,
    settings.backupIntervalHours,
    settings.secondaryBackupPath,
    settings.secondaryBackupEnabled,
    settings.backupRetentionCount,
    settings.backupOnClose,
    settings.backupBeforeMigration,
    settings.backupVerify,
    settings.backupIncludeLogs,
    settings.soundEnabled,
    settings.soundOnSale,
    settings.soundOnError,
    settings.soundOnScan,
    settings.soundVolume,
    settings.compactMode,
    settings.showAnimations,
    settings.sidebarDefault,
    settings.sessionTimeoutMinutes,
    settings.passwordMinLength,
    settings.passwordComplexity,
    settings.maxFailedAttempts,
    settings.autoLockMinutes,
    settings.developerMode,
    settings.logLevel,
    settings.verboseLogs,
    settings.showPerformance,
    settings.makersApiUrl,
    settings.makersSearchLimit,
    settings.makersAutoSync,
    settings.makersSyncIntervalHours,
  ])

  // Printers List State
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
        setSuccessMsg(isAr ? 'تم إرسال أمر الطباعة التجريبية بنجاح' : 'Test print sent successfully')
        setTimeout(() => setSuccessMsg(''), 4000)
      } else {
        setErrorMsg(res.message || (isAr ? 'فشل في الطباعة التجريبية' : 'Test print failed'))
      }
    } catch (err: any) {
      setErrorMsg(err?.message || (isAr ? 'فشل في الطباعة التجريبية' : 'Test print failed'))
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

  // Secondary Path State
  const [localBackupDir, setLocalBackupDir] = useState('')
  const [secondaryPathStatus, setSecondaryPathStatus] = useState<'idle' | 'testing' | 'valid' | 'invalid'>('idle')
  const [secondaryStatusMsg, setSecondaryStatusMsg] = useState('')
  const [isTestingSecondary, setIsTestingSecondary] = useState(false)
  const [isRunningAutoNow, setIsRunningAutoNow] = useState(false)

  const loadBackups = async () => {
    setLoadingBackups(true)
    try {
      const list = await backupService.listBackups()
      setBackupsList(list)
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
  const [importMakersCategoriesSetting, setImportMakersCategoriesSetting] = useState(true)
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

  // Test Users Cleanup State
  const [testUsersList, setTestUsersList] = useState<UserListItem[]>([])
  const [loadingTestUsers, setLoadingTestUsers] = useState(false)
  const [cleanupTestUsersModalOpen, setCleanupTestUsersModalOpen] = useState(false)
  const [isCleaningTestUsers, setIsCleaningTestUsers] = useState(false)

  const loadTestUsers = async () => {
    setLoadingTestUsers(true)
    try {
      const list = await authService.getTestUsers()
      setTestUsersList(list)
    } catch (err) {
      console.error('Failed to load test users:', err)
    } finally {
      setLoadingTestUsers(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'advanced') {
      loadOperationalCounts()
      loadTestUsers()
    }
  }, [activeTab])

  // Integrations Testing State
  const [isTestingMakers, setIsTestingMakers] = useState(false)
  const [makersTestStatus, setMakersTestStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [makersTestMsg, setMakersTestMsg] = useState('')

  const handleTestMakersConnection = async () => {
    setIsTestingMakers(true)
    setMakersTestStatus('idle')
    setMakersTestMsg('')
    try {
      const res = await fetchMakersProducts('', 1, 1)
      setMakersTestStatus('success')
      setMakersTestMsg(
        isAr
          ? `✅ الاتصال ناجح! تم جلب بيانات المتجر (إجمالي العناصر المتاحة: ${res.total || res.products.length})`
          : `✅ Connection successful! Found ${res.total || res.products.length} products.`
      )
    } catch (err: any) {
      setMakersTestStatus('error')
      setMakersTestMsg(
        err.message || (isAr ? '❌ تعذر الاتصال بمتجر MAKERS. تأكد من اتصال الإنترنت' : '❌ Failed to connect to MAKERS.')
      )
    } finally {
      setIsTestingMakers(false)
    }
  }

  const handleExecuteCleanupTestUsers = async () => {
    if (!user) return
    setIsCleaningTestUsers(true)
    setErrorMsg('')
    setSuccessMsg('')
    try {
      const res = await authService.cleanupTestUsers(user)
      if (res.success) {
        setSuccessMsg(
          isAr
            ? `تم حذف ${res.count} مستخدم تجريبي بنجاح وإنشاء نسخة احتياطية إجبارية!`
            : `Successfully removed ${res.count} test users and created an automatic backup!`
        )
        setCleanupTestUsersModalOpen(false)
        await loadTestUsers()
        await loadBackups()
      } else {
        setErrorMsg(res.error || 'Failed to cleanup test users')
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to cleanup test users')
    } finally {
      setIsCleaningTestUsers(false)
    }
  }

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
        importMakersCategories: importMakersCategoriesSetting,
      })
      if (res.success) {
        setSuccessMsg(
          isAr
            ? 'تمت إعادة ضبط جميع البيانات التشغيلية بنجاح وتم إنشاء نسخة احتياطية إجبارية!'
            : 'All operational data reset successfully!'
        )
        setResetModalOpen(false)
        setResetConfirmationInput('')
        await loadOperationalCounts()
        await loadBackups()
      }
    } catch (err: any) {
      setErrorMsg(err?.message || (isAr ? 'فشل إعادة ضبط البيانات' : 'Failed to reset operational data'))
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
      setSuccessMsg(isAr ? 'تم إنشاء النسخة الاحتياطية بنجاح' : 'Backup created successfully')
      await loadBackups()
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to create backup')
    } finally {
      setIsBackingUp(false)
    }
  }

  const handleTestSecondaryPath = async () => {
    if (!formData.secondaryBackupPath.trim()) {
      setSecondaryPathStatus('invalid')
      setSecondaryStatusMsg(isAr ? 'يرجى إدخال مسار المجلد أولاً' : 'Please enter folder path first')
      return
    }
    setIsTestingSecondary(true)
    setSecondaryPathStatus('testing')
    try {
      const accessible = await invoke<boolean>('check_path_accessible', {
        path: formData.secondaryBackupPath.trim(),
      })
      if (accessible) {
        setSecondaryPathStatus('valid')
        setSecondaryStatusMsg(isAr ? '✅ المسار متاح وصالح للكتابة' : '✅ Path is accessible and writable')
      } else {
        setSecondaryPathStatus('invalid')
        setSecondaryStatusMsg(isAr ? '❌ المسار غير متاح أو لا يمكن الوصول إليه' : '❌ Path is inaccessible')
      }
    } catch (err: any) {
      setSecondaryPathStatus('invalid')
      setSecondaryStatusMsg(isAr ? '❌ المسار غير متاح' : '❌ Path error')
    } finally {
      setIsTestingSecondary(false)
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
          ? isAr
            ? 'تم إنشاء النسخة محلياً وتم نسخها إلى المسار الثانوي بنجاح'
            : 'Backup created locally and copied to secondary path'
          : isAr
          ? 'تم إنشاء النسخة الاحتياطية محلياً بنجاح'
          : 'Backup created locally successfully'
        setSuccessMsg(msg)
        setTimeout(() => setSuccessMsg(''), 5000)
        await loadBackups()
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to trigger backup')
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
      setSuccessMsg(isAr ? 'تم تصدير سجلات التشخيص بنجاح' : 'Diagnostics exported successfully')
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err: any) {
      setErrorMsg(isAr ? 'تعذر تصدير السجلات' : 'Failed to export logs')
    }
  }

  const handleConfirmRestore = async () => {
    if (!restoreConfirmModal || !canEdit) return
    setIsRestoring(true)
    setErrorMsg('')
    try {
      await backupService.restoreBackup(restoreConfirmModal.id, user?.id)
      setSuccessMsg(isAr ? 'تمت استعادة قاعدة البيانات بنجاح' : 'Database restored successfully')
      setRestoreConfirmModal(null)
      await settings.loadFromDb()
      await loadBackups()
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to restore backup')
    } finally {
      setIsRestoring(false)
    }
  }

  // Clear Saved Logins (WebView2)
  const [isClearingWebview, setIsClearingWebview] = useState(false)
  const handleClearSavedLogins = async () => {
    if (!window.confirm(isAr ? 'مسح كل بيانات الدخول المحفوظة؟' : 'Clear all saved login data?')) return
    setIsClearingWebview(true)
    setErrorMsg('')
    try {
      await invoke('clear_webview_data')
      setSuccessMsg(
        isAr
          ? 'تم المسح. أعد تشغيل التطبيق للتأثير.'
          : 'Cleared successfully. Restart the app for changes to take effect.'
      )
    } catch (err: any) {
      setErrorMsg(isAr ? 'فشل في المسح' : 'Failed to clear saved logins')
    } finally {
      setIsClearingWebview(false)
    }
  }

  // Instant Language & Theme Handlers
  const handleLanguageChange = async (lang: Language) => {
    if (!canEdit) return
    setFormData((prev) => ({ ...prev, language: lang }))
    await settings.setLanguage(lang, user)
    setSuccessMsg(t('settings.saveSuccess'))
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  const handleThemeChange = async (newTheme: Theme) => {
    if (!canEdit) return
    setFormData((prev) => ({ ...prev, theme: newTheme }))
    await settings.setTheme(newTheme, user)
    setSuccessMsg(t('settings.saveSuccess'))
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  // Validation
  const validate = (): boolean => {
    const errors: Record<string, string> = {}
    if (!formData.storeName.trim() && !formData.storeNameAr.trim() && !formData.storeNameEn.trim()) {
      errors.storeName = isAr ? 'اسم المتجر مطلوب' : 'Store name is required'
    }
    if (formData.taxEnabled) {
      const tax = Number(formData.taxRate)
      if (isNaN(tax) || tax < 0 || tax > 100) {
        errors.taxRate = isAr ? 'نسبة الضريبة يجب أن تكون بين 0 و 100' : 'Tax rate must be between 0 and 100'
      }
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Dedicated Save Function (Used by top Save button & each tab's individual Save button)
  const handleSaveTab = async (tabName?: SettingsTabType) => {
    if (!canEdit) return
    setSuccessMsg('')
    setErrorMsg('')

    if (!validate()) return

    setIsSaving(true)
    try {
      // Synchronize derived store name
      const effectiveStoreName = formData.storeNameAr.trim() || formData.storeName.trim() || formData.storeNameEn.trim()
      const payload = {
        ...formData,
        storeName: effectiveStoreName,
        storeNameAr: formData.storeNameAr.trim() || effectiveStoreName,
        storeNameEn: formData.storeNameEn.trim() || effectiveStoreName,
        taxRate: Number(formData.taxRate) || 0,
        maxDiscountPercent: Number(formData.maxDiscountPercent) || 100,
        returnWindowDays: Number(formData.returnWindowDays) || 14,
        printCopies: Number(formData.printCopies) || 1,
        logoSizeMm: Number(formData.logoSizeMm) || 40,
        cutterClearanceMm: Number(formData.cutterClearanceMm) || 12,
        labelWidthMm: Number(formData.labelWidthMm) || 50,
        labelHeightMm: Number(formData.labelHeightMm) || 30,
        labelColumns: Number(formData.labelColumns) || 3,
        labelMarginMm: Number(formData.labelMarginMm) || 2,
        backupIntervalHours: Number(formData.backupIntervalHours) || 24,
        backupRetentionCount: Number(formData.backupRetentionCount) || 30,
        soundVolume: Number(formData.soundVolume) || 70,
        sessionTimeoutMinutes: Number(formData.sessionTimeoutMinutes) || 480,
        passwordMinLength: Number(formData.passwordMinLength) || 6,
        maxFailedAttempts: Number(formData.maxFailedAttempts) || 5,
        autoLockMinutes: Number(formData.autoLockMinutes) || 0,
        makersSearchLimit: Number(formData.makersSearchLimit) || 20,
        makersSyncIntervalHours: Number(formData.makersSyncIntervalHours) || 24,
      }

      await settings.saveSettings(payload, user)
      setSuccessMsg(isAr ? 'تم حفظ الإعدادات بنجاح في قاعدة البيانات!' : 'Settings saved successfully!')
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err: any) {
      console.error('Save settings error:', err)
      setErrorMsg(err?.message || (isAr ? 'فشل حفظ الإعدادات' : 'Failed to save settings'))
    } finally {
      setIsSaving(false)
    }
  }

  interface TabDef {
    id: SettingsTabType
    labelAr: string
    labelEn: string
    icon: any
    danger?: boolean
    badge?: string
  }

  const tabGroups = [
    {
      titleAr: 'الأساسي',
      titleEn: 'Core',
      tabs: ['general', 'store', 'theme_sounds'] as SettingsTabType[],
      danger: false,
    },
    {
      titleAr: 'العمليات',
      titleEn: 'Operations',
      tabs: ['pos', 'receipt', 'barcode'] as SettingsTabType[],
      danger: false,
    },
    {
      titleAr: 'النظام',
      titleEn: 'System',
      tabs: ['database', 'security', 'integrations', 'about'] as SettingsTabType[],
      danger: false,
    },
    {
      titleAr: '⚠️ مخاطر',
      titleEn: '⚠️ Hazards',
      tabs: ['advanced'] as SettingsTabType[],
      danger: true,
    },
  ]

  // 11 Tabs Configuration
  const tabsList: TabDef[] = [
    { id: 'general', labelAr: 'عام', labelEn: 'General', icon: Globe },
    { id: 'store', labelAr: 'المتجر', labelEn: 'Store', icon: Store },
    { id: 'pos', labelAr: 'نقطة البيع', labelEn: 'Point of Sale', icon: CreditCard, badge: '16' },
    { id: 'receipt', labelAr: 'الطباعة', labelEn: 'Printing', icon: Printer, badge: '15' },
    { id: 'barcode', labelAr: 'الباركود', labelEn: 'Barcode', icon: Barcode },
    { id: 'database', labelAr: 'النسخ الاحتياطي', labelEn: 'Backup', icon: Database },
    { id: 'theme_sounds', labelAr: 'المظهر', labelEn: 'Appearance', icon: Volume2 },
    { id: 'security', labelAr: 'الأمان', labelEn: 'Security', icon: Lock },
    { id: 'advanced', labelAr: 'منطقة الخطر', labelEn: 'Danger Zone', icon: ShieldAlert, danger: true, badge: 'خطر' },
    { id: 'integrations', labelAr: 'التكامل', labelEn: 'Integrations', icon: Cpu },
    { id: 'about', labelAr: 'عن النظام', labelEn: 'About System', icon: Info },
  ]

  // Render Per-Tab Save Button component
  const renderTabSaveFooter = (tabId: SettingsTabType) => {
    if (!canEdit || tabId === 'about') return null
    return (
      <div className="flex items-center justify-between pt-6 mt-6 border-t border-border/80 bg-card/40 -mx-6 -mb-6 px-6 py-4 rounded-b-2xl">
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5 text-primary" />
          <span>{isAr ? 'يتم حفظ الإعدادات تلقائياً في SQLite' : 'Settings are stored locally in SQLite'}</span>
        </div>
        <button
          type="button"
          onClick={() => handleSaveTab(tabId)}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-md hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isSaving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ إعدادات هذا القسم' : 'Save Section Settings')}
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-background text-foreground selection:bg-primary/20">
      {/* Header */}
      <div className="px-8 py-4 border-b border-border bg-card/70 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary shadow-inner">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{t('settings.title', 'الإعدادات')}</h1>
            <p className="text-xs text-muted-foreground">
              {isAr ? 'تخصيص كامل لكافة خصائص وتشغيل النظام' : 'Comprehensive System Configuration'}
            </p>
          </div>
        </div>

        {canEdit && activeTab !== 'about' && (
          <button
            onClick={() => handleSaveTab(activeTab)}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-md hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ التغييرات' : 'Save Changes')}
          </button>
        )}
      </div>

      <div className="p-4 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Read-only Alert */}
        {!canEdit && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-sm">
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <p>{t('settings.readOnlyNotice', 'وضع العرض فقط: ليس لديك صلاحية تعديل الإعدادات')}</p>
          </div>
        )}

        {/* Success / Error Messages */}
        {successMsg && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <p className="font-medium">{successMsg}</p>
          </div>
        )}
        {errorMsg && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm animate-in fade-in slide-in-from-top-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <p className="font-medium">{errorMsg}</p>
          </div>
        )}

        {/* Mobile Horizontal Tabs (< 1024px) */}
        <div className="lg:hidden flex gap-2 p-2 bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl overflow-x-auto no-scrollbar shadow-sm">
          {tabsList.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as SettingsTabType)}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                  isActive
                    ? tab.danger
                      ? 'bg-rose-600 text-white shadow-md ring-2 ring-rose-500/20'
                      : 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20'
                    : tab.danger
                    ? 'text-rose-500 hover:bg-rose-500/10'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                }`}
              >
                <Icon className={`w-4 h-4 ${tab.danger && !isActive ? 'text-rose-500' : ''}`} />
                {isAr ? tab.labelAr : tab.labelEn}
              </button>
            )
          })}
        </div>

        {/* Main 2-Column Layout: Right-Side Sidebar in RTL (or Left in LTR) + Main Content */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Vertical Sidebar */}
          <aside className="w-full lg:w-80 xl:w-80 flex-shrink-0 hidden lg:flex sticky top-20 h-fit max-h-[calc(100vh-140px)] border border-border/50 bg-card/60 backdrop-blur-md rounded-2xl overflow-hidden flex-col shadow-sm">
            <div className="p-4 border-b border-border/50 bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Sliders className="w-5 h-5 text-primary" />
                <span className="text-sm font-bold text-foreground">
                  {isAr ? 'أقسام الإعدادات' : 'Settings Sections'}
                </span>
              </div>
              <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                11 {isAr ? 'أقسام' : 'tabs'}
              </span>
            </div>

            <nav className="flex-1 overflow-y-auto p-3 space-y-4 max-h-[calc(100vh-210px)]">
              {tabGroups.map((group, gIdx) => (
                <div key={gIdx} className="space-y-1.5">
                  <div
                    className={`text-xs font-medium px-3 pt-2 pb-1 ${
                      group.danger ? 'text-rose-500 font-semibold' : 'text-muted-foreground'
                    }`}
                  >
                    {isAr ? group.titleAr : group.titleEn}
                  </div>
                  {group.tabs.map((tabId) => {
                    const tab = tabsList.find((t) => t.id === tabId)
                    if (!tab) return null
                    const Icon = tab.icon
                    const isActive = activeTab === tab.id
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`relative w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group text-start ${
                          isActive
                            ? tab.danger
                              ? 'bg-rose-600 text-white font-semibold shadow-md ring-2 ring-rose-500/20'
                              : 'bg-primary text-primary-foreground font-semibold shadow-md ring-2 ring-primary/20'
                            : tab.danger
                            ? 'text-rose-500 hover:bg-rose-500/10'
                            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                        }`}
                      >
                        {/* Active indicator bar */}
                        {isActive && (
                          <span
                            className={`absolute top-2.5 bottom-2.5 w-1 rounded-full ${
                              isAr ? 'right-1.5' : 'left-1.5'
                            } bg-white`}
                          />
                        )}
                        <Icon
                          className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                            tab.danger && !isActive ? 'text-rose-500' : ''
                          }`}
                        />
                        <span className="flex-1 truncate">{isAr ? tab.labelAr : tab.labelEn}</span>
                        {tab.badge && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-mono font-semibold ${
                              isActive
                                ? 'bg-white/20 text-white'
                                : tab.danger
                                ? 'bg-rose-500/20 text-rose-500'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {tab.badge}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))}
            </nav>
          </aside>

          {/* Active Tab Content Area */}
          <div className="flex-1 min-w-0 w-full animate-in fade-in-50 duration-200" key={activeTab}>

        {/* ======================================================== */}
        {/* TAB 1: GENERAL (عام) */}
        {/* ======================================================== */}
        {activeTab === 'general' && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2.5">
                <Globe className="w-5 h-5 text-primary" />
                <h2 className="text-base font-bold text-foreground">{isAr ? 'الإعدادات العامة واللغة' : 'General & Localization'}</h2>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-mono font-medium">8 options</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Language Selection */}
              <div className="space-y-2 p-4 rounded-xl bg-muted/40 border border-border/60">
                <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" />
                  {isAr ? 'لغة واجهة النظام' : 'System Interface Language'}
                </label>
                <p className="text-xs text-muted-foreground">
                  {isAr ? 'التبديل بين العربية والإنجليزية لواجهة المستخدم بالكامل' : 'Switch between Arabic and English for all screens'}
                </p>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleLanguageChange('ar')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                      formData.language === 'ar'
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'bg-background hover:bg-muted border-border text-foreground'
                    }`}
                  >
                    العربية (AR)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLanguageChange('en')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                      formData.language === 'en'
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'bg-background hover:bg-muted border-border text-foreground'
                    }`}
                  >
                    English (EN)
                  </button>
                </div>
              </div>

              {/* Theme Selection */}
              <div className="space-y-2 p-4 rounded-xl bg-muted/40 border border-border/60">
                <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  {formData.theme === 'dark' ? <Moon className="w-4 h-4 text-primary" /> : <Sun className="w-4 h-4 text-primary" />}
                  {isAr ? 'نمط المظهر' : 'Visual Theme'}
                </label>
                <p className="text-xs text-muted-foreground">
                  {isAr ? 'الوضع الداكن الموفر للطاقة أو الوضع الفاتح عالي التباين' : 'Dark mode or Light high-contrast mode'}
                </p>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleThemeChange('dark')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border flex items-center justify-center gap-2 transition-all ${
                      formData.theme === 'dark'
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'bg-background hover:bg-muted border-border text-foreground'
                    }`}
                  >
                    <Moon className="w-4 h-4" />
                    {isAr ? 'داكن (Dark)' : 'Dark'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleThemeChange('light')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border flex items-center justify-center gap-2 transition-all ${
                      formData.theme === 'light'
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'bg-background hover:bg-muted border-border text-foreground'
                    }`}
                  >
                    <Sun className="w-4 h-4" />
                    {isAr ? 'فاتح (Light)' : 'Light'}
                  </button>
                </div>
              </div>

              {/* Date Format */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  {isAr ? 'صيغة عرض التاريخ' : 'Date Format'}
                </label>
                <select
                  value={formData.dateFormat}
                  onChange={(e) => setFormData((prev) => ({ ...prev, dateFormat: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY (مثال: 09/10/2026)</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD (ISO 8601: 2026-10-09)</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY (US Format)</option>
                </select>
              </div>

              {/* Time Format */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  {isAr ? 'صيغة عرض الوقت' : 'Time Format'}
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, timeFormat: '12h' }))}
                    className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium border transition-all ${
                      formData.timeFormat === '12h'
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'bg-background hover:bg-muted border-border text-foreground'
                    }`}
                  >
                    12h (08:30 PM / ص)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, timeFormat: '24h' }))}
                    className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium border transition-all ${
                      formData.timeFormat === '24h'
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'bg-background hover:bg-muted border-border text-foreground'
                    }`}
                  >
                    24h (20:30)
                  </button>
                </div>
              </div>

              {/* First Day of Week */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">
                  {isAr ? 'بداية الأسبوع في التقارير' : 'First Day of the Week'}
                </label>
                <select
                  value={formData.firstDayOfWeek}
                  onChange={(e) => setFormData((prev) => ({ ...prev, firstDayOfWeek: e.target.value as any }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="saturday">{isAr ? 'السبت (مصر والشرق الأوسط)' : 'Saturday'}</option>
                  <option value="sunday">{isAr ? 'الأحد' : 'Sunday'}</option>
                  <option value="monday">{isAr ? 'الإثنين' : 'Monday'}</option>
                </select>
              </div>

              {/* Number Format */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">
                  {isAr ? 'تنسيق أرقام النظام' : 'Number Digits Format'}
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, numberFormat: 'western' }))}
                    className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium border transition-all ${
                      formData.numberFormat === 'western'
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'bg-background hover:bg-muted border-border text-foreground'
                    }`}
                  >
                    123,456 (Western)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, numberFormat: 'arabic-indic' }))}
                    className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium border transition-all ${
                      formData.numberFormat === 'arabic-indic'
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'bg-background hover:bg-muted border-border text-foreground'
                    }`}
                  >
                    ١٢٣,٤٥٦ (Arabic-Indic)
                  </button>
                </div>
              </div>

              {/* Currency Symbol */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">
                  {isAr ? 'رمز العملة المعروض' : 'Currency Symbol'}
                </label>
                <input
                  type="text"
                  value={formData.currencySymbol}
                  onChange={(e) => setFormData((prev) => ({ ...prev, currencySymbol: e.target.value }))}
                  placeholder="ج.م أو EGP"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-bold"
                />
              </div>

              {/* Currency Position */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">
                  {isAr ? 'موضع رمز العملة' : 'Currency Symbol Position'}
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, currencyPosition: 'after' }))}
                    className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium border transition-all ${
                      formData.currencyPosition === 'after'
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'bg-background hover:bg-muted border-border text-foreground'
                    }`}
                  >
                    {isAr ? 'بعد المبلغ (100 ج.م)' : 'After Amount (100 EGP)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, currencyPosition: 'before' }))}
                    className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium border transition-all ${
                      formData.currencyPosition === 'before'
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'bg-background hover:bg-muted border-border text-foreground'
                    }`}
                  >
                    {isAr ? 'قبل المبلغ (ج.م 100)' : 'Before Amount (EGP 100)'}
                  </button>
                </div>
              </div>
            </div>

            {renderTabSaveFooter('general')}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: STORE INFO (بيانات المتجر) */}
        {/* ======================================================== */}
        {activeTab === 'store' && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2.5">
                <Store className="w-5 h-5 text-primary" />
                <h2 className="text-base font-bold text-foreground">{isAr ? 'بيانات وهوية المتجر والفواتير' : 'Store Profile & Receipts'}</h2>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-mono font-medium">12 options</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Store Name AR */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground flex items-center justify-between">
                  <span>{isAr ? 'اسم المتجر (بالعربية) *' : 'Store Name (Arabic) *'}</span>
                  <span className="text-xs text-muted-foreground">{isAr ? 'إلزامي بالفاتورة' : 'Required'}</span>
                </label>
                <input
                  type="text"
                  value={formData.storeNameAr}
                  onChange={(e) => setFormData((prev) => ({ ...prev, storeNameAr: e.target.value }))}
                  placeholder="MAKERS أو متجر الإلكترونيات"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-bold"
                />
              </div>

              {/* Store Name EN */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground flex items-center justify-between">
                  <span>{isAr ? 'اسم المتجر (بالإنجليزية) *' : 'Store Name (English) *'}</span>
                  <span className="text-xs text-muted-foreground">{isAr ? 'إلزامي' : 'Required'}</span>
                </label>
                <input
                  type="text"
                  value={formData.storeNameEn}
                  onChange={(e) => setFormData((prev) => ({ ...prev, storeNameEn: e.target.value }))}
                  placeholder="MAKERS ELECTRONICS"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-bold"
                />
              </div>

              {/* Subtitle AR */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">{isAr ? 'الوصف الفرعي (عربي)' : 'Subtitle (Arabic)'}</label>
                <input
                  type="text"
                  value={formData.storeSubtitleAr}
                  onChange={(e) => setFormData((prev) => ({ ...prev, storeSubtitleAr: e.target.value }))}
                  placeholder="مكونات إلكترونية ومشاريع هندسية"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              {/* Subtitle EN */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">{isAr ? 'الوصف الفرعي (إنجليزي)' : 'Subtitle (English)'}</label>
                <input
                  type="text"
                  value={formData.storeSubtitleEn}
                  onChange={(e) => setFormData((prev) => ({ ...prev, storeSubtitleEn: e.target.value }))}
                  placeholder="Electronics Components & Robotics"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              {/* Phone 1 */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">{isAr ? 'رقم الهاتف الأساسي' : 'Primary Phone'}</label>
                <input
                  type="text"
                  value={formData.storePhone1}
                  onChange={(e) => setFormData((prev) => ({ ...prev, storePhone1: e.target.value }))}
                  placeholder="01xxxxxxxxx"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                />
              </div>

              {/* Phone 2 */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">{isAr ? 'رقم الهاتف الثانوي / واتساب' : 'Secondary Phone / WhatsApp'}</label>
                <input
                  type="text"
                  value={formData.storePhone2}
                  onChange={(e) => setFormData((prev) => ({ ...prev, storePhone2: e.target.value }))}
                  placeholder="01xxxxxxxxx"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">{isAr ? 'البريد الإلكتروني' : 'Store Email'}</label>
                <input
                  type="email"
                  value={formData.storeEmail}
                  onChange={(e) => setFormData((prev) => ({ ...prev, storeEmail: e.target.value }))}
                  placeholder="info@makerselectronics.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                />
              </div>

              {/* Website */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">{isAr ? 'الموقع الإلكتروني' : 'Website'}</label>
                <input
                  type="text"
                  value={formData.storeWebsite}
                  onChange={(e) => setFormData((prev) => ({ ...prev, storeWebsite: e.target.value }))}
                  placeholder="makerselectronics.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                />
              </div>

              {/* Tax Registration Number */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">{isAr ? 'الرقم الضريبي (الفاتورة الإلكترونية)' : 'Tax Number'}</label>
                <input
                  type="text"
                  value={formData.storeTaxNumber}
                  onChange={(e) => setFormData((prev) => ({ ...prev, storeTaxNumber: e.target.value }))}
                  placeholder="XXX-XXX-XXX"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                />
              </div>

              {/* Commercial Registration Number */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">{isAr ? 'رقم السجل التجاري' : 'Commercial Registration'}</label>
                <input
                  type="text"
                  value={formData.storeCommercialReg}
                  onChange={(e) => setFormData((prev) => ({ ...prev, storeCommercialReg: e.target.value }))}
                  placeholder="123456"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                />
              </div>

              {/* Full Address */}
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-semibold text-foreground">{isAr ? 'العنوان وتفاصيل الفرع' : 'Store Address'}</label>
                <textarea
                  rows={2}
                  value={formData.storeAddress}
                  onChange={(e) => setFormData((prev) => ({ ...prev, storeAddress: e.target.value }))}
                  placeholder={isAr ? 'القاهرة - مصر' : 'Cairo, Egypt'}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            {renderTabSaveFooter('store')}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: POS & FINANCIAL (نقطة البيع والمالية) */}
        {/* ======================================================== */}
        {activeTab === 'pos' && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2.5">
                <CreditCard className="w-5 h-5 text-primary" />
                <h2 className="text-base font-bold text-foreground">{isAr ? 'سياسات نقطة البيع والضرائب والحسابات' : 'POS Checkout & Financial Policies'}</h2>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-mono font-medium">16 options</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* VAT Tax Toggle & Rate */}
              <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-3 md:col-span-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-sm text-foreground block">{isAr ? 'تفعيل ضريبة القيمة المضافة (VAT)' : 'Enable Value Added Tax (VAT)'}</span>
                    <span className="text-xs text-muted-foreground">{isAr ? 'تطبيق نسبة الضريبة تلقائياً على كل مبيعات الكاشير' : 'Calculate tax automatically at POS'}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.taxEnabled}
                    onChange={(e) => setFormData((prev) => ({ ...prev, taxEnabled: e.target.checked }))}
                    className="w-5 h-5 rounded text-primary focus:ring-primary cursor-pointer accent-primary"
                  />
                </div>

                {formData.taxEnabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-border/40">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">{isAr ? 'نسبة الضريبة (%)' : 'Tax Rate (%)'}</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={formData.taxRate}
                        onChange={(e) => setFormData((prev) => ({ ...prev, taxRate: Number(e.target.value) }))}
                        className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm font-mono font-bold"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">{isAr ? 'طريقة احتساب الأسعار' : 'Price Tax Inclusion'}</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, taxInclusive: true }))}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium border transition-all ${
                            formData.taxInclusive
                              ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                              : 'bg-background hover:bg-muted border-border text-foreground'
                          }`}
                        >
                          {isAr ? 'الأسعار شاملة الضريبة' : 'Tax Inclusive'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, taxInclusive: false }))}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium border transition-all ${
                            !formData.taxInclusive
                              ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                              : 'bg-background hover:bg-muted border-border text-foreground'
                          }`}
                        >
                          {isAr ? 'يضاف فوق السعر' : 'Tax Exclusive'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Allow Negative Stock */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border/60">
                <div>
                  <span className="font-semibold text-sm text-foreground block">{isAr ? 'السماح بالبيع بالسالب' : 'Allow Negative Stock'}</span>
                  <span className="text-xs text-muted-foreground">{isAr ? 'إمكانية إتمام البيع حتى لو كان رصيد المنتج 0' : 'Allow sales when item stock is 0'}</span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.allowNegativeStock}
                  onChange={(e) => setFormData((prev) => ({ ...prev, allowNegativeStock: e.target.checked }))}
                  className="w-5 h-5 rounded text-primary focus:ring-primary cursor-pointer accent-primary"
                />
              </div>

              {/* Allow Discounts */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border/60">
                <div>
                  <span className="font-semibold text-sm text-foreground block">{isAr ? 'السماح بالخصم المباشر بالكاشير' : 'Allow POS Discounts'}</span>
                  <span className="text-xs text-muted-foreground">{isAr ? 'تمكين الكاشير من تطبيق خصومات على الفاتورة' : 'Allow cashier to discount bills'}</span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.allowDiscount}
                  onChange={(e) => setFormData((prev) => ({ ...prev, allowDiscount: e.target.checked }))}
                  className="w-5 h-5 rounded text-primary focus:ring-primary cursor-pointer accent-primary"
                />
              </div>

              {/* Max Discount Percent */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground flex items-center justify-between">
                  <span>{isAr ? 'الحد الأقصى للخصم المسموح (%)' : 'Max Allowed Discount (%)'}</span>
                  <Percent className="w-4 h-4 text-muted-foreground" />
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.maxDiscountPercent}
                  onChange={(e) => setFormData((prev) => ({ ...prev, maxDiscountPercent: Number(e.target.value) }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-mono font-bold"
                />
              </div>

              {/* Require Customer for Credit Sale */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border/60">
                <div>
                  <span className="font-semibold text-sm text-foreground block">{isAr ? 'إلزامية اختيار عميل للبيع الآجل' : 'Require Customer for Credit'}</span>
                  <span className="text-xs text-muted-foreground">{isAr ? 'منع البيع الآجل دون تحديد حساب عميل مسجل' : 'Force customer selection for credit sales'}</span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.requireCustomerForCredit}
                  onChange={(e) => setFormData((prev) => ({ ...prev, requireCustomerForCredit: e.target.checked }))}
                  className="w-5 h-5 rounded text-primary focus:ring-primary cursor-pointer accent-primary"
                />
              </div>

              {/* Rounding Rule */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">{isAr ? 'قاعدة تقريب إجمالي الفاتورة' : 'Total Rounding Rule'}</label>
                <select
                  value={formData.roundingRule}
                  onChange={(e) => setFormData((prev) => ({ ...prev, roundingRule: e.target.value as any }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-medium"
                >
                  <option value="none">{isAr ? 'بدون تقريب (دقيق بالقروش)' : 'No Rounding (Exact cents)'}</option>
                  <option value="0.25">{isAr ? 'تقريب لأقرب ربع جنيه (0.25)' : 'Round to nearest 0.25'}</option>
                  <option value="0.50">{isAr ? 'تقريب لأقرب نصف جنيه (0.50)' : 'Round to nearest 0.50'}</option>
                  <option value="1.00">{isAr ? 'تقريب لأقرب جنيه كامل (1.00)' : 'Round to nearest integer'}</option>
                </select>
              </div>

              {/* Default Payment Method */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">{isAr ? 'طريقة السداد الافتراضية' : 'Default Payment Method'}</label>
                <select
                  value={formData.defaultPaymentMethod}
                  onChange={(e) => setFormData((prev) => ({ ...prev, defaultPaymentMethod: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-medium"
                >
                  <option value="cash">{isAr ? 'نقداً (كاش)' : 'Cash'}</option>
                  <option value="instapay">{isAr ? 'إنستاباي (InstaPay)' : 'InstaPay'}</option>
                  <option value="wallet">{isAr ? 'محفظة إلكترونية (Vodafone Cash...)' : 'E-Wallet'}</option>
                </select>
              </div>

              {/* Invoice Prefix */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">{isAr ? 'بادئة رقم الفاتورة (Prefix)' : 'Invoice Number Prefix'}</label>
                <input
                  type="text"
                  value={formData.invoicePrefix}
                  onChange={(e) => setFormData((prev) => ({ ...prev, invoicePrefix: e.target.value }))}
                  placeholder="SAL-"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-mono font-bold"
                />
              </div>

              {/* Invoice Numbering Style */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">{isAr ? 'نمط ترقيم الفواتير' : 'Invoice Numbering Scheme'}</label>
                <select
                  value={formData.invoiceNumbering}
                  onChange={(e) => setFormData((prev) => ({ ...prev, invoiceNumbering: e.target.value as any }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-medium"
                >
                  <option value="date">{isAr ? 'مرتبط بالتاريخ (SAL-YYMM-000001)' : 'Date-based sequential'}</option>
                  <option value="sequential">{isAr ? 'متسلسل مستمر (SAL-000001)' : 'Simple sequential'}</option>
                </select>
              </div>

              {/* Return Window Days */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">{isAr ? 'فترة الإرجاع المسموح بها (بالأيام)' : 'Return Policy Window (Days)'}</label>
                <input
                  type="number"
                  min="0"
                  max="365"
                  value={formData.returnWindowDays}
                  onChange={(e) => setFormData((prev) => ({ ...prev, returnWindowDays: Number(e.target.value) }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-mono font-bold"
                />
              </div>

              {/* Return Requires Receipt */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border/60">
                <div>
                  <span className="font-semibold text-sm text-foreground block">{isAr ? 'اشتراط أصل الفاتورة للمرتجع' : 'Require Receipt for Return'}</span>
                  <span className="text-xs text-muted-foreground">{isAr ? 'منع عمل مرتجع دون ربطه برقم فاتورة أصلية' : 'Must link return to completed sale bill'}</span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.returnRequiresReceipt}
                  onChange={(e) => setFormData((prev) => ({ ...prev, returnRequiresReceipt: e.target.checked }))}
                  className="w-5 h-5 rounded text-primary focus:ring-primary cursor-pointer accent-primary"
                />
              </div>
            </div>

            {renderTabSaveFooter('pos')}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: RECEIPT & PRINT (الفواتير والطباعة) */}
        {/* ======================================================== */}
        {activeTab === 'receipt' && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2.5">
                <Printer className="w-5 h-5 text-primary" />
                <h2 className="text-base font-bold text-foreground">{isAr ? 'إعدادات الطابعة الحرارية وتنسيق الإيصال' : 'Thermal Printer & Receipt Template'}</h2>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-mono font-medium">15 options</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Printer Device Selection */}
              <div className="space-y-2 md:col-span-2 p-4 rounded-xl bg-muted/40 border border-border/60">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Printer className="w-4 h-4 text-primary" />
                    {isAr ? 'جهاز الطابعة الحرارية المعين' : 'Assigned Thermal Printer Device'}
                  </label>
                  <button
                    type="button"
                    onClick={loadPrinters}
                    disabled={loadingPrinters}
                    className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingPrinters ? 'animate-spin' : ''}`} />
                    {isAr ? 'تحديث قائمة الطابعات' : 'Refresh Printers'}
                  </button>
                </div>
                <div className="flex gap-3 pt-2">
                  <select
                    value={formData.defaultPrinter}
                    onChange={(e) => setFormData((prev) => ({ ...prev, defaultPrinter: e.target.value }))}
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-mono"
                  >
                    <option value="">{isAr ? 'الطابعة الافتراضية للنظام (Windows Default)' : 'System Default Printer'}</option>
                    {printersList.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleTestPrint}
                    disabled={isTestingPrinter}
                    className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-semibold flex items-center gap-2 border border-border"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    {isTestingPrinter ? (isAr ? 'جاري الاختبار...' : 'Printing...') : (isAr ? 'طباعة تجريبية' : 'Test Print')}
                  </button>
                </div>
              </div>

              {/* Paper Width */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">{isAr ? 'عرض ورق الإيصال' : 'Receipt Paper Width'}</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, receiptPaperWidth: '80mm' }))}
                    className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium border transition-all ${
                      formData.receiptPaperWidth === '80mm'
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'bg-background hover:bg-muted border-border text-foreground'
                    }`}
                  >
                    80mm (Standard POS)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, receiptPaperWidth: '58mm' }))}
                    className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium border transition-all ${
                      formData.receiptPaperWidth === '58mm'
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'bg-background hover:bg-muted border-border text-foreground'
                    }`}
                  >
                    58mm (Compact Mobile)
                  </button>
                </div>
              </div>

              {/* Print Copies */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">{isAr ? 'عدد النسخ المطبوعة' : 'Print Copies'}</label>
                <select
                  value={formData.printCopies}
                  onChange={(e) => setFormData((prev) => ({ ...prev, printCopies: Number(e.target.value) }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-medium"
                >
                  <option value={1}>{isAr ? 'نسخة واحدة (للعميل)' : '1 Copy'}</option>
                  <option value={2}>{isAr ? 'نسختان (عميل + أرشيف المتجر)' : '2 Copies'}</option>
                  <option value={3}>{isAr ? '3 نسخ' : '3 Copies'}</option>
                </select>
              </div>

              {/* Auto Print After Sale */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border/60">
                <div>
                  <span className="font-semibold text-sm text-foreground block">{isAr ? 'طباعة تلقائية فور البيع' : 'Auto-Print After Sale'}</span>
                  <span className="text-xs text-muted-foreground">{isAr ? 'إرسال الفاتورة للطابعة مباشرة بعد إتمام الدفع' : 'Print ticket instantly on checkout'}</span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.autoPrintAfterSale}
                  onChange={(e) => setFormData((prev) => ({ ...prev, autoPrintAfterSale: e.target.checked }))}
                  className="w-5 h-5 rounded text-primary focus:ring-primary cursor-pointer accent-primary"
                />
              </div>

              {/* Auto Open Drawer */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border/60">
                <div>
                  <span className="font-semibold text-sm text-foreground block">{isAr ? 'فتح الدرج النقدي تلقائياً' : 'Auto-Open Cash Drawer'}</span>
                  <span className="text-xs text-muted-foreground">{isAr ? 'إرسال نبضة فتح الدرج (ESC/POS) لمبيعات الكاش' : 'Send drawer kick pulse for cash'}</span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.autoOpenDrawer}
                  onChange={(e) => setFormData((prev) => ({ ...prev, autoOpenDrawer: e.target.checked }))}
                  className="w-5 h-5 rounded text-primary focus:ring-primary cursor-pointer accent-primary"
                />
              </div>

              {/* Header Lines */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">{isAr ? 'سطر ترويسة إضافي 1' : 'Receipt Header Line 1'}</label>
                <input
                  type="text"
                  value={formData.receiptHeaderLine1}
                  onChange={(e) => setFormData((prev) => ({ ...prev, receiptHeaderLine1: e.target.value }))}
                  placeholder={isAr ? 'أهلاً بكم في متجرنا' : 'Welcome to MAKERS'}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">{isAr ? 'سطر ترويسة إضافي 2' : 'Receipt Header Line 2'}</label>
                <input
                  type="text"
                  value={formData.receiptHeaderLine2}
                  onChange={(e) => setFormData((prev) => ({ ...prev, receiptHeaderLine2: e.target.value }))}
                  placeholder={isAr ? 'خدمة العملاء: 01xxxxxxxxx' : 'Support Hotline'}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm"
                />
              </div>

              {/* Footer Lines */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">{isAr ? 'سطر التذييل 1' : 'Receipt Footer Line 1'}</label>
                <input
                  type="text"
                  value={formData.receiptFooterLine1}
                  onChange={(e) => setFormData((prev) => ({ ...prev, receiptFooterLine1: e.target.value }))}
                  placeholder="شكراً لتعاملكم معنا"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">{isAr ? 'سطر التذييل 2' : 'Receipt Footer Line 2'}</label>
                <input
                  type="text"
                  value={formData.receiptFooterLine2}
                  onChange={(e) => setFormData((prev) => ({ ...prev, receiptFooterLine2: e.target.value }))}
                  placeholder="Thank you for your visit"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-medium"
                />
              </div>

              {/* Show Barcode & QR toggles */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border/60">
                <div>
                  <span className="font-semibold text-sm text-foreground block">{isAr ? 'طباعة باركود الفاتورة' : 'Print Invoice Barcode'}</span>
                  <span className="text-xs text-muted-foreground">{isAr ? 'باركود 128 برقم الفاتورة لسرعة الاسترجاع' : 'Code128 for quick return scanning'}</span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.showBarcodeOnReceipt}
                  onChange={(e) => setFormData((prev) => ({ ...prev, showBarcodeOnReceipt: e.target.checked }))}
                  className="w-5 h-5 rounded text-primary focus:ring-primary cursor-pointer accent-primary"
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border/60">
                <div>
                  <span className="font-semibold text-sm text-foreground block">{isAr ? 'طباعة QR Code الفاتورة' : 'Print Invoice QR Code'}</span>
                  <span className="text-xs text-muted-foreground">{isAr ? 'رمز استجابة سريعة متوافق مع الفاتورة الإلكترونية' : 'ZATCA / Electronic invoice QR'}</span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.showQrOnReceipt}
                  onChange={(e) => setFormData((prev) => ({ ...prev, showQrOnReceipt: e.target.checked }))}
                  className="w-5 h-5 rounded text-primary focus:ring-primary cursor-pointer accent-primary"
                />
              </div>
            </div>

            {renderTabSaveFooter('receipt')}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 5: BARCODE (الباركود) */}
        {/* ======================================================== */}
        {activeTab === 'barcode' && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2.5">
                <Barcode className="w-5 h-5 text-primary" />
                <h2 className="text-base font-bold text-foreground">{isAr ? 'إعدادات ملصقات واستيكرات الباركود' : 'Barcode & Sticker Printing Preferences'}</h2>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-mono font-medium">12 options</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Default Barcode Type */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">{isAr ? 'نوع الباركود الافتراضي' : 'Default Barcode Format'}</label>
                <select
                  value={formData.defaultBarcodeType}
                  onChange={(e) => setFormData((prev) => ({ ...prev, defaultBarcodeType: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-medium"
                >
                  <option value="code128">Code 128 (قياسي متعدد الأحرف والأرقام)</option>
                  <option value="ean13">EAN-13 (أكواد السلع العالمية 13 رقماً)</option>
                  <option value="qr">QR Code (رمز ثنائي الأبعاد)</option>
                </select>
              </div>

              {/* SKU Prefix */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">{isAr ? 'بادئة كود SKU' : 'SKU Prefix'}</label>
                <input
                  type="text"
                  value={formData.skuPrefix}
                  onChange={(e) => setFormData((prev) => ({ ...prev, skuPrefix: e.target.value }))}
                  placeholder="MKR-"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-mono font-bold"
                />
              </div>

              {/* Label Dimensions mm */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">{isAr ? 'عرض الملصق (مم)' : 'Label Width (mm)'}</label>
                <input
                  type="number"
                  min="20"
                  max="120"
                  value={formData.labelWidthMm}
                  onChange={(e) => setFormData((prev) => ({ ...prev, labelWidthMm: Number(e.target.value) }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-mono font-bold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">{isAr ? 'ارتفاع الملصق (مم)' : 'Label Height (mm)'}</label>
                <input
                  type="number"
                  min="15"
                  max="100"
                  value={formData.labelHeightMm}
                  onChange={(e) => setFormData((prev) => ({ ...prev, labelHeightMm: Number(e.target.value) }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-mono font-bold"
                />
              </div>

              {/* Label Columns in Sheet */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">{isAr ? 'عدد الأعمدة في الورقة / البكرة' : 'Columns per Row'}</label>
                <select
                  value={formData.labelColumns}
                  onChange={(e) => setFormData((prev) => ({ ...prev, labelColumns: Number(e.target.value) }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-medium"
                >
                  <option value={1}>1 (بكرة حرارية فردية)</option>
                  <option value={2}>2 (عمودان)</option>
                  <option value={3}>3 (شيت ستيكر 3 أعمدة)</option>
                  <option value={4}>4 (4 أعمدة)</option>
                </select>
              </div>

              {/* Auto Generate SKU */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border/60">
                <div>
                  <span className="font-semibold text-sm text-foreground block">{isAr ? 'توليد تلقائي للـ SKU عند إنشاء منتج' : 'Auto-Generate SKU'}</span>
                  <span className="text-xs text-muted-foreground">{isAr ? 'توليد كود فريد تلقائياً إذا تم ترك الحقل فارغاً' : 'Generate SKU code automatically'}</span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.autoGenerateSku}
                  onChange={(e) => setFormData((prev) => ({ ...prev, autoGenerateSku: e.target.checked }))}
                  className="w-5 h-5 rounded text-primary focus:ring-primary cursor-pointer accent-primary"
                />
              </div>

              {/* Display items on stickers */}
              <div className="p-4 rounded-xl bg-muted/40 border border-border/60 md:col-span-2 space-y-3">
                <span className="text-sm font-semibold text-foreground block">{isAr ? 'العناصر الظاهرة على ملصق الباركود' : 'Visible Sticker Elements'}</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.labelShowStore}
                      onChange={(e) => setFormData((prev) => ({ ...prev, labelShowStore: e.target.checked }))}
                      className="rounded text-primary accent-primary"
                    />
                    {isAr ? 'اسم المتجر' : 'Store Name'}
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.labelShowName}
                      onChange={(e) => setFormData((prev) => ({ ...prev, labelShowName: e.target.checked }))}
                      className="rounded text-primary accent-primary"
                    />
                    {isAr ? 'اسم المنتج' : 'Product Name'}
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.labelShowPrice}
                      onChange={(e) => setFormData((prev) => ({ ...prev, labelShowPrice: e.target.checked }))}
                      className="rounded text-primary accent-primary"
                    />
                    {isAr ? 'سعر البيع' : 'Sale Price'}
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.labelShowSku}
                      onChange={(e) => setFormData((prev) => ({ ...prev, labelShowSku: e.target.checked }))}
                      className="rounded text-primary accent-primary"
                    />
                    {isAr ? 'كود SKU' : 'SKU Code'}
                  </label>
                </div>
              </div>
            </div>

            {renderTabSaveFooter('barcode')}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 6: DB & BACKUP (قاعدة البيانات والنسخ) */}
        {/* ======================================================== */}
        {activeTab === 'database' && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2.5">
                <Database className="w-5 h-5 text-primary" />
                <h2 className="text-base font-bold text-foreground">{isAr ? 'إدارة قاعدة بيانات SQLite والنسخ الاحتياطي' : 'Database Storage & Backup Manager'}</h2>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-mono font-medium">10 options</span>
            </div>

            {/* Quick Actions Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={handleCreateBackup}
                disabled={isBackingUp}
                className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary/15 transition-all text-xs font-bold flex items-center justify-center gap-2 shadow-xs"
              >
                <Download className={`w-4 h-4 ${isBackingUp ? 'animate-bounce' : ''}`} />
                {isBackingUp ? (isAr ? 'جاري النسخ...' : 'Backing up...') : (isAr ? 'نسخة احتياطية يدوية الآن' : 'Create Backup Now')}
              </button>

              <button
                type="button"
                onClick={handleTriggerAutoBackupNow}
                disabled={isRunningAutoNow}
                className="p-3.5 rounded-xl bg-secondary border border-border text-foreground hover:bg-muted transition-all text-xs font-bold flex items-center justify-center gap-2 shadow-xs"
              >
                <RefreshCw className={`w-4 h-4 ${isRunningAutoNow ? 'animate-spin' : ''}`} />
                {isRunningAutoNow ? (isAr ? 'جاري التشغيل...' : 'Running...') : (isAr ? 'تشغيل النسخ التلقائي فوراً' : 'Run Auto-Backup')}
              </button>

              <button
                type="button"
                onClick={handleTestSecondaryPath}
                disabled={isTestingSecondary}
                className="p-3.5 rounded-xl bg-muted border border-border text-foreground hover:bg-muted/80 transition-all text-xs font-bold flex items-center justify-center gap-2 shadow-xs"
              >
                <FolderOpen className="w-4 h-4 text-primary" />
                {isTestingSecondary ? (isAr ? 'جاري الفحص...' : 'Checking...') : (isAr ? 'فحص المسار الثانوي' : 'Check Backup Path')}
              </button>
            </div>

            {secondaryStatusMsg && (
              <div className={`p-3 rounded-xl text-xs font-medium border ${secondaryPathStatus === 'valid' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-rose-500/10 border-rose-500/20 text-rose-500'}`}>
                {secondaryStatusMsg}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Auto Backup Enabled */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border/60">
                <div>
                  <span className="font-semibold text-sm text-foreground block">{isAr ? 'تفعيل النسخ الاحتياطي التلقائي' : 'Enable Automatic Backup'}</span>
                  <span className="text-xs text-muted-foreground">{isAr ? 'أخذ نسخ دورية وحفظها محلياً' : 'Automated daily backup schedule'}</span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.autoBackupEnabled}
                  onChange={(e) => setFormData((prev) => ({ ...prev, autoBackupEnabled: e.target.checked }))}
                  className="w-5 h-5 rounded text-primary focus:ring-primary cursor-pointer accent-primary"
                />
              </div>

              {/* Backup Frequency Hours */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">{isAr ? 'تكرار النسخ التلقائي (بالساعات)' : 'Backup Frequency (Hours)'}</label>
                <input
                  type="number"
                  min="1"
                  max="720"
                  value={formData.backupIntervalHours}
                  onChange={(e) => setFormData((prev) => ({ ...prev, backupIntervalHours: Number(e.target.value) }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-mono font-bold"
                />
              </div>

              {/* Retention Count */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">{isAr ? 'الحد الأقصى للنسخ المحفوظة (Retention)' : 'Backup Retention Count'}</label>
                <input
                  type="number"
                  min="5"
                  max="365"
                  value={formData.backupRetentionCount}
                  onChange={(e) => setFormData((prev) => ({ ...prev, backupRetentionCount: Number(e.target.value) }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-mono font-bold"
                />
              </div>

              {/* Backup on Close */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border/60">
                <div>
                  <span className="font-semibold text-sm text-foreground block">{isAr ? 'نسخ احتياطي عند إغلاق التطبيق' : 'Backup on App Close'}</span>
                  <span className="text-xs text-muted-foreground">{isAr ? 'إنشاء نسخة فورية قبل الخروج النهائي' : 'Create snapshot before shutdown'}</span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.backupOnClose}
                  onChange={(e) => setFormData((prev) => ({ ...prev, backupOnClose: e.target.checked }))}
                  className="w-5 h-5 rounded text-primary focus:ring-primary cursor-pointer accent-primary"
                />
              </div>

              {/* Secondary Backup Path */}
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-semibold text-foreground">{isAr ? 'مسار النسخ الاحتياطي الثانوي (فلاشة / هارد خارجي / سحابة)' : 'Secondary Backup Folder Path'}</label>
                <input
                  type="text"
                  value={formData.secondaryBackupPath}
                  onChange={(e) => setFormData((prev) => ({ ...prev, secondaryBackupPath: e.target.value }))}
                  placeholder="D:\MakersBackups أو E:\POS_Safe"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-mono"
                />
              </div>
            </div>

            {/* Backups List Table */}
            <div className="space-y-3 pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold flex items-center gap-2">
                  <History className="w-4 h-4 text-primary" />
                  {isAr ? 'سجل النسخ الاحتياطية المتوفرة' : 'Available Backup History'}
                </span>
                <span className="text-xs text-muted-foreground font-mono">{backupsList.length} files</span>
              </div>

              <div className="border border-border/80 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-xs text-right">
                  <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] font-mono sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">{isAr ? 'الملف' : 'Filename'}</th>
                      <th className="py-2.5 px-3">{isAr ? 'النوع' : 'Type'}</th>
                      <th className="py-2.5 px-3">{isAr ? 'الحجم' : 'Size'}</th>
                      <th className="py-2.5 px-3">{isAr ? 'التاريخ' : 'Date'}</th>
                      <th className="py-2.5 px-3 text-center">{isAr ? 'استعادة' : 'Restore'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {backupsList.map((b) => (
                      <tr key={b.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-2 px-3 font-mono font-medium truncate max-w-xs">{b.filename}</td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${b.type === 'manual' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            {b.type}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono">{(b.size_bytes / 1024).toFixed(1)} KB</td>
                        <td className="py-2 px-3 font-mono text-muted-foreground">{new Date(b.created_at).toLocaleString()}</td>
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => setRestoreConfirmModal(b)}
                            className="px-2 py-1 rounded bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 text-[11px] font-bold"
                          >
                            {isAr ? 'استرجاع' : 'Restore'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {backupsList.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-muted-foreground text-xs">
                          {isAr ? 'لا توجد نسخ احتياطية مسجلة بعد' : 'No backup files yet'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {renderTabSaveFooter('database')}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 7: THEME & SOUNDS (المظهر والأصوات) */}
        {/* ======================================================== */}
        {activeTab === 'theme_sounds' && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2.5">
                <Volume2 className="w-5 h-5 text-primary" />
                <h2 className="text-base font-bold text-foreground">{isAr ? 'التأثيرات الصوتية وتخصيص تجربة الاستخدام' : 'Audio Feedback & Sound Effects'}</h2>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-mono font-medium">8 options</span>
            </div>

            {/* Sound Synthesizer Test Card */}
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-primary flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    {isAr ? 'محاكي الأصوات وتجربة التنبيهات الفورية' : 'Live Web Audio Synthesizer'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {isAr ? 'أصوات رقمية عالية النقاء مولدة برمجياً دون ملفات خارجية' : 'Native Web Audio oscillators for instant feedback'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => playScanSound()}
                  className="px-3.5 py-2 rounded-xl bg-background border border-border text-xs font-semibold hover:bg-muted transition-all flex items-center gap-2 shadow-xs"
                >
                  <Play className="w-3.5 h-3.5 text-primary" />
                  {isAr ? 'تجربة صوت الباركود (Beep)' : 'Test Scan Beep'}
                </button>
                <button
                  type="button"
                  onClick={() => playSaleSuccessSound()}
                  className="px-3.5 py-2 rounded-xl bg-background border border-border text-xs font-semibold hover:bg-muted transition-all flex items-center gap-2 shadow-xs"
                >
                  <Play className="w-3.5 h-3.5 text-emerald-500" />
                  {isAr ? 'تجربة صوت إتمام البيع (Chime)' : 'Test Sale Chime'}
                </button>
                <button
                  type="button"
                  onClick={() => playErrorSound()}
                  className="px-3.5 py-2 rounded-xl bg-background border border-border text-xs font-semibold hover:bg-muted transition-all flex items-center gap-2 shadow-xs"
                >
                  <Play className="w-3.5 h-3.5 text-rose-500" />
                  {isAr ? 'تجربة صوت التنبيه / الخطأ' : 'Test Error Tone'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Sound Enabled Global Toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border/60">
                <div>
                  <span className="font-semibold text-sm text-foreground block">{isAr ? 'تفعيل المؤثرات الصوتية عاماً' : 'Sound Effects Enabled'}</span>
                  <span className="text-xs text-muted-foreground">{isAr ? 'تشغيل أو كتم كافة أصوات الكاشير والتنبيهات' : 'Global audio toggle'}</span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.soundEnabled}
                  onChange={(e) => setFormData((prev) => ({ ...prev, soundEnabled: e.target.checked }))}
                  className="w-5 h-5 rounded text-primary focus:ring-primary cursor-pointer accent-primary"
                />
              </div>

              {/* Sound Volume Slider */}
              <div className="space-y-2 p-4 rounded-xl bg-muted/40 border border-border/60">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                    {formData.soundVolume > 0 ? <Volume2 className="w-4 h-4 text-primary" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
                    {isAr ? 'مستوى صوت التنبيهات' : 'Sound Volume'}
                  </label>
                  <span className="text-sm font-mono font-bold text-primary">{formData.soundVolume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={formData.soundVolume}
                  onChange={(e) => setFormData((prev) => ({ ...prev, soundVolume: Number(e.target.value) }))}
                  className="w-full accent-primary cursor-pointer"
                />
              </div>

              {/* Sound on Scan */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border/60">
                <div>
                  <span className="font-semibold text-sm text-foreground block">{isAr ? 'صوت مسح الباركود' : 'Beep on Barcode Scan'}</span>
                  <span className="text-xs text-muted-foreground">{isAr ? 'تأكيد صوتي فوري عند قراءة المنتج' : 'Play beep on product scan'}</span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.soundOnScan}
                  onChange={(e) => setFormData((prev) => ({ ...prev, soundOnScan: e.target.checked }))}
                  className="w-5 h-5 rounded text-primary focus:ring-primary cursor-pointer accent-primary"
                />
              </div>

              {/* Sound on Sale */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border/60">
                <div>
                  <span className="font-semibold text-sm text-foreground block">{isAr ? 'صوت نجاح الفاتورة' : 'Chime on Completed Sale'}</span>
                  <span className="text-xs text-muted-foreground">{isAr ? 'نغمة تأكيد إتمام الدفع بنجاح' : 'Success chime on checkout'}</span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.soundOnSale}
                  onChange={(e) => setFormData((prev) => ({ ...prev, soundOnSale: e.target.checked }))}
                  className="w-5 h-5 rounded text-primary focus:ring-primary cursor-pointer accent-primary"
                />
              </div>

              {/* Sound on Error */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border/60">
                <div>
                  <span className="font-semibold text-sm text-foreground block">{isAr ? 'صوت الأخطاء والتنبيهات' : 'Error & Warning Sounds'}</span>
                  <span className="text-xs text-muted-foreground">{isAr ? 'تنبيه عند نفاذ الرصيد أو خطأ السداد' : 'Alert sound on validation errors'}</span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.soundOnError}
                  onChange={(e) => setFormData((prev) => ({ ...prev, soundOnError: e.target.checked }))}
                  className="w-5 h-5 rounded text-primary focus:ring-primary cursor-pointer accent-primary"
                />
              </div>

              {/* Compact Mode */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border/60">
                <div>
                  <span className="font-semibold text-sm text-foreground block">{isAr ? 'الوضع المضغوط (Compact Mode)' : 'Compact View Mode'}</span>
                  <span className="text-xs text-muted-foreground">{isAr ? 'تقليل المسافات لعرض أصناف أكثر بالشاشات الصغيرة' : 'Tighter layout spacing for small POS screens'}</span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.compactMode}
                  onChange={(e) => setFormData((prev) => ({ ...prev, compactMode: e.target.checked }))}
                  className="w-5 h-5 rounded text-primary focus:ring-primary cursor-pointer accent-primary"
                />
              </div>
            </div>

            {renderTabSaveFooter('theme_sounds')}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 8: SECURITY (الأمان) */}
        {/* ======================================================== */}
        {activeTab === 'security' && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2.5">
                <Lock className="w-5 h-5 text-primary" />
                <h2 className="text-base font-bold text-foreground">{isAr ? 'سياسات الأمان والجلسات وكلمات المرور' : 'Security Policies & Session Timeout'}</h2>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-mono font-medium">5 options</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Session Timeout */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground flex items-center justify-between">
                  <span>{isAr ? 'مدة صلاحية الجلسة (بالدقائق)' : 'Session Timeout (Minutes)'}</span>
                  <Clock className="w-4 h-4 text-muted-foreground" />
                </label>
                <input
                  type="number"
                  min="30"
                  max="1440"
                  step="30"
                  value={formData.sessionTimeoutMinutes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, sessionTimeoutMinutes: Number(e.target.value) }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-mono font-bold"
                />
                <p className="text-xs text-muted-foreground">{isAr ? 'القيمة الافتراضية 480 دقيقة (8 ساعات وردية كاملة)' : 'Default 480 min (8 hours full shift)'}</p>
              </div>

              {/* Password Minimum Length */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground flex items-center justify-between">
                  <span>{isAr ? 'الحد الأدنى لطول كلمة المرور' : 'Minimum Password Length'}</span>
                  <KeyRound className="w-4 h-4 text-muted-foreground" />
                </label>
                <input
                  type="number"
                  min="4"
                  max="32"
                  value={formData.passwordMinLength}
                  onChange={(e) => setFormData((prev) => ({ ...prev, passwordMinLength: Number(e.target.value) }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-mono font-bold"
                />
              </div>

              {/* Max Failed Attempts */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">{isAr ? 'أقصى محاولات دخول خاطئة قبل القفل' : 'Max Failed Login Attempts'}</label>
                <input
                  type="number"
                  min="3"
                  max="20"
                  value={formData.maxFailedAttempts}
                  onChange={(e) => setFormData((prev) => ({ ...prev, maxFailedAttempts: Number(e.target.value) }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-mono font-bold"
                />
              </div>

              {/* Auto Lock on Idle */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">{isAr ? 'قفل تلقائي عند الخمول (بالدقائق)' : 'Auto-Lock on Idle (Minutes)'}</label>
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={formData.autoLockMinutes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, autoLockMinutes: Number(e.target.value) }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-mono font-bold"
                />
                <p className="text-xs text-muted-foreground">{isAr ? '0 تعني تعطيل القفل التلقائي' : '0 = Disabled'}</p>
              </div>

              {/* Password Complexity */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border/60 md:col-span-2">
                <div>
                  <span className="font-semibold text-sm text-foreground block">{isAr ? 'اشتراط تعقيد كلمة المرور' : 'Enforce Password Complexity'}</span>
                  <span className="text-xs text-muted-foreground">{isAr ? 'يجب أن تحتوي على حروف كبيرة وصغيرة وأرقام' : 'Require uppercase, lowercase, and digits'}</span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.passwordComplexity}
                  onChange={(e) => setFormData((prev) => ({ ...prev, passwordComplexity: e.target.checked }))}
                  className="w-5 h-5 rounded text-primary focus:ring-primary cursor-pointer accent-primary"
                />
              </div>
            </div>

            {renderTabSaveFooter('security')}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 9: ADVANCED (متقدم / منطقة الخطر) */}
        {/* ======================================================== */}
        {activeTab === 'advanced' && (
          <div className="space-y-6">
            {/* Developer & Logging Options */}
            <div className="bg-card border border-border rounded-2xl p-6 space-y-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-2.5">
                  <Sliders className="w-5 h-5 text-primary" />
                  <h2 className="text-base font-bold text-foreground">{isAr ? 'خيارات المطور والتشخيص' : 'Developer & Diagnostics'}</h2>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-mono font-medium">4 options</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Developer Mode */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border/60">
                  <div>
                    <span className="font-semibold text-sm text-foreground block">{isAr ? 'وضع المطور (Developer Mode)' : 'Developer Mode'}</span>
                    <span className="text-xs text-muted-foreground">{isAr ? 'تفعيل أدوات فحص وتعديل متقدمة' : 'Enable advanced dev capabilities'}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.developerMode}
                    onChange={(e) => setFormData((prev) => ({ ...prev, developerMode: e.target.checked }))}
                    className="w-5 h-5 rounded text-primary focus:ring-primary cursor-pointer accent-primary"
                  />
                </div>

                {/* Log Level */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">{isAr ? 'مستوى تسجيل الأحداث (Log Level)' : 'Log Level'}</label>
                  <select
                    value={formData.logLevel}
                    onChange={(e) => setFormData((prev) => ({ ...prev, logLevel: e.target.value as any }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-mono font-medium"
                  >
                    <option value="debug">debug (تفصيلي بالكامل)</option>
                    <option value="info">info (قياسي للتشغيل)</option>
                    <option value="warn">warn (تحذيرات فقط)</option>
                    <option value="error">error (أخطاء حرجة فقط)</option>
                  </select>
                </div>

                {/* Verbose Logs */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border/60">
                  <div>
                    <span className="font-semibold text-sm text-foreground block">{isAr ? 'تسجيل مطول بوحدة التحكم' : 'Verbose Console Logs'}</span>
                    <span className="text-xs text-muted-foreground">{isAr ? 'طباعة استعلامات SQLite في الـ Console' : 'Print raw SQLite queries in DevTools'}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.verboseLogs}
                    onChange={(e) => setFormData((prev) => ({ ...prev, verboseLogs: e.target.checked }))}
                    className="w-5 h-5 rounded text-primary focus:ring-primary cursor-pointer accent-primary"
                  />
                </div>

                {/* Performance Metrics */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border/60">
                  <div>
                    <span className="font-semibold text-sm text-foreground block">{isAr ? 'عرض مؤشرات الأداء' : 'Show Performance Metrics'}</span>
                    <span className="text-xs text-muted-foreground">{isAr ? 'عرض زمن استجابة الاستعلامات' : 'Display query timings'}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.showPerformance}
                    onChange={(e) => setFormData((prev) => ({ ...prev, showPerformance: e.target.checked }))}
                    className="w-5 h-5 rounded text-primary focus:ring-primary cursor-pointer accent-primary"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleExportDiagnostics}
                  className="px-4 py-2 rounded-xl bg-muted border border-border hover:bg-muted/80 text-xs font-semibold flex items-center gap-2"
                >
                  <FileText className="w-4 h-4 text-primary" />
                  {isAr ? 'تصدير ملف تشخيص النظام (JSON Logs)' : 'Export Diagnostic Logs (JSON)'}
                </button>
              </div>

              {renderTabSaveFooter('advanced')}
            </div>

            {/* Danger Zone Card */}
            <div className="bg-rose-950/20 border-2 border-rose-500/30 rounded-2xl p-6 space-y-6 shadow-sm">
              <div className="flex items-center gap-3 border-b border-rose-500/20 pb-4">
                <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-rose-500">{isAr ? 'منطقة الخطر (Danger Zone)' : 'Danger Zone'}</h3>
                  <p className="text-xs text-rose-400/80">{isAr ? 'إجراءات حساسة تؤثر على بيانات النظام' : 'Irreversible actions affecting stored data'}</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Clear WebView2 logins */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-background/60 border border-border">
                  <div>
                    <span className="font-semibold text-sm text-foreground block">{isAr ? 'مسح بيانات WebView2 المحفوظة' : 'Clear WebView2 Saved Logins'}</span>
                    <span className="text-xs text-muted-foreground">{isAr ? 'إزالة الكوكيز وكلمات المرور المخزنة في متصفح التطبيق' : 'Clear cached cookies and stored logins'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearSavedLogins}
                    disabled={isClearingWebview}
                    className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-semibold border border-border flex items-center gap-2"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    {isClearingWebview ? (isAr ? 'جاري المسح...' : 'Clearing...') : (isAr ? 'مسح بيانات الدخول' : 'Clear Data')}
                  </button>
                </div>

                {/* Clean Test Users */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-background/60 border border-border">
                  <div>
                    <span className="font-semibold text-sm text-foreground block">{isAr ? 'تنظيف المستخدمين التجريبيين' : 'Cleanup Test Users'}</span>
                    <span className="text-xs text-muted-foreground">
                      {isAr
                        ? `حذف الحسابات التجريبية نهائياً (${testUsersList.length} مستخدم تم اكتشافه)`
                        : `Remove dummy test accounts (${testUsersList.length} detected)`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCleanupTestUsersModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-xs font-bold border border-amber-500/30 flex items-center gap-2"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    {isAr ? 'تنظيف الحسابات التجريبية' : 'Cleanup Test Users'}
                  </button>
                </div>

                {/* Reset Operational Data */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-rose-500/10 border border-rose-500/30">
                  <div>
                    <span className="font-semibold text-sm text-rose-500 block">{isAr ? 'إعادة ضبط البيانات التشغيلية بالكامل' : 'Reset All Operational Data'}</span>
                    <span className="text-xs text-rose-400">
                      {isAr ? 'تصفير المبيعات، المرتجعات، الورديات، والمخزون مع أخذ نسخة احتياطية إجبارية' : 'Wipes sales, returns, and shifts'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setResetModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {isAr ? 'إعادة الضبط الآن' : 'Reset All Data'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 10: INTEGRATIONS (التكامل) */}
        {/* ======================================================== */}
        {activeTab === 'integrations' && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2.5">
                <Cpu className="w-5 h-5 text-primary" />
                <h2 className="text-base font-bold text-foreground">{isAr ? 'التكامل والربط مع متجر MAKERS الإلكتروني' : 'MAKERS WooCommerce Store API Integration'}</h2>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-mono font-medium">4 options</span>
            </div>

            {/* Connection Test Status Banner */}
            {makersTestMsg && (
              <div className={`p-4 rounded-xl text-xs font-medium border flex items-center gap-2.5 animate-in fade-in ${makersTestStatus === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-rose-500/10 border-rose-500/20 text-rose-500'}`}>
                {makersTestStatus === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
                <span>{makersTestMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* API Base URL */}
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-semibold text-foreground flex items-center justify-between">
                  <span>{isAr ? 'رابط الموقع / المتجر الإلكتروني (API URL)' : 'MAKERS Store API URL'}</span>
                  <span className="text-xs text-muted-foreground font-mono">WooCommerce Store API</span>
                </label>
                <input
                  type="text"
                  value={formData.makersApiUrl}
                  onChange={(e) => setFormData((prev) => ({ ...prev, makersApiUrl: e.target.value }))}
                  placeholder="https://makerselectronics.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-mono"
                />
              </div>

              {/* Search Result Limit */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">{isAr ? 'أقصى عدد نتائج في البحث الفوري' : 'Live Search Results Limit'}</label>
                <input
                  type="number"
                  min="5"
                  max="100"
                  value={formData.makersSearchLimit}
                  onChange={(e) => setFormData((prev) => ({ ...prev, makersSearchLimit: Number(e.target.value) }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-mono font-bold"
                />
              </div>

              {/* Sync Interval Hours */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">{isAr ? 'تكرار المزامنة الدورية (بالساعات)' : 'Sync Interval (Hours)'}</label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={formData.makersSyncIntervalHours}
                  onChange={(e) => setFormData((prev) => ({ ...prev, makersSyncIntervalHours: Number(e.target.value) }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm font-mono font-bold"
                />
              </div>

              {/* Auto Sync Toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border/60 md:col-span-2">
                <div>
                  <span className="font-semibold text-sm text-foreground block">{isAr ? 'المزامنة التلقائية لأسعار وكتالوج المتجر' : 'Enable Automatic Catalog Sync'}</span>
                  <span className="text-xs text-muted-foreground">{isAr ? 'تحديث تلقائي لأسعار وصور المنتجات من الموقع' : 'Periodically refresh product prices & pictures'}</span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.makersAutoSync}
                  onChange={(e) => setFormData((prev) => ({ ...prev, makersAutoSync: e.target.checked }))}
                  className="w-5 h-5 rounded text-primary focus:ring-primary cursor-pointer accent-primary"
                />
              </div>
            </div>

            {/* Test Connection Button */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleTestMakersConnection}
                disabled={isTestingMakers}
                className="px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 text-xs font-bold flex items-center gap-2"
              >
                <Wifi className={`w-3.5 h-3.5 ${isTestingMakers ? 'animate-pulse' : ''}`} />
                {isTestingMakers ? (isAr ? 'جاري فحص الاتصال...' : 'Testing...') : (isAr ? 'اختبار الاتصال بالموقع الآن' : 'Test Connection')}
              </button>
            </div>

            {renderTabSaveFooter('integrations')}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 11: ABOUT (عن النظام) */}
        {/* ======================================================== */}
        {activeTab === 'about' && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-6 shadow-sm">
            <div className="flex items-center gap-3 border-b border-border pb-4">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">MAKERS POS — System Overview</h2>
                <p className="text-xs text-muted-foreground">{isAr ? 'معلومات الإصدار، البنية التحتية، وحقوق التطوير' : 'Version, Architecture, and Engineering Credits'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-1">
                <span className="text-xs text-muted-foreground">{isAr ? 'إصدار التطبيق' : 'Application Version'}</span>
                <p className="text-sm font-mono font-bold text-foreground">v1.0.0 (Production Stable)</p>
              </div>

              <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-1">
                <span className="text-xs text-muted-foreground">{isAr ? 'بيئة التشغيل' : 'Platform & Runtime'}</span>
                <p className="text-sm font-mono font-bold text-foreground">Tauri 2.0 (Rust) + React 18 + Vite</p>
              </div>

              <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-1">
                <span className="text-xs text-muted-foreground">{isAr ? 'محرك قاعدة البيانات' : 'Embedded Database'}</span>
                <p className="text-sm font-mono font-bold text-foreground">SQLite 3 (Local Offline-First with WAL)</p>
              </div>

              <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-1">
                <span className="text-xs text-muted-foreground">{isAr ? 'الترخيص' : 'License'}</span>
                <p className="text-sm font-bold text-foreground">Commercial License — MAKERS POS</p>
              </div>
            </div>

            {/* Developer Credit & Links */}
            <div className="p-5 rounded-xl bg-primary/5 border border-primary/20 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-foreground">{isAr ? 'تصميم وتطوير المهندس' : 'Designed & Developed by'}</h4>
                  <p className="text-sm font-semibold text-primary pt-0.5">Khaled Eldaoudy</p>
                  <p className="text-xs text-muted-foreground pt-1">Senior Full-Stack & Systems Engineer</p>
                </div>
                <button
                  type="button"
                  onClick={() => openExternalUrl(DEVELOPER_LINKEDIN_URL)}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-sm"
                >
                  <Linkedin className="w-4 h-4" />
                  LinkedIn
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODALS: Reset Operational Data */}
      {/* ======================================================== */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-card border border-rose-500/40 rounded-2xl p-6 max-w-lg w-full space-y-5 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-500">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-lg font-bold">{isAr ? 'تحذير أمني: إعادة ضبط البيانات' : 'Security Warning: Reset Data'}</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {isAr
                ? 'سيتم حذف كافة المبيعات، المرتجعات، الورديات، وتسويات المخزون. سيتم أخذ نسخة احتياطية إجبارية تلقائياً قبل بدء الحذف.'
                : 'All transactions will be deleted. An automated backup will be created first.'}
            </p>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">
                {isAr ? 'اكتب "RESET" للتأكيد:' : 'Type "RESET" to confirm:'}
              </label>
              <input
                type="text"
                value={resetConfirmationInput}
                onChange={(e) => setResetConfirmationInput(e.target.value)}
                placeholder="RESET"
                className="w-full px-3.5 py-2 rounded-xl bg-background border border-border text-sm font-mono font-bold"
              />
            </div>
            <div className="flex gap-2 justify-end pt-3">
              <button
                type="button"
                onClick={() => {
                  setResetModalOpen(false)
                  setResetConfirmationInput('')
                }}
                className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-xs font-bold"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleExecuteReset}
                disabled={resetConfirmationInput.trim().toUpperCase() !== 'RESET' || isResetting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-40"
              >
                {isResetting ? (isAr ? 'جاري الضبط...' : 'Resetting...') : (isAr ? 'تأكيد الحذف النهائي' : 'Confirm Reset')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cleanup Test Users Modal */}
      {cleanupTestUsersModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-card border border-amber-500/40 rounded-2xl p-6 max-w-lg w-full space-y-5 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-500">
              <UserX className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-lg font-bold">{isAr ? 'تأكيد حذف المستخدمين التجريبيين' : 'Confirm Cleanup Test Users'}</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {isAr
                ? `سيتم إزالة ${testUsersList.length} مستخدم تجريبي من قاعدة البيانات. سيتم أخذ نسخة احتياطية أولاً.`
                : `Permanently delete ${testUsersList.length} test users from database.`}
            </p>
            <div className="flex gap-2 justify-end pt-3">
              <button
                type="button"
                onClick={() => setCleanupTestUsersModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-xs font-bold"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleExecuteCleanupTestUsers}
                disabled={isCleaningTestUsers}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold disabled:opacity-40"
              >
                {isCleaningTestUsers ? (isAr ? 'جاري الحذف...' : 'Cleaning...') : (isAr ? 'حذف الحسابات التجريبية' : 'Confirm Cleanup')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirm Modal */}
      {restoreConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-card border border-amber-500/40 rounded-2xl p-6 max-w-lg w-full space-y-5 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-500">
              <History className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-lg font-bold">{isAr ? 'تأكيد استعادة النسخة الاحتياطية' : 'Confirm Database Restore'}</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {isAr
                ? `سيتم استبدال قاعدة البيانات الحالية ببيانات النسخة (${restoreConfirmModal.filename}). سيتم أخذ نسخة طوارئ إجبارية قبل البدء.`
                : `Restore database from ${restoreConfirmModal.filename}? A safety snapshot will be taken first.`}
            </p>
            <div className="flex gap-2 justify-end pt-3">
              <button
                type="button"
                onClick={() => setRestoreConfirmModal(null)}
                className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-xs font-bold"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={isRestoring}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold disabled:opacity-40"
              >
                {isRestoring ? (isAr ? 'جاري الاستعادة...' : 'Restoring...') : (isAr ? 'بدء الاستعادة' : 'Restore')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

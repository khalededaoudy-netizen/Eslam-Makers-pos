import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Trash2, Loader2, Info, X } from 'lucide-react'
import { useSettingsStore } from '@/stores/settingsStore'

export interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void> | void
  title?: string
  description?: string
  itemName?: string
  itemCount?: number
  itemsList?: string[]
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
  isLoading?: boolean
  errorMessage?: string | null
  warningMessage?: string
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  itemName,
  itemCount,
  itemsList,
  confirmText,
  cancelText,
  variant = 'danger',
  isLoading: externalLoading = false,
  errorMessage = null,
  warningMessage,
}: ConfirmDialogProps) {
  const { t } = useTranslation()
  const { language } = useSettingsStore()
  const isRTL = language === 'ar'

  const [internalLoading, setInternalLoading] = useState(false)
  const [internalError, setInternalError] = useState<string | null>(null)
  const isBusy = externalLoading || internalLoading

  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Reset internal states on open
  useEffect(() => {
    if (isOpen) {
      setInternalLoading(false)
      setInternalError(null)
      // Focus cancel button by default for safety
      const timer = setTimeout(() => {
        cancelButtonRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Sync external error
  useEffect(() => {
    if (errorMessage) {
      setInternalError(errorMessage)
    }
  }, [errorMessage])

  // Keyboard navigation: Escape to cancel, Enter to submit
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isBusy) {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isBusy, onClose])

  if (!isOpen) return null

  const handleConfirmClick = async () => {
    if (isBusy) return
    setInternalError(null)
    setInternalLoading(true)

    try {
      await onConfirm()
      // If parent handles closing, internalLoading resets on unmount/re-open
    } catch (err: any) {
      const msg = err?.message || t('common.errorOccurred', 'حدث خطأ أثناء تنفيذ العملية')
      setInternalError(msg)
    } finally {
      setInternalLoading(false)
    }
  }

  // Variant visuals
  const variantStyles = {
    danger: {
      iconBg: 'bg-rose-500/10 text-rose-500 border-rose-500/20 ring-rose-500/10',
      icon: <Trash2 className="w-6 h-6 text-rose-500" />,
      confirmBtn:
        'bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white focus:ring-rose-500 shadow-sm shadow-rose-600/20',
      defaultTitle: t('common.confirmDelete', 'تأكيد الحذف'),
      defaultConfirm: t('common.delete', 'حذف'),
    },
    warning: {
      iconBg: 'bg-amber-500/10 text-amber-500 border-amber-500/20 ring-amber-500/10',
      icon: <AlertTriangle className="w-6 h-6 text-amber-500" />,
      confirmBtn:
        'bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white focus:ring-amber-500 shadow-sm shadow-amber-600/20',
      defaultTitle: t('common.confirmAction', 'تأكيد الإجراء'),
      defaultConfirm: t('common.confirm', 'تأكيد'),
    },
    info: {
      iconBg: 'bg-primary/10 text-primary border-primary/20 ring-primary/10',
      icon: <Info className="w-6 h-6 text-primary" />,
      confirmBtn:
        'bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground focus:ring-primary shadow-sm',
      defaultTitle: t('common.confirm', 'تأكيد'),
      defaultConfirm: t('common.confirm', 'تأكيد'),
    },
  }[variant]

  const displayTitle = title || variantStyles.defaultTitle
  const displayConfirmText = isBusy
    ? (variant === 'danger' ? t('common.deleting', 'جارٍ الحذف...') : t('common.loading', 'جارٍ التنفيذ...'))
    : (confirmText || variantStyles.defaultConfirm)
  const displayCancelText = cancelText || t('common.cancel', 'إلغاء')

  // Description computation
  let displayDescription = description
  if (!displayDescription) {
    if (itemCount && itemCount > 1) {
      displayDescription = isRTL
        ? `هل أنت متأكد من حذف ${itemCount} عنصر محدد؟`
        : `Are you sure you want to delete ${itemCount} selected items?`
    } else if (itemName) {
      displayDescription = isRTL
        ? `هل أنت متأكد من حذف هذا العنصر؟`
        : `Are you sure you want to delete this item?`
    } else {
      displayDescription = t(
        'common.confirmDeleteDesc',
        'هل أنت متأكد من حذف هذا العنصر؟'
      )
    }
  }

  const effectiveWarning =
    warningMessage !== undefined
      ? warningMessage
      : variant === 'danger'
      ? t('common.confirmDeleteWarning', 'لا يمكن التراجع عن هذا الإجراء.')
      : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150"
      dir={isRTL ? 'rtl' : 'ltr'}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
    >
      {/* Click outside to close (if not busy) */}
      <div
        className="fixed inset-0"
        onClick={() => {
          if (!isBusy) onClose()
        }}
        aria-hidden="true"
      />

      {/* Dialog Card */}
      <div
        ref={dialogRef}
        className="relative z-10 w-full max-w-md overflow-hidden bg-card text-card-foreground border border-border shadow-2xl rounded-2xl p-6 sm:p-7 text-center animate-in zoom-in-95 duration-150"
      >
        {/* Close Button Top-Corner */}
        <button
          type="button"
          onClick={onClose}
          disabled={isBusy}
          className="absolute top-4 end-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors disabled:opacity-40"
          aria-label={t('common.close', 'إغلاق')}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon Badge */}
        <div className="flex justify-center mb-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center border ring-8 transition-all ${variantStyles.iconBg}`}
          >
            {variantStyles.icon}
          </div>
        </div>

        {/* Title */}
        <h3
          id="confirm-dialog-title"
          className="text-lg font-bold text-foreground tracking-tight"
        >
          {displayTitle}
        </h3>

        {/* Item Name Badge or Items List */}
        {itemName && (
          <div className="mt-3 flex justify-center">
            <span className="inline-block max-w-[90%] truncate px-3.5 py-1.5 rounded-xl bg-muted/80 border border-border/60 text-foreground font-semibold text-sm">
              "{itemName}"
            </span>
          </div>
        )}

        {/* Optional small items list for bulk (1-3 items) */}
        {itemsList && itemsList.length > 0 && itemsList.length <= 3 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5 justify-center max-h-24 overflow-y-auto">
            {itemsList.map((name, idx) => (
              <span
                key={idx}
                className="text-xs px-2 py-1 rounded-md bg-muted border border-border/50 text-foreground truncate max-w-[200px]"
              >
                {name}
              </span>
            ))}
          </div>
        )}

        {/* Description */}
        <p
          id="confirm-dialog-desc"
          className="text-sm text-muted-foreground mt-2 leading-relaxed"
        >
          {displayDescription}
        </p>

        {/* Destructive Warning */}
        {effectiveWarning && (
          <div className="mt-3.5 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center justify-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{effectiveWarning}</span>
          </div>
        )}

        {/* Error Banner */}
        {internalError && (
          <div className="mt-3.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium text-start leading-relaxed animate-in fade-in">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">{t('common.error', 'خطأ')}</p>
                <p className="mt-0.5 opacity-90">{internalError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="flex-1 px-4 py-2.5 rounded-xl border border-input bg-background hover:bg-muted text-foreground text-sm font-semibold transition-colors disabled:opacity-40"
          >
            {displayCancelText}
          </button>

          <button
            type="button"
            onClick={handleConfirmClick}
            disabled={isBusy}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 ${variantStyles.confirmBtn}`}
          >
            {isBusy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{displayConfirmText}</span>
              </>
            ) : (
              <span>{displayConfirmText}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Imperative Hook for Confirm Dialog
 */
interface ConfirmOptions {
  title?: string
  description?: string
  itemName?: string
  itemCount?: number
  itemsList?: string[]
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
  warningMessage?: string
  onConfirm: () => Promise<void> | void
}

export function useConfirmDialog() {
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean
    options: ConfirmOptions | null
  }>({
    isOpen: false,
    options: null,
  })

  const confirm = useCallback((options: ConfirmOptions) => {
    setDialogState({
      isOpen: true,
      options,
    })
  }, [])

  const close = useCallback(() => {
    setDialogState(prev => ({ ...prev, isOpen: false }))
  }, [])

  const handleConfirm = useCallback(async () => {
    if (dialogState.options?.onConfirm) {
      await dialogState.options.onConfirm()
      close()
    }
  }, [dialogState.options, close])

  const ConfirmDialogComponent = (
    <ConfirmDialog
      isOpen={dialogState.isOpen}
      onClose={close}
      onConfirm={handleConfirm}
      title={dialogState.options?.title}
      description={dialogState.options?.description}
      itemName={dialogState.options?.itemName}
      itemCount={dialogState.options?.itemCount}
      itemsList={dialogState.options?.itemsList}
      confirmText={dialogState.options?.confirmText}
      cancelText={dialogState.options?.cancelText}
      variant={dialogState.options?.variant}
      warningMessage={dialogState.options?.warningMessage}
    />
  )

  return {
    confirm,
    close,
    ConfirmDialogComponent,
  }
}

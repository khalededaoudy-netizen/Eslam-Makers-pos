import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  X,
  Lock,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Loader2,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Coins,
} from 'lucide-react'
import { cashRegisterService } from '@/features/cash-register/cashRegisterService'
import { ShiftReconciliation } from '@/features/cash-register/types'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency } from '@/lib/formatters'
import { useSettingsStore } from '@/stores/settingsStore'

interface QuickCloseShiftModalProps {
  isOpen: boolean
  shiftId: string
  onClose: () => void
  onShiftClosed: () => void
  onToast?: (msg: string, type?: 'success' | 'error') => void
}

export function QuickCloseShiftModal({
  isOpen,
  shiftId,
  onClose,
  onShiftClosed,
  onToast,
}: QuickCloseShiftModalProps) {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language !== 'en'
  const { user } = useAuthStore()
  const { currencySymbol } = useSettingsStore()

  const [reconciliation, setReconciliation] = useState<ShiftReconciliation | null>(null)
  const [actualCash, setActualCash] = useState('')
  const [notes, setNotes] = useState('')
  const [loadingRecon, setLoadingRecon] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && shiftId) {
      setError(null)
      setActualCash('')
      setNotes('')
      setLoadingRecon(true)
      cashRegisterService
        .getShiftReconciliation(shiftId)
        .then((recon) => {
          setReconciliation(recon)
        })
        .catch((err) => {
          console.error('Failed to get shift reconciliation:', err)
          setError(isArabic ? 'فشل تحميل بيانات مطابقة الوردية' : 'Failed to load shift summary')
        })
        .finally(() => {
          setLoadingRecon(false)
        })
    }
  }, [isOpen, shiftId, isArabic])

  if (!isOpen) return null

  const expectedCash = reconciliation?.expectedPhysicalCash ?? 0
  const isActualEntered = actualCash.trim() !== ''
  const counted = parseFloat(actualCash)
  const isCountedValid = isActualEntered && !isNaN(counted) && counted >= 0
  const difference = isCountedValid ? Number((counted - expectedCash).toFixed(2)) : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!isActualEntered) {
      setError(isArabic ? 'الرصيد الفعلي مطلوب — يرجى عد النقود الموجودة في الدرج' : 'Actual cash count is required')
      return
    }

    if (isNaN(counted) || counted < 0) {
      setError(isArabic ? 'الرصيد الفعلي يجب أن يكون رقماً أكبر من أو يساوي صفر' : 'Actual cash count must be >= 0')
      return
    }

    if (!user) {
      setError(isArabic ? 'يجب تسجيل الدخول لإغلاق الوردية' : 'User authentication required')
      return
    }

    setSubmitting(true)
    try {
      await cashRegisterService.closeShift(
        {
          shiftId,
          actualCash: counted,
          notes: notes.trim() || undefined,
        },
        {
          id: user.id,
          fullName: user.fullName,
          role: user.roleName,
        }
      )

      if (onToast) {
        onToast(t('shift.shiftClosed', 'تم إغلاق الوردية بنجاح'), 'success')
      }
      onShiftClosed()
      onClose()
    } catch (err: any) {
      setError(err?.message || (isArabic ? 'فشل إغلاق الوردية' : 'Failed to close shift'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                {t('shift.closeNow', 'إغلاق الوردية والمطابقة المالية')}
              </h3>
              <p className="text-xs text-muted-foreground">
                {isArabic ? 'جرد النقدية بالدرج وحساب الفروقات قبل الإغلاق' : 'Reconcile drawer cash count and close session'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loadingRecon ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-xs">{isArabic ? 'جاري حساب حركة النقدية والمبيعات...' : 'Calculating reconciliation...'}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Shift Financial Summary Breakdown */}
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-2.5 text-xs">
              <div className="font-bold text-foreground flex items-center justify-between border-b border-border/60 pb-1.5">
                <span>{isArabic ? 'ملخص حركة النقدية بالوردية:' : 'Shift Cash Breakdown:'}</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {reconciliation?.openedAt ? new Date(reconciliation.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>{t('shift.openingBalance', 'الرصيد الافتتاحي')}:</span>
                  <span className="font-mono font-bold text-foreground">
                    {formatCurrency(reconciliation?.openingBalance ?? 0, currencySymbol)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>{isArabic ? 'مبيعات نقدية' : 'Cash Sales'}:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    +{formatCurrency(reconciliation?.totalCashSales ?? 0, currencySymbol)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>{isArabic ? 'إيداعات (Cash In)' : 'Cash In'}:</span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                    +{formatCurrency(reconciliation?.totalCashIn ?? 0, currencySymbol)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>{isArabic ? 'مسحوبات / مصاريف' : 'Cash Out'}:</span>
                  <span className="font-mono font-bold text-rose-500">
                    -{formatCurrency(reconciliation?.totalCashOut ?? 0, currencySymbol)}
                  </span>
                </div>
                {Boolean(reconciliation?.totalCashRefunds) && (
                  <div className="flex items-center justify-between text-muted-foreground col-span-2">
                    <span>{isArabic ? 'مرتجعات نقدية' : 'Cash Refunds'}:</span>
                    <span className="font-mono font-bold text-rose-500">
                      -{formatCurrency(reconciliation?.totalCashRefunds ?? 0, currencySymbol)}
                    </span>
                  </div>
                )}
              </div>

              {/* Expected Drawer Cash Highlight */}
              <div className="pt-2 border-t border-border flex items-center justify-between">
                <span className="font-bold text-foreground">
                  {t('shift.expectedBalance', 'الرصيد المتوقع دفترياً بالدرج')}:
                </span>
                <span className="text-base font-mono font-black text-primary">
                  {formatCurrency(expectedCash, currencySymbol)}
                </span>
              </div>
            </div>

            {/* Actual Balance Input (NO DEFAULT VALUE) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-primary" />
                  <span>{t('shift.actualBalance', 'الرصيد الفعلي بعد الجرد')} ({currencySymbol})</span>
                </span>
                <span className="text-destructive font-bold">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="any"
                autoFocus
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                placeholder={isArabic ? 'أدخل المبلغ الفعلي المحسوب في الدرج' : 'Enter actual counted cash'}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-lg font-mono font-bold text-center text-foreground placeholder:text-muted-foreground/60 placeholder:text-xs placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-primary/40"
                required
              />
            </div>

            {/* Live Difference Display */}
            {isActualEntered && isCountedValid && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center justify-between font-semibold transition-all ${
                  difference === 0
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : difference > 0
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  {difference === 0 ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  ) : difference > 0 ? (
                    <TrendingUp className="w-4 h-4 shrink-0 text-emerald-600" />
                  ) : (
                    <TrendingDown className="w-4 h-4 shrink-0 text-rose-600" />
                  )}
                  <span>
                    {difference === 0
                      ? t('shift.matched', 'مطابق تماماً ✓')
                      : difference > 0
                      ? `${t('shift.surplus', 'فائض')}: +${formatCurrency(difference, currencySymbol)}`
                      : `${t('shift.shortage', 'عجز / نقص')}: ${formatCurrency(difference, currencySymbol)}`}
                  </span>
                </div>
                <span className="text-[11px] font-mono">
                  {difference === 0
                    ? '0.00'
                    : `${difference > 0 ? '+' : ''}${difference.toFixed(2)}`}
                </span>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                {t('common.notes', 'ملاحظات الإغلاق')}
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={isArabic ? 'أسباب الفروقات أو أي ملاحظات أخرى (اختياري)...' : 'Reason for discrepancy or closing notes...'}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              />
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
              <button
                type="button"
                disabled={submitting}
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium rounded-xl border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                {t('common.cancel', 'إلغاء')}
              </button>
              <button
                type="submit"
                disabled={submitting || !isCountedValid}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground flex items-center gap-1.5 shadow-md transition-all disabled:opacity-50 active:scale-95"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{isArabic ? 'جاري الإغلاق...' : 'Closing...'}</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>{t('shift.closeNow', 'إغلاق الوردية')}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

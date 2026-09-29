import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Lock, AlertTriangle, CheckCircle2, TrendingDown, TrendingUp } from 'lucide-react'
import { CloseShiftInput, ShiftReconciliation } from '../types'
import { formatCurrency } from '@/lib/formatters'

interface CloseShiftModalProps {
  isOpen: boolean
  onClose: () => void
  shiftId: string
  expectedCash: number
  onCloseShift: (input: CloseShiftInput) => Promise<void>
}

export function CloseShiftModal({
  isOpen,
  onClose,
  shiftId,
  expectedCash,
  onCloseShift,
}: CloseShiftModalProps) {
  const { t } = useTranslation()

  const [actualCash, setActualCash] = useState(String(expectedCash))
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const counted = parseFloat(actualCash) || 0
  const difference = Number((counted - expectedCash).toFixed(2))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isNaN(counted) || counted < 0) {
      setError(t('cashRegister.invalidActualCash', 'يرجى إدخال مبلغ النقدية الفعلي المحسوب بالدرج'))
      return
    }

    setLoading(true)
    setError(null)
    try {
      await onCloseShift({
        shiftId,
        actualCash: counted,
        notes: notes.trim() || undefined,
      })
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error closing shift')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                {t('cashRegister.closeShift', 'إغلاق الوردية والمطابقة')}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t('cashRegister.closeShiftSubtitle', 'جرد الدرج، تسجيل النقدية الفعلية وحساب الفروقات')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Expected Cash Box */}
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">
              {t('cashRegister.expectedCash', 'النقدية المتوقعة دفترياً بالدرج')}
            </span>
            <span className="text-base font-mono font-bold text-foreground">
              {formatCurrency(expectedCash)}
            </span>
          </div>

          {/* Actual Cash Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {t('cashRegister.actualCashCounted', 'النقدية الفعلية المحصية بالدرج (ج.م)')} <span className="text-destructive">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="10"
              value={actualCash}
              onChange={e => setActualCash(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2.5 bg-background border border-input rounded-xl text-lg font-mono font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary/40"
              required
              autoFocus
            />
          </div>

          {/* Real-Time Difference Status */}
          <div
            className={`p-3 rounded-xl border text-xs flex items-center justify-between font-semibold ${
              difference < 0
                ? 'bg-destructive/10 border-destructive/20 text-destructive'
                : difference > 0
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                : 'bg-blue-500/10 border-blue-500/20 text-blue-500'
            }`}
          >
            <div className="flex items-center gap-2">
              {difference < 0 ? (
                <TrendingDown className="w-4 h-4" />
              ) : difference > 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>
                {difference < 0
                  ? t('cashRegister.shortage', 'عجز في النقدية')
                  : difference > 0
                  ? t('cashRegister.surplus', 'زيادة في النقدية')
                  : t('cashRegister.balanced', 'الرصيد متطابق تماماً')}
              </span>
            </div>
            <span className="font-mono font-bold text-sm">
              {difference !== 0 ? formatCurrency(Math.abs(difference)) : '0.00 ج.م'}
            </span>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {t('common.notes', 'ملاحظات الإغلاق والتسليم')}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={t('cashRegister.closingNotesPlaceholder', 'أي ملاحظات عن أسباب الفروقات أو تسليم العهدة...')}
              className="w-full px-3 py-2 bg-background border border-input rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-xl border border-border text-foreground hover:bg-muted"
            >
              {t('common.cancel', 'إلغاء')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 flex items-center gap-1.5 shadow-md disabled:opacity-50"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{loading ? t('common.loading', 'جاري الإغلاق...') : t('cashRegister.confirmCloseShift', 'تأكيد إغلاق الوردية')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

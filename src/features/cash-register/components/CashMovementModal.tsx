import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, ArrowDownRight, ArrowUpRight, AlertCircle, DollarSign } from 'lucide-react'
import { CreateCashMovementInput } from '../types'

interface CashMovementModalProps {
  isOpen: boolean
  onClose: () => void
  shiftId: string
  registerId: string
  defaultDirection?: 'in' | 'out'
  onSubmitMovement: (input: CreateCashMovementInput) => Promise<void>
}

export function CashMovementModal({
  isOpen,
  onClose,
  shiftId,
  registerId,
  defaultDirection = 'in',
  onSubmitMovement,
}: CashMovementModalProps) {
  const { t } = useTranslation()

  const [direction, setDirection] = useState<'in' | 'out'>(defaultDirection)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const num = parseFloat(amount)
    if (isNaN(num) || num <= 0) {
      setError(t('cashRegister.invalidMovementAmount', 'يرجى إدخال مبلغ صحيح أكبر من الصفر'))
      return
    }

    if (!reason.trim()) {
      setError(t('cashRegister.reasonRequired', 'يرجى إدخال سبب حركة النقدية'))
      return
    }

    setLoading(true)
    setError(null)
    try {
      await onSubmitMovement({
        shiftId,
        registerId,
        amount: num,
        direction,
        type: direction === 'in' ? 'cash_in' : 'cash_out',
        reason: reason.trim(),
        notes: notes.trim() || undefined,
      })
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error recording movement')
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
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                direction === 'in'
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
              }`}
            >
              {direction === 'in' ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                {direction === 'in'
                  ? t('cashRegister.cashIn', 'إيداع نقدية في الدرج (Cash In)')
                  : t('cashRegister.cashOut', 'سحب نقدية من الدرج (Cash Out)')}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t('cashRegister.movementSubtitle', 'تسجيل حركة نقدية يدوية في دفتر الخزينة')}
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
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Movement Type Toggle */}
          <div className="flex rounded-xl border border-input bg-muted/40 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setDirection('in')}
              className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                direction === 'in'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ArrowDownRight className="w-3.5 h-3.5" />
              <span>{t('cashRegister.deposit', 'إيداع (Cash In)')}</span>
            </button>
            <button
              type="button"
              onClick={() => setDirection('out')}
              className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                direction === 'out'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>{t('cashRegister.withdrawal', 'سحب (Cash Out)')}</span>
            </button>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {t('common.amount', 'المبلغ (ج.م)')} <span className="text-destructive">*</span>
            </label>
            <input
              type="number"
              min="1"
              step="10"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2.5 bg-background border border-input rounded-xl text-lg font-mono font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary/40"
              required
              autoFocus
            />
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {t('cashRegister.reason', 'سبب الحركة / البيان')} <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={
                direction === 'in'
                  ? t('cashRegister.reasonInPlaceholder', 'مثال: تغذية فكة إضافية للدرج، تسليم عهدة...')
                  : t('cashRegister.reasonOutPlaceholder', 'مثال: مصروفات نظافة ونقل، توريد للبنك...')
              }
              className="w-full px-3 py-2 bg-background border border-input rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
              required
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {t('common.notes', 'ملاحظات إضافية')}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={t('common.optional', 'اختياري...')}
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
              className={`px-5 py-2 text-xs font-semibold rounded-xl text-white shadow-md disabled:opacity-50 flex items-center gap-1.5 ${
                direction === 'in' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              <span>{loading ? t('common.loading', 'جاري التسجيل...') : t('common.save', 'تسجيل الحركة')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

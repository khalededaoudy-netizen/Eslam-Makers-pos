import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Play, AlertCircle, Coins, Loader2 } from 'lucide-react'
import { cashRegisterService } from '@/features/cash-register/cashRegisterService'
import { CashRegister } from '@/features/cash-register/types'
import { useAuthStore } from '@/stores/authStore'

interface QuickShiftModalProps {
  isOpen: boolean
  onClose: () => void
  onShiftOpened: () => void
  onToast?: (msg: string, type?: 'success' | 'error') => void
}

export function QuickShiftModal({
  isOpen,
  onClose,
  onShiftOpened,
  onToast,
}: QuickShiftModalProps) {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language !== 'en'
  const { user } = useAuthStore()

  const [registers, setRegisters] = useState<CashRegister[]>([])
  const [selectedRegisterId, setSelectedRegisterId] = useState('')
  const [openingBalance, setOpeningBalance] = useState('')
  const [notes, setNotes] = useState('')
  const [loadingRegisters, setLoadingRegisters] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setError(null)
      setOpeningBalance('')
      setNotes('')
      setLoadingRegisters(true)
      cashRegisterService
        .getCashRegisters()
        .then((list) => {
          setRegisters(list)
          if (list.length > 0) {
            setSelectedRegisterId(list[0].id)
          }
        })
        .catch((err) => {
          console.error('Failed to load cash registers:', err)
          setError(isArabic ? 'فشل تحميل قائمة الخزائن' : 'Failed to load registers')
        })
        .finally(() => {
          setLoadingRegisters(false)
        })
    }
  }, [isOpen, isArabic])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!selectedRegisterId) {
      setError(isArabic ? 'يرجى اختيار الخزينة / نقطة البيع' : 'Please select a register')
      return
    }

    if (openingBalance.trim() === '') {
      setError(isArabic ? 'الرصيد الافتتاحي مطلوب — يرجى إدخال المبلغ الموجود في الدرج' : 'Opening balance is required')
      return
    }

    const numBalance = parseFloat(openingBalance)
    if (isNaN(numBalance) || numBalance < 0) {
      setError(isArabic ? 'الرصيد الافتتاحي يجب أن يكون رقماً أكبر من أو يساوي صفر' : 'Opening balance must be >= 0')
      return
    }

    if (!user) {
      setError(isArabic ? 'يجب تسجيل الدخول لفتح الوردية' : 'User authentication required')
      return
    }

    setSubmitting(true)
    try {
      await cashRegisterService.openShift(
        {
          registerId: selectedRegisterId,
          openingBalance: numBalance,
          notes: notes.trim() || undefined,
        },
        {
          id: user.id,
          fullName: user.fullName,
          role: user.roleName,
        }
      )

      if (onToast) {
        onToast(t('shift.shiftOpened', 'تم فتح الوردية بنجاح'), 'success')
      }
      onShiftOpened()
      onClose()
    } catch (err: any) {
      setError(err?.message || (isArabic ? 'فشل فتح الوردية' : 'Failed to open shift'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Play className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                {t('shift.openNew', 'فتح وردية جديدة')}
              </h3>
              <p className="text-xs text-muted-foreground">
                {isArabic ? 'تسجيل رصيد النقدية الافتتاحي وبدء البيع فوراً' : 'Set opening drawer cash and begin sales'}
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
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Register Select */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>{isArabic ? 'الخزينة / نقطة البيع' : 'Cash Register'}</span>
              <span className="text-destructive">*</span>
            </label>
            {loadingRegisters ? (
              <div className="h-10 flex items-center gap-2 px-3 bg-muted/30 border border-border rounded-xl text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{isArabic ? 'جاري تحميل الخزائن...' : 'Loading registers...'}</span>
              </div>
            ) : (
              <select
                value={selectedRegisterId}
                onChange={(e) => setSelectedRegisterId(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
                required
              >
                {registers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {isArabic ? r.name_ar || r.name : r.name || r.name_ar} {r.code ? `(${r.code})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Opening Balance (REQUIRED - NO DEFAULT VALUE) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-primary" />
                <span>{t('shift.openingBalance', 'رصيد افتتاحي بالدرج')} (ج.م)</span>
              </span>
              <span className="text-destructive font-bold">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="any"
              autoFocus
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              placeholder={t('shift.openingBalancePlaceholder', 'أدخل المبلغ الموجود في الدرج الآن')}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-lg font-mono font-bold text-center text-foreground placeholder:text-muted-foreground/60 placeholder:text-xs placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-primary/40"
              required
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {t('common.notes', 'ملاحظات')}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isArabic ? 'أي ملاحظات عند بدء الوردية (اختياري)...' : 'Optional notes...'}
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
              disabled={submitting || loadingRegisters}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-md transition-all disabled:opacity-50 active:scale-95"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{isArabic ? 'جاري الفتح...' : 'Opening...'}</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>{t('shift.openNow', 'فتح الوردية')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

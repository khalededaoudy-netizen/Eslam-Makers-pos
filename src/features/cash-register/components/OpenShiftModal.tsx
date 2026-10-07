import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Play, AlertCircle, Coins, Loader2 } from 'lucide-react'
import { CashRegister, OpenShiftInput } from '../types'
import { cashRegisterService } from '../cashRegisterService'

interface OpenShiftModalProps {
  isOpen: boolean
  onClose: () => void
  registers: CashRegister[]
  onOpenShift: (input: OpenShiftInput) => Promise<void>
}

export function OpenShiftModal({
  isOpen,
  onClose,
  registers,
  onOpenShift,
}: OpenShiftModalProps) {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language !== 'en'

  const [internalRegisters, setInternalRegisters] = useState<CashRegister[]>(registers)
  const activeRegisters = (internalRegisters.length > 0 ? internalRegisters : registers).filter(
    r => r.is_active === 1
  )
  const [registerId, setRegisterId] = useState(activeRegisters[0]?.id || '')
  const [openingBalance, setOpeningBalance] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingRegisters, setLoadingRegisters] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setError(null)
      setOpeningBalance('')
      setNotes('')
      if (registers.length === 0) {
        setLoadingRegisters(true)
        cashRegisterService
          .getCashRegisters()
          .then((list) => {
            setInternalRegisters(list)
            if (list.length > 0) {
              setRegisterId(list[0].id)
            }
          })
          .catch(async (err) => {
            console.error('Failed to load cash registers:', err)
            try {
              const def = await cashRegisterService.ensureDefaultRegister()
              setInternalRegisters([def])
              setRegisterId(def.id)
            } catch {
              setError(isArabic ? 'فشل تحميل قائمة الخزائن' : 'Failed to load registers')
            }
          })
          .finally(() => {
            setLoadingRegisters(false)
          })
      } else {
        setInternalRegisters(registers)
        const active = registers.filter(r => r.is_active === 1)
        if (active.length > 0) {
          setRegisterId(active[0].id)
        }
      }
    }
  }, [isOpen, registers, isArabic])

  useEffect(() => {
    if (activeRegisters.length === 1) {
      setRegisterId(activeRegisters[0].id)
    }
  }, [activeRegisters.length])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (openingBalance.trim() === '') {
      setError(t('shift.openingBalanceRequired', isArabic ? 'الرصيد الافتتاحي مطلوب — يرجى إدخال المبلغ الموجود في الدرج' : 'Opening balance is required'))
      return
    }

    const balance = parseFloat(openingBalance)
    if (isNaN(balance) || balance < 0) {
      setError(t('cashRegister.invalidOpeningBalance', 'يرجى إدخال رصيد افتتاح صحيح أكبر من أو يساوي الصفر'))
      return
    }

    if (!registerId) {
      setError(t('cashRegister.selectRegisterRequired', 'يرجى اختيار الخزينة / نقطة البيع'))
      return
    }

    setLoading(true)
    setError(null)
    try {
      await onOpenShift({
        registerId,
        openingBalance: balance,
        notes: notes.trim() || undefined,
      })
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error opening shift')
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
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Play className="w-5 h-5 fill-primary" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                {t('cashRegister.openShift', 'فتح وردية جديدة')}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t('cashRegister.openShiftSubtitle', 'تسجيل رصيد النقدية الافتتاحي وتفعيل نقطة البيع')}
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
          {/* Register Select */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>{t('cashRegister.selectRegister', 'الخزينة / نقطة البيع')}</span>
              <span className="text-destructive">*</span>
            </label>

            {loadingRegisters ? (
              <div className="h-10 flex items-center gap-2 px-3 bg-muted/30 border border-border rounded-xl text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{isArabic ? 'جاري تحميل الخزائن...' : 'Loading registers...'}</span>
              </div>
            ) : activeRegisters.length === 0 ? (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{isArabic ? '⚠ لم يتم العثور على خزينة. سيتم إنشاؤها تلقائياً...' : '⚠ No cash register found. Creating automatically...'}</span>
              </div>
            ) : activeRegisters.length === 1 ? (
              <div className="text-xs text-muted-foreground p-3 bg-muted/40 border border-border rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-foreground">
                  <span className="text-sm">📍</span>
                  <span>{isArabic ? activeRegisters[0].name_ar || activeRegisters[0].name : activeRegisters[0].name || activeRegisters[0].name_ar}</span>
                </div>
                <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md font-medium">
                  {isArabic ? 'الخزينة الرئيسية' : 'Main Register'}
                </span>
              </div>
            ) : (
              <select
                value={registerId}
                onChange={e => setRegisterId(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-input rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                required
              >
                {activeRegisters.map(r => (
                  <option key={r.id} value={r.id}>
                    {isArabic ? r.name_ar || r.name : r.name || r.name_ar} {r.code ? `(${r.code})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Opening Balance */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-primary" />
                <span>{t('cashRegister.openingBalance', 'رصيد النقدية الافتتاحي بالدرج (ج.م)')}</span>
              </span>
              <span className="text-destructive font-bold">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={openingBalance}
              onChange={e => setOpeningBalance(e.target.value)}
              placeholder={t('shift.openingBalancePlaceholder', 'أدخل المبلغ الموجود في الدرج الآن')}
              className="w-full px-3 py-2.5 bg-background border border-input rounded-xl text-lg font-mono font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground/60 placeholder:text-xs placeholder:font-normal"
              required
              autoFocus
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
              onChange={e => setNotes(e.target.value)}
              placeholder={t('cashRegister.openingNotesPlaceholder', 'أي ملاحظات عند استلام العهدة أو بدء الوردية...')}
              className="w-full px-3 py-2 bg-background border border-input rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
            />
          </div>

          {/* Footer Actions */}
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
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 shadow-md disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-primary-foreground" />
              <span>{loading ? t('common.loading', 'جاري الفتح...') : t('cashRegister.startShift', 'بدء الوردية')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

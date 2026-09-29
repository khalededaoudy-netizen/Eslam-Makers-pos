import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, DollarSign, CreditCard, Save, AlertCircle } from 'lucide-react'
import { purchaseService, PurchaseListItem } from '@/services/purchases'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency } from '@/lib/formatters'

interface AddPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  onPaymentAdded: () => void
  purchase: PurchaseListItem
}

export function AddPaymentModal({
  isOpen,
  onClose,
  onPaymentAdded,
  purchase,
}: AddPaymentModalProps) {
  const { t } = useTranslation()
  const { user } = useAuthStore()

  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setAmount(String(purchase.balance || ''))
    setPaymentMethod('cash')
    setReference('')
    setNotes('')
    setError(null)
  }, [isOpen, purchase])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payVal = parseFloat(amount)
    if (isNaN(payVal) || payVal <= 0) {
      setError(t('purchases.errorValidAmount', 'يرجى إدخال مبلغ دفع صحيح أكبر من صفر'))
      return
    }

    if (payVal > purchase.balance) {
      setError(t('purchases.errorAmountExceedsBalance', `المبلغ المدخل (${payVal}) يتجاوز المتبقي من الفاتورة (${purchase.balance})`))
      return
    }

    setSaving(true)
    setError(null)

    try {
      await purchaseService.addPayment({
        purchaseId: purchase.id,
        amount: payVal,
        paymentMethod,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      }, user || undefined)

      onPaymentAdded()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error recording payment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {t('purchases.addPayment', 'سداد دفعة للمورد')}
              </h2>
              <p className="text-xs text-muted-foreground font-mono">
                {purchase.purchase_number} | {purchase.supplier_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center gap-2 text-rose-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Balance Overview */}
          <div className="p-3 bg-muted/30 border border-border rounded-lg flex items-center justify-between text-xs">
            <div>
              <span className="text-muted-foreground block">إجمالي الفاتورة:</span>
              <span className="font-mono font-bold text-sm">{formatCurrency(purchase.total)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">المسدد سابقاً:</span>
              <span className="font-mono font-bold text-sm text-emerald-400">{formatCurrency(purchase.paid_amount)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">المتبقي:</span>
              <span className="font-mono font-bold text-sm text-amber-400">{formatCurrency(purchase.balance)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5">
              {t('purchases.paymentAmount', 'مبلغ السداد المطلوب')} <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="any"
                min="0.01"
                max={purchase.balance}
                required
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-base font-bold font-mono text-emerald-400 focus:outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={() => setAmount(String(purchase.balance))}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-primary hover:underline px-2 py-0.5 bg-muted rounded"
              >
                سداد كامل المتبقي
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5">
              {t('purchases.paymentMethod', 'طريقة الدفع')}
            </label>
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value as any)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
            >
              <option value="cash">نقداً (Cash)</option>
              <option value="card">بطاقة بنكية (Card)</option>
              <option value="transfer">تحويل بنكي / فودافون كاش (Transfer)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5">
              {t('purchases.referenceNumber', 'رقم الإيصال / مرجع التحويل')}
            </label>
            <input
              type="text"
              value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder="e.g. TXN-8821039"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5">
              {t('purchases.notes', 'ملاحظات إضافية')}
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="دفعة تحت الحساب، شيك رقم..."
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors"
            >
              {t('common.cancel', 'إلغاء')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? t('common.saving', 'جاري التسجيل...') : t('purchases.confirmPayment', 'تأكيد السداد')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

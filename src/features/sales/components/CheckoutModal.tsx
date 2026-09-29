/**
 * MAKERS POS — Checkout & Payment Modal Component
 * Interactive checkout flow with Cash, Card, InstaPay, Vodafone Cash, Bank Transfer, and Split Payments.
 */

import React, { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
  Wallet,
  Plus,
  Trash2,
  CheckCircle2,
  X,
  AlertCircle,
  ArrowRight,
  Calculator,
} from 'lucide-react'
import { PAYMENT_METHODS, PaymentMethodType } from '@/features/payments/types'
import { CreateSalePaymentInput } from '../types'
import { formatCurrency } from '@/lib/formatters'
import { useSettingsStore } from '@/stores/settingsStore'

interface CheckoutModalProps {
  isOpen: boolean
  totalDue: number
  customerName?: string | null
  itemsCount: number
  onClose: () => void
  onConfirmSale: (payments: CreateSalePaymentInput[], notes?: string) => Promise<void>
}

export function CheckoutModal({
  isOpen,
  totalDue,
  customerName,
  itemsCount,
  onClose,
  onConfirmSale,
}: CheckoutModalProps) {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language !== 'en'
  const { currencySymbol } = useSettingsStore()

  const [mode, setMode] = useState<'single' | 'split'>('single')
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType>('cash')
  const [cashReceived, setCashReceived] = useState<string>(totalDue.toFixed(2))
  const [reference, setReference] = useState<string>('')
  const [saleNotes, setSaleNotes] = useState<string>('')

  // Split payment list
  const [splitPayments, setSplitPayments] = useState<Array<{
    method: PaymentMethodType
    amount: number
    reference?: string
  }>>([
    { method: 'cash', amount: totalDue, reference: '' }
  ])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode('single')
      setSelectedMethod('cash')
      setCashReceived(totalDue.toFixed(2))
      setReference('')
      setSaleNotes('')
      setSplitPayments([{ method: 'cash', amount: totalDue, reference: '' }])
      setError(null)
      setLoading(false)
    }
  }, [isOpen, totalDue])

  // Single payment calculations
  const numCashReceived = parseFloat(cashReceived) || 0
  const singleChange = selectedMethod === 'cash' ? Math.max(0, numCashReceived - totalDue) : 0

  // Split payment calculations
  const totalSplitPaid = useMemo(() => {
    return splitPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
  }, [splitPayments])

  const remainingDue = Math.max(0, Number((totalDue - totalSplitPaid).toFixed(2)))

  if (!isOpen) return null

  // Quick cash helper buttons
  const quickCashOptions = [
    totalDue,
    Math.ceil(totalDue / 10) * 10,
    Math.ceil(totalDue / 50) * 50,
    Math.ceil(totalDue / 100) * 100,
    Math.ceil(totalDue / 200) * 200,
    500,
    1000,
  ].filter((val, idx, arr) => val >= totalDue && arr.indexOf(val) === idx).slice(0, 5)

  // Add line to split payments
  const handleAddSplitLine = () => {
    if (remainingDue <= 0) return
    setSplitPayments([
      ...splitPayments,
      { method: 'card', amount: remainingDue, reference: '' }
    ])
  }

  // Remove line from split payments
  const handleRemoveSplitLine = (index: number) => {
    if (splitPayments.length <= 1) return
    setSplitPayments(splitPayments.filter((_, i) => i !== index))
  }

  // Update line in split payments
  const handleUpdateSplitLine = (index: number, field: string, value: any) => {
    const updated = [...splitPayments]
    updated[index] = { ...updated[index], [field]: value }
    setSplitPayments(updated)
  }

  // Final confirmation handler
  const handleConfirm = async () => {
    setError(null)

    try {
      setLoading(true)

      let paymentsToSubmit: CreateSalePaymentInput[] = []

      if (mode === 'single') {
        if (selectedMethod === 'cash') {
          if (numCashReceived < totalDue) {
            throw new Error(
              t('payments.insufficientCash', 'المبلغ المدفوع أقل من إجمالي الفاتورة المطلوبة')
            )
          }
          paymentsToSubmit = [
            {
              method: 'cash',
              amount: totalDue,
              receivedAmount: numCashReceived,
              changeAmount: singleChange,
              notes: saleNotes,
            }
          ]
        } else {
          paymentsToSubmit = [
            {
              method: selectedMethod,
              amount: totalDue,
              reference: reference.trim() || undefined,
              notes: saleNotes,
            }
          ]
        }
      } else {
        // Split Mode
        if (totalSplitPaid < totalDue) {
          throw new Error(
            t('payments.splitIncomplete', `إجمالي الدفعات المقسمة (${totalSplitPaid}) أقل من المطلوب (${totalDue})`)
          )
        }
        paymentsToSubmit = splitPayments.map(p => ({
          method: p.method,
          amount: Number(p.amount),
          reference: p.reference?.trim() || undefined,
        }))
      }

      await onConfirmSale(paymentsToSubmit, saleNotes.trim() || undefined)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error completing checkout')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            <h3 className="text-base font-bold text-foreground">
              {t('pos.checkout', 'إتمام عملية البيع والدفع')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-destructive/15 border border-destructive/30 rounded-xl text-destructive text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm flex-1">
          {/* Total Due Callout */}
          <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-semibold">
                {t('pos.totalDue', 'الإجمالي المطلوب سداده')}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {itemsCount} {t('pos.items', 'أصناف')} {customerName ? `— ${customerName}` : ''}
              </p>
            </div>
            <div className="text-end">
              <span className="text-2xl font-bold font-mono text-primary">
                {formatCurrency(totalDue)}
              </span>
            </div>
          </div>

          {/* Mode Switcher: Single vs Split */}
          <div className="flex rounded-xl border border-border bg-muted/30 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMode('single')}
              className={`flex-1 py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                mode === 'single' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Banknote className="w-3.5 h-3.5" />
              <span>{t('payments.singlePayment', 'دفع مباشر (طريقة واحدة)')}</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('split')}
              className={`flex-1 py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                mode === 'split' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>{t('payments.splitPayment', 'دفع مقسم (طرق متعددة)')}</span>
            </button>
          </div>

          {/* Mode: Single Payment */}
          {mode === 'single' && (
            <div className="space-y-4 animate-fade-in">
              {/* Payment Methods Grid */}
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(PAYMENT_METHODS) as PaymentMethodType[]).map((key) => {
                  const meta = PAYMENT_METHODS[key]
                  const isSelected = selectedMethod === key
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedMethod(key)}
                      className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center gap-2 transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary shadow-sm ring-2 ring-primary/20'
                          : 'border-border bg-card hover:bg-muted/60 text-muted-foreground'
                      }`}
                    >
                      {key === 'cash' && <Banknote className="w-5 h-5" />}
                      {key === 'card' && <CreditCard className="w-5 h-5" />}
                      {key === 'instapay' && <Smartphone className="w-5 h-5" />}
                      {key === 'vodafone_cash' && <Smartphone className="w-5 h-5" />}
                      {key === 'bank_transfer' && <Building2 className="w-5 h-5" />}
                      {key === 'other' && <Wallet className="w-5 h-5" />}
                      <span className="text-center truncate w-full">
                        {isArabic ? meta.nameAr : meta.nameEn}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Cash Specific Inputs: Received & Change */}
              {selectedMethod === 'cash' && (
                <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">
                      {t('payments.cashReceived', 'المبلغ المستلم نقداً (ج.م)')}
                    </label>
                    <input
                      type="number"
                      step="any"
                      min={totalDue}
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      className="w-full px-3 py-2 text-base font-bold font-mono rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  {/* Quick Cash Options */}
                  <div className="flex flex-wrap gap-1.5">
                    {quickCashOptions.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setCashReceived(opt.toFixed(2))}
                        className="px-2.5 py-1 rounded-md bg-muted hover:bg-primary/20 text-foreground text-xs font-mono font-semibold border border-border transition-colors"
                      >
                        {opt} {currencySymbol}
                      </button>
                    ))}
                  </div>

                  {/* Calculated Change */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                    <span className="font-semibold text-muted-foreground">
                      {t('payments.changeDue', 'المتبقي للعميل (الفكة)')}:
                    </span>
                    <span className="font-mono font-bold text-base text-emerald-600">
                      {formatCurrency(singleChange)}
                    </span>
                  </div>
                </div>
              )}

              {/* Electronic / Bank Reference Input */}
              {selectedMethod !== 'cash' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    {t('payments.reference', 'رقم العملية / المرجع (اختياري)')}
                  </label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="مثال: رقم الحوالة، كود التأكيد..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              )}
            </div>
          )}

          {/* Mode: Split Payments */}
          {mode === 'split' && (
            <div className="space-y-3 animate-fade-in">
              <div className="space-y-2">
                {splitPayments.map((p, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-border bg-muted/20 flex flex-wrap items-center gap-2"
                  >
                    <select
                      value={p.method}
                      onChange={(e) =>
                        handleUpdateSplitLine(idx, 'method', e.target.value as PaymentMethodType)
                      }
                      className="px-2.5 py-1.5 rounded-lg border border-input bg-background text-xs font-semibold flex-1 min-w-[120px]"
                    >
                      {(Object.keys(PAYMENT_METHODS) as PaymentMethodType[]).map((key) => (
                        <option key={key} value={key}>
                          {isArabic ? PAYMENT_METHODS[key].nameAr : PAYMENT_METHODS[key].nameEn}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      placeholder="المبلغ"
                      value={p.amount}
                      onChange={(e) =>
                        handleUpdateSplitLine(idx, 'amount', parseFloat(e.target.value) || 0)
                      }
                      className="w-28 px-2.5 py-1.5 rounded-lg border border-input bg-background text-xs font-mono font-bold"
                    />

                    {p.method !== 'cash' && (
                      <input
                        type="text"
                        placeholder="مرجع / إيصال"
                        value={p.reference || ''}
                        onChange={(e) =>
                          handleUpdateSplitLine(idx, 'reference', e.target.value)
                        }
                        className="w-28 px-2.5 py-1.5 rounded-lg border border-input bg-background text-xs"
                      />
                    )}

                    {splitPayments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSplitLine(idx)}
                        className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Split Line Button */}
              {remainingDue > 0 && (
                <button
                  type="button"
                  onClick={handleAddSplitLine}
                  className="w-full py-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {t('payments.addPaymentMethod', 'إضافة طريقة دفع أخرى')} (المتبقي: {formatCurrency(remainingDue)})
                  </span>
                </button>
              )}

              {/* Split Summary */}
              <div className="p-3 rounded-xl border border-border bg-card space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('payments.totalAllocated', 'المبلغ الموزع')}:</span>
                  <span className="font-mono font-bold">{formatCurrency(totalSplitPaid)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('payments.remaining', 'المتبقي سداده')}:</span>
                  <span className={`font-mono font-bold ${remainingDue > 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                    {formatCurrency(remainingDue)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Sale Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              {t('common.notes', 'ملاحظات الفاتورة (اختياري)')}
            </label>
            <input
              type="text"
              value={saleNotes}
              onChange={(e) => setSaleNotes(e.target.value)}
              placeholder="أي ملاحظات إضافية على الفاتورة..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-border bg-card flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl border border-border bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold transition-colors disabled:opacity-50"
          >
            {t('common.cancel', 'إلغاء')}
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || (mode === 'split' && remainingDue > 0)}
            className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span>{t('common.loading', 'جاري المعالجة...')}</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>{t('pos.confirmAndComplete', 'تأكيد وإصدار الفاتورة')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

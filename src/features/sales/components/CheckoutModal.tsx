/**
 * MAKERS POS — Simplified Checkout & Payment Modal Component
 * Streamlined payment flow supporting Cash, InstaPay, E-Wallet, and Customer Credit/Debt Sales.
 */

import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Banknote,
  Smartphone,
  Wallet,
  CheckCircle2,
  X,
  AlertCircle,
  Phone,
  Copy,
  Check,
  User,
  CreditCard,
  AlertTriangle,
} from 'lucide-react'
import { PAYMENT_METHODS, PaymentMethodType } from '@/features/payments/types'
import { CreateSalePaymentInput } from '../types'
import { formatCurrency } from '@/lib/formatters'
import { useSettingsStore } from '@/stores/settingsStore'
import { CustomerSummary } from '@/stores/cartStore'
import { customerService } from '@/services/customers/customerService'

interface CheckoutModalProps {
  isOpen: boolean
  totalDue: number
  customerName?: string | null
  customer?: CustomerSummary | null
  itemsCount: number
  onClose: () => void
  onConfirmSale: (payments: CreateSalePaymentInput[], notes?: string) => Promise<void>
}

export function CheckoutModal({
  isOpen,
  totalDue,
  customerName,
  customer,
  itemsCount,
  onClose,
  onConfirmSale,
}: CheckoutModalProps) {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language !== 'en'
  const { currencySymbol } = useSettingsStore()

  // Payment Mode: 'full' (سداد كامل) vs 'credit' (بيع آجل / جزء على الحساب)
  const [salePaymentMode, setSalePaymentMode] = useState<'full' | 'credit'>('full')
  const [partialPaid, setPartialPaid] = useState<string>('0')

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType>('cash')
  const [cashReceived, setCashReceived] = useState<string>(totalDue.toFixed(2))
  const [reference, setReference] = useState<string>('')
  const [saleNotes, setSaleNotes] = useState<string>('')

  // Fresh customer financial metrics
  const [customerBalance, setCustomerBalance] = useState<number>(customer?.balance || 0)
  const [creditLimit, setCreditLimit] = useState<number>(customer?.creditLimit || 0)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rawErrorDetails, setRawErrorDetails] = useState<string | null>(null)
  const [copiedError, setCopiedError] = useState(false)

  const refInputRef = useRef<HTMLInputElement>(null)
  const cashInputRef = useRef<HTMLInputElement>(null)
  const partialInputRef = useRef<HTMLInputElement>(null)

  // Fetch authoritative customer details on open
  useEffect(() => {
    if (isOpen && customer?.id) {
      customerService.getCustomerById(customer.id).then((fresh) => {
        if (fresh) {
          setCustomerBalance(Number(fresh.balance) || 0)
          setCreditLimit(Number(fresh.credit_limit) || 0)
        }
      }).catch(err => console.warn('Could not refresh customer in checkout:', err))
    }
  }, [isOpen, customer?.id])

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSalePaymentMode('full')
      setSelectedMethod('cash')
      setCashReceived(totalDue.toFixed(2))
      setPartialPaid('0')
      setReference('')
      setSaleNotes('')
      setError(null)
      setRawErrorDetails(null)
      setCopiedError(false)
      setLoading(false)

      setTimeout(() => {
        cashInputRef.current?.focus()
        cashInputRef.current?.select()
      }, 100)
    }
  }, [isOpen, totalDue])

  // Focus appropriate input when payment method or mode changes
  useEffect(() => {
    if (!isOpen) return
    setError(null)
    setRawErrorDetails(null)

    if (salePaymentMode === 'credit') {
      setTimeout(() => {
        partialInputRef.current?.focus()
        partialInputRef.current?.select()
      }, 50)
    } else if (selectedMethod === 'cash') {
      setTimeout(() => {
        cashInputRef.current?.focus()
        cashInputRef.current?.select()
      }, 50)
    } else {
      setTimeout(() => {
        refInputRef.current?.focus()
      }, 50)
    }
  }, [selectedMethod, salePaymentMode, isOpen])

  // Calculations for Full payment
  const numCashReceived = parseFloat(cashReceived) || 0
  const singleChange = selectedMethod === 'cash' ? Math.max(0, numCashReceived - totalDue) : 0

  // Calculations for Credit payment
  const numPartialPaid = Math.max(0, parseFloat(partialPaid) || 0)
  const debtToAdd = Math.max(0, Number((totalDue - numPartialPaid).toFixed(2)))
  const newProjectedBalance = Number((customerBalance + debtToAdd).toFixed(2))
  const isCreditLimitExceeded = creditLimit > 0 && newProjectedBalance > creditLimit

  // Friendly error formatter
  const formatErrorMessage = (err: any): string => {
    const rawMsg = err?.message || (typeof err === 'string' ? err : '')
    const lower = rawMsg.toLowerCase()

    if (lower.includes('insufficient payment') || lower.includes('المبلغ المدفوع أقل')) {
      return isArabic ? 'المبلغ المدفوع أقل من إجمالي الفاتورة المطلوبة' : 'Insufficient payment amount'
    }
    if (lower.includes('customer selection is required')) {
      return isArabic ? 'لا يمكن البيع الآجل أو الجزئي بدون اختيار عميل' : 'Customer selection required for credit sales'
    }
    if (lower.includes('stock') || lower.includes('المخزون')) {
      return isArabic ? 'الكمية غير متوفرة في المخزون' : 'Insufficient stock available'
    }
    if (lower.includes('shift') || lower.includes('وردية')) {
      return isArabic ? 'يجب فتح وردية أولاً' : 'An active shift is required'
    }
    if (rawMsg) return rawMsg
    return isArabic ? 'خطأ أثناء إتمام عملية البيع' : 'Error completing checkout'
  }

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

  const handleCopyError = () => {
    if (!rawErrorDetails) return
    navigator.clipboard.writeText(rawErrorDetails)
    setCopiedError(true)
    setTimeout(() => setCopiedError(false), 2000)
  }

  // Final confirmation handler
  const handleConfirm = async () => {
    if (loading) return
    setError(null)
    setRawErrorDetails(null)

    try {
      setLoading(true)
      let paymentsToSubmit: CreateSalePaymentInput[] = []

      if (salePaymentMode === 'credit') {
        // Credit sale
        if (!customer) {
          throw new Error(isArabic ? 'يجب اختيار عميل مسجل لإتمام البيع الآجل' : 'Customer required for credit sale')
        }
        if (numPartialPaid > totalDue) {
          throw new Error(isArabic ? 'المبلغ المدفوع لا يمكن أن يزيد عن قيمة الفاتورة' : 'Paid amount cannot exceed total')
        }

        // If customer paid a partial amount at checkout
        if (numPartialPaid > 0) {
          if (selectedMethod === 'cash') {
            paymentsToSubmit = [
              {
                method: 'cash',
                amount: numPartialPaid,
                receivedAmount: numPartialPaid,
                changeAmount: 0,
                notes: saleNotes.trim() || undefined,
              },
            ]
          } else {
            const trimmedRef = reference.trim()
            if (!trimmedRef) {
              refInputRef.current?.focus()
              throw new Error(isArabic ? 'رقم الموبايل المحول منه مطلوب' : 'Sender phone required')
            }
            paymentsToSubmit = [
              {
                method: selectedMethod,
                amount: numPartialPaid,
                reference: trimmedRef,
                notes: saleNotes.trim() || undefined,
              },
            ]
          }
        } else {
          // 100% on credit (0 paid now)
          paymentsToSubmit = []
        }
      } else {
        // Full upfront payment
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
              notes: saleNotes.trim() || undefined,
            },
          ]
        } else {
          const trimmedRef = reference.trim()
          if (!trimmedRef) {
            refInputRef.current?.focus()
            throw new Error(
              t('payments.senderPhoneRequired', 'رقم الموبايل المحول منه مطلوب')
            )
          }

          paymentsToSubmit = [
            {
              method: selectedMethod,
              amount: totalDue,
              reference: trimmedRef,
              notes: saleNotes.trim() || undefined,
            },
          ]
        }
      }

      await onConfirmSale(paymentsToSubmit, saleNotes.trim() || undefined)
      onClose()
    } catch (err: any) {
      console.error('[POS Checkout Error]:', err)
      const details = err?.stack || err?.message || String(err)
      setRawErrorDetails(details)
      setError(formatErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (!loading) onClose()
    } else if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
      e.preventDefault()
      if (!loading) handleConfirm()
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in select-none"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
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

        {/* Error Banner with Copy Details */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-destructive/15 border border-destructive/30 rounded-xl text-destructive text-xs font-semibold flex items-center justify-between gap-2 animate-fade-in">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="truncate">{error}</span>
            </div>
            {rawErrorDetails && (
              <button
                type="button"
                onClick={handleCopyError}
                className="shrink-0 px-2.5 py-1 bg-destructive/20 hover:bg-destructive/30 text-destructive rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors"
                title={rawErrorDetails}
              >
                {copiedError ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span>{isArabic ? 'تم النسخ' : 'Copied'}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>{isArabic ? 'نسخ التفاصيل' : 'Copy Details'}</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-sm flex-1">
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

          {/* Customer Debt & Balance Card (when customer attached) */}
          {customer && (
            <div className="p-3.5 rounded-xl border border-border/80 bg-muted/30 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-primary" />
                  <span>{customer.name}</span>
                  {customer.customerCode && (
                    <span className="text-[11px] text-muted-foreground font-mono">
                      ({customer.customerCode})
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-[11px]">
                    {t('debts.currentBalance', 'الرصيد الحالي')}:
                  </span>
                  <span
                    className={`font-mono font-bold ${
                      customerBalance > 0 ? 'text-amber-500' : 'text-emerald-500'
                    }`}
                  >
                    {formatCurrency(customerBalance)}
                  </span>
                </div>
              </div>

              {creditLimit > 0 && (
                <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-1.5">
                  <span>{t('debts.creditLimit', 'الحد الائتماني المتاح')}:</span>
                  <span className="font-mono font-semibold text-foreground">
                    {formatCurrency(creditLimit)}
                  </span>
                </div>
              )}

              {/* Mode Selector: Full Payment vs Credit / On Account */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setSalePaymentMode('full')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                    salePaymentMode === 'full'
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-card text-muted-foreground border-border hover:bg-muted/50'
                  }`}
                >
                  {isArabic ? 'سداد كامل الفاتورة' : 'Pay in Full'}
                </button>
                <button
                  type="button"
                  onClick={() => setSalePaymentMode('credit')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                    salePaymentMode === 'credit'
                      ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                      : 'bg-card text-muted-foreground border-border hover:bg-muted/50'
                  }`}
                >
                  {isArabic ? 'دفع آجل / جزء على الحساب' : 'On Credit / Account'}
                </button>
              </div>
            </div>
          )}

          {/* Credit Sale Fields */}
          {salePaymentMode === 'credit' && (
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-amber-500 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4" />
                  <span>{isArabic ? 'المبلغ المدفوع نقداً الآن (إن وجد)' : 'Amount Paid Upfront'}</span>
                </label>
                <span className="text-[11px] text-muted-foreground">
                  {isArabic ? '(0 = آجل بالكامل)' : '(0 = 100% on credit)'}
                </span>
              </div>

              <div className="flex gap-2">
                <input
                  ref={partialInputRef}
                  type="number"
                  step="any"
                  min="0"
                  max={totalDue}
                  value={partialPaid}
                  onChange={(e) => setPartialPaid(e.target.value)}
                  className="flex-1 px-3 py-2 text-base font-bold font-mono rounded-lg border border-amber-500/40 bg-background focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setPartialPaid('0')}
                  className="px-3 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 text-xs font-bold transition-colors"
                >
                  {isArabic ? '0 (آجل كلي)' : 'Zero'}
                </button>
              </div>

              {/* Debt & Projected Balance Breakdown */}
              <div className="space-y-1.5 text-xs border-t border-amber-500/20 pt-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {isArabic ? 'المبلغ الآجل (يُضاف لرصيد العميل):' : 'Debt added to balance:'}
                  </span>
                  <span className="font-mono font-bold text-amber-500">
                    +{formatCurrency(debtToAdd)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {isArabic ? 'الرصيد بعد الفاتورة:' : 'Balance after invoice:'}
                  </span>
                  <span className="font-mono font-bold text-foreground">
                    {formatCurrency(newProjectedBalance)}
                  </span>
                </div>
              </div>

              {isCreditLimitExceeded && (
                <div className="p-2.5 rounded-lg bg-destructive/15 border border-destructive/30 text-destructive text-[11px] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    {isArabic
                      ? `تنبيه: الرصيد سيتجاوز الحد الائتماني المسموح به (${formatCurrency(creditLimit)})`
                      : `Warning: Projected balance exceeds credit limit (${formatCurrency(creditLimit)})`}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Payment Method Selection (Only needed if paying > 0) */}
          {(salePaymentMode === 'full' || numPartialPaid > 0) && (
            <>
              {/* Payment Methods Grid */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground block">
                  {salePaymentMode === 'credit'
                    ? isArabic
                      ? 'طريقة سداد الدفعة المقدمة'
                      : 'Upfront Payment Method'
                    : t('payments.methods', 'طرق الدفع')}
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {(['cash', 'instapay', 'wallet'] as PaymentMethodType[]).map((key) => {
                    const meta = PAYMENT_METHODS[key]
                    const isSelected = selectedMethod === key
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedMethod(key)}
                        className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center gap-2 transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/10 text-primary shadow-sm ring-2 ring-primary/20 font-bold'
                            : 'border-border bg-card hover:bg-muted/60 text-muted-foreground'
                        }`}
                      >
                        {key === 'cash' && <Banknote className="w-5 h-5" />}
                        {key === 'instapay' && <Smartphone className="w-5 h-5" />}
                        {key === 'wallet' && <Wallet className="w-5 h-5" />}
                        <span className="text-center truncate w-full">
                          {isArabic ? meta.nameAr : meta.nameEn}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Method: Cash Specific Inputs */}
              {selectedMethod === 'cash' && salePaymentMode === 'full' && (
                <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3 animate-fade-in">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">
                      {t('payments.cashReceived', 'المبلغ المستلم نقداً (ج.م)')}
                    </label>
                    <input
                      ref={cashInputRef}
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

              {/* Methods 2 & 3: InstaPay / E-Wallet Reference Input */}
              {selectedMethod !== 'cash' && (
                <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2 animate-fade-in">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-primary" />
                    <span>{t('payments.senderPhone', 'رقم الموبايل المحول منه')}</span>
                    <span className="text-destructive">*</span>
                  </label>
                  <input
                    ref={refInputRef}
                    type="text"
                    inputMode="tel"
                    value={reference}
                    onChange={(e) => {
                      setReference(e.target.value)
                      setError(null)
                    }}
                    placeholder={t('payments.senderPhonePlaceholder', 'أدخل رقم الموبايل المحول منه (01xxxxxxxxx)...')}
                    className="w-full px-3 py-2 text-sm font-mono font-bold rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary placeholder:font-normal"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {isArabic
                      ? 'يرجى تسجيل رقم هاتف العميل للتأكد ومطابقة إشعار التحويل المالي'
                      : 'Please record the sender mobile number to verify against transaction notification'}
                  </p>
                </div>
              )}
            </>
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
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span>{t('common.loading', 'جاري المعالجة...')}</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {salePaymentMode === 'credit'
                    ? isArabic
                      ? 'تأكيد البيع الآجل'
                      : 'Confirm Credit Sale'
                    : t('pos.confirmAndComplete', 'تأكيد وإصدار الفاتورة')}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

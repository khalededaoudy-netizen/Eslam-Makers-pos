/**
 * MAKERS POS — Record Customer Debt Payment Modal
 * Supports Cash, InstaPay, and E-Wallet payments with atomic balance deductions,
 * cash drawer movement recording, and payment voucher generation.
 */

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  X,
  CreditCard,
  Banknote,
  Smartphone,
  Wallet,
  Phone,
  CheckCircle2,
  Printer,
  Calendar,
  AlertCircle,
  FileText,
  User,
  Check,
} from 'lucide-react'
import {
  customerDebtService,
  DebtPaymentMethod,
  PaymentVoucherData,
} from '@/services/customers/customerDebtService'
import { Customer } from '@/services/customers/types'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { useSettingsStore } from '@/stores/settingsStore'
import { printReceiptDirect } from '@/services/printer/directPrint'

interface RecordPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  customer: Customer | null
  onSuccess?: () => void
}

export function RecordPaymentModal({
  isOpen,
  onClose,
  customer,
  onSuccess,
}: RecordPaymentModalProps) {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language !== 'en'
  const { user } = useAuthStore()
  const { currencySymbol, storeName, storePhone, storeAddress } = useSettingsStore()

  const [amount, setAmount] = useState<string>('')
  const [method, setMethod] = useState<DebtPaymentMethod>('cash')
  const [reference, setReference] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  )

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [voucherData, setVoucherData] = useState<PaymentVoucherData | null>(null)
  const [isPrinting, setIsPrinting] = useState(false)

  useEffect(() => {
    if (isOpen && customer) {
      // Default amount to current balance if > 0
      setAmount(customer.balance > 0 ? customer.balance.toString() : '')
      setMethod('cash')
      setReference(customer.phone || '')
      setNotes('')
      setPaymentDate(new Date().toISOString().slice(0, 10))
      setError(null)
      setVoucherData(null)
      setLoading(false)
    }
  }, [isOpen, customer])

  if (!isOpen || !customer) return null

  const parsedAmount = parseFloat(amount) || 0
  const remainingAfter = Math.max(0, Number((customer.balance - parsedAmount).toFixed(2)))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError(null)

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError(isArabic ? 'يرجى إدخال مبلغ دفع صحيح أكبر من صفر' : 'Please enter a valid amount')
      return
    }

    if (['instapay', 'wallet'].includes(method) && !reference.trim()) {
      setError(
        isArabic
          ? 'رقم الموبايل المحول منه مطلوب لمدفوعات انستاباي والمحافظ'
          : 'Sender phone number is required'
      )
      return
    }

    setLoading(true)
    try {
      const voucher = await customerDebtService.recordCustomerPayment(
        {
          customerId: customer.id,
          amount: parsedAmount,
          method,
          reference: reference.trim() || undefined,
          notes: notes.trim() || undefined,
          paymentDate: new Date(paymentDate).toISOString(),
        },
        user ? { id: user.id, fullName: user.fullName, role: user.roleName } : undefined
      )

      setVoucherData(voucher)
      onSuccess?.()
    } catch (err: any) {
      console.error('Failed to record customer debt payment:', err)
      setError(err?.message || (isArabic ? 'حدث خطأ أثناء تسجيل الدفعة' : 'Failed to record payment'))
    } finally {
      setLoading(false)
    }
  }

  // Print voucher direct
  const handlePrintVoucher = async () => {
    if (!voucherData || isPrinting) return
    setIsPrinting(true)
    try {
      const el = document.getElementById('payment-voucher-content')
      if (el) {
        await printReceiptDirect(el)
      } else {
        window.print()
      }
    } catch (err) {
      console.error('Print error:', err)
    } finally {
      setIsPrinting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in select-none">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            <h3 className="text-base font-bold text-foreground">
              {voucherData
                ? isArabic
                  ? 'سند قبض مالي'
                  : 'Payment Voucher'
                : isArabic
                ? 'تسجيل دفعة سداد دين'
                : 'Record Debt Payment'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Voucher Success View */}
        {voucherData ? (
          <div className="p-6 overflow-y-auto space-y-5 flex-1">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 shrink-0" />
              <div>
                <p className="font-bold text-sm">
                  {isArabic ? 'تم تسجيل الدفعة وتحديث الرصيد بنجاح!' : 'Payment recorded successfully!'}
                </p>
                <p className="text-xs opacity-90 mt-0.5">
                  {isArabic
                    ? `رقم السند: ${voucherData.voucherNumber}`
                    : `Voucher: ${voucherData.voucherNumber}`}
                </p>
              </div>
            </div>

            {/* Printable Voucher Component Preview */}
            <div
              id="payment-voucher-content"
              className="p-5 rounded-xl border border-border bg-card space-y-4 text-xs font-sans shadow-sm"
            >
              {/* Voucher Header */}
              <div className="border-b border-border pb-3 text-center space-y-1">
                <h4 className="font-bold text-sm tracking-wide text-foreground">
                  {storeName || 'MAKERS ELECTRONICS'}
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  {storeAddress || 'العاشر من رمضان — مول City A'}
                </p>
                <div className="inline-block mt-1 px-3 py-1 bg-muted rounded-full font-bold text-xs">
                  {isArabic ? 'سند قبض نقدي / إشعار سداد' : 'Receipt Voucher'}
                </div>
              </div>

              {/* Voucher Meta */}
              <div className="grid grid-cols-2 gap-2 text-muted-foreground border-b border-border pb-3 text-[11px]">
                <div>
                  <span className="block font-semibold text-foreground">
                    {isArabic ? 'رقم السند:' : 'Voucher #:'} {voucherData.voucherNumber}
                  </span>
                  <span>
                    {isArabic ? 'التاريخ:' : 'Date:'} {formatDate(voucherData.date, true)}
                  </span>
                </div>
                <div className="text-end">
                  <span className="block font-semibold text-foreground">
                    {isArabic ? 'المستلم:' : 'Cashier:'} {voucherData.cashierName || 'الكاشير'}
                  </span>
                  <span>
                    {isArabic ? 'طريقة الدفع:' : 'Method:'}{' '}
                    {voucherData.paymentMethod === 'cash'
                      ? 'نقدي (Cash)'
                      : voucherData.paymentMethod === 'instapay'
                      ? 'انستاباي (InstaPay)'
                      : 'محفظة (E-Wallet)'}
                  </span>
                </div>
              </div>

              {/* Customer Info */}
              <div className="bg-muted/30 p-3 rounded-lg space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{isArabic ? 'اسم العميل:' : 'Customer:'}</span>
                  <span className="font-bold text-foreground">
                    {voucherData.customerName} ({voucherData.customerCode})
                  </span>
                </div>
                {voucherData.customerPhone && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{isArabic ? 'الهاتف:' : 'Phone:'}</span>
                    <span className="font-mono" dir="ltr">{voucherData.customerPhone}</span>
                  </div>
                )}
                {voucherData.reference && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{isArabic ? 'المرجع / التحويل:' : 'Ref:'}</span>
                    <span className="font-mono">{voucherData.reference}</span>
                  </div>
                )}
              </div>

              {/* Amount Box */}
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-center space-y-1">
                <span className="text-muted-foreground text-[11px]">
                  {isArabic ? 'المبلغ المستلم' : 'Amount Received'}
                </span>
                <div className="text-2xl font-bold font-mono text-primary">
                  {formatCurrency(voucherData.amount)}
                </div>
                <p className="text-[11px] font-semibold text-muted-foreground pt-1">
                  {voucherData.amountWordsAr}
                </p>
              </div>

              {/* Balance Summary */}
              <div className="border-t border-border pt-3 space-y-1 text-[11px]">
                <div className="flex justify-between text-muted-foreground">
                  <span>{isArabic ? 'الرصيد قبل الدفعة:' : 'Previous Balance:'}</span>
                  <span className="font-mono">{formatCurrency(voucherData.previousBalance)}</span>
                </div>
                <div className="flex justify-between font-bold text-foreground">
                  <span>{isArabic ? 'الرصيد المتبقي المستحق:' : 'Remaining Balance:'}</span>
                  <span className="font-mono text-amber-500">
                    {formatCurrency(voucherData.remainingBalance)}
                  </span>
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-4 pt-6 text-[10px] text-muted-foreground text-center border-t border-border">
                <div>
                  <div className="border-b border-dashed border-border mb-1 h-5"></div>
                  <span>{isArabic ? 'توقيع المستلم' : 'Received By'}</span>
                </div>
                <div>
                  <div className="border-b border-dashed border-border mb-1 h-5"></div>
                  <span>{isArabic ? 'توقيع العميل' : 'Customer Signature'}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-border bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold"
              >
                {isArabic ? 'إغلاق' : 'Close'}
              </button>

              <button
                type="button"
                onClick={handlePrintVoucher}
                disabled={isPrinting}
                className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-md"
              >
                <Printer className="w-4 h-4" />
                <span>{isPrinting ? (isArabic ? 'جاري الطباعة...' : 'Printing...') : (isArabic ? 'طباعة سند القبض' : 'Print Voucher')}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Payment Form */
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-sm flex-1">
            {error && (
              <div className="p-3 bg-destructive/15 border border-destructive/30 rounded-xl text-destructive text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Customer Summary Card */}
            <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  <span className="font-bold text-foreground">{customer.name}</span>
                </div>
                <span className="text-xs font-mono text-muted-foreground">
                  {customer.customer_code}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-border/40 text-xs">
                <span className="text-muted-foreground">
                  {isArabic ? 'المديونية الحالية المستحقة:' : 'Current Debt:'}
                </span>
                <span className="font-mono font-bold text-amber-500 text-sm">
                  {formatCurrency(customer.balance)}
                </span>
              </div>
            </div>

            {/* Payment Amount Input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-foreground">
                  {isArabic ? 'المبلغ المسدد (ج.م)' : 'Amount Paid'}
                  <span className="text-destructive"> *</span>
                </label>
                <button
                  type="button"
                  onClick={() => setAmount(customer.balance.toString())}
                  className="text-[11px] text-primary hover:underline font-semibold"
                >
                  {isArabic ? 'سداد كامل الرصيد' : 'Pay Full Balance'}
                </button>
              </div>

              <input
                type="number"
                step="any"
                min="0.1"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2.5 text-lg font-bold font-mono rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />

              {parsedAmount > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground pt-1">
                  <span>{isArabic ? 'الرصيد المتبقي بعد السداد:' : 'Remaining after payment:'}</span>
                  <span className="font-mono font-bold text-foreground">
                    {formatCurrency(remainingAfter)}
                  </span>
                </div>
              )}
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">
                {isArabic ? 'طريقة الدفع' : 'Payment Method'}
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { id: 'cash', ar: 'كاش نقدي', en: 'Cash', icon: Banknote },
                  { id: 'instapay', ar: 'انستاباي', en: 'InstaPay', icon: Smartphone },
                  { id: 'wallet', ar: 'محفظة ذكية', en: 'E-Wallet', icon: Wallet },
                ].map((m) => {
                  const Icon = m.icon
                  const isSelected = method === m.id
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMethod(m.id as DebtPaymentMethod)}
                      className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center gap-1.5 transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20 shadow-sm'
                          : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{isArabic ? m.ar : m.en}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Reference (Phone) for InstaPay and Wallet */}
            {['instapay', 'wallet'].includes(method) && (
              <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-1.5 animate-fade-in">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-primary" />
                  <span>{isArabic ? 'رقم الموبايل المحول منه' : 'Sender Phone'}</span>
                  <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  inputMode="tel"
                  required
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="01xxxxxxxxx"
                  className="w-full px-3 py-2 text-xs font-mono font-bold rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}

            {/* Payment Date & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'تاريخ السداد' : 'Payment Date'}</span>
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  {isArabic ? 'ملاحظات (اختياري)' : 'Notes (optional)'}
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={isArabic ? 'أي بيان إضافي...' : 'Any details...'}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Footer Form Submit */}
            <div className="pt-4 border-t border-border flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 rounded-xl border border-border bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold"
              >
                {isArabic ? 'إلغاء' : 'Cancel'}
              </button>

              <button
                type="submit"
                disabled={loading || parsedAmount <= 0}
                className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-md disabled:opacity-50"
              >
                {loading ? (
                  <span>{isArabic ? 'جاري التسجيل...' : 'Processing...'}</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isArabic ? 'تسجيل الدفعة وإصدار السند' : 'Record & Issue Voucher'}</span>
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

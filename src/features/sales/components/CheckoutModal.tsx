/**
 * MAKERS POS — Simplified Checkout & Payment Modal Component
 * Streamlined single-payment flow supporting Cash, InstaPay, and E-Wallet (Mobile Wallets).
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

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType>('cash')
  const [cashReceived, setCashReceived] = useState<string>(totalDue.toFixed(2))
  const [reference, setReference] = useState<string>('')
  const [saleNotes, setSaleNotes] = useState<string>('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refInputRef = useRef<HTMLInputElement>(null)
  const cashInputRef = useRef<HTMLInputElement>(null)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedMethod('cash')
      setCashReceived(totalDue.toFixed(2))
      setReference('')
      setSaleNotes('')
      setError(null)
      setLoading(false)

      setTimeout(() => {
        cashInputRef.current?.focus()
        cashInputRef.current?.select()
      }, 100)
    }
  }, [isOpen, totalDue])

  // Focus appropriate input when payment method changes
  useEffect(() => {
    if (!isOpen) return
    setError(null)
    if (selectedMethod === 'cash') {
      setTimeout(() => {
        cashInputRef.current?.focus()
        cashInputRef.current?.select()
      }, 50)
    } else {
      setTimeout(() => {
        refInputRef.current?.focus()
      }, 50)
    }
  }, [selectedMethod, isOpen])

  // Single payment calculations
  const numCashReceived = parseFloat(cashReceived) || 0
  const singleChange = selectedMethod === 'cash' ? Math.max(0, numCashReceived - totalDue) : 0

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

  // Final confirmation handler
  const handleConfirm = async () => {
    setError(null)

    try {
      setLoading(true)

      let paymentsToSubmit: CreateSalePaymentInput[] = []

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
          }
        ]
      } else {
        // InstaPay or E-Wallet: reference is required (Sender Phone)
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
          }
        ]
      }

      await onConfirmSale(paymentsToSubmit, saleNotes.trim() || undefined)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error completing checkout')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
      e.preventDefault()
      handleConfirm()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in select-none"
      onKeyDown={handleKeyDown}
    >
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

          {/* Payment Methods Grid (3 Simplified Methods) */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground block">
              {t('payments.methods', 'طرق الدفع')}
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

          {/* Method 1: Cash Specific Inputs (Received Amount & Change) */}
          {selectedMethod === 'cash' && (
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

          {/* Methods 2 & 3: InstaPay / E-Wallet Reference Input (Required Sender Phone) */}
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

          {/* Sale Notes (Optional) */}
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
                <span>{t('pos.confirmAndComplete', 'تأكيد وإصدار الفاتورة')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

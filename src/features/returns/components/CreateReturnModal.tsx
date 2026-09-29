/**
 * MAKERS POS — Create Return & Refund Modal
 * Interactive interface for selecting returnable items, conditions, proportional refund calculations,
 * and refund payment allocation.
 */

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  RotateCcw, X, AlertTriangle, CheckCircle2, DollarSign,
  Package, ShieldCheck, Plus, Trash2, ArrowLeft, CreditCard, Banknote, Smartphone
} from 'lucide-react'
import { returnService } from '../returnService'
import { SaleReturnEligibility, CreateReturnInput, ReturnCondition, ReturnReceiptData } from '../types'
import { PaymentMethodType } from '@/features/payments/types'
import { posService } from '@/features/pos/posService'
import { useAuthStore } from '@/stores/authStore'

interface CreateReturnModalProps {
  saleId: string
  onClose: () => void
  onSuccess: (receipt: ReturnReceiptData) => void
}

interface ReturnLineState {
  saleItemId: string
  productId: string
  productName: string
  productSku: string
  unitPrice: number
  unitRefundAmount: number
  soldQuantity: number
  previouslyReturnedQuantity: number
  remainingQuantity: number
  quantityToReturn: number
  condition: ReturnCondition
  reason: string
}

interface SplitRefundState {
  method: PaymentMethodType
  amount: number
  reference: string
}

export function CreateReturnModal({ saleId, onClose, onSuccess }: CreateReturnModalProps) {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'ar'
  const user = useAuthStore((state) => state.user)

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [eligibility, setEligibility] = useState<SaleReturnEligibility | null>(null)
  const [activeShift, setActiveShift] = useState<{ id: string; registerId: string } | null>(null)

  // Item return selection state
  const [lines, setLines] = useState<ReturnLineState[]>([])
  const [globalReason, setGlobalReason] = useState('Customer Return')
  const [notes, setNotes] = useState('')

  // Refund method allocation state
  const [isSplitRefund, setIsSplitRefund] = useState(false)
  const [primaryMethod, setPrimaryMethod] = useState<PaymentMethodType>('cash')
  const [splitRefunds, setSplitRefunds] = useState<SplitRefundState[]>([
    { method: 'cash', amount: 0, reference: '' }
  ])

  // Load Eligibility & Shift
  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setError(null)
      try {
        const [elig, shift] = await Promise.all([
          returnService.getSaleReturnEligibility(saleId),
          posService.getActiveShift(user?.id || ''),
        ])

        setEligibility(elig)

        if (!shift || !shift.isOpen || !shift.shiftId) {
          setError(t('returns.noActiveShift', 'لا توجد وردية كاشير مفتوحة حالياً. يرجى فتح وردية أولاً لمعالجة المرتجعات.'))
        } else {
          setActiveShift({ id: shift.shiftId, registerId: shift.registerId || '' })
        }

        // Initialize line states
        const initialLines: ReturnLineState[] = elig.items.map((item) => ({
          saleItemId: item.saleItemId,
          productId: item.productId,
          productName: item.productName,
          productSku: item.productSku,
          unitPrice: item.unitPrice,
          unitRefundAmount: item.unitRefundAmount,
          soldQuantity: item.soldQuantity,
          previouslyReturnedQuantity: item.previouslyReturnedQuantity,
          remainingQuantity: item.remainingReturnableQuantity,
          quantityToReturn: 0,
          condition: 'resellable',
          reason: '',
        }))
        setLines(initialLines)
      } catch (err: any) {
        console.error('Failed to load sale eligibility:', err)
        setError(err.message || 'Failed to load sale data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [saleId, user?.id, t])

  // Computed Totals
  const selectedLines = lines.filter((l) => l.quantityToReturn > 0)
  const totalRefundDue = selectedLines.reduce((sum, l) => sum + l.quantityToReturn * l.unitRefundAmount, 0)
  const totalItemsCount = selectedLines.reduce((sum, l) => sum + l.quantityToReturn, 0)

  // Split calculations
  const totalSplitAllocated = splitRefunds.reduce((sum, s) => sum + (Number(s.amount) || 0), 0)
  const remainingToAllocate = Math.max(0, totalRefundDue - totalSplitAllocated)

  // Handlers
  const handleQuantityChange = (saleItemId: string, newQty: number) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.saleItemId !== saleItemId) return l
        const safeQty = Math.max(0, Math.min(l.remainingQuantity, newQty))
        return { ...l, quantityToReturn: safeQty }
      })
    )
  }

  const handleConditionChange = (saleItemId: string, condition: ReturnCondition) => {
    setLines((prev) =>
      prev.map((l) => (l.saleItemId === saleItemId ? { ...l, condition } : l))
    )
  }

  const handleAddSplit = () => {
    setSplitRefunds((prev) => [
      ...prev,
      { method: 'card', amount: Number(remainingToAllocate.toFixed(2)), reference: '' }
    ])
  }

  const handleRemoveSplit = (idx: number) => {
    setSplitRefunds((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSplitChange = (idx: number, field: keyof SplitRefundState, value: any) => {
    setSplitRefunds((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
    )
  }

  const handleSubmitReturn = async () => {
    if (!activeShift) {
      setError(t('returns.noActiveShift', 'لا توجد وردية مفتوحة لتسجيل حركة الاسترداد'))
      return
    }

    if (selectedLines.length === 0) {
      setError(t('returns.noItemsSelected', 'يرجى تحديد كمية صنف واحد على الأقل للمرتجع'))
      return
    }

    if (totalRefundDue <= 0) {
      setError(t('returns.zeroRefund', 'إجمالي مبلغ الاسترداد يجب أن يكون أكبر من الصفر'))
      return
    }

    // Build Payments
    const payments = isSplitRefund
      ? splitRefunds.map((s) => ({
          method: s.method,
          amount: Number(s.amount),
          reference: s.reference || undefined,
        }))
      : [
          {
            method: primaryMethod,
            amount: Number(totalRefundDue.toFixed(2)),
          },
        ]

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
    if (Math.abs(totalPaid - totalRefundDue) > 0.01) {
      setError(
        t('returns.splitMismatch', 'إجمالي مبالغ الاسترداد لا يتطابق مع الإجمالي المطلوب') +
          ` (${totalPaid.toFixed(2)} != ${totalRefundDue.toFixed(2)})`
      )
      return
    }

    const payload: CreateReturnInput = {
      saleId,
      shiftId: activeShift.id,
      registerId: activeShift.registerId,
      reason: globalReason,
      notes,
      items: selectedLines.map((l) => ({
        saleItemId: l.saleItemId,
        productId: l.productId,
        quantity: l.quantityToReturn,
        condition: l.condition,
        reason: l.reason || globalReason,
      })),
      payments,
    }

    setSubmitting(true)
    setError(null)
    try {
      const result = await returnService.createReturn(payload, {
        id: user?.id || '',
        fullName: user?.fullName || user?.username || 'Cashier',
        role: user?.roleName,
      })

      onSuccess(result.receipt)
    } catch (err: any) {
      console.error('Failed to submit return:', err)
      setError(err.message || 'Failed to complete return')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <span>{t('returns.processReturn', 'معالجة مرتجع مبيعات')}</span>
                {eligibility && (
                  <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {eligibility.invoiceNumber}
                  </span>
                )}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t('returns.processReturnSubtitle', 'حدد الأصناف والكميات المراد إرجاعها وحالة البضاعة وطريقة الاسترداد')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading && (
            <div className="py-16 text-center text-muted-foreground">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent mb-3" />
              <p className="text-sm">{t('common.loading', 'جاري تحميل بيانات الفاتورة...')}</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-3 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && eligibility && (
            <>
              {/* Sale Info Summary Bar */}
              <div className="p-4 rounded-xl bg-muted/30 border border-border grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground block">{t('sales.customer', 'العميل')}</span>
                  <span className="font-bold text-foreground mt-0.5 block">
                    {eligibility.customerName || t('common.walkInCustomer', 'عميل نقدي')}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">{t('sales.cashier', 'الكاشير الأصلي')}</span>
                  <span className="font-bold text-foreground mt-0.5 block">{eligibility.cashierName || 'Cashier'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">{t('returns.originalTotal', 'إجمالي الفاتورة')}</span>
                  <span className="font-bold text-foreground font-mono mt-0.5 block">
                    {eligibility.originalTotal.toFixed(2)} ج.م
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">{t('returns.maxRefundable', 'المتبقي القابل للاسترداد')}</span>
                  <span className="font-extrabold text-emerald-500 font-mono mt-0.5 block text-sm">
                    {eligibility.remainingRefundableAmount.toFixed(2)} ج.م
                  </span>
                </div>
              </div>

              {/* Items Selection Table */}
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" />
                  <span>{t('returns.selectItemsToReturn', 'أصناف الفاتورة القابلة للإرجاع')}</span>
                </h3>

                <div className="border border-border rounded-xl overflow-hidden shadow-sm bg-card">
                  <div className="grid grid-cols-12 gap-2 p-3 bg-muted/40 font-bold text-xs text-muted-foreground border-b border-border">
                    <span className="col-span-4">{t('products.name', 'الصنف')}</span>
                    <span className="col-span-2 text-center">{t('returns.soldQty', 'المباع / المسترجع')}</span>
                    <span className="col-span-2 text-center">{t('returns.returnQty', 'كمية الإرجاع')}</span>
                    <span className="col-span-2">{t('returns.condition', 'حالة الصنف')}</span>
                    <span className="col-span-2 text-end">{t('returns.refundValue', 'قيمة الاسترداد')}</span>
                  </div>

                  <div className="divide-y divide-border">
                    {lines.map((item) => {
                      const isReturnable = item.remainingQuantity > 0
                      const lineRefund = (item.quantityToReturn * item.unitRefundAmount).toFixed(2)

                      return (
                        <div
                          key={item.saleItemId}
                          className={`grid grid-cols-12 gap-2 p-3.5 items-center text-xs transition-colors ${
                            item.quantityToReturn > 0 ? 'bg-primary/5' : ''
                          } ${!isReturnable ? 'opacity-50 bg-muted/10' : ''}`}
                        >
                          {/* Name & SKU */}
                          <div className="col-span-4">
                            <span className="font-bold text-foreground block truncate">{item.productName}</span>
                            <span className="text-[11px] text-muted-foreground font-mono">SKU: {item.productSku}</span>
                          </div>

                          {/* Sold / Previously Returned */}
                          <div className="col-span-2 text-center">
                            <span className="font-bold text-foreground font-mono">{item.soldQuantity}</span>
                            {item.previouslyReturnedQuantity > 0 && (
                              <span className="text-amber-500 font-mono text-[10px] block">
                                (-{item.previouslyReturnedQuantity} {t('returns.previouslyReturned', 'سابقاً')})
                              </span>
                            )}
                            <span className="text-muted-foreground text-[10px] block">
                              {t('returns.available', 'متاح')}: {item.remainingQuantity}
                            </span>
                          </div>

                          {/* Quantity Selector */}
                          <div className="col-span-2 flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              disabled={!isReturnable || item.quantityToReturn <= 0}
                              onClick={() => handleQuantityChange(item.saleItemId, item.quantityToReturn - 1)}
                              className="w-7 h-7 rounded-lg border border-border flex items-center justify-center font-bold hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              max={item.remainingQuantity}
                              disabled={!isReturnable}
                              value={item.quantityToReturn}
                              onChange={(e) => handleQuantityChange(item.saleItemId, parseInt(e.target.value) || 0)}
                              className="w-12 h-7 text-center bg-background border border-border rounded-lg font-mono font-bold text-xs focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                            />
                            <button
                              type="button"
                              disabled={!isReturnable || item.quantityToReturn >= item.remainingQuantity}
                              onClick={() => handleQuantityChange(item.saleItemId, item.quantityToReturn + 1)}
                              className="w-7 h-7 rounded-lg border border-border flex items-center justify-center font-bold hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              +
                            </button>
                          </div>

                          {/* Condition */}
                          <div className="col-span-2">
                            <select
                              disabled={!isReturnable || item.quantityToReturn === 0}
                              value={item.condition}
                              onChange={(e) => handleConditionChange(item.saleItemId, e.target.value as ReturnCondition)}
                              className="w-full py-1 px-2 bg-background border border-border rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                            >
                              <option value="resellable">{t('returns.conditions.resellable', 'سليم (مخزون)')}</option>
                              <option value="damaged">{t('returns.conditions.damaged', 'تالف (عزل)')}</option>
                              <option value="defective">{t('returns.conditions.defective', 'معيب / صيانة')}</option>
                            </select>
                          </div>

                          {/* Line Refund */}
                          <div className="col-span-2 text-end">
                            <span className="font-extrabold font-mono text-sm text-foreground block">
                              {lineRefund} ج.م
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              ({item.unitRefundAmount.toFixed(2)}/وحدة)
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Refund Method & Global Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {/* Reason & Notes */}
                <div className="space-y-3">
                  <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">
                    {t('returns.reasonAndNotes', 'سبب الإرجاع والملاحظات')}
                  </h4>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={globalReason}
                      onChange={(e) => setGlobalReason(e.target.value)}
                      placeholder={t('returns.reasonPlaceholder', 'سبب الإرجاع (مثال: منتج غير متطابق، رغبة العميل...)')}
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={t('returns.notesPlaceholder', 'أي ملاحظات إضافية عن حالة العملية...')}
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                    />
                  </div>
                </div>

                {/* Refund Method Selection */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">
                      {t('returns.refundMethod', 'طريقة الاسترداد المالي')}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setIsSplitRefund(!isSplitRefund)}
                      className="text-xs text-primary hover:underline font-semibold"
                    >
                      {isSplitRefund ? t('returns.singleMethod', 'طريقة واحدة') : t('returns.splitRefund', 'تقسيم الاسترداد')}
                    </button>
                  </div>

                  {!isSplitRefund ? (
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'cash', label: 'نقداً', icon: Banknote },
                        { id: 'card', label: 'بطاقة', icon: CreditCard },
                        { id: 'instapay', label: 'InstaPay', icon: Smartphone },
                        { id: 'vodafone_cash', label: 'Vodafone', icon: Smartphone },
                        { id: 'bank_transfer', label: 'تحويل', icon: CreditCard },
                      ].map((m) => {
                        const Icon = m.icon
                        const isSelected = primaryMethod === m.id
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setPrimaryMethod(m.id as PaymentMethodType)}
                            className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-xs font-semibold ${
                              isSelected
                                ? 'border-primary bg-primary/10 text-primary shadow-sm'
                                : 'border-border bg-card hover:bg-muted/50 text-foreground'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            <span>{m.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="space-y-2 p-3 rounded-xl bg-muted/20 border border-border">
                      {splitRefunds.map((split, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <select
                            value={split.method}
                            onChange={(e) => handleSplitChange(idx, 'method', e.target.value)}
                            className="py-1.5 px-2 bg-background border border-border rounded-lg text-xs font-medium"
                          >
                            <option value="cash">نقداً (Cash)</option>
                            <option value="card">بطاقة (Card)</option>
                            <option value="instapay">InstaPay</option>
                            <option value="vodafone_cash">Vodafone Cash</option>
                            <option value="bank_transfer">Bank Transfer</option>
                          </select>
                          <input
                            type="number"
                            step="0.01"
                            value={split.amount}
                            onChange={(e) => handleSplitChange(idx, 'amount', parseFloat(e.target.value) || 0)}
                            placeholder="المبلغ"
                            className="w-24 py-1.5 px-2 bg-background border border-border rounded-lg text-xs font-mono font-bold"
                          />
                          <input
                            type="text"
                            value={split.reference}
                            onChange={(e) => handleSplitChange(idx, 'reference', e.target.value)}
                            placeholder="رقم المرجع"
                            className="flex-1 py-1.5 px-2 bg-background border border-border rounded-lg text-xs"
                          />
                          {splitRefunds.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSplit(idx)}
                              className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={handleAddSplit}
                        className="text-xs text-primary font-bold flex items-center gap-1 hover:underline pt-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{t('returns.addSplitMethod', 'إضافة طريقة استرداد أخرى')}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Summary & Confirm Button */}
        <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-xs text-muted-foreground block">{t('returns.itemsSelected', 'الأصناف المحددة')}</span>
              <span className="text-sm font-bold text-foreground">{totalItemsCount} {t('returns.units', 'قطع')}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">{t('returns.totalRefund', 'إجمالي مبلغ الاسترداد')}</span>
              <span className="text-xl font-extrabold text-primary font-mono">{totalRefundDue.toFixed(2)} ج.م</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-accent text-accent-foreground font-semibold hover:bg-accent/80 transition-all text-sm"
            >
              {t('common.cancel', 'إلغاء')}
            </button>
            <button
              type="button"
              disabled={submitting || totalRefundDue <= 0 || !activeShift}
              onClick={handleSubmitReturn}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-sm transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{submitting ? t('common.processing', 'جاري المعالجة...') : t('returns.confirmReturn', 'تأكيد المرتجع والاسترداد')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

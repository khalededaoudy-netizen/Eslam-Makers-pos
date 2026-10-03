import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Tag,
  FolderOpen,
  X,
  AlertCircle,
  Percent,
  DollarSign,
  Check,
  Trash2,
} from 'lucide-react'
import { PosCartSummary } from '../types'
import { formatCurrency } from '@/lib/formatters'
import { useSettingsStore } from '@/stores/settingsStore'

interface CartSummaryProps {
  summary: PosCartSummary
  canDiscount?: boolean
  canHold?: boolean
  heldCartsCount: number
  onSetDiscount: (pct: number, amount: number, type?: 'pct' | 'fixed') => void
  onOpenHeldCarts: () => void
}

export function CartSummary({
  summary,
  canDiscount = false,
  canHold = false,
  heldCartsCount,
  onSetDiscount,
  onOpenHeldCarts,
}: CartSummaryProps) {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language !== 'en'
  const { currencySymbol } = useSettingsStore()

  const [showDiscountModal, setShowDiscountModal] = useState(false)
  const [discountType, setDiscountType] = useState<'pct' | 'fixed'>('pct')
  const [discountVal, setDiscountVal] = useState('')

  // Sync modal state when opening
  useEffect(() => {
    if (showDiscountModal) {
      const isPct = summary.cartDiscountType === 'pct' || (summary.cartDiscountPct > 0 && summary.cartDiscountAmount === Number(((summary.subtotal * summary.cartDiscountPct) / 100).toFixed(2)))
      if (summary.cartDiscountAmount > 0) {
        if (summary.cartDiscountType) {
          setDiscountType(summary.cartDiscountType)
          setDiscountVal(summary.cartDiscountType === 'pct' ? String(Number(summary.cartDiscountPct.toFixed(2))) : String(summary.cartDiscountAmount))
        } else if (isPct) {
          setDiscountType('pct')
          setDiscountVal(String(Number(summary.cartDiscountPct.toFixed(2))))
        } else {
          setDiscountType('fixed')
          setDiscountVal(String(summary.cartDiscountAmount))
        }
      } else {
        setDiscountType('pct')
        setDiscountVal('')
      }
    }
  }, [showDiscountModal, summary])

  // Live calculation and validation inside modal
  const numVal = parseFloat(discountVal) || 0
  let previewDiscountAmount = 0
  let previewTotal = summary.subtotal
  let isValid = true
  let errorMessage: string | null = null

  if (discountVal.trim() !== '') {
    if (isNaN(numVal) || numVal < 0) {
      isValid = false
      errorMessage = isArabic ? 'قيمة الخصم لا يمكن أن تكون سالبة' : 'Discount cannot be negative'
    } else if (discountType === 'pct') {
      if (numVal > 100) {
        isValid = false
        errorMessage = isArabic ? 'نسبة الخصم لا يمكن أن تتجاوز 100%' : 'Percentage cannot exceed 100%'
      } else {
        previewDiscountAmount = Number(((summary.subtotal * numVal) / 100).toFixed(2))
        previewTotal = Math.max(0, summary.subtotal - previewDiscountAmount)
      }
    } else {
      if (numVal > summary.subtotal) {
        isValid = false
        errorMessage = isArabic
          ? `قيمة الخصم لا يمكن أن تتجاوز الإجمالي قبل الخصم (${formatCurrency(summary.subtotal, currencySymbol)})`
          : `Discount cannot exceed subtotal (${formatCurrency(summary.subtotal, currencySymbol)})`
      } else {
        previewDiscountAmount = numVal
        previewTotal = Math.max(0, summary.subtotal - previewDiscountAmount)
      }
    }
  }

  const handleApplyDiscount = () => {
    if (!isValid) return

    if (!discountVal || discountVal.trim() === '' || numVal === 0) {
      onSetDiscount(0, 0, discountType)
      setShowDiscountModal(false)
      return
    }

    if (discountType === 'pct') {
      const cleanPct = Math.min(100, Math.max(0, numVal))
      const cleanAmount = Number(((summary.subtotal * cleanPct) / 100).toFixed(2))
      onSetDiscount(cleanPct, cleanAmount, 'pct')
    } else {
      const cleanAmount = Math.min(summary.subtotal, Math.max(0, numVal))
      const cleanPct = summary.subtotal > 0 ? Number(((cleanAmount / summary.subtotal) * 100).toFixed(2)) : 0
      onSetDiscount(cleanPct, cleanAmount, 'fixed')
    }
    setShowDiscountModal(false)
  }

  const handleRemoveDiscount = () => {
    onSetDiscount(0, 0, 'fixed')
    setDiscountVal('')
    setShowDiscountModal(false)
  }

  const percentagePresets = [5, 10, 15, 20, 25, 50, 100]

  return (
    <div className="p-4 bg-card border border-border rounded-2xl shadow-sm space-y-3">
      {/* Line Items & Totals Breakdown */}
      <div className="space-y-2 text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>{t('pos.itemsCount', 'عدد الأصناف / الكمية')}</span>
          <span className="font-mono font-semibold text-foreground">
            {summary.itemsCount} صنف ({summary.totalQuantity} وحدة)
          </span>
        </div>

        {/* Subtotal Before Discount */}
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-muted-foreground">{isArabic ? 'الإجمالي الفرعي' : 'Subtotal'}</span>
          <span className="font-mono font-bold text-foreground">
            {formatCurrency(summary.subtotal, currencySymbol)}
          </span>
        </div>

        {/* Invoice Discount Section */}
        {canDiscount && (
          <div className="flex items-center justify-between py-1 border-y border-border/50">
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-primary" />
                <span>{isArabic ? 'الخصم' : 'Discount'}</span>
              </span>

              {summary.cartDiscountAmount > 0 ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowDiscountModal(true)}
                    className="px-2 py-0.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-bold transition-colors"
                  >
                    {isArabic ? 'تعديل الخصم' : 'Edit'}
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveDiscount}
                    className="p-1 text-muted-foreground hover:text-destructive rounded-md transition-colors"
                    title={isArabic ? 'إزالة الخصم' : 'Remove discount'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDiscountModal(true)}
                  disabled={summary.itemsCount === 0}
                  className="px-3 py-1 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all shadow-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>{isArabic ? 'خصم' : 'Discount'}</span>
                </button>
              )}
            </div>

            <span className={`font-mono font-black text-sm ${summary.cartDiscountAmount > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {summary.cartDiscountAmount > 0
                ? `- ${formatCurrency(summary.cartDiscountAmount, currencySymbol)}${summary.cartDiscountPct > 0 ? ` (${summary.cartDiscountPct.toFixed(0)}%)` : ''}`
                : '0.00'}
            </span>
          </div>
        )}

        {/* Tax (if enabled) */}
        {summary.taxRate > 0 && (
          <div className="flex items-center justify-between">
            <span>
              {t('pos.tax', 'ضريبة القيمة المضافة')} ({summary.taxRate}%)
            </span>
            <span className="font-mono font-semibold text-foreground">
              {formatCurrency(summary.taxAmount, currencySymbol)}
            </span>
          </div>
        )}
      </div>

      {/* Grand Total Row */}
      <div className="pt-2 border-t border-border flex items-center justify-between">
        <div>
          <span className="text-xs text-muted-foreground font-bold uppercase">
            {isArabic ? 'الإجمالي النهائي' : 'Grand Total'}
          </span>
          <div className="text-2xl font-black font-mono text-primary leading-none mt-0.5">
            {formatCurrency(summary.total, currencySymbol)}
          </div>
        </div>

        {/* Held Carts Badge/Button */}
        {canHold && heldCartsCount > 0 && (
          <button
            type="button"
            onClick={onOpenHeldCarts}
            className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            title={t('pos.heldCarts', 'الفواتير المعلقة')}
          >
            <FolderOpen className="w-4 h-4" />
            <span>{isArabic ? 'معلقة' : 'Held'}</span>
            <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px] font-mono font-bold">
              {heldCartsCount}
            </span>
          </button>
        )}
      </div>

      {/* Invoice Discount Modal */}
      {showDiscountModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in select-none"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setShowDiscountModal(false)
            if (e.key === 'Enter' && isValid) handleApplyDiscount()
          }}
        >
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-5 space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {isArabic ? 'خصم على الفاتورة' : 'Invoice Discount'}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDiscountModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              {/* Row 1: Subtotal Before Discount */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 border border-border/60 text-xs">
                <span className="font-semibold text-muted-foreground">{isArabic ? 'الإجمالي قبل الخصم:' : 'Subtotal Before Discount:'}</span>
                <span className="font-mono font-bold text-foreground text-sm">
                  {formatCurrency(summary.subtotal, currencySymbol)}
                </span>
              </div>

              {/* Row 2: Discount Type Switcher */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground block">
                  {isArabic ? 'نوع الخصم' : 'Discount Type'}
                </label>
                <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-border bg-muted/40 p-1 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setDiscountType('pct')
                      setDiscountVal('')
                    }}
                    className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                      discountType === 'pct'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Percent className="w-3.5 h-3.5" />
                    <span>{isArabic ? 'نسبة مئوية (%)' : 'Percentage (%)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDiscountType('fixed')
                      setDiscountVal('')
                    }}
                    className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                      discountType === 'fixed'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>{isArabic ? `مبلغ ثابت (${currencySymbol})` : `Fixed (${currencySymbol})`}</span>
                  </button>
                </div>
              </div>

              {/* Percentage Quick Presets */}
              {discountType === 'pct' && (
                <div className="flex flex-wrap gap-1.5">
                  {percentagePresets.map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setDiscountVal(String(pct))}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-colors ${
                        discountVal === String(pct)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/50 border-border text-foreground hover:bg-muted'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              )}

              {/* Row 3: Discount Value Input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground block">
                  {isArabic ? 'قيمة الخصم' : 'Discount Value'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    max={discountType === 'pct' ? '100' : String(summary.subtotal)}
                    value={discountVal}
                    onChange={(e) => setDiscountVal(e.target.value)}
                    placeholder="0"
                    className="w-full px-4 py-2.5 bg-background border border-input rounded-xl text-center font-mono font-bold text-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
                    autoFocus
                  />
                  <span className="absolute end-3.5 top-1/2 -translate-y-1/2 font-mono font-bold text-xs text-muted-foreground select-none">
                    {discountType === 'pct' ? '%' : currencySymbol}
                  </span>
                </div>

                {/* Validation Error Message */}
                {errorMessage && (
                  <div className="flex items-center gap-1.5 text-xs text-destructive font-medium px-1 animate-fade-in">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}
              </div>

              {/* Rows 4 & 5: Live Preview Breakdown Box */}
              {isValid && discountVal.trim() !== '' && numVal > 0 && (
                <div className="p-3 bg-muted/40 border border-border/80 rounded-xl space-y-1.5 text-xs animate-fade-in">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>{isArabic ? 'الخصم:' : 'Discount Amount:'}</span>
                    <span className="font-mono font-bold text-destructive">
                      - {formatCurrency(previewDiscountAmount, currencySymbol)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-bold text-foreground border-t border-border/50 pt-1.5">
                    <span>{isArabic ? 'الإجمالي بعد الخصم:' : 'Total After Discount:'}</span>
                    <span className="font-mono text-primary text-base">
                      {formatCurrency(previewTotal, currencySymbol)}
                    </span>
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                {summary.cartDiscountAmount > 0 && (
                  <button
                    type="button"
                    onClick={handleRemoveDiscount}
                    className="px-3 py-2 text-xs text-destructive hover:bg-destructive/10 rounded-xl transition-colors font-semibold flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isArabic ? 'إزالة الخصم' : 'Remove Discount'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowDiscountModal(false)}
                  className="px-3.5 py-2 text-xs rounded-xl border border-border text-foreground hover:bg-muted transition-colors font-semibold"
                >
                  {isArabic ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleApplyDiscount}
                  disabled={!isValid}
                  className="px-5 py-2 text-xs rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'تطبيق الخصم' : 'Apply Discount'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


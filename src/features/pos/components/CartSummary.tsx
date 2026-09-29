import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Tag,
  DollarSign,
  PauseCircle,
  FolderOpen,
  ArrowRight,
  ShieldAlert,
  Percent,
  Calculator,
} from 'lucide-react'
import { PosCartSummary } from '../types'
import { formatCurrency } from '@/lib/formatters'

interface CartSummaryProps {
  summary: PosCartSummary
  canDiscount?: boolean
  canHold?: boolean
  heldCartsCount: number
  onSetDiscount: (pct: number, amount: number) => void
  onHoldCart: () => void
  onOpenHeldCarts: () => void
  onPrepareCheckout?: () => void
}

export function CartSummary({
  summary,
  canDiscount = false,
  canHold = false,
  heldCartsCount,
  onSetDiscount,
  onHoldCart,
  onOpenHeldCarts,
  onPrepareCheckout,
}: CartSummaryProps) {
  const { t } = useTranslation()

  const [showDiscountModal, setShowDiscountModal] = useState(false)
  const [discountType, setDiscountType] = useState<'pct' | 'amount'>('pct')
  const [discountVal, setDiscountVal] = useState(
    summary.cartDiscountPct > 0
      ? String(summary.cartDiscountPct)
      : summary.cartDiscountAmount > 0
      ? String(summary.cartDiscountAmount)
      : ''
  )

  const handleApplyDiscount = () => {
    const num = parseFloat(discountVal) || 0
    if (discountType === 'pct') {
      const cleanPct = Math.min(100, Math.max(0, num))
      const cleanAmount = (summary.subtotal * cleanPct) / 100
      onSetDiscount(cleanPct, cleanAmount)
    } else {
      const cleanAmount = Math.min(summary.subtotal, Math.max(0, num))
      const cleanPct = summary.subtotal > 0 ? (cleanAmount / summary.subtotal) * 100 : 0
      onSetDiscount(cleanPct, cleanAmount)
    }
    setShowDiscountModal(false)
  }

  const handleClearDiscount = () => {
    onSetDiscount(0, 0)
    setDiscountVal('')
    setShowDiscountModal(false)
  }

  return (
    <div className="p-4 bg-card border border-border rounded-2xl shadow-sm space-y-3">
      {/* Line Items Breakdown */}
      <div className="space-y-1.5 text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>{t('pos.itemsCount', 'عدد الأصناف / الكمية')}</span>
          <span className="font-mono font-semibold text-foreground">
            {summary.itemsCount} صنف ({summary.totalQuantity} وحدة)
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span>{t('pos.subtotal', 'المجموع الفرعي')}</span>
          <span className="font-mono font-semibold text-foreground">
            {formatCurrency(summary.subtotal)}
          </span>
        </div>

        {/* Cart Discount */}
        {canDiscount && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span>{t('pos.discount', 'خصم الفاتورة')}</span>
              <button
                type="button"
                onClick={() => setShowDiscountModal(true)}
                className="text-primary hover:underline text-[11px] font-semibold"
              >
                {summary.cartDiscountAmount > 0 ? t('common.edit', 'تعديل') : `+ ${t('common.add', 'إضافة')}`}
              </button>
            </div>
            <span className="font-mono font-bold text-destructive">
              {summary.cartDiscountAmount > 0 ? `- ${formatCurrency(summary.cartDiscountAmount)}` : '—'}
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
              {formatCurrency(summary.taxAmount)}
            </span>
          </div>
        )}
      </div>

      {/* Grand Total */}
      <div className="pt-2.5 border-t border-border flex items-center justify-between">
        <div>
          <span className="text-xs text-muted-foreground font-semibold uppercase">
            {t('pos.total', 'الإجمالي النهائي')}
          </span>
          <div className="text-2xl font-bold font-mono text-primary">
            {formatCurrency(summary.total)}
          </div>
        </div>

        {/* Held Carts Badge & Button */}
        {canHold && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenHeldCarts}
              className="p-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title={t('pos.heldCarts', 'الفواتير المعلقة')}
            >
              <FolderOpen className="w-4 h-4 text-amber-500" />
              {heldCartsCount > 0 && (
                <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px] font-mono font-bold">
                  {heldCartsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onHoldCart}
              disabled={summary.itemsCount === 0}
              className="px-3 py-2 rounded-xl bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-30"
            >
              <PauseCircle className="w-4 h-4" />
              <span>{t('pos.holdSale', 'تعليق الفاتورة')}</span>
            </button>
          </div>
        )}
      </div>

      {/* Checkout Preparation Button (for POS Core phase) */}
      <div className="pt-1">
        <button
          type="button"
          onClick={onPrepareCheckout}
          disabled={summary.itemsCount === 0}
          className="w-full py-3 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span>{t('pos.checkoutPrepared', 'جاهز للدفع والتنفيذ')}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Discount Modal */}
      {showDiscountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold">{t('pos.cartDiscount', 'خصم على إجمالي الفاتورة')}</h3>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex rounded-lg border border-input bg-muted/40 p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setDiscountType('pct')}
                  className={`flex-1 py-1.5 rounded-md transition-colors ${
                    discountType === 'pct' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
                  }`}
                >
                  نسبة مئوية (%)
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType('amount')}
                  className={`flex-1 py-1.5 rounded-md transition-colors ${
                    discountType === 'amount' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
                  }`}
                >
                  مبلغ ثابت (ج.م)
                </button>
              </div>

              <div>
                <input
                  type="number"
                  min="0"
                  max={discountType === 'pct' ? '100' : String(summary.subtotal)}
                  value={discountVal}
                  onChange={e => setDiscountVal(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-center font-mono font-bold text-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                {summary.cartDiscountAmount > 0 && (
                  <button
                    type="button"
                    onClick={handleClearDiscount}
                    className="px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 rounded-lg transition-colors font-semibold"
                  >
                    {t('common.delete', 'إلغاء الخصم')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowDiscountModal(false)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-border text-foreground hover:bg-muted transition-colors font-medium"
                >
                  {t('common.cancel', 'إلغاء')}
                </button>
                <button
                  type="button"
                  onClick={handleApplyDiscount}
                  className="px-4 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-semibold shadow-sm"
                >
                  {t('common.save', 'تطبيق')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

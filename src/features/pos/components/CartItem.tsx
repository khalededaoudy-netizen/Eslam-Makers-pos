import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Minus, Trash2, Tag, Percent, AlertCircle } from 'lucide-react'
import { CartItem as CartItemType } from '@/stores/cartStore'
import { formatCurrency } from '@/lib/formatters'

interface CartItemProps {
  item: CartItemType
  onUpdateQuantity: (id: string, qty: number) => void
  onRemoveItem: (id: string) => void
  onUpdateDiscount: (id: string, pct: number, amount: number) => void
  canDiscount?: boolean
}

export function CartItem({
  item,
  onUpdateQuantity,
  onRemoveItem,
  onUpdateDiscount,
  canDiscount = false,
}: CartItemProps) {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language !== 'en'

  const [showDiscountInput, setShowDiscountInput] = useState(false)
  const [discountVal, setDiscountVal] = useState(
    item.discountPct > 0 ? String(item.discountPct) : item.discountAmount > 0 ? String(item.discountAmount) : ''
  )
  const [discountType, setDiscountType] = useState<'pct' | 'amount'>('pct')

  const handleQtyChange = (delta: number) => {
    const step = item.allowDecimal ? 0.5 : 1
    const nextQty = Math.max(0.1, Number((item.quantity + delta * step).toFixed(2)))
    onUpdateQuantity(item.id, nextQty)
  }

  const handleDirectQty = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    if (!isNaN(val) && val > 0) {
      onUpdateQuantity(item.id, val)
    }
  }

  const handleApplyDiscount = () => {
    const num = parseFloat(discountVal) || 0
    if (discountType === 'pct') {
      const cleanPct = Math.min(100, Math.max(0, num))
      onUpdateDiscount(item.id, cleanPct, (item.quantity * item.unitPrice * cleanPct) / 100)
    } else {
      const maxDiscount = item.quantity * item.unitPrice
      const cleanAmt = Math.min(maxDiscount, Math.max(0, num))
      onUpdateDiscount(item.id, (cleanAmt / maxDiscount) * 100, cleanAmt)
    }
    setShowDiscountInput(false)
  }

  return (
    <div className="p-3 bg-card border border-border rounded-xl shadow-sm hover:border-border/80 transition-all space-y-2">
      {/* Top Row: Name, SKU, Delete */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5 flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
              {item.sku}
            </span>
            <span className="font-semibold text-xs text-foreground truncate">
              {isArabic ? item.productNameAr || item.productName : item.productName || item.productNameAr}
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground">
            {formatCurrency(item.unitPrice)} / {item.unitSymbol || 'قطعة'}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onRemoveItem(item.id)}
          className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
          title={t('common.delete', 'حذف من السلة')}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Middle Row: Quantity Controls & Subtotal */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
        {/* Quantity Stepper */}
        <div className="flex items-center border border-input rounded-lg bg-background overflow-hidden shadow-xs">
          <button
            type="button"
            onClick={() => handleQtyChange(-1)}
            disabled={item.quantity <= (item.allowDecimal ? 0.5 : 1)}
            className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
          >
            <Minus className="w-3 h-3" />
          </button>

          <input
            type="number"
            min={item.allowDecimal ? '0.1' : '1'}
            step={item.allowDecimal ? '0.5' : '1'}
            value={item.quantity}
            onChange={handleDirectQty}
            className="w-12 py-0.5 text-center text-xs font-mono font-bold bg-transparent focus:outline-none"
          />

          <button
            type="button"
            onClick={() => handleQtyChange(1)}
            disabled={item.quantity >= item.stock}
            className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {/* Line Subtotal & Discount Badge */}
        <div className="text-end">
          {item.discountAmount > 0 && (
            <div className="text-[10px] text-destructive line-through font-mono">
              {formatCurrency(item.quantity * item.unitPrice)}
            </div>
          )}
          <div className="font-mono font-bold text-sm text-foreground">
            {formatCurrency(item.subtotal)}
          </div>
        </div>
      </div>

      {/* Optional: Line Discount Bar (RBAC guarded) */}
      {canDiscount && (
        <div className="pt-1">
          {!showDiscountInput ? (
            <div className="flex items-center justify-between text-[11px]">
              <button
                type="button"
                onClick={() => setShowDiscountInput(true)}
                className="text-primary hover:underline text-[11px] flex items-center gap-1"
              >
                <Tag className="w-3 h-3" />
                <span>
                  {item.discountAmount > 0
                    ? `${t('pos.discount', 'خصم')}: ${formatCurrency(item.discountAmount)} (${item.discountPct.toFixed(1)}%)`
                    : `+ ${t('pos.addDiscount', 'إضافة خصم للصنف')}`}
                </span>
              </button>
              {item.quantity >= item.stock && (
                <span className="text-[10px] text-amber-500 flex items-center gap-0.5">
                  <AlertCircle className="w-3 h-3" />
                  <span>{t('pos.maxStockReached', 'الحد الأقصى للمخزون')}</span>
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 p-1.5 bg-muted/40 rounded-lg border border-border animate-fade-in text-xs">
              <div className="flex rounded-md border border-input bg-background overflow-hidden text-[10px] font-semibold">
                <button
                  type="button"
                  onClick={() => setDiscountType('pct')}
                  className={`px-1.5 py-0.5 ${discountType === 'pct' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType('amount')}
                  className={`px-1.5 py-0.5 ${discountType === 'amount' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                >
                  ج.م
                </button>
              </div>

              <input
                type="number"
                min="0"
                value={discountVal}
                onChange={e => setDiscountVal(e.target.value)}
                placeholder="0"
                className="w-16 px-2 py-0.5 text-xs bg-background border border-input rounded text-center font-mono focus:outline-none"
              />

              <button
                type="button"
                onClick={handleApplyDiscount}
                className="px-2 py-0.5 bg-primary text-primary-foreground text-[11px] font-semibold rounded hover:bg-primary/90"
              >
                {t('common.save', 'حفظ')}
              </button>

              <button
                type="button"
                onClick={() => setShowDiscountInput(false)}
                className="text-muted-foreground hover:text-foreground text-[10px]"
              >
                {t('common.cancel', 'إلغاء')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

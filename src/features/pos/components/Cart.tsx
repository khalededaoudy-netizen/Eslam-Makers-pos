import React from 'react'
import { useTranslation } from 'react-i18next'
import { ShoppingCart, Trash2, ShoppingBag } from 'lucide-react'
import { CartItem as CartItemType } from '@/stores/cartStore'
import { CartItem } from './CartItem'

interface CartProps {
  items: CartItemType[]
  onUpdateQuantity: (id: string, qty: number) => void
  onRemoveItem: (id: string) => void
  onUpdateDiscount: (id: string, pct: number, amount: number) => void
  onClearCart: () => void
  canDiscount?: boolean
}

export function Cart({
  items,
  onUpdateQuantity,
  onRemoveItem,
  onUpdateDiscount,
  onClearCart,
  canDiscount = false,
}: CartProps) {
  const { t } = useTranslation()

  const handleClearWithConfirm = () => {
    if (items.length === 0) return
    if (window.confirm(t('pos.confirmClearCart', 'هل تريد بالتأكيد إفراغ سلة المشتريات الحالية؟'))) {
      onClearCart()
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background/50 rounded-2xl border border-border overflow-hidden">
      {/* Cart Header */}
      <div className="px-4 py-3 border-b border-border bg-card/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">
            {t('pos.cart', 'سلة المشتريات')}
          </h2>
          <span className="px-2 py-0.5 text-xs font-mono font-bold bg-primary/10 text-primary rounded-full">
            {items.length}
          </span>
        </div>

        {items.length > 0 && (
          <button
            type="button"
            onClick={handleClearWithConfirm}
            className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors px-2 py-1 rounded-md hover:bg-destructive/10"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t('pos.clearCart', 'مسح السلة')}</span>
          </button>
        )}
      </div>

      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-muted/40 border border-border flex items-center justify-center">
              <ShoppingBag className="w-7 h-7 opacity-30" />
            </div>
            <p className="text-sm font-semibold">{t('pos.emptyCart', 'السلة فارغة حالياً')}</p>
            <p className="text-xs opacity-75 max-w-[220px]">
              {t('pos.addProducts', 'امسح باركود المنتج أو ابحث في القائمة لإضافة أصناف للبيع')}
            </p>
          </div>
        ) : (
          items.map(item => (
            <CartItem
              key={item.id}
              item={item}
              onUpdateQuantity={onUpdateQuantity}
              onRemoveItem={onRemoveItem}
              onUpdateDiscount={onUpdateDiscount}
              canDiscount={canDiscount}
            />
          ))
        )}
      </div>
    </div>
  )
}

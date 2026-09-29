import React from 'react'
import { useTranslation } from 'react-i18next'
import { X, FolderOpen, Play, Trash2, Clock, User, ShoppingBag } from 'lucide-react'
import { HeldCart } from '../types'
import { formatCurrency, formatDate } from '@/lib/formatters'

interface HeldCartsModalProps {
  isOpen: boolean
  onClose: () => void
  heldCarts: HeldCart[]
  onResumeCart: (heldCart: HeldCart) => void
  onDeleteCart: (heldCartId: string) => void
}

export function HeldCartsModal({
  isOpen,
  onClose,
  heldCarts,
  onResumeCart,
  onDeleteCart,
}: HeldCartsModalProps) {
  const { t } = useTranslation()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                {t('pos.heldCarts', 'الفواتير المعلقة المحفوظة')}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t('pos.heldCartsSubtitle', 'استرجاع الفواتير المؤجلة مع التحقق التلقائي من المخزون')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-border">
          {heldCarts.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground space-y-2">
              <ShoppingBag className="w-10 h-10 mx-auto opacity-25" />
              <p className="text-sm font-semibold">{t('pos.noHeldCarts', 'لا توجد فواتير معلقة حالياً')}</p>
              <p className="text-xs opacity-75">
                {t('pos.heldCartsHelp', 'يمكنك تعليق أي فاتورة مفتوحة للرجوع إليها لاحقاً.')}
              </p>
            </div>
          ) : (
            heldCarts.map(cart => (
              <div
                key={cart.id}
                className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-sm text-foreground">
                      {formatCurrency(cart.total)}
                    </span>
                    <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
                      {cart.items?.length || 0} صنف
                    </span>
                    {cart.customer_name && (
                      <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <span>{cart.customer_name}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{formatDate(cart.held_at)}</span>
                    </span>
                    {cart.cashier_name && (
                      <span>كاشير: {cart.cashier_name}</span>
                    )}
                  </div>

                  {cart.notes && (
                    <div className="text-xs text-muted-foreground italic">
                      ملاحظات: {cart.notes}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(t('pos.confirmDeleteHeld', 'هل تريد بالتأكيد حذف هذه الفاتورة المعلقة؟'))) {
                        onDeleteCart(cart.id)
                      }
                    }}
                    className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title={t('common.delete', 'حذف')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onResumeCart(cart)}
                    className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{t('pos.resume', 'استرجاع الفاتورة')}</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Plus, ExternalLink, X, Package, Check, ArrowRight } from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'
import { useSettingsStore } from '@/stores/settingsStore'
import { DuplicateCheckResult } from '@/services/makers/types'

interface MakersDuplicateModalProps {
  duplicateResult: DuplicateCheckResult
  onAddStock: (productId: string, quantityToAdd: number) => Promise<void>
  onOpenProduct: (product: any) => void
  onClose: () => void
}

export function MakersDuplicateModal({
  duplicateResult,
  onAddStock,
  onOpenProduct,
  onClose,
}: MakersDuplicateModalProps) {
  const { t } = useTranslation()
  const { currencySymbol, language } = useSettingsStore()
  const isAr = language === 'ar'

  const product = duplicateResult.matchedProduct
  const [showAddStockInput, setShowAddStockInput] = useState(false)
  const [qtyToAdd, setQtyToAdd] = useState<string>('50')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!product) return null

  const currentStock = Number(product.current_stock) || 0
  const parsedAdd = parseFloat(qtyToAdd) || 0
  const projectedStock = currentStock + parsedAdd

  const handleConfirmAddStock = async () => {
    if (parsedAdd <= 0) {
      setError(isAr ? 'يرجى إدخال كمية صحيحة أكبر من الصفر' : 'Please enter a quantity greater than zero')
      return
    }
    setError('')
    setLoading(true)
    try {
      await onAddStock(product.id, parsedAdd)
    } catch (err: any) {
      setError(err.message || t('common.error'))
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-destructive/30 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-destructive/10">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <h3 className="text-base font-bold text-foreground">
              {t('makersImport.duplicateTitle')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('makersImport.duplicateNotice')}
          </p>

          {/* Product info card */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-3">
            <div>
              <h4 className="text-base font-semibold text-foreground">
                {isAr ? (product.name_ar || product.name_en) : (product.name_en || product.name_ar)}
              </h4>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">
                SKU: {product.sku}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/60 text-xs">
              <div>
                <span className="text-muted-foreground">{t('makersImport.currentStock')}:</span>
                <p className="text-base font-bold text-foreground display-number mt-0.5">
                  {currentStock}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">{t('makersImport.sellingPrice')}:</span>
                <p className="text-base font-bold text-foreground display-number mt-0.5">
                  {formatCurrency(product.selling_price, currencySymbol)}
                </p>
              </div>
            </div>

            {product.drawer_location && (
              <div className="text-xs text-muted-foreground">
                <span>{t('products.drawerLocation')}: </span>
                <span className="font-mono text-foreground font-medium">{product.drawer_location}</span>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
              {error}
            </div>
          )}

          {/* Add Stock Section */}
          {showAddStockInput && (
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3 animate-in fade-in duration-150">
              <label className="text-xs font-semibold text-primary block">
                {t('makersImport.quantityToAdd')}:
              </label>

              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={qtyToAdd}
                  onChange={(e) => setQtyToAdd(e.target.value)}
                  className="w-32 h-10 px-3 rounded-lg bg-input border border-border text-sm font-semibold display-number focus:ring-2 focus:ring-primary"
                  autoFocus
                />
                
                {/* Stock calculation preview */}
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 display-number">
                  <span>{currentStock}</span>
                  <span>+</span>
                  <span className="text-primary font-bold">{parsedAdd}</span>
                  <span>=</span>
                  <span className="font-bold text-foreground text-sm">{projectedStock}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleConfirmAddStock}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  {t('makersImport.confirmAddStock')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddStockInput(false)}
                  className="px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-muted"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 px-6 py-4 border-t border-border bg-muted/20">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            {t('common.cancel')}
          </button>

          <button
            type="button"
            onClick={() => onOpenProduct(product)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium border border-border bg-card hover:bg-muted text-foreground transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {t('makersImport.openProduct')}
          </button>

          {!showAddStockInput && (
            <button
              type="button"
              onClick={() => setShowAddStockInput(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('makersImport.addStock')}
            </button>
          )}
        </div>

      </div>
    </div>
  )
}

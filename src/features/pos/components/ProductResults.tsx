import React from 'react'
import { useTranslation } from 'react-i18next'
import { Package, Tag, Plus, AlertTriangle, Layers } from 'lucide-react'
import { PosProduct } from '../types'
import { formatCurrency } from '@/lib/formatters'

interface ProductResultsProps {
  results: PosProduct[]
  onSelectProduct: (product: PosProduct) => void
  searching?: boolean
  query: string
}

export function ProductResults({
  results,
  onSelectProduct,
  searching = false,
  query,
}: ProductResultsProps) {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language !== 'en'

  if (searching) {
    return (
      <div className="p-8 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
        <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span>{t('common.loading', 'جاري البحث في المنتجات...')}</span>
      </div>
    )
  }

  if (query.trim().length >= 2 && results.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground text-sm space-y-1">
        <Package className="w-8 h-8 mx-auto opacity-30 mb-2" />
        <p className="font-semibold">{t('pos.noProducts', 'لا توجد منتجات مطابقة للبحث')}</p>
        <p className="text-xs opacity-75">
          {t('pos.tryDifferentSearch', 'جرب البحث باسم آخر، كود SKU، أو امسح الباركود مباشرة.')}
        </p>
      </div>
    )
  }

  if (results.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[420px] overflow-y-auto p-1">
      {results.map(product => {
        const isOutOfStock = product.current_stock <= 0
        const isLowStock = product.current_stock > 0 && product.current_stock <= 5

        return (
          <button
            key={product.id}
            type="button"
            onClick={() => onSelectProduct(product)}
            disabled={isOutOfStock}
            className={`p-3 rounded-xl border text-start transition-all flex flex-col justify-between group relative ${
              isOutOfStock
                ? 'bg-muted/30 border-border opacity-50 cursor-not-allowed'
                : 'bg-card hover:bg-primary/5 hover:border-primary/40 border-border shadow-sm hover:shadow-md'
            }`}
          >
            <div className="space-y-1.5 w-full">
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-[11px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                  {product.sku}
                </span>
                {product.category_name && (
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded truncate max-w-[100px]">
                    {product.category_name}
                  </span>
                )}
              </div>

              <div className="font-semibold text-xs text-foreground line-clamp-2 leading-snug">
                {isArabic ? product.name_ar || product.name_en : product.name_en || product.name_ar}
              </div>

              {product.drawer_location && (
                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Layers className="w-3 h-3 text-muted-foreground/70" />
                  <span className="truncate">{product.drawer_location}</span>
                </div>
              )}
            </div>

            <div className="pt-2 mt-2 border-t border-border/60 flex items-center justify-between w-full">
              <div className="font-bold text-sm font-mono text-emerald-500">
                {formatCurrency(product.selling_price)}
              </div>

              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                    isOutOfStock
                      ? 'bg-destructive/15 text-destructive'
                      : isLowStock
                      ? 'bg-amber-500/15 text-amber-500'
                      : 'bg-emerald-500/10 text-emerald-500'
                  }`}
                >
                  {isOutOfStock
                    ? t('pos.outOfStock', 'نفذ')
                    : `${product.current_stock} ${product.unit_symbol || 'قطعة'}`}
                </span>

                <div className="w-6 h-6 rounded-lg bg-primary/10 group-hover:bg-primary text-primary group-hover:text-primary-foreground flex items-center justify-center transition-colors">
                  <Plus className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

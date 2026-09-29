/**
 * MAKERS POS — Top Products Component
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { Trophy } from 'lucide-react'
import { TopProductItem } from '../types'
import { useSettingsStore } from '@/stores/settingsStore'

interface TopProductsCardProps {
  products: TopProductItem[]
}

export function TopProductsCard({ products }: TopProductsCardProps) {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'ar'
  const currencySymbol = useSettingsStore(s => s.currencySymbol) || 'EGP'

  const formatCurrency = (val: number) => {
    return `${val.toLocaleString(isRtl ? 'ar-EG' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${currencySymbol}`
  }

  return (
    <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">{t('dashboard.topProducts')}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isRtl ? 'الأعلى مبيعاً حسب القيمة والكمية' : 'Highest by revenue and volume'}
            </p>
          </div>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="h-44 flex items-center justify-center text-muted-foreground text-xs">
          {t('dashboard.noData')}
        </div>
      ) : (
        <div className="divide-y divide-border/60 text-xs">
          {products.map((p, idx) => (
            <div key={p.productId || idx} className="py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-5 h-5 rounded-full bg-muted font-bold text-[10px] flex items-center justify-center text-muted-foreground shrink-0">
                  {idx + 1}
                </span>
                <div className="min-w-0 truncate">
                  <p className="font-bold text-foreground truncate">
                    {isRtl ? p.nameAr : p.nameEn || p.nameAr}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {p.sku} • {p.quantitySold} {isRtl ? 'قطعة مباعة' : 'sold'}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className="font-bold text-foreground">{formatCurrency(p.salesTotal)}</p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  +{formatCurrency(p.profit)} {isRtl ? 'ربح' : 'profit'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

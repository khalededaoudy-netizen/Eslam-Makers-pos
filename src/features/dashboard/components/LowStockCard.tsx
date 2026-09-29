/**
 * MAKERS POS — Low Stock Items List Component
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, MapPin, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { LowStockItem } from '../types'

interface LowStockCardProps {
  items: LowStockItem[]
}

export function LowStockCard({ items }: LowStockCardProps) {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'ar'

  return (
    <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-orange-500/10 text-orange-500 rounded-xl">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">{t('dashboard.lowStock')}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isRtl ? 'أصناف قاربت على النفاد وتحتاج إعادة طلب' : 'Items reaching reorder threshold'}
            </p>
          </div>
        </div>

        <Link
          to="/inventory"
          className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
        >
          <span>{t('dashboard.viewAll')}</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="h-44 flex items-center justify-center text-muted-foreground text-xs">
          {isRtl ? 'جميع الأصناف بمستويات مخزون آمنة' : 'All items are well stocked'}
        </div>
      ) : (
        <div className="divide-y divide-border/60 text-xs">
          {items.map(item => (
            <div key={item.id} className="py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-foreground truncate">
                  {isRtl ? item.nameAr : item.nameEn || item.nameAr}
                </p>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                  <span>{item.sku}</span>
                  {item.drawerLocation && (
                    <span className="flex items-center gap-0.5 text-primary">
                      <MapPin className="w-3 h-3" />
                      <span>{item.drawerLocation}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400 font-black text-xs border border-orange-500/20">
                  {item.currentStock} / {item.minStock} {item.unitSymbol}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

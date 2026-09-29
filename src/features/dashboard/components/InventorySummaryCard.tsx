/**
 * MAKERS POS — Inventory Summary Card
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { Package, AlertTriangle, XCircle, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { InventorySummary } from '../types'
import { useSettingsStore } from '@/stores/settingsStore'

interface InventorySummaryCardProps {
  summary: InventorySummary
}

export function InventorySummaryCard({ summary }: InventorySummaryCardProps) {
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
          <div className="p-2 bg-purple-500/10 text-purple-500 rounded-xl">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">{t('dashboard.inventorySummary')}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {summary.totalProducts} {isRtl ? 'صنف مسجل' : 'products'} • {summary.totalStockUnits} {isRtl ? 'وحدة' : 'units'}
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

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="p-3 rounded-xl border border-border bg-background/50 space-y-1">
          <span className="text-[11px] text-muted-foreground font-medium">
            {t('dashboard.inventoryCost')}
          </span>
          <p className="font-bold text-foreground text-sm">
            {formatCurrency(summary.inventoryCostValue)}
          </p>
        </div>

        <div className="p-3 rounded-xl border border-border bg-background/50 space-y-1">
          <span className="text-[11px] text-muted-foreground font-medium">
            {t('dashboard.inventoryRetail')}
          </span>
          <p className="font-bold text-foreground text-sm">
            {formatCurrency(summary.inventoryRetailValue)}
          </p>
        </div>
      </div>

      {/* Low / Out of stock indicators */}
      <div className="flex items-center gap-3 pt-1">
        <div className="flex-1 p-2.5 rounded-xl border border-orange-500/30 bg-orange-500/5 flex items-center gap-2 text-xs">
          <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />
          <div>
            <p className="text-[10px] text-muted-foreground">{t('dashboard.lowStock')}</p>
            <p className="font-bold text-orange-600 dark:text-orange-400">{summary.lowStockCount}</p>
          </div>
        </div>

        <div className="flex-1 p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/5 flex items-center gap-2 text-xs">
          <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <div>
            <p className="text-[10px] text-muted-foreground">{t('dashboard.outOfStock')}</p>
            <p className="font-bold text-rose-600 dark:text-rose-400">{summary.outOfStockCount}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

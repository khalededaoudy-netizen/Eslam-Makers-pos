/**
 * MAKERS POS — Recent Activity Feed Component
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Activity,
  ShoppingCart,
  RotateCcw,
  TrendingDown,
  ShoppingBag,
  Wallet,
} from 'lucide-react'
import { RecentActivityItem } from '../types'
import { useSettingsStore } from '@/stores/settingsStore'

interface RecentActivityCardProps {
  activities: RecentActivityItem[]
}

export function RecentActivityCard({ activities }: RecentActivityCardProps) {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'ar'
  const currencySymbol = useSettingsStore(s => s.currencySymbol) || 'EGP'

  const formatCurrency = (val: number) => {
    return `${val.toLocaleString(isRtl ? 'ar-EG' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${currencySymbol}`
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'sale':
        return (
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
            <ShoppingCart className="w-4 h-4" />
          </div>
        )
      case 'return':
        return (
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
            <RotateCcw className="w-4 h-4" />
          </div>
        )
      case 'expense':
        return (
          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
            <TrendingDown className="w-4 h-4" />
          </div>
        )
      case 'purchase':
        return (
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
            <ShoppingBag className="w-4 h-4" />
          </div>
        )
      default:
        return (
          <div className="p-2 rounded-xl bg-muted text-muted-foreground">
            <Wallet className="w-4 h-4" />
          </div>
        )
    }
  }

  const getActivityTypeLabel = (type: string) => {
    switch (type) {
      case 'sale':
        return isRtl ? 'فاتورة بيع' : 'Sale Invoice'
      case 'return':
        return isRtl ? 'مرتجع مبيعات' : 'Sales Return'
      case 'expense':
        return isRtl ? 'مصروف تشغيلي' : 'Expense'
      case 'purchase':
        return isRtl ? 'فاتورة شراء' : 'Purchase'
      default:
        return type
    }
  }

  return (
    <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 text-primary rounded-xl">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">{t('dashboard.recentActivity')}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isRtl ? 'سجل العمليات المباشر بالمتجر' : 'Live timeline of store events'}
            </p>
          </div>
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="h-44 flex items-center justify-center text-muted-foreground text-xs">
          {t('dashboard.noData')}
        </div>
      ) : (
        <div className="divide-y divide-border/60 text-xs">
          {activities.map(act => (
            <div key={`${act.type}-${act.id}`} className="py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {getActivityIcon(act.type)}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{act.referenceNumber}</span>
                    <span className="px-1.5 py-0.2 text-[10px] rounded bg-muted text-muted-foreground font-medium">
                      {getActivityTypeLabel(act.type)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {act.userName ? `${act.userName} • ` : ''}
                    {new Date(act.date).toLocaleTimeString(isRtl ? 'ar-EG' : 'en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span
                  className={`font-bold text-xs ${
                    act.type === 'return' || act.type === 'expense'
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {act.type === 'return' || act.type === 'expense' ? '-' : '+'}
                  {formatCurrency(act.amount)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

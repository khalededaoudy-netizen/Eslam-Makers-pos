/**
 * MAKERS POS — Enhanced Recent Activity Feed Component
 * Displays 10 latest events: Sales, Customers added, and Inventory movements.
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Activity,
  ShoppingCart,
  RotateCcw,
  TrendingDown,
  ShoppingBag,
  UserPlus,
  PackageCheck,
  PackageMinus,
  Wallet,
} from 'lucide-react'
import { RecentActivityItem } from '../types'
import { useSettingsStore } from '@/stores/settingsStore'

interface RecentActivityCardProps {
  activities: RecentActivityItem[]
}

export function RecentActivityCard({ activities }: RecentActivityCardProps) {
  const { i18n } = useTranslation()
  const isArabic = i18n.language !== 'en'
  const currencySymbol = useSettingsStore(s => s.currencySymbol) || 'EGP'

  const formatCurrency = (val: number) => {
    return `${val.toLocaleString(isArabic ? 'ar-EG' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${currencySymbol}`
  }

  const formatRelativeTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime()
      const diffMins = Math.floor(diffMs / (1000 * 60))
      const diffHours = Math.floor(diffMins / 60)
      const diffDays = Math.floor(diffHours / 24)

      if (diffMins < 1) return isArabic ? 'الآن' : 'Just now'
      if (diffMins < 60) return isArabic ? `منذ ${diffMins} دقيقة` : `${diffMins}m ago`
      if (diffHours < 24) return isArabic ? `منذ ${diffHours} ساعة` : `${diffHours}h ago`
      return isArabic ? `منذ ${diffDays} يوم` : `${diffDays}d ago`
    } catch {
      return isoString.slice(0, 10)
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'sale':
        return (
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
            <ShoppingCart className="w-4 h-4" />
          </div>
        )
      case 'customer':
        return (
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
            <UserPlus className="w-4 h-4" />
          </div>
        )
      case 'stock_in':
        return (
          <div className="p-2 rounded-xl bg-teal-500/10 text-teal-500">
            <PackageCheck className="w-4 h-4" />
          </div>
        )
      case 'stock_out':
        return (
          <div className="p-2 rounded-xl bg-orange-500/10 text-orange-500">
            <PackageMinus className="w-4 h-4" />
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

  const getActivityBadge = (type: string) => {
    switch (type) {
      case 'sale':
        return isArabic ? 'مبيعات' : 'Sale'
      case 'customer':
        return isArabic ? 'عميل جديد' : 'New Customer'
      case 'stock_in':
        return isArabic ? 'إيداع مخزني' : 'Stock In'
      case 'stock_out':
        return isArabic ? 'صرف مخزني' : 'Stock Out'
      case 'return':
        return isArabic ? 'مرتجع' : 'Return'
      case 'expense':
        return isArabic ? 'مصروف' : 'Expense'
      case 'purchase':
        return isArabic ? 'شراء' : 'Purchase'
      default:
        return type
    }
  }

  return (
    <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 text-primary rounded-xl">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">
              {isArabic ? 'النشاط الأخير بالمتجر' : 'Recent Activity Feed'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isArabic ? 'سجل العمليات والعملاء وحركات المخزون الأخيرة' : 'Latest sales, added customers, and stock adjustments'}
            </p>
          </div>
        </div>
      </div>

      {/* Feed List */}
      {activities.length === 0 ? (
        <div className="h-52 flex items-center justify-center text-muted-foreground text-xs font-semibold">
          {isArabic ? 'لا يوجد نشاط مسجل مؤخراً' : 'No activity logged yet'}
        </div>
      ) : (
        <div className="divide-y divide-border/60 max-h-80 overflow-y-auto pr-1 text-xs">
          {activities.map(act => (
            <div key={act.id} className="py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {getActivityIcon(act.type)}
                <div className="min-w-0 truncate">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-foreground truncate">
                      {act.referenceNumber}
                    </span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                      {getActivityBadge(act.type)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {act.description}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                {act.amount != null && (
                  <p className="font-bold text-foreground">
                    {formatCurrency(act.amount)}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground">
                  {formatRelativeTime(act.date)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

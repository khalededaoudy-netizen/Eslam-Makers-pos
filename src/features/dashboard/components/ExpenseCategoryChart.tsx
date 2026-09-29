/**
 * MAKERS POS — Expense Category Breakdown Component
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { Tag } from 'lucide-react'
import { ExpenseCategoryMetric } from '../types'
import { useSettingsStore } from '@/stores/settingsStore'

interface ExpenseCategoryChartProps {
  categories: ExpenseCategoryMetric[]
}

export function ExpenseCategoryChart({ categories }: ExpenseCategoryChartProps) {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'ar'
  const currencySymbol = useSettingsStore(s => s.currencySymbol) || 'EGP'

  const formatCurrency = (val: number) => {
    return `${val.toLocaleString(isRtl ? 'ar-EG' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${currencySymbol}`
  }

  const totalAmount = categories.reduce((acc, c) => acc + c.amount, 0)

  return (
    <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-foreground">{t('dashboard.expenseCategories')}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatCurrency(totalAmount)}
          </p>
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-muted-foreground text-xs">
          {t('dashboard.noData')}
        </div>
      ) : (
        <div className="space-y-3.5 pt-1">
          {categories.map((cat, idx) => {
            const colors = ['bg-rose-500', 'bg-amber-500', 'bg-purple-500', 'bg-sky-500', 'bg-emerald-500', 'bg-indigo-500']
            const barColor = colors[idx % colors.length]

            return (
              <div key={cat.categoryId} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="font-semibold text-foreground">
                      {isRtl ? cat.nameAr : cat.nameEn}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-bold">
                    <span className="text-foreground">{formatCurrency(cat.amount)}</span>
                    <span className="text-muted-foreground text-[11px]">({cat.percentage}%)</span>
                  </div>
                </div>
                {/* Progress Bar */}
                <div className="w-full bg-muted/60 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                    style={{ width: `${Math.max(3, cat.percentage)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

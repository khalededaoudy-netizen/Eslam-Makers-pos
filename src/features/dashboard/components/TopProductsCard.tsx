/**
 * MAKERS POS — Top 5 Products Bar Chart & List Component
 */

import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trophy, BarChart2, List } from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { TopProductItem } from '../types'
import { useSettingsStore } from '@/stores/settingsStore'

interface TopProductsCardProps {
  products: TopProductItem[]
}

export function TopProductsCard({ products }: TopProductsCardProps) {
  const { i18n } = useTranslation()
  const isArabic = i18n.language !== 'en'
  const currencySymbol = useSettingsStore(s => s.currencySymbol) || 'EGP'
  const [viewMode, setViewMode] = useState<'chart' | 'list'>('chart')

  const formatCurrency = (val: number) => {
    return `${val.toLocaleString(isArabic ? 'ar-EG' : 'en-US')} ${currencySymbol}`
  }

  const chartData = products.map(p => ({
    name: (isArabic ? p.nameAr : p.nameEn || p.nameAr).slice(0, 16),
    fullName: isArabic ? p.nameAr : p.nameEn || p.nameAr,
    salesTotal: p.salesTotal,
    quantitySold: p.quantitySold,
    profit: p.profit,
  }))

  return (
    <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">
              {isArabic ? 'أعلى 5 منتجات مبيعاً' : 'Top 5 Selling Products'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isArabic ? 'الأعلى تحقيقاً للإيرادات والكميات المباعة' : 'Ranked by sales volume and total revenue'}
            </p>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center p-1 rounded-xl bg-muted/50 border border-border">
          <button
            type="button"
            onClick={() => setViewMode('chart')}
            className={`p-1.5 rounded-lg transition-all ${
              viewMode === 'chart' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
            title={isArabic ? 'رسم بياني' : 'Chart'}
          >
            <BarChart2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-lg transition-all ${
              viewMode === 'list' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
            title={isArabic ? 'قائمة' : 'List'}
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-muted-foreground text-xs font-semibold">
          {isArabic ? 'لا توجد مبيعات في الفترة المحددة' : 'No product sales recorded in period'}
        </div>
      ) : viewMode === 'chart' ? (
        <div className="h-56 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(150, 150, 150, 0.12)" vertical={false} />
              <XAxis dataKey="name" stroke="#888" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#888" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `${v}`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(23, 23, 23, 0.95)',
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '12px',
                }}
                formatter={(val: any, name: any, item: any) => [
                  `${formatCurrency(Number(val) || 0)} (${item.payload.quantitySold} ${isArabic ? 'قطعة' : 'units'})`,
                  isArabic ? 'المبيعات' : 'Sales',
                ]}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
              />
              <Bar dataKey="salesTotal" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="divide-y divide-border/60 text-xs">
          {products.map((p, idx) => (
            <div key={p.productId || idx} className="py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-600 font-bold text-[10px] flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
                <div className="min-w-0 truncate">
                  <p className="font-bold text-foreground truncate">
                    {isArabic ? p.nameAr : p.nameEn || p.nameAr}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {p.sku} • {p.quantitySold} {isArabic ? 'قطعة مباعة' : 'sold'}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className="font-bold text-foreground">{formatCurrency(p.salesTotal)}</p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  +{formatCurrency(p.profit)} {isArabic ? 'ربح' : 'profit'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

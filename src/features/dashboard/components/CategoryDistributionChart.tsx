/**
 * MAKERS POS — Category Distribution Bar Chart Component
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { FolderTree } from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { CategoryPerformanceItem } from '../types'
import { useSettingsStore } from '@/stores/settingsStore'

interface CategoryDistributionChartProps {
  categories: CategoryPerformanceItem[]
}

export function CategoryDistributionChart({ categories }: CategoryDistributionChartProps) {
  const { i18n } = useTranslation()
  const isArabic = i18n.language !== 'en'
  const currencySymbol = useSettingsStore(s => s.currencySymbol) || 'EGP'

  const formatCurrency = (val: number) => {
    return `${val.toLocaleString(isArabic ? 'ar-EG' : 'en-US')} ${currencySymbol}`
  }

  const chartData = categories.slice(0, 5).map(c => ({
    name: (isArabic ? c.nameAr : c.nameEn || c.nameAr).slice(0, 14),
    fullName: isArabic ? c.nameAr : c.nameEn || c.nameAr,
    salesTotal: c.salesTotal,
    quantitySold: c.quantitySold,
  }))

  return (
    <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
          <FolderTree className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-foreground">
            {isArabic ? 'توزيع المبيعات حسب التصنيفات' : 'Category Sales Distribution'}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isArabic ? 'أكثر الفئات إنتاجية وحصتها من الإيرادات' : 'Top revenue generating product categories'}
          </p>
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-muted-foreground text-xs font-semibold">
          {isArabic ? 'لا توجد بيانات للفئات' : 'No category data recorded'}
        </div>
      ) : (
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
              <Bar dataKey="salesTotal" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

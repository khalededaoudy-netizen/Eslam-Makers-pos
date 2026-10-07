/**
 * MAKERS POS — Hourly Sales Heatmap / Distribution Component
 * Analyzes store rush hours from 08:00 to 23:00.
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { Clock } from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { HourlySalesPoint } from '../types'
import { useSettingsStore } from '@/stores/settingsStore'

interface HourlySalesChartProps {
  hourlySales: HourlySalesPoint[]
}

export function HourlySalesChart({ hourlySales }: HourlySalesChartProps) {
  const { i18n } = useTranslation()
  const isArabic = i18n.language !== 'en'
  const currencySymbol = useSettingsStore(s => s.currencySymbol) || 'EGP'

  const formatCurrency = (val: number) => {
    return `${val.toLocaleString(isArabic ? 'ar-EG' : 'en-US')} ${currencySymbol}`
  }

  const hasSales = hourlySales.some(h => h.sales > 0 || h.count > 0)

  return (
    <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-teal-500/10 text-teal-500 rounded-xl">
          <Clock className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-foreground">
            {isArabic ? 'أوقات الذروة والمبيعات بالساعة' : 'Hourly Sales Distribution (Rush Hours)'}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isArabic ? 'توزيع المبيعات على ساعات العمل لتحديد أوقات الذروة' : 'Revenue and customer traffic spread throughout the day'}
          </p>
        </div>
      </div>

      {!hasSales ? (
        <div className="h-48 flex items-center justify-center text-muted-foreground text-xs font-semibold">
          {isArabic ? 'لا توجد مبيعات مسجلة في ساعات اليوم' : 'No sales registered across hourly buckets'}
        </div>
      ) : (
        <div className="h-56 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourlySales} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(150, 150, 150, 0.12)" vertical={false} />
              <XAxis dataKey="label" stroke="#888" fontSize={9} tickLine={false} axisLine={false} />
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
                  `${formatCurrency(Number(val) || 0)} (${item.payload.count} ${isArabic ? 'فاتورة' : 'bills'})`,
                  isArabic ? 'المبيعات' : 'Sales',
                ]}
              />
              <Bar dataKey="sales" fill="#14b8a6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

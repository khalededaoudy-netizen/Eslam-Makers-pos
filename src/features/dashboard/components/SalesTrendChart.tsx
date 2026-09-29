/**
 * MAKERS POS — Sales & Net Sales Trend Chart
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { SalesTrendPoint } from '../types'
import { useSettingsStore } from '@/stores/settingsStore'

interface SalesTrendChartProps {
  data: SalesTrendPoint[]
}

export function SalesTrendChart({ data }: SalesTrendChartProps) {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'ar'
  const currencySymbol = useSettingsStore(s => s.currencySymbol) || 'EGP'

  if (!data || data.length === 0) {
    return (
      <div className="p-6 rounded-2xl border border-border bg-card shadow-sm h-72 flex items-center justify-center text-muted-foreground text-xs">
        {t('dashboard.noData')}
      </div>
    )
  }

  const formatCurrencyValue = (val: number) => {
    return `${val.toLocaleString(isRtl ? 'ar-EG' : 'en-US')} ${currencySymbol}`
  }

  return (
    <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-foreground">{t('dashboard.salesTrend')}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isRtl ? 'تطور المبيعات وصافي الإيرادات والأرباح' : 'Sales, Net Revenue and Profit progression'}
          </p>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(150, 150, 150, 0.15)" vertical={false} />
            <XAxis
              dataKey="label"
              stroke="#888888"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#888888"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(23, 23, 23, 0.95)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                color: '#fff',
                fontSize: '12px',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
              }}
              formatter={(value: any, name: any) => [
                formatCurrencyValue(Number(value) || 0),
                name === 'sales'
                  ? t('dashboard.salesLegend')
                  : name === 'netSales'
                  ? t('dashboard.netSalesLegend')
                  : name === 'profit'
                  ? t('dashboard.profitLegend')
                  : name === 'returns'
                  ? t('dashboard.returnsLegend')
                  : name,
              ]}
            />
            <Legend
              wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
              formatter={(value) =>
                value === 'sales'
                  ? t('dashboard.salesLegend')
                  : value === 'netSales'
                  ? t('dashboard.netSalesLegend')
                  : value === 'profit'
                  ? t('dashboard.profitLegend')
                  : value
              }
            />
            <Area
              type="monotone"
              dataKey="sales"
              stroke="#3b82f6"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#salesGrad)"
            />
            <Area
              type="monotone"
              dataKey="netSales"
              stroke="#8b5cf6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#netGrad)"
            />
            <Area
              type="monotone"
              dataKey="profit"
              stroke="#10b981"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#profitGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/**
 * MAKERS POS — Payment Methods Donut Chart Component
 * Donut chart with Recharts Pie, center summary, and legend breakdown.
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { DollarSign, Smartphone, CreditCard, Wallet, HelpCircle } from 'lucide-react'
import { PaymentMethodMetric } from '../types'
import { useSettingsStore } from '@/stores/settingsStore'

interface PaymentMethodChartProps {
  methods: PaymentMethodMetric[]
}

const METHOD_COLORS: Record<string, string> = {
  cash: '#10b981', // Emerald
  instapay: '#8b5cf6', // Violet
  vodafone_cash: '#ef4444', // Red
  card: '#3b82f6', // Blue
  bank_transfer: '#0ea5e9', // Sky
  other: '#64748b', // Slate
}

export function PaymentMethodChart({ methods }: PaymentMethodChartProps) {
  const { i18n } = useTranslation()
  const isArabic = i18n.language !== 'en'
  const currencySymbol = useSettingsStore(s => s.currencySymbol) || 'EGP'

  const formatCurrency = (val: number) => {
    return `${val.toLocaleString(isArabic ? 'ar-EG' : 'en-US')} ${currencySymbol}`
  }

  const totalAmount = methods.reduce((acc, m) => acc + m.amount, 0)
  const totalCount = methods.reduce((acc, m) => acc + m.count, 0)

  const chartData = methods.map(m => ({
    name: isArabic ? m.labelAr : m.labelEn,
    value: m.amount,
    count: m.count,
    method: m.method,
    percentage: m.percentage,
    color: METHOD_COLORS[m.method] || '#94a3b8',
  }))

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'cash':
        return <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
      case 'instapay':
        return <Smartphone className="w-3.5 h-3.5 text-violet-500" />
      case 'vodafone_cash':
        return <Smartphone className="w-3.5 h-3.5 text-rose-500" />
      case 'card':
        return <CreditCard className="w-3.5 h-3.5 text-blue-500" />
      default:
        return <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
    }
  }

  return (
    <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4 flex flex-col justify-between">
      {/* Header */}
      <div>
        <h2 className="text-sm font-bold text-foreground">
          {isArabic ? 'طرق الدفع والتحصيل' : 'Payment Methods'}
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isArabic ? 'توزيع المبيعات النقدية والإلكترونية' : 'Cash vs Electronic transactions distribution'}
        </p>
      </div>

      {methods.length === 0 ? (
        <div className="h-60 flex items-center justify-center text-muted-foreground text-xs font-semibold">
          {isArabic ? 'لا توجد مدفوعات مسجلة' : 'No payments recorded'}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Donut Chart with Center Total */}
          <div className="relative h-44 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(23, 23, 23, 0.95)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                  formatter={(val: any) => [formatCurrency(Number(val) || 0), isArabic ? 'الإجمالي' : 'Total']}
                />
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={74}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            {/* Center Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] font-bold text-muted-foreground">
                {isArabic ? 'إجمالي التحصيل' : 'Total Collected'}
              </span>
              <span className="text-xs font-black text-foreground">
                {formatCurrency(totalAmount)}
              </span>
              <span className="text-[9px] text-muted-foreground">
                {totalCount} {isArabic ? 'معاملة' : 'txns'}
              </span>
            </div>
          </div>

          {/* Breakdown List */}
          <div className="space-y-2 pt-1 border-t border-border/50">
            {methods.map(m => (
              <div key={m.method} className="flex items-center justify-between text-xs py-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: METHOD_COLORS[m.method] || '#94a3b8' }}
                  />
                  {getMethodIcon(m.method)}
                  <span className="font-semibold text-foreground truncate">
                    {isArabic ? m.labelAr : m.labelEn}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-bold text-foreground">{formatCurrency(m.amount)}</span>
                  <span className="text-[10px] text-muted-foreground font-semibold">({m.percentage}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

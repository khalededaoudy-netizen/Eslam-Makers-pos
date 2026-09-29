/**
 * MAKERS POS — Payment Methods Breakdown Component
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { CreditCard, DollarSign, Smartphone, Landmark, HelpCircle } from 'lucide-react'
import { PaymentMethodMetric } from '../types'
import { useSettingsStore } from '@/stores/settingsStore'

interface PaymentMethodChartProps {
  methods: PaymentMethodMetric[]
}

export function PaymentMethodChart({ methods }: PaymentMethodChartProps) {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'ar'
  const currencySymbol = useSettingsStore(s => s.currencySymbol) || 'EGP'

  const formatCurrency = (val: number) => {
    return `${val.toLocaleString(isRtl ? 'ar-EG' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${currencySymbol}`
  }

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'cash':
        return <DollarSign className="w-4 h-4 text-emerald-500" />
      case 'instapay':
        return <Smartphone className="w-4 h-4 text-violet-500" />
      case 'wallet':
      case 'vodafone_cash':
        return <Smartphone className="w-4 h-4 text-rose-500" />
      default:
        return <HelpCircle className="w-4 h-4 text-muted-foreground" />
    }
  }

  const totalAmount = methods.reduce((acc, m) => acc + m.amount, 0)

  return (
    <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-foreground">{t('dashboard.paymentMethods')}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatCurrency(totalAmount)}
          </p>
        </div>
      </div>

      {methods.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-muted-foreground text-xs">
          {t('dashboard.noData')}
        </div>
      ) : (
        <div className="space-y-3.5 pt-1">
          {methods.map(m => (
            <div key={m.method} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {getMethodIcon(m.method)}
                  <span className="font-semibold text-foreground">
                    {isRtl ? m.labelAr : m.labelEn}
                  </span>
                  <span className="text-[10px] text-muted-foreground">({m.count} فاتورة)</span>
                </div>
                <div className="flex items-center gap-2 font-bold">
                  <span className="text-foreground">{formatCurrency(m.amount)}</span>
                  <span className="text-muted-foreground text-[11px]">({m.percentage}%)</span>
                </div>
              </div>
              {/* Progress Bar */}
              <div className="w-full bg-muted/60 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    (m.method as string) === 'cash'
                      ? 'bg-emerald-500'
                      : (m.method as string) === 'instapay'
                      ? 'bg-violet-500'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.max(3, m.percentage)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

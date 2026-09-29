/**
 * MAKERS POS — Cash Register & Shift Status Card
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { Wallet, Clock, ArrowUpRight, ArrowDownRight, TrendingDown, DollarSign } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Shift, ShiftReconciliation } from '@/features/cash-register/types'
import { useSettingsStore } from '@/stores/settingsStore'

interface CashRegisterCardProps {
  activeShift?: Shift | null
  reconciliation?: ShiftReconciliation | null
}

export function CashRegisterCard({ activeShift, reconciliation }: CashRegisterCardProps) {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'ar'
  const currencySymbol = useSettingsStore(s => s.currencySymbol) || 'EGP'

  const formatCurrency = (val: number) => {
    return `${val.toLocaleString(isRtl ? 'ar-EG' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${currencySymbol}`
  }

  if (!activeShift) {
    return (
      <div className="p-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <Wallet className="w-5 h-5" />
            <h2 className="text-sm font-bold">{t('dashboard.cashRegister')}</h2>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[11px] font-bold">
            {t('dashboard.noActiveShift')}
          </span>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          {t('dashboard.noShiftWarning')}
        </p>

        <Link
          to="/cash-register"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:bg-primary/90 transition-all"
        >
          <span>{t('dashboard.openShift')}</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    )
  }

  const expectedCash = reconciliation ? reconciliation.expectedPhysicalCash : Number(activeShift.opening_balance) || 0
  const totalCashSales = reconciliation ? reconciliation.totalCashSales : Number(activeShift.cash_sales) || 0
  const totalCashExpenses = Number(activeShift.cash_expenses) || 0
  const openingBal = Number(activeShift.opening_balance) || 0

  return (
    <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">{t('dashboard.currentShift')}</h2>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3" />
              <span>
                {t('dashboard.openedAt')}: {new Date(activeShift.opened_at).toLocaleTimeString(isRtl ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </p>
          </div>
        </div>

        <Link
          to="/cash-register"
          className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
        >
          <span>{t('dashboard.viewAll')}</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Expected Physical Drawer Cash Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 flex items-center justify-between">
        <div>
          <p className="text-[11px] text-muted-foreground font-semibold">
            {t('dashboard.expectedCash')}
          </p>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
            {formatCurrency(expectedCash)}
          </p>
        </div>
        <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-600">
          <DollarSign className="w-5 h-5" />
        </div>
      </div>

      {/* Quick Shift Cash Movements Grid */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="p-2.5 rounded-xl border border-border bg-background/50 space-y-0.5">
          <span className="text-[10px] text-muted-foreground font-medium">{t('dashboard.openingBalance')}</span>
          <p className="font-bold text-foreground">{formatCurrency(openingBal)}</p>
        </div>

        <div className="p-2.5 rounded-xl border border-border bg-background/50 space-y-0.5">
          <span className="text-[10px] text-muted-foreground font-medium">{t('dashboard.cashSales')}</span>
          <p className="font-bold text-emerald-600 dark:text-emerald-400">+{formatCurrency(totalCashSales)}</p>
        </div>

        <div className="p-2.5 rounded-xl border border-border bg-background/50 space-y-0.5">
          <span className="text-[10px] text-muted-foreground font-medium">{t('dashboard.cashExpenses')}</span>
          <p className="font-bold text-rose-600 dark:text-rose-400">-{formatCurrency(totalCashExpenses)}</p>
        </div>
      </div>
    </div>
  )
}

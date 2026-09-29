import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  TrendingUp,
  DollarSign,
  RotateCcw,
  Receipt,
  ShoppingBag,
  Package,
  Users,
  Building2,
  Percent,
  ShoppingCart,
} from 'lucide-react'
import { ReportOverviewKPIs } from '../types'
import { ReportKpiGrid, KpiCardItem } from '../components/ReportKpiGrid'

interface OverviewReportViewProps {
  kpis: ReportOverviewKPIs | null
  formatCurrency: (val: number) => string
}

export function OverviewReportView({ kpis, formatCurrency }: OverviewReportViewProps) {
  const { t } = useTranslation()

  if (!kpis) return null

  const items: KpiCardItem[] = [
    {
      id: 'net_sales',
      label: t('reports.netSales'),
      value: formatCurrency(kpis.netSales),
      subValue: `${kpis.salesCount} ${t('reports.salesCount')}`,
      icon: TrendingUp,
      color: 'primary',
    },
    {
      id: 'gross_profit',
      label: t('reports.grossProfit'),
      value: formatCurrency(kpis.grossProfit),
      subValue: `${kpis.profitMarginPct}% ${t('reports.profitMargin')}`,
      icon: DollarSign,
      color: 'emerald',
    },
    {
      id: 'total_returns',
      label: t('reports.returnsTotal'),
      value: formatCurrency(kpis.totalReturns),
      subValue: `${kpis.returnsCount} ${t('reports.returns')}`,
      icon: RotateCcw,
      color: 'rose',
    },
    {
      id: 'total_expenses',
      label: t('reports.expensesTotal'),
      value: formatCurrency(kpis.totalExpenses),
      subValue: `${kpis.expensesCount} ${t('reports.expenses')}`,
      icon: Receipt,
      color: 'amber',
    },
    {
      id: 'total_purchases',
      label: t('reports.purchasesTotal'),
      value: formatCurrency(kpis.totalPurchases),
      subValue: `${kpis.purchasesCount} ${t('reports.purchases')}`,
      icon: ShoppingBag,
      color: 'indigo',
    },
    {
      id: 'inventory_value',
      label: t('reports.inventoryCostValue'),
      value: formatCurrency(kpis.inventoryValue),
      icon: Package,
      color: 'cyan',
    },
    {
      id: 'active_customers',
      label: t('reports.customers'),
      value: kpis.activeCustomers,
      icon: Users,
      color: 'primary',
    },
    {
      id: 'active_suppliers',
      label: t('reports.suppliers'),
      value: kpis.activeSuppliers,
      icon: Building2,
      color: 'emerald',
    },
  ]

  return (
    <div className="space-y-6">
      <ReportKpiGrid items={items} />

      {/* Quick Summary Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-foreground">
            {t('reports.subtitle')}
          </h3>
          <p className="text-xs text-muted-foreground">
            جميع الأرقام والبيانات المعروضة مستخرجة مباشرة من قاعدة البيانات المعتمدة في الوقت الفعلي.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono font-bold bg-background/80 px-4 py-2 rounded-xl border border-border shadow-inner">
          <span className="text-muted-foreground">صافي العائد:</span>
          <span className="text-emerald-500 text-sm">
            {formatCurrency(kpis.netSales - kpis.totalExpenses)}
          </span>
        </div>
      </div>
    </div>
  )
}

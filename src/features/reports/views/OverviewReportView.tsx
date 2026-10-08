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

      {/* Overview Breakdown Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border bg-muted/30">
          <h3 className="font-bold text-sm text-foreground">جدول ملخص المؤشرات المالية والتشغيلية</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-muted/50 text-muted-foreground text-xs font-semibold">
              <tr>
                <th className="p-3 border-b border-border">المؤشر</th>
                <th className="p-3 border-b border-border">القيمة المالية</th>
                <th className="p-3 border-b border-border">بيانات إضافية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr className="hover:bg-muted/20">
                <td className="p-3 font-medium text-foreground">{t('reports.netSales')}</td>
                <td className="p-3 font-bold text-primary">{formatCurrency(kpis.netSales)}</td>
                <td className="p-3 text-muted-foreground">{kpis.salesCount} فاتورة بيع</td>
              </tr>
              <tr className="hover:bg-muted/20">
                <td className="p-3 font-medium text-foreground">{t('reports.grossProfit')}</td>
                <td className="p-3 font-bold text-emerald-600">{formatCurrency(kpis.grossProfit)}</td>
                <td className="p-3 text-muted-foreground">هامش ربح {kpis.profitMarginPct}%</td>
              </tr>
              <tr className="hover:bg-muted/20">
                <td className="p-3 font-medium text-foreground">{t('reports.returnsTotal')}</td>
                <td className="p-3 font-bold text-rose-600">{formatCurrency(kpis.totalReturns)}</td>
                <td className="p-3 text-muted-foreground">{kpis.returnsCount} مرتجع</td>
              </tr>
              <tr className="hover:bg-muted/20">
                <td className="p-3 font-medium text-foreground">{t('reports.expensesTotal')}</td>
                <td className="p-3 font-bold text-amber-600">{formatCurrency(kpis.totalExpenses)}</td>
                <td className="p-3 text-muted-foreground">{kpis.expensesCount} عملية صرف</td>
              </tr>
              <tr className="hover:bg-muted/20">
                <td className="p-3 font-medium text-foreground">{t('reports.purchasesTotal')}</td>
                <td className="p-3 font-bold text-indigo-600">{formatCurrency(kpis.totalPurchases)}</td>
                <td className="p-3 text-muted-foreground">{kpis.purchasesCount} فاتورة توريد</td>
              </tr>
              <tr className="hover:bg-muted/20">
                <td className="p-3 font-medium text-foreground">{t('reports.inventoryCostValue')}</td>
                <td className="p-3 font-bold text-cyan-600">{formatCurrency(kpis.inventoryValue)}</td>
                <td className="p-3 text-muted-foreground">تقييم بالتكلفة الفعلية</td>
              </tr>
              <tr className="hover:bg-muted/20">
                <td className="p-3 font-medium text-foreground">صافي العائد التشغيلي (المبيعات - المصروفات)</td>
                <td className="p-3 font-bold text-emerald-600">{formatCurrency(kpis.netSales - kpis.totalExpenses)}</td>
                <td className="p-3 text-muted-foreground">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

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

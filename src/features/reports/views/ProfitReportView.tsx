import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DollarSign,
  TrendingUp,
  Percent,
  Layers,
  Package,
} from 'lucide-react'
import { ReportDateRange, ProfitSummaryReport } from '../types'
import { reportsService } from '../reportsService'
import { ReportKpiGrid, KpiCardItem } from '../components/ReportKpiGrid'
import { ReportTable, ColumnDef } from '../components/ReportTable'

interface ProfitReportViewProps {
  dateRange: ReportDateRange
  formatCurrency: (val: number) => string
}

export function ProfitReportView({ dateRange, formatCurrency }: ProfitReportViewProps) {
  const { t } = useTranslation()
  const [data, setData] = useState<ProfitSummaryReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [subTab, setSubTab] = useState<'byProduct' | 'byCategory' | 'byDate'>('byProduct')

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await reportsService.getProfitReport(dateRange)
      setData(res)
    } catch (err) {
      console.error('Failed to load profit report:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [dateRange])

  const kpis: KpiCardItem[] = data
    ? [
        {
          id: 'net_sales',
          label: t('reports.netSales'),
          value: formatCurrency(data.netSales),
          icon: TrendingUp,
          color: 'primary',
        },
        {
          id: 'cogs',
          label: t('reports.cogs'),
          value: formatCurrency(data.cogs),
          icon: Package,
          color: 'indigo',
        },
        {
          id: 'gross_profit',
          label: t('reports.grossProfit'),
          value: formatCurrency(data.grossProfit),
          icon: DollarSign,
          color: 'emerald',
        },
        {
          id: 'profit_margin',
          label: t('reports.profitMargin'),
          value: `${data.profitMarginPct}%`,
          icon: Percent,
          color: 'amber',
        },
      ]
    : []

  const productColumns: ColumnDef<any>[] = [
    {
      key: 'nameAr',
      header: 'المنتج',
      render: r => (
        <div>
          <span className="font-bold text-foreground block">{r.nameAr}</span>
          <span className="text-[10px] text-muted-foreground font-mono">{r.sku}</span>
        </div>
      ),
    },
    {
      key: 'quantitySold',
      header: 'الكمية المباعة',
      align: 'center',
      render: r => <span className="font-mono font-bold">{r.quantitySold}</span>,
    },
    {
      key: 'revenue',
      header: 'الإيراد',
      align: 'right',
      render: r => <span className="font-mono">{formatCurrency(r.revenue)}</span>,
    },
    {
      key: 'cost',
      header: 'التكلفة',
      align: 'right',
      render: r => <span className="font-mono text-muted-foreground">{formatCurrency(r.cost)}</span>,
    },
    {
      key: 'profit',
      header: 'الربح',
      align: 'right',
      render: r => <span className="font-mono font-bold text-emerald-500">{formatCurrency(r.profit)}</span>,
    },
    {
      key: 'marginPct',
      header: 'هامش الربح',
      align: 'center',
      render: r => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500">
          {r.marginPct}%
        </span>
      ),
    },
  ]

  const categoryColumns: ColumnDef<any>[] = [
    {
      key: 'nameAr',
      header: 'الفئة',
      render: r => <span className="font-bold text-foreground">{r.nameAr}</span>,
    },
    {
      key: 'quantitySold',
      header: 'الكمية المباعة',
      align: 'center',
      render: r => <span className="font-mono font-bold">{r.quantitySold}</span>,
    },
    {
      key: 'revenue',
      header: 'الإيراد',
      align: 'right',
      render: r => <span className="font-mono">{formatCurrency(r.revenue)}</span>,
    },
    {
      key: 'cost',
      header: 'التكلفة',
      align: 'right',
      render: r => <span className="font-mono text-muted-foreground">{formatCurrency(r.cost)}</span>,
    },
    {
      key: 'profit',
      header: 'الربح',
      align: 'right',
      render: r => <span className="font-mono font-bold text-emerald-500">{formatCurrency(r.profit)}</span>,
    },
    {
      key: 'marginPct',
      header: 'هامش الربح',
      align: 'center',
      render: r => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500">
          {r.marginPct}%
        </span>
      ),
    },
  ]

  const dateColumns: ColumnDef<any>[] = [
    {
      key: 'date',
      header: 'التاريخ',
      render: r => <span className="font-mono font-bold text-primary">{r.date}</span>,
    },
    {
      key: 'revenue',
      header: 'الإيراد',
      align: 'right',
      render: r => <span className="font-mono">{formatCurrency(r.revenue)}</span>,
    },
    {
      key: 'cost',
      header: 'التكلفة',
      align: 'right',
      render: r => <span className="font-mono text-muted-foreground">{formatCurrency(r.cost)}</span>,
    },
    {
      key: 'profit',
      header: 'الربح',
      align: 'right',
      render: r => <span className="font-mono font-bold text-emerald-500">{formatCurrency(r.profit)}</span>,
    },
    {
      key: 'marginPct',
      header: 'هامش الربح',
      align: 'center',
      render: r => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500">
          {r.marginPct}%
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {data && <ReportKpiGrid items={kpis} />}

      {/* Sub tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          onClick={() => setSubTab('byProduct')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            subTab === 'byProduct'
              ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
              : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          أرباح المنتجات
        </button>
        <button
          onClick={() => setSubTab('byCategory')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            subTab === 'byCategory'
              ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
              : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          أرباح الفئات
        </button>
        <button
          onClick={() => setSubTab('byDate')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            subTab === 'byDate'
              ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
              : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          الأرباح اليومية
        </button>
      </div>

      {subTab === 'byProduct' && (
        <ReportTable
          columns={productColumns}
          data={data?.byProduct || []}
          loading={loading}
          emptyMessage="لا توجد مبيعات لحساب أرباح المنتجات في الفترة المحددة"
        />
      )}

      {subTab === 'byCategory' && (
        <ReportTable
          columns={categoryColumns}
          data={data?.byCategory || []}
          loading={loading}
          emptyMessage="لا توجد مبيعات لحساب أرباح الفئات في الفترة المحددة"
        />
      )}

      {subTab === 'byDate' && (
        <ReportTable
          columns={dateColumns}
          data={data?.byDate || []}
          loading={loading}
          emptyMessage="لا توجد مبيعات في الفترة المحددة"
        />
      )}
    </div>
  )
}

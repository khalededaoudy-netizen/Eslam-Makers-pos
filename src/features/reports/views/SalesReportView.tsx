import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  TrendingUp,
  CreditCard,
  Receipt,
  ShoppingCart,
  Percent,
  Calculator,
} from 'lucide-react'
import {
  ReportDateRange,
  SalesSummaryReport,
  SalesTransactionRow,
} from '../types'
import { reportsService } from '../reportsService'
import { ReportKpiGrid, KpiCardItem } from '../components/ReportKpiGrid'
import { ReportTable, ColumnDef } from '../components/ReportTable'

interface SalesReportViewProps {
  dateRange: ReportDateRange
  formatCurrency: (val: number) => string
}

export function SalesReportView({ dateRange, formatCurrency }: SalesReportViewProps) {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'ar'

  const [summary, setSummary] = useState<SalesSummaryReport | null>(null)
  const [transactions, setTransactions] = useState<SalesTransactionRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const sum = await reportsService.getSalesSummary(dateRange)
      setSummary(sum)

      const txs = await reportsService.getSalesTransactions({
        range: dateRange,
        search,
        page,
        pageSize: 15,
      })
      setTransactions(txs.rows)
      setTotalCount(txs.totalCount)
    } catch (err) {
      console.error('Failed to load sales report:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [dateRange, page, search])

  const kpis: KpiCardItem[] = summary
    ? [
        {
          id: 'gross_sales',
          label: t('reports.grossSales'),
          value: formatCurrency(summary.grossSales),
          icon: Receipt,
          color: 'primary',
        },
        {
          id: 'discounts',
          label: t('reports.discounts'),
          value: formatCurrency(summary.discountTotal),
          icon: Percent,
          color: 'amber',
        },
        {
          id: 'tax',
          label: t('reports.tax'),
          value: formatCurrency(summary.taxTotal),
          icon: Calculator,
          color: 'indigo',
        },
        {
          id: 'net_sales',
          label: t('reports.netSales'),
          value: formatCurrency(summary.netSales),
          subValue: `${summary.salesCount} ${t('reports.salesCount')}`,
          icon: TrendingUp,
          color: 'emerald',
        },
      ]
    : []

  const columns: ColumnDef<SalesTransactionRow>[] = [
    {
      key: 'invoiceNumber',
      header: 'رقم الفاتورة',
      render: r => <span className="font-mono font-bold text-primary">{r.invoiceNumber}</span>,
    },
    {
      key: 'createdAt',
      header: 'التاريخ والوقت',
      render: r => <span className="font-mono text-muted-foreground">{new Date(r.createdAt).toLocaleString(isRtl ? 'ar-EG' : 'en-US')}</span>,
    },
    {
      key: 'customerName',
      header: 'العميل',
      render: r => r.customerName || 'عميل نقدي',
    },
    {
      key: 'cashierName',
      header: 'الكاشير',
      render: r => r.cashierName || '—',
    },
    {
      key: 'itemsCount',
      header: 'القطع',
      align: 'center',
      render: r => <span className="font-mono font-bold">{r.itemsCount}</span>,
    },
    {
      key: 'subtotal',
      header: 'المجموع',
      align: 'right',
      render: r => <span className="font-mono">{formatCurrency(r.subtotal)}</span>,
    },
    {
      key: 'discountAmount',
      header: 'الخصم',
      align: 'right',
      render: r => r.discountAmount > 0 ? <span className="font-mono text-amber-500">-{formatCurrency(r.discountAmount)}</span> : '—',
    },
    {
      key: 'total',
      header: 'الإجمالي',
      align: 'right',
      render: r => <span className="font-mono font-bold text-emerald-500">{formatCurrency(r.total)}</span>,
    },
    {
      key: 'paymentMethods',
      header: 'طريقة الدفع',
      align: 'center',
      render: r => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground uppercase">
          {r.paymentMethods}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {summary && <ReportKpiGrid items={kpis} />}

      {/* Payment methods breakdown bar */}
      {summary && (
        <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-sm space-y-3">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            المبيعات حسب وسيلة الدفع
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <div className="p-3 bg-muted/40 rounded-xl border border-border/40">
              <span className="text-muted-foreground block text-[11px]">نقداً</span>
              <span className="font-mono font-bold text-foreground">{formatCurrency(summary.cashSales)}</span>
            </div>
            <div className="p-3 bg-muted/40 rounded-xl border border-border/40">
              <span className="text-muted-foreground block text-[11px]">بطاقة بنكية</span>
              <span className="font-mono font-bold text-foreground">{formatCurrency(summary.cardSales)}</span>
            </div>
            <div className="p-3 bg-muted/40 rounded-xl border border-border/40">
              <span className="text-muted-foreground block text-[11px]">إنستاباي</span>
              <span className="font-mono font-bold text-foreground">{formatCurrency(summary.instaPaySales)}</span>
            </div>
            <div className="p-3 bg-muted/40 rounded-xl border border-border/40">
              <span className="text-muted-foreground block text-[11px]">فودافون كاش</span>
              <span className="font-mono font-bold text-foreground">{formatCurrency(summary.vodafoneCashSales)}</span>
            </div>
            <div className="p-3 bg-muted/40 rounded-xl border border-border/40">
              <span className="text-muted-foreground block text-[11px]">تحويل بنكي</span>
              <span className="font-mono font-bold text-foreground">{formatCurrency(summary.bankTransferSales)}</span>
            </div>
            <div className="p-3 bg-muted/40 rounded-xl border border-border/40">
              <span className="text-muted-foreground block text-[11px]">أخرى</span>
              <span className="font-mono font-bold text-foreground">{formatCurrency(summary.otherSales)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Transactions Table */}
      <ReportTable
        columns={columns}
        data={transactions}
        loading={loading}
        totalCount={totalCount}
        page={page}
        pageSize={15}
        onPageChange={setPage}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="بحث برقم الفاتورة أو اسم العميل..."
      />
    </div>
  )
}

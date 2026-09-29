import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ShoppingBag,
  CheckCircle2,
  Clock,
  Building2,
} from 'lucide-react'
import {
  ReportDateRange,
  PurchasesSummaryReport,
  PurchaseRow,
} from '../types'
import { reportsService } from '../reportsService'
import { ReportKpiGrid, KpiCardItem } from '../components/ReportKpiGrid'
import { ReportTable, ColumnDef } from '../components/ReportTable'

interface PurchasesReportViewProps {
  dateRange: ReportDateRange
  formatCurrency: (val: number) => string
}

export function PurchasesReportView({ dateRange, formatCurrency }: PurchasesReportViewProps) {
  const { t } = useTranslation()

  const [summary, setSummary] = useState<PurchasesSummaryReport | null>(null)
  const [rows, setRows] = useState<PurchaseRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await reportsService.getPurchasesReport({
        range: dateRange,
        search,
        page,
        pageSize: 15,
      })
      setSummary(res.summary)
      setRows(res.rows)
      setTotalCount(res.totalCount)
    } catch (err) {
      console.error('Failed to load purchases report:', err)
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
          id: 'total_purchases',
          label: t('reports.purchasesTotal'),
          value: formatCurrency(summary.totalPurchases),
          subValue: `${summary.invoicesCount} ${t('reports.purchases')}`,
          icon: ShoppingBag,
          color: 'primary',
        },
        {
          id: 'paid_amount',
          label: t('reports.paidPurchases'),
          value: formatCurrency(summary.paidAmount),
          icon: CheckCircle2,
          color: 'emerald',
        },
        {
          id: 'unpaid_amount',
          label: t('reports.unpaidPurchases'),
          value: formatCurrency(summary.unpaidAmount),
          icon: Clock,
          color: 'amber',
        },
        {
          id: 'suppliers_count',
          label: 'الموردين المتعامل معهم',
          value: summary.bySupplier.length,
          icon: Building2,
          color: 'indigo',
        },
      ]
    : []

  const columns: ColumnDef<PurchaseRow>[] = [
    {
      key: 'purchaseNumber',
      header: 'رقم أمر الشراء',
      render: r => <span className="font-mono font-bold text-primary">{r.purchaseNumber}</span>,
    },
    {
      key: 'supplierName',
      header: 'المورد',
      render: r => <span className="font-bold text-foreground">{r.supplierName}</span>,
    },
    {
      key: 'purchasedAt',
      header: 'تاريخ الشراء',
      render: r => <span className="font-mono text-muted-foreground">{r.purchasedAt.slice(0, 10)}</span>,
    },
    {
      key: 'itemsCount',
      header: 'الأصناف',
      align: 'center',
      render: r => <span className="font-mono font-bold">{r.itemsCount}</span>,
    },
    {
      key: 'total',
      header: 'الإجمالي',
      align: 'right',
      render: r => <span className="font-mono font-bold">{formatCurrency(r.total)}</span>,
    },
    {
      key: 'paidAmount',
      header: 'المدفوع',
      align: 'right',
      render: r => <span className="font-mono text-emerald-500">{formatCurrency(r.paidAmount)}</span>,
    },
    {
      key: 'balance',
      header: 'المتبقي',
      align: 'right',
      render: r => r.balance > 0 ? <span className="font-mono font-bold text-amber-500">{formatCurrency(r.balance)}</span> : '0.00',
    },
    {
      key: 'status',
      header: 'حالة الاستلام',
      align: 'center',
      render: r => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground">
          {r.status}
        </span>
      ),
    },
    {
      key: 'paymentStatus',
      header: 'حالة الدفع',
      align: 'center',
      render: r => {
        const isPaid = r.paymentStatus === 'paid'
        const isPartial = r.paymentStatus === 'partial'
        return (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            isPaid
              ? 'bg-emerald-500/10 text-emerald-500'
              : isPartial
              ? 'bg-amber-500/10 text-amber-500'
              : 'bg-rose-500/10 text-rose-500'
          }`}>
            {isPaid ? 'مسدد' : isPartial ? 'مسدد جزئياً' : 'غير مسدد'}
          </span>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      {summary && <ReportKpiGrid items={kpis} />}

      {/* Supplier purchases breakdown */}
      {summary && summary.bySupplier.length > 0 && (
        <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-sm space-y-3">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            المشتريات حسب المورد
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {summary.bySupplier.map(s => (
              <div key={s.supplierId} className="p-3 bg-muted/40 rounded-xl border border-border/40 space-y-1">
                <div className="flex justify-between items-center text-muted-foreground text-[11px]">
                  <span className="font-bold text-foreground">{s.supplierName}</span>
                  <span>{s.invoicesCount} فواتير</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-mono font-bold text-foreground">{formatCurrency(s.totalAmount)}</span>
                  {s.balance > 0 && (
                    <span className="text-[11px] text-amber-500 font-mono font-bold">متبقي: {formatCurrency(s.balance)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ReportTable
        columns={columns}
        data={rows}
        loading={loading}
        totalCount={totalCount}
        page={page}
        pageSize={15}
        onPageChange={setPage}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="بحث برقم أمر الشراء أو المورد..."
      />
    </div>
  )
}

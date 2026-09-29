import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Receipt,
  Wallet,
  CreditCard,
  Ban,
} from 'lucide-react'
import {
  ReportDateRange,
  ExpensesSummaryReport,
  ExpenseRow,
} from '../types'
import { reportsService } from '../reportsService'
import { ReportKpiGrid, KpiCardItem } from '../components/ReportKpiGrid'
import { ReportTable, ColumnDef } from '../components/ReportTable'

interface ExpensesReportViewProps {
  dateRange: ReportDateRange
  formatCurrency: (val: number) => string
}

export function ExpensesReportView({ dateRange, formatCurrency }: ExpensesReportViewProps) {
  const { t } = useTranslation()

  const [summary, setSummary] = useState<ExpensesSummaryReport | null>(null)
  const [rows, setRows] = useState<ExpenseRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await reportsService.getExpensesReport({
        range: dateRange,
        search,
        page,
        pageSize: 15,
      })
      setSummary(res.summary)
      setRows(res.rows)
      setTotalCount(res.totalCount)
    } catch (err) {
      console.error('Failed to load expenses report:', err)
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
          id: 'total_expenses',
          label: t('reports.expensesTotal'),
          value: formatCurrency(summary.totalExpenses),
          subValue: `${summary.expensesCount} ${t('reports.expenses')}`,
          icon: Receipt,
          color: 'primary',
        },
        {
          id: 'cash_expenses',
          label: t('reports.cashExpenses'),
          value: formatCurrency(summary.cashExpenses),
          icon: Wallet,
          color: 'amber',
        },
        {
          id: 'non_cash_expenses',
          label: t('reports.nonCashExpenses'),
          value: formatCurrency(summary.nonCashExpenses),
          icon: CreditCard,
          color: 'indigo',
        },
        {
          id: 'cancelled_expenses',
          label: t('reports.cancelledExpenses'),
          value: summary.cancelledCount,
          icon: Ban,
          color: 'rose',
        },
      ]
    : []

  const columns: ColumnDef<ExpenseRow>[] = [
    {
      key: 'expenseNumber',
      header: 'رقم المصروف',
      render: r => <span className="font-mono font-bold text-primary">{r.expenseNumber}</span>,
    },
    {
      key: 'date',
      header: 'التاريخ',
      render: r => <span className="font-mono text-muted-foreground">{r.date.slice(0, 10)}</span>,
    },
    {
      key: 'categoryNameAr',
      header: 'البند / الفئة',
      render: r => (
        <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-muted text-foreground">
          {r.categoryNameAr}
        </span>
      ),
    },
    {
      key: 'description',
      header: 'البيان',
      render: r => <span className="truncate max-w-xs block">{r.description}</span>,
    },
    {
      key: 'supplierName',
      header: 'المورد المرتبط',
      render: r => r.supplierName || '—',
    },
    {
      key: 'paymentMethod',
      header: 'طريقة الدفع',
      align: 'center',
      render: r => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground uppercase">
          {r.paymentMethod}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'المبلغ',
      align: 'right',
      render: r => <span className="font-mono font-bold text-rose-500">{formatCurrency(r.amount)}</span>,
    },
    {
      key: 'userName',
      header: 'المستخدم',
      render: r => r.userName || '—',
    },
    {
      key: 'status',
      header: 'الحالة',
      align: 'center',
      render: r => {
        const isCanc = r.status === 'cancelled'
        return (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            isCanc ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'
          }`}>
            {isCanc ? 'ملغي' : 'مكتمل'}
          </span>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      {summary && <ReportKpiGrid items={kpis} />}

      {/* Category Breakdown Bar */}
      {summary && summary.byCategory.length > 0 && (
        <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-sm space-y-3">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            المصروفات حسب الفئة
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
            {summary.byCategory.map(c => (
              <div key={c.categoryId} className="p-3 bg-muted/40 rounded-xl border border-border/40 space-y-1">
                <div className="flex justify-between items-center text-muted-foreground text-[11px]">
                  <span>{c.nameAr}</span>
                  <span className="font-bold">{c.percentage}%</span>
                </div>
                <div className="font-mono font-bold text-foreground">
                  {formatCurrency(c.amount)}
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
        searchPlaceholder="بحث برقم المصروف أو البيان..."
      />
    </div>
  )
}

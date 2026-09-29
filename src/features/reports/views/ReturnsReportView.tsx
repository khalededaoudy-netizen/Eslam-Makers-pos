import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react'
import {
  ReportDateRange,
  ReturnsSummaryReport,
  ReturnTransactionRow,
} from '../types'
import { reportsService } from '../reportsService'
import { ReportKpiGrid, KpiCardItem } from '../components/ReportKpiGrid'
import { ReportTable, ColumnDef } from '../components/ReportTable'

interface ReturnsReportViewProps {
  dateRange: ReportDateRange
  formatCurrency: (val: number) => string
}

export function ReturnsReportView({ dateRange, formatCurrency }: ReturnsReportViewProps) {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'ar'

  const [summary, setSummary] = useState<ReturnsSummaryReport | null>(null)
  const [rows, setRows] = useState<ReturnTransactionRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [condition, setCondition] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await reportsService.getReturnsReport({
        range: dateRange,
        search,
        condition: condition || undefined,
        page,
        pageSize: 15,
      })
      setSummary(res.summary)
      setRows(res.rows)
      setTotalCount(res.totalCount)
    } catch (err) {
      console.error('Failed to load returns report:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [dateRange, page, search, condition])

  const kpis: KpiCardItem[] = summary
    ? [
        {
          id: 'total_returns',
          label: t('reports.returnsTotal'),
          value: formatCurrency(summary.totalRefundAmount),
          subValue: `${summary.returnsCount} ${t('reports.returns')}`,
          icon: RotateCcw,
          color: 'rose',
        },
        {
          id: 'resellable',
          label: 'مرتجع صالح لإعادة البيع',
          value: summary.resellableCount,
          icon: CheckCircle2,
          color: 'emerald',
        },
        {
          id: 'damaged',
          label: 'مرتجع تالف',
          value: summary.damagedCount,
          icon: AlertTriangle,
          color: 'amber',
        },
        {
          id: 'defective',
          label: 'مرتجع معيب مصنعياً',
          value: summary.defectiveCount,
          icon: XCircle,
          color: 'rose',
        },
      ]
    : []

  const columns: ColumnDef<ReturnTransactionRow>[] = [
    {
      key: 'returnNumber',
      header: 'رقم المرتجع',
      render: r => <span className="font-mono font-bold text-rose-500">{r.returnNumber}</span>,
    },
    {
      key: 'originalSaleNumber',
      header: 'فاتورة البيع الأصلية',
      render: r => <span className="font-mono text-muted-foreground">{r.originalSaleNumber}</span>,
    },
    {
      key: 'createdAt',
      header: 'تاريخ الإرجاع',
      render: r => <span className="font-mono text-muted-foreground">{new Date(r.createdAt).toLocaleString(isRtl ? 'ar-EG' : 'en-US')}</span>,
    },
    {
      key: 'customerName',
      header: 'العميل',
      render: r => r.customerName || 'عميل نقدي',
    },
    {
      key: 'userName',
      header: 'الموظف',
      render: r => r.userName || '—',
    },
    {
      key: 'condition',
      header: 'حالة الصنف',
      align: 'center',
      render: r => {
        const cond = r.condition || 'resellable'
        const isResell = cond === 'resellable'
        return (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            isResell ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
          }`}>
            {isResell ? 'صالح للبيع' : 'تالف / معيب'}
          </span>
        )
      },
    },
    {
      key: 'refundAmount',
      header: 'مبلغ الاسترداد',
      align: 'right',
      render: r => <span className="font-mono font-bold text-rose-500">{formatCurrency(r.refundAmount)}</span>,
    },
    {
      key: 'status',
      header: 'الحالة',
      align: 'center',
      render: r => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground">
          {r.status}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {summary && <ReportKpiGrid items={kpis} />}

      {/* Filter by condition */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCondition('')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            condition === ''
              ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
              : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          جميع الحالات
        </button>
        <button
          onClick={() => setCondition('resellable')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            condition === 'resellable'
              ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
              : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          صالح للبيع فقط
        </button>
        <button
          onClick={() => setCondition('damaged')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            condition === 'damaged'
              ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
              : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          تالف فقط
        </button>
      </div>

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
        searchPlaceholder="بحث برقم المرتجع أو الفاتورة..."
      />
    </div>
  )
}

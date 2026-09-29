import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  TrendingDown,
} from 'lucide-react'
import {
  ReportDateRange,
  ShiftsSummaryReport,
  CashMovementRow,
} from '../types'
import { reportsService } from '../reportsService'
import { ReportKpiGrid, KpiCardItem } from '../components/ReportKpiGrid'
import { ReportTable, ColumnDef } from '../components/ReportTable'

interface CashShiftsReportViewProps {
  dateRange: ReportDateRange
  formatCurrency: (val: number) => string
}

export function CashShiftsReportView({ dateRange, formatCurrency }: CashShiftsReportViewProps) {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'ar'

  const [shiftsReport, setShiftsReport] = useState<ShiftsSummaryReport | null>(null)
  const [cashMovements, setCashMovements] = useState<CashMovementRow[]>([])
  const [subTab, setSubTab] = useState<'shifts' | 'movements'>('shifts')
  const [loading, setLoading] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const sh = await reportsService.getShiftsReport(dateRange)
      setShiftsReport(sh)

      const movs = await reportsService.getCashMovements(dateRange)
      setCashMovements(movs)
    } catch (err) {
      console.error('Failed to load cash & shifts report:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [dateRange])

  const kpis: KpiCardItem[] = shiftsReport
    ? [
        {
          id: 'cash_sales',
          label: 'إجمالي المبيعات النقدية',
          value: formatCurrency(shiftsReport.totalCashSales),
          icon: DollarSign,
          color: 'emerald',
        },
        {
          id: 'cash_refunds',
          label: 'إجمالي المرتجعات النقدية',
          value: formatCurrency(shiftsReport.totalCashRefunds),
          icon: TrendingDown,
          color: 'rose',
        },
        {
          id: 'cash_expenses',
          label: 'إجمالي المصروفات النقدية',
          value: formatCurrency(shiftsReport.totalCashExpenses),
          icon: ArrowUpRight,
          color: 'amber',
        },
        {
          id: 'shifts_count',
          label: 'عدد الورديات',
          value: shiftsReport.shiftsCount,
          icon: Wallet,
          color: 'primary',
        },
      ]
    : []

  const shiftColumns: ColumnDef<any>[] = [
    {
      key: 'registerName',
      header: 'الخزينة',
      render: r => <span className="font-bold text-foreground">{r.registerName}</span>,
    },
    {
      key: 'userName',
      header: 'الكاشير',
      render: r => r.userName,
    },
    {
      key: 'openedAt',
      header: 'تاريخ الفتح',
      render: r => <span className="font-mono text-muted-foreground">{new Date(r.openedAt).toLocaleString(isRtl ? 'ar-EG' : 'en-US')}</span>,
    },
    {
      key: 'openingBalance',
      header: 'رصيد الافتتاح',
      align: 'right',
      render: r => <span className="font-mono">{formatCurrency(r.openingBalance)}</span>,
    },
    {
      key: 'cashSales',
      header: 'مبيعات نقدية (+)',
      align: 'right',
      render: r => <span className="font-mono text-emerald-500">+{formatCurrency(r.cashSales)}</span>,
    },
    {
      key: 'cashRefunds',
      header: 'مرتجعات (-)',
      align: 'right',
      render: r => r.cashRefunds > 0 ? <span className="font-mono text-rose-500">-{formatCurrency(r.cashRefunds)}</span> : '—',
    },
    {
      key: 'cashExpenses',
      header: 'مصروفات (-)',
      align: 'right',
      render: r => r.cashExpenses > 0 ? <span className="font-mono text-amber-500">-{formatCurrency(r.cashExpenses)}</span> : '—',
    },
    {
      key: 'expectedCash',
      header: 'النقدية المتوقعة',
      align: 'right',
      render: r => <span className="font-mono font-bold text-primary">{formatCurrency(r.expectedCash)}</span>,
    },
    {
      key: 'actualCash',
      header: 'النقدية الفعلية',
      align: 'right',
      render: r => r.actualCash !== undefined ? <span className="font-mono font-bold">{formatCurrency(r.actualCash)}</span> : '—',
    },
    {
      key: 'difference',
      header: 'العجز / الزيادة',
      align: 'right',
      render: r => {
        if (r.difference === undefined) return '—'
        const diff = r.difference
        return (
          <span className={`font-mono font-bold ${diff < 0 ? 'text-rose-500' : diff > 0 ? 'text-emerald-500' : 'text-muted-foreground'}`}>
            {diff > 0 ? `+${formatCurrency(diff)}` : formatCurrency(diff)}
          </span>
        )
      },
    },
    {
      key: 'status',
      header: 'الحالة',
      align: 'center',
      render: r => {
        const isOpen = r.status === 'open'
        return (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            isOpen ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'
          }`}>
            {isOpen ? 'مفتوحة' : 'مغلقة'}
          </span>
        )
      },
    },
  ]

  const movementColumns: ColumnDef<CashMovementRow>[] = [
    {
      key: 'createdAt',
      header: 'التاريخ والوقت',
      render: r => <span className="font-mono text-muted-foreground">{new Date(r.createdAt).toLocaleString(isRtl ? 'ar-EG' : 'en-US')}</span>,
    },
    {
      key: 'registerName',
      header: 'الخزينة',
      render: r => <span className="font-bold text-foreground">{r.registerName}</span>,
    },
    {
      key: 'direction',
      header: 'الاتجاه',
      align: 'center',
      render: r => {
        const isIn = r.direction === 'in'
        return (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
            isIn ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
          }`}>
            {isIn ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
            {isIn ? 'إيداع / وارد' : 'سحب / صادر'}
          </span>
        )
      },
    },
    {
      key: 'amount',
      header: 'المبلغ',
      align: 'right',
      render: r => <span className="font-mono font-bold">{formatCurrency(r.amount)}</span>,
    },
    {
      key: 'reason',
      header: 'السبب / البيان',
      render: r => <span className="text-foreground">{r.reason}</span>,
    },
    {
      key: 'userName',
      header: 'الموظف',
      render: r => r.userName || '—',
    },
  ]

  return (
    <div className="space-y-6">
      {shiftsReport && <ReportKpiGrid items={kpis} />}

      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          onClick={() => setSubTab('shifts')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            subTab === 'shifts'
              ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
              : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          سجل الورديات ومطابقة الخزائن
        </button>
        <button
          onClick={() => setSubTab('movements')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            subTab === 'movements'
              ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
              : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          دفتر حركات النقدية (الإيداع والسحب)
        </button>
      </div>

      {subTab === 'shifts' && (
        <ReportTable
          columns={shiftColumns}
          data={shiftsReport?.shifts || []}
          loading={loading}
          emptyMessage="لا توجد ورديات في الفترة المحددة"
        />
      )}

      {subTab === 'movements' && (
        <ReportTable
          columns={movementColumns}
          data={cashMovements}
          loading={loading}
          emptyMessage="لا توجد حركات نقدية مسجلة في الفترة المحددة"
        />
      )}
    </div>
  )
}

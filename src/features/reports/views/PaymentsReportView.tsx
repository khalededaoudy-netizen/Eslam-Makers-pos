import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CreditCard,
  Wallet,
  Smartphone,
  Building,
  Layers,
} from 'lucide-react'
import {
  ReportDateRange,
  PaymentMethodBreakdownReport,
} from '../types'
import { reportsService } from '../reportsService'
import { ReportKpiGrid, KpiCardItem } from '../components/ReportKpiGrid'
import { ReportTable, ColumnDef } from '../components/ReportTable'

interface PaymentsReportViewProps {
  dateRange: ReportDateRange
  formatCurrency: (val: number) => string
}

export function PaymentsReportView({ dateRange, formatCurrency }: PaymentsReportViewProps) {
  const { t } = useTranslation()
  const [data, setData] = useState<PaymentMethodBreakdownReport | null>(null)
  const [loading, setLoading] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await reportsService.getPaymentMethodBreakdown(dateRange)
      setData(res)
    } catch (err) {
      console.error('Failed to load payments report:', err)
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
          id: 'total_net',
          label: 'إجمالي المتحصلات عبر جميع الوسائل',
          value: formatCurrency(data.totalNet),
          icon: CreditCard,
          color: 'primary',
        },
        {
          id: 'methods_count',
          label: 'طرق الدفع النشطة',
          value: data.methods.length,
          icon: Layers,
          color: 'emerald',
        },
      ]
    : []

  const columns: ColumnDef<any>[] = [
    {
      key: 'labelAr',
      header: 'طريقة الدفع',
      render: r => (
        <div className="flex items-center gap-2">
          <span className="font-bold text-foreground">{r.labelAr}</span>
          <span className="text-[10px] text-muted-foreground font-mono uppercase">({r.method})</span>
        </div>
      ),
    },
    {
      key: 'salesCount',
      header: 'عدد العمليات',
      align: 'center',
      render: r => <span className="font-mono font-bold">{r.salesCount}</span>,
    },
    {
      key: 'salesAmount',
      header: 'إجمالي المبيعات',
      align: 'right',
      render: r => <span className="font-mono font-bold text-foreground">{formatCurrency(r.salesAmount)}</span>,
    },
    {
      key: 'netAmount',
      header: 'الصافي',
      align: 'right',
      render: r => <span className="font-mono font-bold text-emerald-500">{formatCurrency(r.netAmount)}</span>,
    },
    {
      key: 'percentage',
      header: 'النسبة من الإجمالي',
      align: 'center',
      render: r => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
          {r.percentage}%
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {data && <ReportKpiGrid items={kpis} />}

      <ReportTable
        columns={columns}
        data={data?.methods || []}
        loading={loading}
        emptyMessage="لا توجد مدفوعات مسجلة في الفترة المحددة"
      />
    </div>
  )
}

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Building2,
  CheckCircle2,
  Clock,
  ShoppingBag,
} from 'lucide-react'
import {
  ReportDateRange,
  SuppliersReport,
} from '../types'
import { reportsService } from '../reportsService'
import { ReportKpiGrid, KpiCardItem } from '../components/ReportKpiGrid'
import { ReportTable, ColumnDef } from '../components/ReportTable'

interface SuppliersReportViewProps {
  dateRange: ReportDateRange
  formatCurrency: (val: number) => string
}

export function SuppliersReportView({ dateRange, formatCurrency }: SuppliersReportViewProps) {
  const { t } = useTranslation()
  const [data, setData] = useState<SuppliersReport | null>(null)
  const [loading, setLoading] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await reportsService.getSuppliersReport(dateRange)
      setData(res)
    } catch (err) {
      console.error('Failed to load suppliers report:', err)
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
          id: 'total_supp',
          label: 'إجمالي الموردين',
          value: data.totalSuppliers,
          icon: Building2,
          color: 'primary',
        },
        {
          id: 'active_supp',
          label: 'الموردين النشطين',
          value: data.activeSuppliers,
          icon: CheckCircle2,
          color: 'emerald',
        },
        {
          id: 'supp_balance',
          label: 'موردين برصيد مستحق',
          value: data.suppliersWithBalance,
          icon: Clock,
          color: 'amber',
        },
        {
          id: 'total_balance',
          label: 'إجمالي مستحقات الموردين',
          value: formatCurrency(data.totalOutstandingBalance),
          icon: ShoppingBag,
          color: 'rose',
        },
      ]
    : []

  const columns: ColumnDef<any>[] = [
    {
      key: 'name',
      header: 'اسم المورد',
      render: r => <span className="font-bold text-foreground">{r.name}</span>,
    },
    {
      key: 'phone',
      header: 'رقم الهاتف',
      render: r => <span className="font-mono text-muted-foreground">{r.phone || '—'}</span>,
    },
    {
      key: 'purchasesCount',
      header: 'عدد أوامر الشراء في الفترة',
      align: 'center',
      render: r => <span className="font-mono font-bold">{r.purchasesCount}</span>,
    },
    {
      key: 'totalPurchases',
      header: 'إجمالي التوريد في الفترة',
      align: 'right',
      render: r => <span className="font-mono font-bold text-primary">{formatCurrency(r.totalPurchases)}</span>,
    },
    {
      key: 'balance',
      header: 'المستحق الحالي للمورد',
      align: 'right',
      render: r => r.balance > 0 ? <span className="font-mono font-bold text-amber-500">{formatCurrency(r.balance)}</span> : '0.00',
    },
  ]

  return (
    <div className="space-y-6">
      {data && <ReportKpiGrid items={kpis} />}

      <div className="space-y-2">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          أعلى الموردين توريداً في الفترة المحددة
        </h3>
        <ReportTable
          columns={columns}
          data={data?.topSuppliers || []}
          loading={loading}
          emptyMessage="لا توجد تعاملات للموردين في الفترة المحددة"
        />
      </div>
    </div>
  )
}

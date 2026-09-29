import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Users,
  UserCheck,
  CreditCard,
  TrendingUp,
} from 'lucide-react'
import {
  ReportDateRange,
  CustomersReport,
} from '../types'
import { reportsService } from '../reportsService'
import { ReportKpiGrid, KpiCardItem } from '../components/ReportKpiGrid'
import { ReportTable, ColumnDef } from '../components/ReportTable'

interface CustomersReportViewProps {
  dateRange: ReportDateRange
  formatCurrency: (val: number) => string
}

export function CustomersReportView({ dateRange, formatCurrency }: CustomersReportViewProps) {
  const { t } = useTranslation()
  const [data, setData] = useState<CustomersReport | null>(null)
  const [loading, setLoading] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await reportsService.getCustomersReport(dateRange)
      setData(res)
    } catch (err) {
      console.error('Failed to load customers report:', err)
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
          id: 'total_cust',
          label: 'إجمالي العملاء',
          value: data.totalCustomers,
          icon: Users,
          color: 'primary',
        },
        {
          id: 'active_cust',
          label: 'العملاء النشطين',
          value: data.activeCustomers,
          icon: UserCheck,
          color: 'emerald',
        },
        {
          id: 'cust_balance',
          label: 'عملاء برصيد مستحق',
          value: data.customersWithBalance,
          icon: CreditCard,
          color: 'amber',
        },
        {
          id: 'total_balance',
          label: 'إجمالي ديون العملاء',
          value: formatCurrency(data.totalOutstandingBalance),
          icon: TrendingUp,
          color: 'rose',
        },
      ]
    : []

  const columns: ColumnDef<any>[] = [
    {
      key: 'name',
      header: 'اسم العميل',
      render: r => <span className="font-bold text-foreground">{r.name}</span>,
    },
    {
      key: 'phone',
      header: 'رقم الهاتف',
      render: r => <span className="font-mono text-muted-foreground">{r.phone || '—'}</span>,
    },
    {
      key: 'salesCount',
      header: 'عدد المعاملات في الفترة',
      align: 'center',
      render: r => <span className="font-mono font-bold">{r.salesCount}</span>,
    },
    {
      key: 'totalPurchases',
      header: 'إجمالي المشتريات في الفترة',
      align: 'right',
      render: r => <span className="font-mono font-bold text-emerald-500">{formatCurrency(r.totalPurchases)}</span>,
    },
    {
      key: 'balance',
      header: 'الرصيد المستحق الحالي',
      align: 'right',
      render: r => r.balance > 0 ? <span className="font-mono font-bold text-rose-500">{formatCurrency(r.balance)}</span> : '0.00',
    },
  ]

  return (
    <div className="space-y-6">
      {data && <ReportKpiGrid items={kpis} />}

      <div className="space-y-2">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          أعلى العملاء شراءً في الفترة المحددة
        </h3>
        <ReportTable
          columns={columns}
          data={data?.topCustomers || []}
          loading={loading}
          emptyMessage="لا توجد تعاملات للعملاء في الفترة المحددة"
        />
      </div>
    </div>
  )
}

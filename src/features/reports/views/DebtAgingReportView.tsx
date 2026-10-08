/**
 * MAKERS POS — Customer Debt Aging Report View (تقرير أعمار الديون)
 * Shows 30/60/90+ day debtor aging brackets, distribution percentages, and actionable customer breakdown.
 */

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Clock,
  AlertTriangle,
  Users,
  DollarSign,
  FileText,
  CreditCard,
  RefreshCw,
  Search,
  CheckCircle2,
} from 'lucide-react'
import {
  customerDebtService,
  DebtAgingReport,
  DebtorCustomerListItem,
} from '@/services/customers/customerDebtService'
import { CustomerStatementModal } from '@/features/customers/components/CustomerStatementModal'
import { RecordPaymentModal } from '@/features/customers/components/RecordPaymentModal'
import { Customer } from '@/services/customers/types'
import { formatDate } from '@/lib/formatters'

interface DebtAgingReportViewProps {
  formatCurrency: (val: number) => string
}

export function DebtAgingReportView({ formatCurrency }: DebtAgingReportViewProps) {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language !== 'en'

  const [report, setReport] = useState<DebtAgingReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedBucket, setSelectedBucket] = useState<string>('all')

  // Modals
  const [statementCustomerId, setStatementCustomerId] = useState<string | null>(null)
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await customerDebtService.getAgingReport()
      setReport(data)
    } catch (err) {
      console.error('Failed to load aging report:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <span className="text-xs">{isArabic ? 'جاري إعداد تقرير أعمار الديون...' : 'Generating aging report...'}</span>
      </div>
    )
  }

  if (!report) return null

  // Filter debtors by search and selected bucket
  const filteredDebtors = report.debtors.filter((d) => {
    const matchesSearch =
      !search.trim() ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.customer_code.toLowerCase().includes(search.toLowerCase()) ||
      (d.phone && d.phone.includes(search))

    let matchesBucket = true
    if (selectedBucket === '0-30') matchesBucket = d.days_overdue <= 30
    else if (selectedBucket === '31-60') matchesBucket = d.days_overdue > 30 && d.days_overdue <= 60
    else if (selectedBucket === '61-90') matchesBucket = d.days_overdue > 60 && d.days_overdue <= 90
    else if (selectedBucket === '90+') matchesBucket = d.days_overdue > 90

    return matchesSearch && matchesBucket
  })

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 4 Buckets KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {report.buckets.map((b) => {
          const isSelected = selectedBucket === b.bucket
          const is90Plus = b.bucket === '90+'
          const is60Plus = b.bucket === '61-90'
          const is30Plus = b.bucket === '31-60'

          const colorClasses = is90Plus
            ? 'text-rose-500 border-rose-500/30'
            : is60Plus
            ? 'text-orange-500 border-orange-500/30'
            : is30Plus
            ? 'text-yellow-500 border-yellow-500/30'
            : 'text-emerald-500 border-emerald-500/30'

          const bgHighlight = isSelected
            ? 'ring-2 ring-primary border-primary bg-primary/10'
            : 'bg-card border-border hover:bg-muted/40'

          return (
            <div
              key={b.bucket}
              onClick={() => setSelectedBucket(isSelected ? 'all' : b.bucket)}
              className={`p-4 rounded-2xl border shadow-sm cursor-pointer transition-all flex flex-col justify-between ${bgHighlight}`}
            >
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span className="font-semibold text-foreground">
                  {isArabic ? b.bucketLabelAr : b.bucketLabelEn}
                </span>
                <Clock className={`w-4 h-4 ${colorClasses}`} />
              </div>

              <div className="mt-2">
                <span className={`text-xl font-bold font-mono ${colorClasses}`}>
                  {formatCurrency(b.totalAmount)}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[11px] text-muted-foreground mt-2">
                <span>
                  {b.customersCount} {isArabic ? 'عميل' : 'debtors'}
                </span>
                <span className="font-mono font-bold font-semibold text-foreground">
                  {b.percentage}%
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Visual Percentage Distribution Bar */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-sm space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-foreground">
            {isArabic ? 'توزيع شرائح المديونية الإجمالية' : 'Total Debt Distribution'}
          </span>
          <span className="font-mono text-muted-foreground">
            {isArabic ? 'إجمالي المديونيات:' : 'Total Debt:'} {formatCurrency(report.totalDebt)}
          </span>
        </div>

        <div className="h-4 w-full rounded-full bg-muted/60 overflow-hidden flex">
          {report.buckets.map((b) => {
            if (b.percentage <= 0) return null
            const barBg =
              b.bucket === '90+'
                ? 'bg-rose-500'
                : b.bucket === '61-90'
                ? 'bg-orange-500'
                : b.bucket === '31-60'
                ? 'bg-yellow-500'
                : 'bg-emerald-500'

            return (
              <div
                key={b.bucket}
                style={{ width: `${b.percentage}%` }}
                className={`${barBg} h-full transition-all`}
                title={`${b.bucketLabelAr}: ${b.percentage}% (${formatCurrency(b.totalAmount)})`}
              />
            )
          })}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isArabic ? 'بحث باسم العميل أو الكود أو رقم الهاتف...' : 'Search debtors...'}
            className="w-full ps-9 pe-3 py-2 rounded-xl border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedBucket}
            onChange={(e) => setSelectedBucket(e.target.value)}
            className="px-3 py-2 rounded-xl border border-input bg-background text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">{isArabic ? 'جميع الفئات (الكل)' : 'All Buckets'}</option>
            <option value="0-30">{isArabic ? '0-30 يوم (حالي)' : '0-30 days'}</option>
            <option value="31-60">{isArabic ? '31-60 يوم (متأخر)' : '31-60 days'}</option>
            <option value="61-90">{isArabic ? '61-90 يوم (متأخر)' : '61-90 days'}</option>
            <option value="90+">{isArabic ? '90+ يوم (متعثر)' : '90+ days'}</option>
          </select>

          <button
            type="button"
            onClick={loadData}
            title={isArabic ? 'تحديث' : 'Refresh'}
            className="p-2 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Debtors Breakdown Table */}
      <div className="rounded-2xl border border-border overflow-hidden bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead className="bg-muted/60 text-muted-foreground font-semibold border-b border-border">
              <tr>
                <th className="py-3 px-4 text-start">{isArabic ? 'كود العميل' : 'Code'}</th>
                <th className="py-3 px-4 text-start">{isArabic ? 'اسم العميل' : 'Customer Name'}</th>
                <th className="py-3 px-3 text-start">{isArabic ? 'رقم الهاتف' : 'Phone'}</th>
                <th className="py-3 px-3 text-end">{isArabic ? 'الرصيد المستحق' : 'Balance'}</th>
                <th className="py-3 px-3 text-center">{isArabic ? 'شريحة العمر' : 'Aging Bucket'}</th>
                <th className="py-3 px-3 text-center">{isArabic ? 'مدة التأخير' : 'Days'}</th>
                <th className="py-3 px-3 text-start">{isArabic ? 'آخر سداد' : 'Last Payment'}</th>
                <th className="py-3 px-4 text-center">{isArabic ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredDebtors.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-muted-foreground text-xs">
                    {isArabic ? 'لا توجد مديونيات مطابقة للشروط' : 'No matching debtors found'}
                  </td>
                </tr>
              ) : (
                filteredDebtors.map((d) => (
                  <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-muted-foreground">
                      {d.customer_code}
                    </td>

                    <td className="py-3 px-4 font-bold text-foreground">
                      {d.name}
                    </td>

                    <td className="py-3 px-3 font-mono" dir="ltr">
                      {d.phone || '—'}
                    </td>

                    <td className="py-3 px-3 text-end font-mono font-bold text-amber-500">
                      {formatCurrency(d.balance)}
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          d.days_overdue > 90
                            ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                            : d.days_overdue > 60
                            ? 'bg-orange-500/15 text-orange-500 border border-orange-500/30'
                            : d.days_overdue > 30
                            ? 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30'
                            : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {d.days_overdue > 90
                          ? isArabic
                            ? '90+ يوم'
                            : '90+ Days'
                          : d.days_overdue > 60
                          ? isArabic
                            ? '61-90 يوم'
                            : '61-90 Days'
                          : d.days_overdue > 30
                          ? isArabic
                            ? '31-60 يوم'
                            : '31-60 Days'
                          : isArabic
                          ? '0-30 يوم'
                          : '0-30 Days'}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center font-mono">
                      {d.days_overdue} {isArabic ? 'يوم' : 'd'}
                    </td>

                    <td className="py-3 px-3 font-mono text-muted-foreground text-[11px]">
                      {d.last_payment_date ? formatDate(d.last_payment_date) : '—'}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setStatementCustomerId(d.id)}
                          className="px-2 py-1 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold flex items-center gap-1"
                          title={isArabic ? 'كشف الحساب' : 'Statement'}
                        >
                          <FileText className="w-3 h-3 text-primary" />
                          <span>{isArabic ? 'كشف حساب' : 'Statement'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPaymentCustomer(d)}
                          className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1 shadow-sm"
                          title={isArabic ? 'تسجيل دفعة' : 'Record Payment'}
                        >
                          <CreditCard className="w-3 h-3" />
                          <span>{isArabic ? 'تسجيل دفعة' : 'Pay'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {statementCustomerId && (
        <CustomerStatementModal
          isOpen={!!statementCustomerId}
          customerId={statementCustomerId}
          onClose={() => setStatementCustomerId(null)}
          onPaymentRecorded={loadData}
        />
      )}

      {paymentCustomer && (
        <RecordPaymentModal
          isOpen={!!paymentCustomer}
          customer={paymentCustomer}
          onClose={() => setPaymentCustomer(null)}
          onSuccess={() => {
            setPaymentCustomer(null)
            loadData()
          }}
        />
      )}
    </div>
  )
}

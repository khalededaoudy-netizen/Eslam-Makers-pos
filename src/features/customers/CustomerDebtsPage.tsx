/**
 * MAKERS POS — Customer Debt Management Page / Dashboard
 * Complete overview of outstanding customer receivables, aging buckets,
 * search/filter table, statements, payments, and quick communication.
 */

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DollarSign,
  Users,
  Clock,
  AlertTriangle,
  Search,
  Filter,
  ArrowUpDown,
  FileText,
  CreditCard,
  Printer,
  MessageSquare,
  RefreshCw,
  Phone,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react'
import {
  customerDebtService,
  DebtOverviewKPIs,
  DebtorCustomerListItem,
} from '@/services/customers/customerDebtService'
import { Customer } from '@/services/customers/types'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { useSettingsStore } from '@/stores/settingsStore'
import { CustomerStatementModal } from './components/CustomerStatementModal'
import { RecordPaymentModal } from './components/RecordPaymentModal'

interface CustomerDebtsPageProps {
  onCustomerSelect?: (customer: Customer) => void
}

export function CustomerDebtsPage({ onCustomerSelect }: CustomerDebtsPageProps) {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language !== 'en'
  const { currencySymbol, storeName } = useSettingsStore()

  const [kpis, setKpis] = useState<DebtOverviewKPIs>({
    totalOwed: 0,
    debtorsCount: 0,
    avgDebt: 0,
    overdue30Amount: 0,
    overdue30Count: 0,
    overdue60Amount: 0,
    overdue60Count: 0,
    overdue90Amount: 0,
    overdue90Count: 0,
    currentAmount: 0,
    currentCount: 0,
  })

  const [debtors, setDebtors] = useState<DebtorCustomerListItem[]>([])
  const [loading, setLoading] = useState(true)

  // Filters & Sorting
  const [search, setSearch] = useState('')
  const [bucketFilter, setBucketFilter] = useState<'all' | 'current' | 'overdue30' | 'overdue60' | 'overdue90'>('all')
  const [sortBy, setSortBy] = useState<'balance_desc' | 'balance_asc' | 'days_desc' | 'name_asc'>('balance_desc')

  // Modals
  const [statementCustomerId, setStatementCustomerId] = useState<string | null>(null)
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [stats, list] = await Promise.all([
        customerDebtService.getDebtOverview(),
        customerDebtService.getDebtors({
          search,
          filter: bucketFilter,
          sortBy,
        }),
      ])
      setKpis(stats)
      setDebtors(list)
    } catch (err) {
      console.error('Failed to load customer debt data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData()
    }, 150)
    return () => clearTimeout(timer)
  }, [search, bucketFilter, sortBy])

  // Print Debtors List
  const handlePrintList = () => {
    window.print()
  }

  // Quick WhatsApp Link
  const handleOpenWhatsApp = (customer: DebtorCustomerListItem) => {
    if (!customer.phone) return
    let cleanPhone = customer.phone.replace(/[^0-9]/g, '')
    if (cleanPhone.startsWith('01')) {
      cleanPhone = '2' + cleanPhone
    }
    const text = isArabic
      ? `مرحباً ${customer.name}، نود تذكيركم بأن الرصيد المستحق طرفكم لدى ${storeName || 'مايكرز'} هو ${formatCurrency(customer.balance)}. شكراً لتعاملكم معنا!`
      : `Hello ${customer.name}, friendly reminder that your outstanding balance with ${storeName || 'MAKERS'} is ${formatCurrency(customer.balance)}. Thank you!`
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPI Cards Grid (6 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {/* 1. Total Debt */}
        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">{isArabic ? 'إجمالي المديونيات' : 'Total Owed'}</span>
            <DollarSign className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold font-mono text-amber-500">
              {formatCurrency(kpis.totalOwed)}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground mt-1">
            {isArabic ? 'مستحق على العملاء' : 'Receivables from customers'}
          </span>
        </div>

        {/* 2. Debtors Count */}
        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">{isArabic ? 'عدد العملاء المدينين' : 'Debtors Count'}</span>
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold font-mono text-foreground">
              {kpis.debtorsCount}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground mt-1">
            {isArabic ? 'عميل برصيد مدين' : 'Active indebted customers'}
          </span>
        </div>

        {/* 3. Average Debt */}
        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">{isArabic ? 'متوسط الدين للعميل' : 'Average Debt'}</span>
            <ArrowUpDown className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold font-mono text-foreground">
              {formatCurrency(kpis.avgDebt)}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground mt-1">
            {isArabic ? 'لكل عميل مدين' : 'Per indebted customer'}
          </span>
        </div>

        {/* 4. Overdue > 30 Days */}
        <div
          onClick={() => setBucketFilter(bucketFilter === 'overdue30' ? 'all' : 'overdue30')}
          className={`p-4 rounded-2xl border shadow-sm flex flex-col justify-between cursor-pointer transition-all ${
            bucketFilter === 'overdue30'
              ? 'border-yellow-500 bg-yellow-500/10 ring-2 ring-yellow-500/20'
              : 'bg-card border-border hover:border-yellow-500/40'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">{isArabic ? 'متأخر 30+ يوم' : 'Overdue 30+ Days'}</span>
            <Clock className="w-4 h-4 text-yellow-500" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold font-mono text-yellow-500">
              {formatCurrency(kpis.overdue30Amount)}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground mt-1">
            {kpis.overdue30Count} {isArabic ? 'عميل' : 'customers'}
          </span>
        </div>

        {/* 5. Overdue > 60 Days */}
        <div
          onClick={() => setBucketFilter(bucketFilter === 'overdue60' ? 'all' : 'overdue60')}
          className={`p-4 rounded-2xl border shadow-sm flex flex-col justify-between cursor-pointer transition-all ${
            bucketFilter === 'overdue60'
              ? 'border-orange-500 bg-orange-500/10 ring-2 ring-orange-500/20'
              : 'bg-card border-border hover:border-orange-500/40'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">{isArabic ? 'متأخر 60+ يوم' : 'Overdue 60+ Days'}</span>
            <AlertTriangle className="w-4 h-4 text-orange-500" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold font-mono text-orange-500">
              {formatCurrency(kpis.overdue60Amount)}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground mt-1">
            {kpis.overdue60Count} {isArabic ? 'عميل' : 'customers'}
          </span>
        </div>

        {/* 6. Overdue > 90 Days */}
        <div
          onClick={() => setBucketFilter(bucketFilter === 'overdue90' ? 'all' : 'overdue90')}
          className={`p-4 rounded-2xl border shadow-sm flex flex-col justify-between cursor-pointer transition-all ${
            bucketFilter === 'overdue90'
              ? 'border-rose-500 bg-rose-500/10 ring-2 ring-rose-500/20'
              : 'bg-card border-border hover:border-rose-500/40'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">{isArabic ? 'ديون متعثرة 90+ يوم' : 'Defaulted 90+ Days'}</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold font-mono text-rose-500">
              {formatCurrency(kpis.overdue90Amount)}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground mt-1">
            {kpis.overdue90Count} {isArabic ? 'عميل' : 'customers'}
          </span>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3.5 rounded-2xl border border-border shadow-sm">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isArabic ? 'بحث بالاسم، الكود، رقم الهاتف...' : 'Search debtors...'}
            className="w-full ps-9 pe-3 py-2 rounded-xl border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Filter by Aging Bucket */}
        <div className="flex items-center gap-2">
          <select
            value={bucketFilter}
            onChange={(e) => setBucketFilter(e.target.value as any)}
            className="px-3 py-2 rounded-xl border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">{isArabic ? 'جميع الديون' : 'All Debts'}</option>
            <option value="current">{isArabic ? 'حالي (أقل من 30 يوم)' : 'Current (< 30 days)'}</option>
            <option value="overdue30">{isArabic ? 'متأخر 30+ يوم' : 'Overdue 30+ days'}</option>
            <option value="overdue60">{isArabic ? 'متأخر 60+ يوم' : 'Overdue 60+ days'}</option>
            <option value="overdue90">{isArabic ? 'متعثر 90+ يوم' : 'Overdue 90+ days'}</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 rounded-xl border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="balance_desc">{isArabic ? 'الأعلى مديونية' : 'Highest Debt'}</option>
            <option value="balance_asc">{isArabic ? 'الأقل مديونية' : 'Lowest Debt'}</option>
            <option value="days_desc">{isArabic ? 'الأقدم تأخيراً' : 'Most Overdue'}</option>
            <option value="name_asc">{isArabic ? 'ترتيب أبجدي' : 'Alphabetical'}</option>
          </select>

          <button
            type="button"
            onClick={loadData}
            title={isArabic ? 'تحديث' : 'Refresh'}
            className="p-2 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handlePrintList}
            title={isArabic ? 'طباعة القائمة' : 'Print List'}
            className="p-2 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Debtors Table */}
      <div className="rounded-2xl border border-border overflow-hidden bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead className="bg-muted/60 text-muted-foreground font-semibold border-b border-border">
              <tr>
                <th className="py-3 px-4 text-start">{isArabic ? 'العميل والكود' : 'Customer & Code'}</th>
                <th className="py-3 px-3 text-start">{isArabic ? 'رقم الهاتف' : 'Phone'}</th>
                <th className="py-3 px-3 text-end">{isArabic ? 'الرصيد المستحق' : 'Balance'}</th>
                <th className="py-3 px-3 text-start">{isArabic ? 'آخر سداد' : 'Last Payment'}</th>
                <th className="py-3 px-3 text-center">{isArabic ? 'مدة التأخير' : 'Days Overdue'}</th>
                <th className="py-3 px-4 text-center">{isArabic ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {debtors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <p className="font-semibold text-sm">
                      {isArabic ? 'لا توجد مديونيات مطابقة للشروط' : 'No matching debtors found'}
                    </p>
                    <p className="text-xs mt-1">
                      {isArabic ? 'جميع حسابات العملاء خالصة أو لا توجد نتائج للبحث' : 'All customer accounts are clear'}
                    </p>
                  </td>
                </tr>
              ) : (
                debtors.map((cust) => (
                  <tr key={cust.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-foreground flex items-center gap-1.5">
                        <span className="truncate max-w-[200px]">{cust.name}</span>
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {cust.customer_code}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      {cust.phone ? (
                        <span className="font-mono" dir="ltr">
                          {cust.phone}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-end">
                      <span className="font-mono font-bold text-sm text-amber-500">
                        {formatCurrency(cust.balance)}
                      </span>
                      {cust.credit_limit > 0 && (
                        <span className="block text-[10px] text-muted-foreground">
                          {isArabic ? 'الحد:' : 'Limit:'} {formatCurrency(cust.credit_limit)}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      {cust.last_payment_date ? (
                        <span className="font-mono text-muted-foreground">
                          {formatDate(cust.last_payment_date)}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">
                          {isArabic ? 'لا يوجد دفعات' : 'No payments'}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full font-mono text-[11px] font-bold ${
                          cust.days_overdue > 90
                            ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                            : cust.days_overdue > 60
                            ? 'bg-orange-500/15 text-orange-500 border border-orange-500/30'
                            : cust.days_overdue > 30
                            ? 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30'
                            : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {cust.days_overdue} {isArabic ? 'يوم' : 'days'}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Statement Button */}
                        <button
                          type="button"
                          onClick={() => setStatementCustomerId(cust.id)}
                          title={isArabic ? 'عرض كشف الحساب' : 'Account Statement'}
                          className="px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5 text-primary" />
                          <span>{isArabic ? 'كشف حساب' : 'Statement'}</span>
                        </button>

                        {/* Record Payment Button */}
                        <button
                          type="button"
                          onClick={() => setPaymentCustomer(cust)}
                          title={isArabic ? 'تسجيل دفعة سداد' : 'Record Payment'}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition-colors"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>{isArabic ? 'تسجيل دفعة' : 'Pay'}</span>
                        </button>

                        {/* WhatsApp Button */}
                        {cust.phone && (
                          <button
                            type="button"
                            onClick={() => handleOpenWhatsApp(cust)}
                            title={isArabic ? 'مراسلة عبر واتساب' : 'WhatsApp'}
                            className="p-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Statement Modal */}
      {statementCustomerId && (
        <CustomerStatementModal
          isOpen={!!statementCustomerId}
          customerId={statementCustomerId}
          onClose={() => setStatementCustomerId(null)}
          onPaymentRecorded={() => {
            loadData()
          }}
        />
      )}

      {/* Record Payment Modal */}
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

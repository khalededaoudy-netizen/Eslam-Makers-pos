/**
 * MAKERS POS — Reports & Analytics Page
 * Comprehensive business intelligence, financial reporting, and operational auditing.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettingsStore } from '@/stores/settingsStore'
import {
  ReportSection,
  ReportDateRange,
  ReportOverviewKPIs,
} from './types'
import { getDateRangeFromPreset, exportToCSV, printReport } from './reportUtils'
import { reportsService } from './reportsService'

import { ReportSidebar } from './components/ReportSidebar'
import { ReportHeader } from './components/ReportHeader'
import { OverviewReportView } from './views/OverviewReportView'
import { SalesReportView } from './views/SalesReportView'
import { ProfitReportView } from './views/ProfitReportView'
import { ReturnsReportView } from './views/ReturnsReportView'
import { ExpensesReportView } from './views/ExpensesReportView'
import { PurchasesReportView } from './views/PurchasesReportView'
import { InventoryReportView } from './views/InventoryReportView'
import { CustomersReportView } from './views/CustomersReportView'
import { DebtAgingReportView } from './views/DebtAgingReportView'
import { SuppliersReportView } from './views/SuppliersReportView'
import { CashShiftsReportView } from './views/CashShiftsReportView'
import { PaymentsReportView } from './views/PaymentsReportView'
import { ProductCategoryReportView } from './views/ProductCategoryReportView'

export function ReportsPage() {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'ar'
  const currencySymbol = useSettingsStore(s => s.currencySymbol) || 'EGP'

  const [activeSection, setActiveSection] = useState<ReportSection>('overview')
  const [dateRange, setDateRange] = useState<ReportDateRange>(() =>
    getDateRangeFromPreset('today')
  )
  const [overviewKpis, setOverviewKpis] = useState<ReportOverviewKPIs | null>(null)
  const [loading, setLoading] = useState(false)

  const formatCurrency = useCallback((val: number) => {
    return `${val.toLocaleString(isRtl ? 'ar-EG' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${currencySymbol}`
  }, [isRtl, currencySymbol])

  const loadOverview = useCallback(async () => {
    setLoading(true)
    try {
      const kpis = await reportsService.getOverviewKPIs(dateRange)
      setOverviewKpis(kpis)
    } catch (err) {
      console.error('Failed to load overview report KPIs:', err)
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  useEffect(() => {
    loadOverview()
  }, [loadOverview])

  const handleExportCsv = async () => {
    const filename = `MAKERS_POS_Report_${activeSection}_${dateRange.startDate.slice(0, 10)}`
    try {
      if (activeSection === 'sales') {
        const data = await reportsService.getSalesTransactions({ range: dateRange, page: 1, pageSize: 1000 })
        const headers = ['رقم الفاتورة', 'التاريخ', 'العميل', 'الكاشير', 'المجموع', 'الخصم', 'الإجمالي', 'طريقة الدفع']
        const rows = data.rows.map(r => [
          r.invoiceNumber,
          r.createdAt,
          r.customerName || 'عميل نقدي',
          r.cashierName || '—',
          r.subtotal,
          r.discountAmount,
          r.total,
          r.paymentMethods,
        ])
        exportToCSV(filename, headers, rows)
      } else if (activeSection === 'expenses') {
        const data = await reportsService.getExpensesReport({ range: dateRange, page: 1, pageSize: 1000 })
        const headers = ['رقم المصروف', 'التاريخ', 'البند', 'البيان', 'المبلغ', 'طريقة الدفع', 'المستخدم']
        const rows = data.rows.map(r => [
          r.expenseNumber,
          r.date,
          r.categoryNameAr,
          r.description,
          r.amount,
          r.paymentMethod,
          r.userName || '—',
        ])
        exportToCSV(filename, headers, rows)
      } else if (activeSection === 'profit') {
        const data = await reportsService.getProfitReport(dateRange)
        const headers = ['المنتج', 'كود SKU', 'الكمية المباعة', 'الإيراد', 'التكلفة', 'الربح', 'هامش الربح %']
        const rows = data.byProduct.map(r => [
          r.nameAr,
          r.sku,
          r.quantitySold,
          r.revenue,
          r.cost,
          r.profit,
          `${r.marginPct}%`,
        ])
        exportToCSV(filename, headers, rows)
      } else {
        // Fallback generic export
        const headers = ['التقرير', 'الفترة من', 'الفترة إلى', 'تاريخ الإنشاء']
        const rows = [[activeSection, dateRange.startDate, dateRange.endDate, new Date().toISOString()]]
        exportToCSV(filename, headers, rows)
      }
    } catch (err) {
      console.error('Export failed:', err)
    }
  }

  const handlePrint = async () => {
    const dateRangeText = `${dateRange.startDate.slice(0, 10)} → ${dateRange.endDate.slice(0, 10)}`
    if (activeSection === 'sales') {
      const data = await reportsService.getSalesTransactions({ range: dateRange, page: 1, pageSize: 200 })
      const headers = ['الفاتورة', 'التاريخ', 'العميل', 'المجموع', 'الخصم', 'الإجمالي', 'طريقة الدفع']
      const rows = data.rows.map(r => [
        r.invoiceNumber,
        r.createdAt.slice(0, 16).replace('T', ' '),
        r.customerName || 'عميل نقدي',
        formatCurrency(r.subtotal),
        formatCurrency(r.discountAmount),
        formatCurrency(r.total),
        r.paymentMethods,
      ])
      printReport('تقرير المبيعات والعمليات', dateRangeText, headers, rows, isRtl)
    } else if (activeSection === 'profit') {
      const data = await reportsService.getProfitReport(dateRange)
      const headers = ['المنتج', 'كود SKU', 'الكمية', 'الإيراد', 'التكلفة', 'الربح', 'الهامش']
      const rows = data.byProduct.map(r => [
        r.nameAr,
        r.sku,
        r.quantitySold,
        formatCurrency(r.revenue),
        formatCurrency(r.cost),
        formatCurrency(r.profit),
        `${r.marginPct}%`,
      ])
      printReport('تقرير الأرباح وهوامش الربحية', dateRangeText, headers, rows, isRtl)
    } else {
      const headers = ['البيان', 'القيمة']
      const rows = [
        ['صافي المبيعات', overviewKpis ? formatCurrency(overviewKpis.netSales) : '0'],
        ['إجمالي الأرباح', overviewKpis ? formatCurrency(overviewKpis.grossProfit) : '0'],
        ['إجمالي المرتجعات', overviewKpis ? formatCurrency(overviewKpis.totalReturns) : '0'],
        ['إجمالي المصروفات', overviewKpis ? formatCurrency(overviewKpis.totalExpenses) : '0'],
        ['إجمالي المشتريات', overviewKpis ? formatCurrency(overviewKpis.totalPurchases) : '0'],
        ['قيمة المخزون', overviewKpis ? formatCurrency(overviewKpis.inventoryValue) : '0'],
      ]
      printReport('الملخص التنفيذي للأعمال', dateRangeText, headers, rows, isRtl)
    }
  }

  const sectionTitles: Record<ReportSection, { title: string; subtitle: string }> = {
    overview: {
      title: t('reports.overview'),
      subtitle: t('reports.subtitle'),
    },
    sales: {
      title: t('reports.sales'),
      subtitle: 'تفاصيل المبيعات وسجل الفواتير ومساهمة قنوات الدفع',
    },
    profit: {
      title: t('reports.profit'),
      subtitle: 'تحليل تكلفة البضاعة المباعة (COGS) وهوامش الأرباح التاريخية',
    },
    returns: {
      title: t('reports.returns'),
      subtitle: 'سجل المرتجعات وتصنيف حالة الأصناف المرتجعة والمستردات',
    },
    expenses: {
      title: t('reports.expenses'),
      subtitle: 'المصروفات التشغيلية المعتمدة وتوزيعها حسب الفئات وطرق الدفع',
    },
    purchases: {
      title: t('reports.purchases'),
      subtitle: 'فواتير التوريد واستحقاقات الموردين ومتابعة السداد',
    },
    inventory: {
      title: t('reports.inventory'),
      subtitle: 'تقييم المخزون بالتكلفة والبيع وسجل حركات الأصناف',
    },
    customers: {
      title: t('reports.customers'),
      subtitle: 'مبيعات العملاء وحسابات الديون والأرصدة المستحقة',
    },
    customer_debts: {
      title: isRtl ? 'تقرير أعمار ديون العملاء' : 'Customer Debt Aging Report',
      subtitle: isRtl ? 'تحليل الشرائح الزمنية للمديونيات (30 / 60 / 90+ يوم) وجدول حسابات العملاء' : 'Customer aging buckets (30/60/90+ days) and receivables ledger',
    },
    suppliers: {
      title: t('reports.suppliers'),
      subtitle: 'أداء الموردين وإجمالي التوريدات والأرصدة الدائنة',
    },
    cash_shifts: {
      title: t('reports.cashShifts'),
      subtitle: 'سجل الورديات ومطابقة الخزائن وحركات الإيداع والسحب',
    },
    payments: {
      title: t('reports.payments'),
      subtitle: 'توزيع المتحصلات المالية عبر البطاقات البنكية والمحافظ الإلكترونية والنقد',
    },
    products_categories: {
      title: t('reports.productsCategories'),
      subtitle: 'ترتيب المنتجات والفئات الأكثر مبيعاً وتحقيقاً للأرباح',
    },
  }

  const currentMeta = sectionTitles[activeSection] || {
    title: t('reports.title'),
    subtitle: t('reports.subtitle'),
  }

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden bg-background">
      {/* Reports Sidebar */}
      <ReportSidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
      />

      {/* Main Report Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <ReportHeader
          title={currentMeta.title}
          subtitle={currentMeta.subtitle}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          onRefresh={loadOverview}
          onExportCsv={handleExportCsv}
          onPrint={handlePrint}
          loading={loading}
        />

        <div className="p-4 md:p-6 flex-1">
          {activeSection === 'overview' && (
            <OverviewReportView
              kpis={overviewKpis}
              formatCurrency={formatCurrency}
            />
          )}

          {activeSection === 'sales' && (
            <SalesReportView
              dateRange={dateRange}
              formatCurrency={formatCurrency}
            />
          )}

          {activeSection === 'profit' && (
            <ProfitReportView
              dateRange={dateRange}
              formatCurrency={formatCurrency}
            />
          )}

          {activeSection === 'returns' && (
            <ReturnsReportView
              dateRange={dateRange}
              formatCurrency={formatCurrency}
            />
          )}

          {activeSection === 'expenses' && (
            <ExpensesReportView
              dateRange={dateRange}
              formatCurrency={formatCurrency}
            />
          )}

          {activeSection === 'purchases' && (
            <PurchasesReportView
              dateRange={dateRange}
              formatCurrency={formatCurrency}
            />
          )}

          {activeSection === 'inventory' && (
            <InventoryReportView
              dateRange={dateRange}
              formatCurrency={formatCurrency}
            />
          )}

          {activeSection === 'customers' && (
            <CustomersReportView
              dateRange={dateRange}
              formatCurrency={formatCurrency}
            />
          )}

          {activeSection === 'customer_debts' && (
            <DebtAgingReportView
              formatCurrency={formatCurrency}
            />
          )}

          {activeSection === 'suppliers' && (
            <SuppliersReportView
              dateRange={dateRange}
              formatCurrency={formatCurrency}
            />
          )}

          {activeSection === 'cash_shifts' && (
            <CashShiftsReportView
              dateRange={dateRange}
              formatCurrency={formatCurrency}
            />
          )}

          {activeSection === 'payments' && (
            <PaymentsReportView
              dateRange={dateRange}
              formatCurrency={formatCurrency}
            />
          )}

          {activeSection === 'products_categories' && (
            <ProductCategoryReportView
              dateRange={dateRange}
              formatCurrency={formatCurrency}
            />
          )}
        </div>
      </main>
    </div>
  )
}
export default ReportsPage

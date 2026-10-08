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
import { getDateRangeFromPreset, exportToCSV } from './reportUtils'
import { reportsService } from './reportsService'
import { customerDebtService } from '@/services/customers/customerDebtService'
import { printReportA4, downloadReportPDF, shareReportViaWhatsApp } from './reportPrintService'
import { CheckCircle2, AlertCircle } from 'lucide-react'

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
  const currencySymbol = useSettingsStore(s => s.currencySymbol) || (isRtl ? 'ج.م' : 'EGP')
  const storeName = useSettingsStore(s => s.storeName) || 'MAKERS POS'
  const storePhone = useSettingsStore(s => s.storePhone)
  const storeAddress = useSettingsStore(s => s.storeAddress)
  const storeAddressAr = useSettingsStore(s => s.storeAddressAr)

  const [activeSection, setActiveSection] = useState<ReportSection>('overview')
  const [dateRange, setDateRange] = useState<ReportDateRange>(() =>
    getDateRangeFromPreset('today')
  )
  const [overviewKpis, setOverviewKpis] = useState<ReportOverviewKPIs | null>(null)
  const [loading, setLoading] = useState(false)
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const showToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 3500)
  }, [])

  const formatCurrency = useCallback((val: number) => {
    const formattedNum = Number(val || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    return `${formattedNum} ${currencySymbol || (isRtl ? 'ج.م' : 'EGP')}`
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
    const filename = `report_${activeSection}_${new Date().toISOString().slice(0, 10)}.csv`
    try {
      let headers: string[] = []
      let rows: (string | number)[][] = []

      if (activeSection === 'overview') {
        headers = ['بند التقرير', 'القيمة']
        rows = [
          ['صافي المبيعات', overviewKpis?.netSales ?? 0],
          ['إجمالي الأرباح', overviewKpis?.grossProfit ?? 0],
          ['إجمالي المرتجعات', overviewKpis?.totalReturns ?? 0],
          ['إجمالي المصروفات', overviewKpis?.totalExpenses ?? 0],
          ['إجمالي المشتريات', overviewKpis?.totalPurchases ?? 0],
          ['قيمة المخزون', overviewKpis?.inventoryValue ?? 0],
          ['العملاء النشطين', overviewKpis?.activeCustomers ?? 0],
          ['الموردين النشطين', overviewKpis?.activeSuppliers ?? 0],
        ]
      } else if (activeSection === 'sales') {
        const data = await reportsService.getSalesTransactions({ range: dateRange, page: 1, pageSize: 5000 })
        headers = ['رقم الفاتورة', 'التاريخ والوقت', 'العميل', 'الكاشير', 'المجموع', 'الخصم', 'الإجمالي', 'طريقة الدفع']
        rows = data.rows.map(r => [
          r.invoiceNumber,
          r.createdAt,
          r.customerName || 'عميل نقدي',
          r.cashierName || '—',
          r.subtotal,
          r.discountAmount,
          r.total,
          r.paymentMethods,
        ])
      } else if (activeSection === 'profit') {
        const data = await reportsService.getProfitReport(dateRange)
        headers = ['المنتج', 'كود SKU', 'الكمية المباعة', 'الإيراد', 'التكلفة', 'الربح', 'هامش الربح %']
        rows = data.byProduct.map(r => [
          r.nameAr,
          r.sku,
          r.quantitySold,
          r.revenue,
          r.cost,
          r.profit,
          `${r.marginPct}%`,
        ])
      } else if (activeSection === 'returns') {
        const data = await reportsService.getReturnsReport({ range: dateRange, page: 1, pageSize: 5000 })
        headers = ['رقم المرتجع', 'التاريخ', 'رقم فاتورة البيع', 'العميل', 'المسؤول', 'المبلغ المسترد', 'الحالة']
        rows = data.rows.map(r => [
          r.returnNumber,
          r.createdAt,
          r.originalSaleNumber,
          r.customerName || 'عميل نقدي',
          r.userName || '—',
          r.refundAmount,
          r.status,
        ])
      } else if (activeSection === 'expenses') {
        const data = await reportsService.getExpensesReport({ range: dateRange, page: 1, pageSize: 5000 })
        headers = ['رقم المصروف', 'التاريخ', 'البند', 'البيان', 'المبلغ', 'طريقة الدفع', 'المستخدم']
        rows = data.rows.map(r => [
          r.expenseNumber,
          r.date,
          r.categoryNameAr,
          r.description,
          r.amount,
          r.paymentMethod,
          r.userName || '—',
        ])
      } else if (activeSection === 'purchases') {
        const data = await reportsService.getPurchasesReport({ range: dateRange, page: 1, pageSize: 5000 })
        headers = ['رقم الفاتورة', 'تاريخ الشراء', 'المورد', 'الإجمالي', 'المدفوع', 'المتبقي', 'الحالة']
        rows = data.rows.map(r => [
          r.purchaseNumber,
          r.purchasedAt,
          r.supplierName || '—',
          r.total,
          r.paidAmount,
          r.balance,
          r.status,
        ])
      } else if (activeSection === 'inventory') {
        const data = await reportsService.getStockMovements({ range: dateRange, page: 1, pageSize: 5000 })
        headers = ['الصنف', 'كود SKU', 'نوع الحركة', 'الكمية', 'الرصيد قبل', 'الرصيد بعد', 'التاريخ والوقت', 'السبب']
        rows = data.rows.map(m => [
          m.productNameAr,
          m.sku,
          m.type,
          m.quantity,
          m.stockBefore,
          m.stockAfter,
          m.date,
          m.reason || '—',
        ])
      } else if (activeSection === 'customers') {
        const data = await reportsService.getCustomersReport(dateRange)
        headers = ['اسم العميل', 'رقم الهاتف', 'عدد المعاملات', 'إجمالي المشتريات', 'الرصيد المستحق']
        rows = data.topCustomers.map(r => [
          r.name,
          r.phone || '—',
          r.salesCount,
          r.totalPurchases,
          r.balance,
        ])
      } else if (activeSection === 'customer_debts') {
        const data = await customerDebtService.getAgingReport()
        headers = ['اسم العميل', 'رقم الهاتف', 'إجمالي المديونية', '0-30 يوم', '31-60 يوم', '61-90 يوم', 'أكثر من 90 يوم']
        rows = data.debtors.map(r => [
          r.name,
          r.phone || '—',
          r.balance,
          r.aging_bucket === 'current' ? r.balance : 0,
          r.aging_bucket === '30+' ? r.balance : 0,
          r.aging_bucket === '60+' ? r.balance : 0,
          r.aging_bucket === '90+' ? r.balance : 0,
        ])
      } else if (activeSection === 'suppliers') {
        const data = await reportsService.getSuppliersReport(dateRange)
        headers = ['اسم المورد', 'رقم الهاتف', 'عدد الفواتير', 'إجمالي التوريدات', 'المستحق للمورد']
        rows = data.topSuppliers.map(r => [
          r.name,
          r.phone || '—',
          r.purchasesCount,
          r.totalPurchases,
          r.balance,
        ])
      } else if (activeSection === 'cash_shifts') {
        const data = await reportsService.getShiftsReport(dateRange)
        headers = ['المعرف', 'نقطة البيع', 'الكاشير', 'وقت الفتح', 'وقت الإغلاق', 'بداية العهدة', 'المبيعات النقدية', 'الرصيد الفعلي', 'العجز/الزيادة', 'الحالة']
        rows = data.shifts.map(r => [
          r.id,
          r.registerName,
          r.userName,
          r.openedAt,
          r.closedAt || 'مفتوحة',
          r.openingBalance,
          r.cashSales,
          r.actualCash ?? '—',
          r.difference ?? 0,
          r.status,
        ])
      } else if (activeSection === 'payments') {
        const data = await reportsService.getPaymentMethodBreakdown(dateRange)
        headers = ['طريقة الدفع', 'عدد العمليات', 'المبيعات', 'المستردات', 'الصافي', 'النسبة المئوية %']
        rows = data.methods.map(r => [
          r.labelAr,
          r.salesCount,
          r.salesAmount,
          r.refundsAmount,
          r.netAmount,
          `${r.percentage}%`,
        ])
      } else if (activeSection === 'products_categories') {
        const data = await reportsService.getProductPerformance({ range: dateRange })
        headers = ['اسم المنتج', 'كود SKU', 'الكمية المباعة', 'الإيراد', 'الربح', 'هامش الربح %']
        rows = data.map(r => [
          r.nameAr,
          r.sku,
          r.quantitySold,
          r.revenue,
          r.profit,
          `${r.marginPct}%`,
        ])
      } else {
        headers = ['التقرير', 'الفترة من', 'الفترة إلى', 'تاريخ الإنشاء']
        rows = [[activeSection, dateRange.startDate, dateRange.endDate, new Date().toISOString()]]
      }

      const ok = exportToCSV(filename, headers, rows)
      if (ok) {
        showToast(isRtl ? 'تم تصدير التقرير' : 'Report exported successfully', 'success')
      } else {
        showToast(isRtl ? 'فشل تصدير التقرير' : 'Failed to export report', 'error')
      }
    } catch (err) {
      console.error('Export CSV error:', err)
      showToast(isRtl ? 'حدث خطأ أثناء تصدير ملف CSV' : 'Error exporting CSV', 'error')
    }
  }

  const handlePrintA4 = async () => {
    const reportEl = document.getElementById('report-content') || document.getElementById('active-report-view')
    if (!reportEl) return
    try {
      await printReportA4(reportEl, {
        reportType: activeSection,
        reportTitle: currentMeta.title,
        dateFrom: dateRange.startDate.slice(0, 10),
        dateTo: dateRange.endDate.slice(0, 10),
        storeName: storeName || 'MAKERS POS',
        phone: storePhone || undefined,
        address: isRtl ? (storeAddressAr || storeAddress || undefined) : (storeAddress || undefined),
        isArabic: isRtl,
      })
    } catch (err: any) {
      console.error('Print A4 error:', err)
      showToast(isRtl ? 'تعذر تشغيل أمر الطباعة' : 'Failed to print report', 'error')
    }
  }

  const handleExportPdf = async () => {
    const reportEl = document.getElementById('report-content') || document.getElementById('active-report-view')
    if (!reportEl) return
    showToast(isRtl ? 'جاري تجهيز وتحميل ملف PDF...' : 'Generating PDF...', 'success')
    try {
      await downloadReportPDF(reportEl, {
        reportType: activeSection,
        reportTitle: currentMeta.title,
        dateFrom: dateRange.startDate.slice(0, 10),
        dateTo: dateRange.endDate.slice(0, 10),
        storeName: storeName || 'MAKERS POS',
        phone: storePhone || undefined,
        address: isRtl ? (storeAddressAr || storeAddress || undefined) : (storeAddress || undefined),
        isArabic: isRtl,
      })
      showToast(isRtl ? 'تم تحميل ملف PDF بنجاح' : 'PDF downloaded successfully', 'success')
    } catch (err: any) {
      console.error('PDF export error:', err)
      showToast(isRtl ? 'تعذر تصدير ملف PDF' : 'Failed to export PDF', 'error')
    }
  }

  const handleShareWhatsApp = async () => {
    const reportEl = document.getElementById('report-content') || document.getElementById('active-report-view')
    if (!reportEl) return
    showToast(isRtl ? 'جاري تجهيز صورة التقرير وفتح واتساب...' : 'Preparing WhatsApp share...', 'success')
    try {
      const res = await shareReportViaWhatsApp(reportEl, {
        reportType: activeSection,
        reportTitle: currentMeta.title,
        dateFrom: dateRange.startDate.slice(0, 10),
        dateTo: dateRange.endDate.slice(0, 10),
        storeName: storeName || 'MAKERS POS',
        phone: storePhone || undefined,
        address: isRtl ? (storeAddressAr || storeAddress || undefined) : (storeAddress || undefined),
        isArabic: isRtl,
      })
      if (res.success) {
        showToast(res.message, 'success')
      }
    } catch (err: any) {
      console.error('WhatsApp share error:', err)
      showToast(isRtl ? 'تعذر مشاركة التقرير عبر واتساب' : 'Failed to share report on WhatsApp', 'error')
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
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto relative">
        {toastMessage && (
          <div
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 transition-all duration-200 ${
              toastMessage.type === 'success'
                ? 'bg-emerald-600 text-white'
                : 'bg-rose-600 text-white'
            }`}
          >
            <span>{toastMessage.text}</span>
          </div>
        )}

        <ReportHeader
          title={currentMeta.title}
          subtitle={currentMeta.subtitle}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          onRefresh={loadOverview}
          onExportCsv={handleExportCsv}
          onExportPdf={handleExportPdf}
          onPrintA4={handlePrintA4}
          onShareWhatsApp={handleShareWhatsApp}
          loading={loading}
        />

        <div id="report-content" className="p-4 md:p-6 flex-1">
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

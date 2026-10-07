/**
 * MAKERS POS — Modern Dashboard Page
 * Real-time operational overview, KPIs with trends & sparklines,
 * interactive charts, quick actions, store alerts, and live activity feed.
 */

import React, { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  TrendingDown,
  Receipt,
  ShoppingBag,
  Users,
  AlertTriangle,
  RefreshCw,
  AlertCircle,
  LayoutDashboard,
  CheckCircle2,
} from 'lucide-react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useAuthStore } from '@/stores/authStore'
import { dashboardService } from './dashboardService'
import { DashboardData, DashboardDateRange, DateRangePreset } from './types'
import { DateRangeFilter } from './components/DateRangeFilter'
import { KpiCard } from './components/KpiCard'
import { QuickActionsRow } from './components/QuickActionsRow'
import { SalesTrendChart } from './components/SalesTrendChart'
import { PaymentMethodChart } from './components/PaymentMethodChart'
import { TopProductsCard } from './components/TopProductsCard'
import { CategoryDistributionChart } from './components/CategoryDistributionChart'
import { HourlySalesChart } from './components/HourlySalesChart'
import { AlertsCard } from './components/AlertsCard'
import { RecentActivityCard } from './components/RecentActivityCard'
import { CashRegisterCard } from './components/CashRegisterCard'
import { InventorySummaryCard } from './components/InventorySummaryCard'
import { SmartImportModal } from '@/features/products/components/SmartImportModal'
import { QuickShiftModal } from '@/features/pos/components/QuickShiftModal'
import { QuickCloseShiftModal } from '@/features/pos/components/QuickCloseShiftModal'

export function DashboardPage() {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language !== 'en'
  const user = useAuthStore(s => s.user)
  const currencySymbol = useSettingsStore(s => s.currencySymbol) || 'EGP'

  const [dateRange, setDateRange] = useState<DashboardDateRange>(() => {
    const saved = localStorage.getItem('makers_pos_dashboard_preset') as DateRangePreset | null
    return dashboardService.getDateRangeFromPreset(saved || 'today')
  })

  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)

  // Modals state
  const [isSmartImportOpen, setIsSmartImportOpen] = useState(false)
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const showToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 3500)
  }, [])

  const formatCurrency = useCallback((val: number) => {
    return `${val.toLocaleString(isArabic ? 'ar-EG' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${currencySymbol}`
  }, [isArabic, currencySymbol])

  const loadDashboard = useCallback(async (showLoadingSpinner = true) => {
    if (showLoadingSpinner) setLoading(true)
    setError(null)
    try {
      const res = await dashboardService.getDashboardData(dateRange, user?.id)
      setData(res)
    } catch (err: any) {
      console.error('Failed to load dashboard:', err)
      setError(err?.message || 'Failed to load dashboard data')
    } finally {
      if (showLoadingSpinner) setLoading(false)
    }
  }, [dateRange, user])

  useEffect(() => {
    loadDashboard(true)
  }, [loadDashboard])

  // Auto-refresh interval (every 30 seconds if enabled)
  useEffect(() => {
    if (!autoRefresh) return
    const timer = setInterval(() => {
      loadDashboard(false)
    }, 30000)
    return () => clearInterval(timer)
  }, [autoRefresh, loadDashboard])

  if (loading && !data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground min-h-[400px]">
        <div className="w-9 h-9 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <span className="text-xs font-semibold">{isArabic ? 'جاري تحميل لوحة التحكم...' : 'Loading Dashboard...'}</span>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4 min-h-[400px]">
        <div className="p-3 bg-rose-500/10 text-rose-500 rounded-2xl">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-base font-bold text-foreground">
            {isArabic ? 'حدث خطأ في تحميل لوحة التحكم' : 'Failed to load dashboard'}
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-md">{error}</p>
        </div>
        <button
          onClick={() => loadDashboard(true)}
          className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-md hover:bg-primary/90 transition-all flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>{isArabic ? 'إعادة المحاولة' : 'Retry'}</span>
        </button>
      </div>
    )
  }

  const kpis = data?.kpis || {
    totalSales: 0,
    totalReturns: 0,
    netSales: 0,
    grossProfit: 0,
    totalExpenses: 0,
    totalPurchases: 0,
    salesCount: 0,
    itemsSold: 0,
    avgSale: 0,
    activeCustomers: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
  }

  const trends = kpis.trends || {}
  const sparklines = kpis.sparklines || {}

  const trendPeriodLabel = dateRange.preset === 'today'
    ? (isArabic ? 'مقارنة بأمس' : 'vs yesterday')
    : (isArabic ? 'مقارنة بالفترة السابقة' : 'vs previous period')

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background text-foreground">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
          <div
            className={`px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold border backdrop-blur-md ${
              toastMessage.type === 'success'
                ? 'bg-emerald-500/90 text-white border-emerald-400/50'
                : 'bg-rose-500/90 text-white border-rose-400/50'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="px-6 py-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/40">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {isArabic ? 'لوحة التحكم والتحليلات' : 'Executive Dashboard'}
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isArabic ? 'مؤشرات الأداء اللحظية، الإيرادات، والمخزون' : 'Real-time performance indicators, revenue, and inventory'}
          </p>
        </div>

        {/* Date Filter & Refresh Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangeFilter
            currentRange={dateRange}
            onRangeChange={setDateRange}
          />

          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
              autoRefresh
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
                : 'border-border bg-card hover:bg-muted text-muted-foreground'
            }`}
            title={isArabic ? 'تحديث تلقائي كل 30 ثانية' : 'Auto refresh every 30s'}
          >
            <span className="hidden sm:inline">
              {isArabic ? 'تحديث تلقائي' : 'Live Auto-Sync'}
            </span>
            <span
              className={`w-2 h-2 rounded-full inline-block sm:ml-1.5 ${
                autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40'
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() => loadDashboard(true)}
            disabled={loading}
            className="p-2 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all shrink-0"
            title={isArabic ? 'تحديث البيانات' : 'Refresh'}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* 1. Quick Actions Row (6 Buttons) */}
        <QuickActionsRow
          onOpenSmartImport={() => setIsSmartImportOpen(true)}
          onToggleShift={() => setIsShiftModalOpen(true)}
          isShiftOpen={!!data?.activeShift}
          onToast={showToast}
        />

        {/* 2. Executive KPI Cards (4 columns x 2 rows) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Sales */}
          <KpiCard
            title={isArabic ? 'إجمالي المبيعات' : 'Gross Sales'}
            value={formatCurrency(kpis.totalSales)}
            subtitle={`${kpis.salesCount} ${isArabic ? 'فاتورة' : 'bills'} • ${kpis.itemsSold} ${isArabic ? 'قطعة' : 'units'}`}
            icon={TrendingUp}
            colorClass="text-blue-500"
            bgClass="bg-blue-500/10"
            borderClass="border-blue-500/20"
            trend={trends.totalSales}
            trendLabel={trendPeriodLabel}
            sparklineData={sparklines.totalSales}
            sparklineColor="#3b82f6"
            to="/sales"
          />

          {/* Net Sales */}
          <KpiCard
            title={isArabic ? 'صافي المبيعات' : 'Net Revenue'}
            value={formatCurrency(kpis.netSales)}
            subtitle={isArabic ? 'بعد خصم المرتجعات' : 'Sales minus refunds'}
            icon={DollarSign}
            colorClass="text-purple-500"
            bgClass="bg-purple-500/10"
            borderClass="border-purple-500/20"
            trend={trends.netSales}
            trendLabel={trendPeriodLabel}
            sparklineData={sparklines.netSales}
            sparklineColor="#8b5cf6"
            to="/reports"
          />

          {/* Gross Profit */}
          <KpiCard
            title={isArabic ? 'إجمالي الأرباح' : 'Gross Margin'}
            value={formatCurrency(kpis.grossProfit)}
            subtitle={isArabic ? 'من واقع لقطات التكلفة' : 'Historical cost margin'}
            icon={ArrowUpRight}
            colorClass="text-emerald-500"
            bgClass="bg-emerald-500/10"
            borderClass="border-emerald-500/20"
            trend={trends.grossProfit}
            trendLabel={trendPeriodLabel}
            sparklineData={sparklines.grossProfit}
            sparklineColor="#10b981"
            to="/reports"
          />

          {/* Total Expenses */}
          <KpiCard
            title={isArabic ? 'المصروفات التشغيلية' : 'Operating Expenses'}
            value={formatCurrency(kpis.totalExpenses)}
            subtitle={isArabic ? 'المصروفات المعتمدة' : 'Approved expenses'}
            icon={TrendingDown}
            colorClass="text-rose-500"
            bgClass="bg-rose-500/10"
            borderClass="border-rose-500/20"
            trend={trends.totalExpenses}
            trendLabel={trendPeriodLabel}
            isExpense={true}
            to="/expenses"
          />

          {/* Invoice Count */}
          <KpiCard
            title={isArabic ? 'عدد الفواتير' : 'Invoices Count'}
            value={String(kpis.salesCount)}
            subtitle={isArabic ? 'فواتير مكتملة في الفترة' : 'Completed transactions'}
            icon={Receipt}
            colorClass="text-cyan-500"
            bgClass="bg-cyan-500/10"
            borderClass="border-cyan-500/20"
            trend={trends.salesCount}
            trendLabel={trendPeriodLabel}
            sparklineData={sparklines.salesCount}
            sparklineColor="#06b6d4"
            to="/sales"
          />

          {/* Average Sale Value */}
          <KpiCard
            title={isArabic ? 'متوسط قيمة الفاتورة' : 'Average Basket Value'}
            value={formatCurrency(kpis.avgSale)}
            subtitle={isArabic ? 'معدل سلة الشراء لكل عميل' : 'Average revenue per bill'}
            icon={ShoppingBag}
            colorClass="text-indigo-500"
            bgClass="bg-indigo-500/10"
            borderClass="border-indigo-500/20"
            trend={trends.avgSale}
            trendLabel={trendPeriodLabel}
            sparklineData={sparklines.avgSale}
            sparklineColor="#6366f1"
            to="/sales"
          />

          {/* Active Customers */}
          <KpiCard
            title={isArabic ? 'العملاء النشطون' : 'Active Customers'}
            value={String(kpis.activeCustomers)}
            subtitle={isArabic ? 'عملاء أجروا مشتريات بالفترة' : 'Customers who transacted'}
            icon={Users}
            colorClass="text-amber-500"
            bgClass="bg-amber-500/10"
            borderClass="border-amber-500/20"
            trend={trends.activeCustomers}
            trendLabel={trendPeriodLabel}
            to="/customers"
          />

          {/* Low Stock Items */}
          <KpiCard
            title={isArabic ? 'نواقص المخزون' : 'Low Stock Items'}
            value={String(kpis.lowStockCount)}
            subtitle={
              kpis.outOfStockCount > 0
                ? `${kpis.outOfStockCount} ${isArabic ? 'صنف نفذ تماماً' : 'out of stock'}`
                : (isArabic ? 'تحت الحد الأدنى' : 'Below threshold')
            }
            icon={AlertTriangle}
            colorClass="text-orange-500"
            bgClass="bg-orange-500/10"
            borderClass="border-orange-500/20"
            to="/inventory"
          />
        </div>

        {/* 3. Primary Charts Row: Sales Trend (2 cols) + Payment Methods Donut (1 col) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SalesTrendChart data={data?.salesTrend || []} />
          </div>
          <div>
            <PaymentMethodChart methods={data?.paymentMethods || []} />
          </div>
        </div>

        {/* 4. Secondary Analytics Row: Top Products + Category Distribution + Hourly Rush */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <TopProductsCard products={data?.topProducts || []} />
          <CategoryDistributionChart categories={data?.categoryPerformance || []} />
          <HourlySalesChart hourlySales={data?.hourlySales || []} />
        </div>

        {/* 5. Operations Row: Alerts (1 col) + Live Activity Feed (1 col) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AlertsCard alerts={data?.alerts || []} />
          <RecentActivityCard activities={data?.recentActivity || []} />
        </div>

        {/* 6. Shift Status & Inventory Valuation Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CashRegisterCard
            activeShift={data?.activeShift}
            reconciliation={data?.shiftReconciliation}
          />
          <InventorySummaryCard summary={data?.inventory || {
            totalProducts: 0,
            totalStockUnits: 0,
            inventoryCostValue: 0,
            inventoryRetailValue: 0,
            lowStockCount: 0,
            outOfStockCount: 0,
          }} />
        </div>
      </div>

      {/* Smart Excel Import Modal */}
      <SmartImportModal
        isOpen={isSmartImportOpen}
        onClose={() => setIsSmartImportOpen(false)}
        onSuccess={() => {
          showToast(isArabic ? 'تم استيراد المنتجات بنجاح' : 'Products imported successfully')
          loadDashboard(false)
        }}
      />

      {/* Quick Shift Open Modal */}
      {isShiftModalOpen && !data?.activeShift && (
        <QuickShiftModal
          isOpen={isShiftModalOpen}
          onClose={() => setIsShiftModalOpen(false)}
          onShiftOpened={() => {
            setIsShiftModalOpen(false)
            showToast(isArabic ? 'تم فتح الوردية بنجاح' : 'Shift opened successfully')
            loadDashboard(false)
          }}
          onToast={showToast}
        />
      )}

      {/* Quick Shift Close Modal */}
      {isShiftModalOpen && data?.activeShift && (
        <QuickCloseShiftModal
          isOpen={isShiftModalOpen}
          shiftId={data.activeShift.id}
          onClose={() => setIsShiftModalOpen(false)}
          onShiftClosed={() => {
            setIsShiftModalOpen(false)
            showToast(isArabic ? 'تم إغلاق الوردية وحفظ الجرد' : 'Shift closed successfully')
            loadDashboard(false)
          }}
          onToast={showToast}
        />
      )}
    </div>
  )
}

/**
 * MAKERS POS — Dashboard Page
 * Real-time operational overview, analytics, and performance KPIs.
 */

import React, { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  TrendingUp,
  RotateCcw,
  DollarSign,
  ArrowUpRight,
  TrendingDown,
  ShoppingBag,
  ShoppingCart,
  Package,
  RefreshCw,
  AlertCircle,
  LayoutDashboard,
} from 'lucide-react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useAuthStore } from '@/stores/authStore'
import { dashboardService } from './dashboardService'
import { DashboardData, DashboardDateRange } from './types'
import { DateRangeFilter } from './components/DateRangeFilter'
import { KpiCard } from './components/KpiCard'
import { SalesTrendChart } from './components/SalesTrendChart'
import { PaymentMethodChart } from './components/PaymentMethodChart'
import { ExpenseCategoryChart } from './components/ExpenseCategoryChart'
import { TopProductsCard } from './components/TopProductsCard'
import { CashRegisterCard } from './components/CashRegisterCard'
import { InventorySummaryCard } from './components/InventorySummaryCard'
import { LowStockCard } from './components/LowStockCard'
import { RecentActivityCard } from './components/RecentActivityCard'
import { CustomerSupplierCard } from './components/CustomerSupplierCard'

export function DashboardPage() {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'ar'
  const user = useAuthStore(s => s.user)
  const currencySymbol = useSettingsStore(s => s.currencySymbol) || 'EGP'

  const [dateRange, setDateRange] = useState<DashboardDateRange>(() =>
    dashboardService.getDateRangeFromPreset('today')
  )
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)

  const formatCurrency = useCallback((val: number) => {
    return `${val.toLocaleString(isRtl ? 'ar-EG' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${currencySymbol}`
  }, [isRtl, currencySymbol])

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
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <span className="text-xs font-semibold">{t('common.loading')}...</span>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="p-3 bg-rose-500/10 text-rose-500 rounded-2xl">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-base font-bold text-foreground">
            {t('common.error', 'حدث خطأ في تحميل لوحة التحكم')}
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-md">{error}</p>
        </div>
        <button
          onClick={() => loadDashboard(true)}
          className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-md hover:bg-primary/90 transition-all flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>{t('common.retry', 'إعادة المحاولة')}</span>
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
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background text-foreground">
      {/* Top Header */}
      <div className="px-6 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/40">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {t('dashboard.title')}
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{t('dashboard.subtitle')}</p>
        </div>

        {/* Controls: Date Filter & Refresh */}
        <div className="flex items-center gap-2.5">
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
            title={t('dashboard.autoRefresh')}
          >
            <span className="hidden sm:inline">{t('dashboard.autoRefresh')}</span>
            <span className={`w-2 h-2 rounded-full inline-block sm:ml-1.5 ${autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40'}`} />
          </button>

          <button
            type="button"
            onClick={() => loadDashboard(true)}
            disabled={loading}
            className="p-2 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all shrink-0"
            title={t('dashboard.refresh')}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Dashboard Grid */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Main 6 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <KpiCard
            title={t('dashboard.totalSales')}
            value={formatCurrency(kpis.totalSales)}
            subtitle={`${kpis.salesCount} ${isRtl ? 'فاتورة' : 'invoices'} • ${kpis.itemsSold} ${isRtl ? 'قطعة' : 'items'}`}
            icon={TrendingUp}
            colorClass="text-blue-500"
            bgClass="bg-blue-500/10"
            borderClass="border-blue-500/20"
          />

          <KpiCard
            title={t('dashboard.totalReturns')}
            value={formatCurrency(kpis.totalReturns)}
            subtitle={isRtl ? 'مرتجعات معتمدة' : 'Approved returns'}
            icon={RotateCcw}
            colorClass="text-amber-500"
            bgClass="bg-amber-500/10"
            borderClass="border-amber-500/20"
          />

          <KpiCard
            title={t('dashboard.netSales')}
            value={formatCurrency(kpis.netSales)}
            subtitle={isRtl ? 'المبيعات بعد خصم المرتجع' : 'Sales minus returns'}
            icon={DollarSign}
            colorClass="text-purple-500"
            bgClass="bg-purple-500/10"
            borderClass="border-purple-500/20"
          />

          <KpiCard
            title={t('dashboard.grossProfit')}
            value={formatCurrency(kpis.grossProfit)}
            subtitle={isRtl ? 'من واقع لقطات التكلفة التاريخية' : 'Historical margin snapshot'}
            icon={ArrowUpRight}
            colorClass="text-emerald-500"
            bgClass="bg-emerald-500/10"
            borderClass="border-emerald-500/20"
          />

          <KpiCard
            title={t('dashboard.expenses')}
            value={formatCurrency(kpis.totalExpenses)}
            subtitle={isRtl ? 'المصروفات التشغيلية المعتمدة' : 'Operating expenses'}
            icon={TrendingDown}
            colorClass="text-rose-500"
            bgClass="bg-rose-500/10"
            borderClass="border-rose-500/20"
          />

          <KpiCard
            title={t('dashboard.purchases')}
            value={formatCurrency(kpis.totalPurchases)}
            subtitle={isRtl ? 'فواتير التوريد المستلمة' : 'Received purchase orders'}
            icon={ShoppingBag}
            colorClass="text-indigo-500"
            bgClass="bg-indigo-500/10"
            borderClass="border-indigo-500/20"
          />
        </div>

        {/* Charts Row: Sales Trend Chart & Payment Methods */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SalesTrendChart data={data?.salesTrend || []} />
          </div>
          <div>
            <PaymentMethodChart methods={data?.paymentMethods || []} />
          </div>
        </div>

        {/* Cash Drawer, Shift Status & Inventory Row */}
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

        {/* Expense Categories & Top Products Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ExpenseCategoryChart categories={data?.expenseCategories || []} />
          <TopProductsCard products={data?.topProducts || []} />
        </div>

        {/* Low Stock & Recent Activity Timeline Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LowStockCard items={data?.lowStock || []} />
          <RecentActivityCard activities={data?.recentActivity || []} />
        </div>

        {/* Customers & Suppliers Overview */}
        <CustomerSupplierCard
          customers={data?.customers || { totalCustomers: 0, activeCustomers: 0, newCustomersInPeriod: 0 }}
          suppliers={data?.suppliers || { totalSuppliers: 0, activeSuppliers: 0, suppliersWithBalance: 0 }}
        />
      </div>
    </div>
  )
}

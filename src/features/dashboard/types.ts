/**
 * MAKERS POS — Dashboard Types
 */

import { PaymentMethodType } from '@/features/payments/types'
import { Shift, ShiftReconciliation } from '@/features/cash-register/types'

export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'last7days'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear'
  | 'last30days'
  | 'custom'

export interface DashboardDateRange {
  preset: DateRangePreset
  startDate: string
  endDate: string
}

export interface KpiTrend {
  value: number
  percent: number
  isUp: boolean
}

export interface DashboardKPIs {
  totalSales: number
  totalReturns: number
  netSales: number
  grossProfit: number
  totalExpenses: number
  totalPurchases: number
  salesCount: number
  itemsSold: number
  avgSale: number
  activeCustomers: number
  lowStockCount: number
  outOfStockCount: number
  trends?: Record<string, KpiTrend>
  sparklines?: Record<string, number[]>
}

export interface SalesTrendPoint {
  date: string
  label: string
  sales: number
  returns: number
  netSales: number
  expenses: number
  profit: number
  previousSales?: number
}

export interface HourlySalesPoint {
  hour: number
  label: string
  sales: number
  count: number
}

export interface PaymentMethodMetric {
  method: PaymentMethodType
  labelAr: string
  labelEn: string
  amount: number
  count: number
  percentage: number
}

export interface ExpenseCategoryMetric {
  categoryId: string
  nameAr: string
  nameEn: string
  amount: number
  percentage: number
}

export interface TopProductItem {
  productId: string
  nameAr: string
  nameEn: string
  sku: string
  quantitySold: number
  salesTotal: number
  profit: number
}

export interface CategoryPerformanceItem {
  categoryId: string
  nameAr: string
  nameEn: string
  quantitySold: number
  salesTotal: number
}

export interface InventorySummary {
  totalProducts: number
  totalStockUnits: number
  inventoryCostValue: number
  inventoryRetailValue: number
  lowStockCount: number
  outOfStockCount: number
}

export interface LowStockItem {
  id: string
  nameAr: string
  nameEn: string
  sku: string
  currentStock: number
  minStock: number
  unitSymbol: string
  drawerLocation?: string | null
}

export interface OutOfStockItem {
  id: string
  nameAr: string
  nameEn: string
  sku: string
  minStock: number
  unitSymbol: string
}

export interface CustomerSummary {
  totalCustomers: number
  activeCustomers: number
  newCustomersInPeriod: number
}

export interface SupplierSummary {
  totalSuppliers: number
  activeSuppliers: number
  suppliersWithBalance: number
}

export interface RecentActivityItem {
  id: string
  type: 'sale' | 'return' | 'expense' | 'purchase' | 'cash_movement' | 'customer' | 'stock_in' | 'stock_out'
  referenceNumber: string
  description: string
  amount?: number
  date: string
  userName?: string
  status?: string
}

export interface DashboardAlert {
  id: string
  type: 'out_of_stock' | 'low_stock' | 'overdue_debt' | 'old_backup' | 'no_shift' | 'all_good'
  severity: 'critical' | 'warning' | 'info' | 'success'
  titleAr: string
  titleEn: string
  subtitleAr?: string
  subtitleEn?: string
  count?: number
  amount?: number
  date?: string
  route: string
}

export interface DashboardData {
  kpis: DashboardKPIs
  salesTrend: SalesTrendPoint[]
  hourlySales: HourlySalesPoint[]
  paymentMethods: PaymentMethodMetric[]
  expenseCategories: ExpenseCategoryMetric[]
  topProducts: TopProductItem[]
  categoryPerformance: CategoryPerformanceItem[]
  inventory: InventorySummary
  lowStock: LowStockItem[]
  outOfStock: OutOfStockItem[]
  customers: CustomerSummary
  suppliers: SupplierSummary
  recentActivity: RecentActivityItem[]
  alerts: DashboardAlert[]
  shiftReconciliation?: ShiftReconciliation | null
  activeShift?: Shift | null
}

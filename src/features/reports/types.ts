/**
 * MAKERS POS — Reports & Analytics Types
 */

import { PaymentMethodType } from '@/features/payments/types'

export type ReportSection =
  | 'overview'
  | 'sales'
  | 'profit'
  | 'returns'
  | 'expenses'
  | 'purchases'
  | 'inventory'
  | 'customers'
  | 'suppliers'
  | 'cash_shifts'
  | 'payments'
  | 'products_categories'

export type ReportDatePreset =
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'last30days'
  | 'thisMonth'
  | 'lastMonth'
  | 'custom'

export interface ReportDateRange {
  preset: ReportDatePreset
  startDate: string // ISO string 00:00:00.000
  endDate: string   // ISO string 23:59:59.999
}

export interface ReportFilterParams {
  range: ReportDateRange
  search?: string
  status?: string
  customerId?: string
  supplierId?: string
  userId?: string
  categoryId?: string
  paymentMethod?: PaymentMethodType | string
  condition?: string
  page?: number
  pageSize?: number
}

// ─── 1. Overview KPIs ────────────────────────────────────────────────────────
export interface ReportOverviewKPIs {
  totalSales: number
  totalReturns: number
  netSales: number
  grossProfit: number
  profitMarginPct: number
  totalExpenses: number
  totalPurchases: number
  inventoryValue: number
  salesCount: number
  returnsCount: number
  expensesCount: number
  purchasesCount: number
  activeCustomers: number
  activeSuppliers: number
}

// ─── 2. Sales Reports ────────────────────────────────────────────────────────
export interface SalesSummaryReport {
  grossSales: number
  discountTotal: number
  taxTotal: number
  netSales: number
  salesCount: number
  itemsSold: number
  averageSale: number
  cashSales: number
  cardSales: number
  instaPaySales: number
  vodafoneCashSales: number
  bankTransferSales: number
  otherSales: number
}

export interface SalesByDatePoint {
  date: string
  label: string
  sales: number
  count: number
  discount: number
  tax: number
  profit: number
}

export interface SalesTransactionRow {
  id: string
  invoiceNumber: string
  createdAt: string
  customerName?: string
  cashierName?: string
  itemsCount: number
  subtotal: number
  discountAmount: number
  taxAmount: number
  total: number
  status: string
  paymentMethods: string
}

// ─── 3. Profit Report ────────────────────────────────────────────────────────
export interface ProfitSummaryReport {
  grossSales: number
  returnsTotal: number
  netSales: number
  cogs: number // Cost of Goods Sold
  grossProfit: number
  profitMarginPct: number
  byProduct: Array<{
    productId: string
    nameAr: string
    nameEn: string
    sku: string
    quantitySold: number
    revenue: number
    cost: number
    profit: number
    marginPct: number
  }>
  byCategory: Array<{
    categoryId: string
    nameAr: string
    nameEn: string
    quantitySold: number
    revenue: number
    cost: number
    profit: number
    marginPct: number
  }>
  byDate: Array<{
    date: string
    revenue: number
    cost: number
    profit: number
    marginPct: number
  }>
}

// ─── 4. Returns Report ───────────────────────────────────────────────────────
export interface ReturnsSummaryReport {
  totalReturns: number
  returnsCount: number
  returnedQuantity: number
  totalRefundAmount: number
  cashRefunds: number
  nonCashRefunds: number
  resellableCount: number
  damagedCount: number
  defectiveCount: number
}

export interface ReturnTransactionRow {
  id: string
  returnNumber: string
  originalSaleNumber: string
  createdAt: string
  customerName?: string
  userName?: string
  itemsCount: number
  condition: string
  refundAmount: number
  status: string
}

// ─── 5. Expenses Report ──────────────────────────────────────────────────────
export interface ExpensesSummaryReport {
  totalExpenses: number
  cashExpenses: number
  nonCashExpenses: number
  expensesCount: number
  cancelledCount: number
  byCategory: Array<{
    categoryId: string
    nameAr: string
    nameEn: string
    amount: number
    percentage: number
  }>
  byPaymentMethod: Array<{
    method: string
    amount: number
    percentage: number
  }>
}

export interface ExpenseRow {
  id: string
  expenseNumber: string
  date: string
  categoryNameAr: string
  categoryNameEn: string
  supplierName?: string
  paymentMethod: string
  amount: number
  status: string
  userName?: string
  description: string
}

// ─── 6. Purchases Report ─────────────────────────────────────────────────────
export interface PurchasesSummaryReport {
  totalPurchases: number
  invoicesCount: number
  receivedValue: number
  paidAmount: number
  unpaidAmount: number
  bySupplier: Array<{
    supplierId: string
    supplierName: string
    totalAmount: number
    paidAmount: number
    balance: number
    invoicesCount: number
  }>
}

export interface PurchaseRow {
  id: string
  purchaseNumber: string
  supplierName: string
  purchasedAt: string
  itemsCount: number
  total: number
  paidAmount: number
  balance: number
  status: string
  paymentStatus: string
}

// ─── 7. Inventory Reports ────────────────────────────────────────────────────
export interface InventoryStockReport {
  totalProducts: number
  totalUnits: number
  totalStockUnits: number
  inventoryCostValue: number
  inventoryRetailValue: number
  lowStockCount: number
  outOfStockCount: number
  byLocation: Array<{
    location: string
    productCount: number
    quantity: number
    stockValue: number
  }>
}

export interface StockMovementRow {
  id: string
  date: string
  productNameAr: string
  productNameEn: string
  sku: string
  type: string
  quantity: number
  stockBefore: number
  stockAfter: number
  referenceType?: string
  referenceId?: string
  userName?: string
  reason?: string
}

// ─── 8. Customers & Suppliers Reports ────────────────────────────────────────
export interface CustomersReport {
  totalCustomers: number
  activeCustomers: number
  customersWithBalance: number
  totalOutstandingBalance: number
  topCustomers: Array<{
    id: string
    name: string
    phone?: string
    balance: number
    totalPurchases: number
    salesCount: number
  }>
}

export interface SuppliersReport {
  totalSuppliers: number
  activeSuppliers: number
  suppliersWithBalance: number
  totalOutstandingBalance: number
  topSuppliers: Array<{
    id: string
    name: string
    phone?: string
    balance: number
    totalPurchases: number
    purchasesCount: number
  }>
}

// ─── 9. Cash & Shift Reports ─────────────────────────────────────────────────
export interface ShiftsSummaryReport {
  shiftsCount: number
  totalCashSales: number
  totalCashRefunds: number
  totalCashExpenses: number
  totalCashDeposits: number
  totalCashWithdrawals: number
  shifts: Array<{
    id: string
    registerName: string
    userName: string
    openedAt: string
    closedAt?: string
    openingBalance: number
    cashSales: number
    cashRefunds: number
    cashExpenses: number
    expectedCash: number
    actualCash?: number
    difference?: number
    status: string
  }>
}

export interface CashMovementRow {
  id: string
  createdAt: string
  registerName: string
  shiftId: string
  type: string
  direction: 'in' | 'out'
  amount: number
  reason: string
  notes?: string
  userName?: string
}

// ─── 10. Payment Method Report ───────────────────────────────────────────────
export interface PaymentMethodBreakdownReport {
  methods: Array<{
    method: string
    labelAr: string
    labelEn: string
    salesAmount: number
    salesCount: number
    refundsAmount: number
    netAmount: number
    percentage: number
  }>
  totalNet: number
}

// ─── 11. Product & Category Performance ──────────────────────────────────────
export interface ProductPerformanceRow {
  id: string
  nameAr: string
  nameEn: string
  sku: string
  categoryNameAr?: string
  categoryNameEn?: string
  quantitySold: number
  revenue: number
  cost: number
  profit: number
  marginPct: number
  returnQuantity: number
}

export interface CategoryPerformanceRow {
  id: string
  nameAr: string
  nameEn: string
  productCount: number
  quantitySold: number
  revenue: number
  cost: number
  profit: number
  marginPct: number
  returnQuantity: number
}

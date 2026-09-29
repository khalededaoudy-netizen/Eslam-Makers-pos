/**
 * MAKERS POS — Dashboard Analytics Service
 * High-performance, read-only analytics service consuming production SQLite database.
 */

import { getDb } from '@/services/db/database'
import { cashRegisterService } from '@/features/cash-register/cashRegisterService'
import { PaymentMethodType } from '@/features/payments/types'
import {
  DashboardDateRange,
  DateRangePreset,
  DashboardKPIs,
  SalesTrendPoint,
  PaymentMethodMetric,
  ExpenseCategoryMetric,
  TopProductItem,
  CategoryPerformanceItem,
  InventorySummary,
  LowStockItem,
  OutOfStockItem,
  CustomerSummary,
  SupplierSummary,
  RecentActivityItem,
  DashboardData,
} from './types'

export class DashboardService {
  /**
   * Helper to build start/end boundaries for a given date range preset
   */
  getDateRangeFromPreset(preset: DateRangePreset, customStart?: string, customEnd?: string): DashboardDateRange {
    const now = new Date()

    if (preset === 'custom' && customStart && customEnd) {
      const start = new Date(customStart)
      start.setHours(0, 0, 0, 0)
      const end = new Date(customEnd)
      end.setHours(23, 59, 59, 999)
      return {
        preset: 'custom',
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      }
    }

    const start = new Date(now)
    const end = new Date(now)

    switch (preset) {
      case 'today': {
        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)
        break
      }
      case 'yesterday': {
        start.setDate(start.getDate() - 1)
        start.setHours(0, 0, 0, 0)
        end.setDate(end.getDate() - 1)
        end.setHours(23, 59, 59, 999)
        break
      }
      case 'last7days': {
        start.setDate(start.getDate() - 6)
        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)
        break
      }
      case 'last30days': {
        start.setDate(start.getDate() - 29)
        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)
        break
      }
      case 'thisMonth': {
        start.setDate(1)
        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)
        break
      }
      case 'lastMonth': {
        start.setMonth(start.getMonth() - 1)
        start.setDate(1)
        start.setHours(0, 0, 0, 0)
        // Last day of last month
        end.setDate(0)
        end.setHours(23, 59, 59, 999)
        break
      }
      default: {
        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)
      }
    }

    return {
      preset,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    }
  }

  /**
   * Fetch all main operational KPIs for the selected date range
   */
  async getKPIs(range: DashboardDateRange): Promise<DashboardKPIs> {
    const db = getDb()

    // 1. Completed Sales
    const [salesRow] = await db.select<Array<{ total: number; count: number }>>(`
      SELECT 
        COALESCE(SUM(total), 0) AS total,
        COUNT(id) AS count
      FROM sales
      WHERE created_at >= ? AND created_at <= ? AND status = 'completed'
    `, [range.startDate, range.endDate])

    // 2. Sale items total quantity and profit (historical snapshot)
    const [itemsRow] = await db.select<Array<{ items: number; gross_profit: number }>>(`
      SELECT 
        COALESCE(SUM(si.quantity), 0) AS items,
        COALESCE(SUM(si.profit), 0) AS gross_profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE s.created_at >= ? AND s.created_at <= ? AND s.status = 'completed'
    `, [range.startDate, range.endDate])

    // 3. Completed Returns
    const [returnsRow] = await db.select<Array<{ total_refund: number }>>(`
      SELECT 
        COALESCE(SUM(refund_amount), 0) AS total_refund
      FROM returns
      WHERE created_at >= ? AND created_at <= ? AND (status = 'completed' OR status IS NULL)
    `, [range.startDate, range.endDate])

    // 4. Returns profit deduction impact
    const [returnProfitRow] = await db.select<Array<{ return_profit: number }>>(`
      SELECT 
        COALESCE(SUM(ri.quantity * ((si.unit_price - si.cost_price) - (si.discount_amount / NULLIF(si.quantity, 0)))), 0) AS return_profit
      FROM return_items ri
      JOIN returns r ON ri.return_id = r.id
      JOIN sale_items si ON ri.sale_item_id = si.id
      WHERE r.created_at >= ? AND r.created_at <= ? AND (r.status = 'completed' OR r.status IS NULL)
    `, [range.startDate, range.endDate])

    // 5. Completed Expenses
    const [expensesRow] = await db.select<Array<{ total: number }>>(`
      SELECT 
        COALESCE(SUM(amount), 0) AS total
      FROM expenses
      WHERE (expense_date >= ? AND expense_date <= ?) 
        AND (status = 'completed' OR status IS NULL)
    `, [range.startDate, range.endDate])

    // 6. Completed Purchases
    const [purchasesRow] = await db.select<Array<{ total: number }>>(`
      SELECT 
        COALESCE(SUM(total), 0) AS total
      FROM purchases
      WHERE (purchased_at >= ? AND purchased_at <= ?)
        AND (status = 'received' OR status = 'completed' OR status IS NULL)
    `, [range.startDate, range.endDate])

    const totalSales = Number(salesRow?.total) || 0
    const salesCount = Number(salesRow?.count) || 0
    const itemsSold = Number(itemsRow?.items) || 0
    const initialGrossProfit = Number(itemsRow?.gross_profit) || 0
    const totalReturns = Number(returnsRow?.total_refund) || 0
    const returnProfit = Number(returnProfitRow?.return_profit) || 0
    const totalExpenses = Number(expensesRow?.total) || 0
    const totalPurchases = Number(purchasesRow?.total) || 0

    const netSales = Number((totalSales - totalReturns).toFixed(2))
    const grossProfit = Number((initialGrossProfit - returnProfit).toFixed(2))

    return {
      totalSales: Number(totalSales.toFixed(2)),
      totalReturns: Number(totalReturns.toFixed(2)),
      netSales,
      grossProfit,
      totalExpenses: Number(totalExpenses.toFixed(2)),
      totalPurchases: Number(totalPurchases.toFixed(2)),
      salesCount,
      itemsSold,
    }
  }

  /**
   * Sales & Net Sales Trend by day across the interval
   */
  async getSalesTrend(range: DashboardDateRange): Promise<SalesTrendPoint[]> {
    const db = getDb()

    // Daily Sales
    const salesRows = await db.select<Array<{ day: string; sales: number; profit: number }>>(`
      SELECT 
        strftime('%Y-%m-%d', s.created_at) AS day,
        COALESCE(SUM(s.total), 0) AS sales,
        COALESCE(SUM(si.profit), 0) AS profit
      FROM sales s
      LEFT JOIN sale_items si ON si.sale_id = s.id
      WHERE s.created_at >= ? AND s.created_at <= ? AND s.status = 'completed'
      GROUP BY strftime('%Y-%m-%d', s.created_at)
      ORDER BY day ASC
    `, [range.startDate, range.endDate])

    // Daily Returns
    const returnRows = await db.select<Array<{ day: string; returns: number }>>(`
      SELECT 
        strftime('%Y-%m-%d', created_at) AS day,
        COALESCE(SUM(refund_amount), 0) AS returns
      FROM returns
      WHERE created_at >= ? AND created_at <= ? AND (status = 'completed' OR status IS NULL)
      GROUP BY strftime('%Y-%m-%d', created_at)
    `, [range.startDate, range.endDate])

    // Daily Expenses
    const expenseRows = await db.select<Array<{ day: string; expenses: number }>>(`
      SELECT 
        strftime('%Y-%m-%d', expense_date) AS day,
        COALESCE(SUM(amount), 0) AS expenses
      FROM expenses
      WHERE expense_date >= ? AND expense_date <= ? AND (status = 'completed' OR status IS NULL)
      GROUP BY strftime('%Y-%m-%d', expense_date)
    `, [range.startDate, range.endDate])

    const map = new Map<string, { sales: number; returns: number; expenses: number; profit: number }>()

    for (const r of salesRows) {
      map.set(r.day, {
        sales: Number(r.sales) || 0,
        returns: 0,
        expenses: 0,
        profit: Number(r.profit) || 0,
      })
    }

    for (const r of returnRows) {
      const existing = map.get(r.day) || { sales: 0, returns: 0, expenses: 0, profit: 0 }
      existing.returns = Number(r.returns) || 0
      map.set(r.day, existing)
    }

    for (const r of expenseRows) {
      const existing = map.get(r.day) || { sales: 0, returns: 0, expenses: 0, profit: 0 }
      existing.expenses = Number(r.expenses) || 0
      map.set(r.day, existing)
    }

    // Sort days chronologically
    const sortedDays = Array.from(map.keys()).sort()

    // If single day (Today or Yesterday), provide at least that day
    if (sortedDays.length === 0) {
      const day = range.startDate.slice(0, 10)
      return [{
        date: day,
        label: day,
        sales: 0,
        returns: 0,
        netSales: 0,
        expenses: 0,
        profit: 0,
      }]
    }

    return sortedDays.map(day => {
      const item = map.get(day)!
      const netSales = Number((item.sales - item.returns).toFixed(2))
      return {
        date: day,
        label: day.slice(5), // MM-DD
        sales: Number(item.sales.toFixed(2)),
        returns: Number(item.returns.toFixed(2)),
        netSales,
        expenses: Number(item.expenses.toFixed(2)),
        profit: Number(item.profit.toFixed(2)),
      }
    })
  }

  /**
   * Payment Methods breakdown for completed sales
   */
  async getPaymentMethodBreakdown(range: DashboardDateRange): Promise<PaymentMethodMetric[]> {
    const db = getDb()

    const rows = await db.select<Array<{ method: string; total_amount: number; count: number }>>(`
      SELECT 
        p.method,
        COALESCE(SUM(p.amount), 0) AS total_amount,
        COUNT(p.id) AS count
      FROM payments p
      JOIN sales s ON p.sale_id = s.id
      WHERE s.created_at >= ? AND s.created_at <= ? AND s.status = 'completed'
      GROUP BY p.method
      ORDER BY total_amount DESC
    `, [range.startDate, range.endDate])

    const totalAll = rows.reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0)

    const labels: Record<string, { ar: string; en: string }> = {
      cash: { ar: 'نقداً', en: 'Cash' },
      card: { ar: 'بطاقة بنكية', en: 'Card' },
      instapay: { ar: 'إنستاباي', en: 'InstaPay' },
      vodafone_cash: { ar: 'فودافون كاش', en: 'Vodafone Cash' },
      bank_transfer: { ar: 'تحويل بنكي', en: 'Bank Transfer' },
      other: { ar: 'أخرى', en: 'Other' },
    }

    return rows.map(r => {
      const methodKey = (r.method || 'cash').toLowerCase() as PaymentMethodType
      const amount = Number(r.total_amount) || 0
      const count = Number(r.count) || 0
      const percentage = totalAll > 0 ? Number(((amount / totalAll) * 100).toFixed(1)) : 0
      const meta = labels[methodKey] || { ar: methodKey, en: methodKey }

      return {
        method: methodKey,
        labelAr: meta.ar,
        labelEn: meta.en,
        amount: Number(amount.toFixed(2)),
        count,
        percentage,
      }
    })
  }

  /**
   * Expense categories breakdown
   */
  async getExpenseCategoryBreakdown(range: DashboardDateRange): Promise<ExpenseCategoryMetric[]> {
    const db = getDb()

    const rows = await db.select<Array<{
      category_id: string | null
      name_ar: string | null
      name_en: string | null
      name: string | null
      total_amount: number
    }>>(`
      SELECT 
        e.category_id,
        ec.name_ar,
        ec.name_en,
        ec.name,
        COALESCE(SUM(e.amount), 0) AS total_amount
      FROM expenses e
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      WHERE (e.expense_date >= ? AND e.expense_date <= ?)
        AND (e.status = 'completed' OR e.status IS NULL)
      GROUP BY e.category_id, ec.name_ar, ec.name_en, ec.name
      ORDER BY total_amount DESC
    `, [range.startDate, range.endDate])

    const totalAll = rows.reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0)

    return rows.map(r => {
      const amount = Number(r.total_amount) || 0
      const percentage = totalAll > 0 ? Number(((amount / totalAll) * 100).toFixed(1)) : 0

      return {
        categoryId: r.category_id || 'general',
        nameAr: r.name_ar || r.name || 'عام',
        nameEn: r.name_en || r.name || 'General',
        amount: Number(amount.toFixed(2)),
        percentage,
      }
    })
  }

  /**
   * Top selling products by revenue and quantity
   */
  async getTopProducts(range: DashboardDateRange, limit = 5): Promise<TopProductItem[]> {
    const db = getDb()

    const rows = await db.select<Array<{
      product_id: string
      name_ar: string | null
      name_en: string | null
      sku: string | null
      quantity_sold: number
      sales_total: number
      profit: number
    }>>(`
      SELECT 
        si.product_id,
        p.name_ar,
        p.name_en,
        COALESCE(si.product_sku, p.sku) AS sku,
        COALESCE(SUM(si.quantity), 0) AS quantity_sold,
        COALESCE(SUM(si.subtotal), 0) AS sales_total,
        COALESCE(SUM(si.profit), 0) AS profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      LEFT JOIN products p ON si.product_id = p.id
      WHERE s.created_at >= ? AND s.created_at <= ? AND s.status = 'completed'
      GROUP BY si.product_id, p.name_ar, p.name_en, sku
      ORDER BY sales_total DESC
      LIMIT ?
    `, [range.startDate, range.endDate, limit])

    return rows.map(r => ({
      productId: r.product_id,
      nameAr: r.name_ar || 'منتج',
      nameEn: r.name_en || 'Product',
      sku: r.sku || '—',
      quantitySold: Number(r.quantity_sold) || 0,
      salesTotal: Number((Number(r.sales_total) || 0).toFixed(2)),
      profit: Number((Number(r.profit) || 0).toFixed(2)),
    }))
  }

  /**
   * Top category sales performance
   */
  async getCategoryPerformance(range: DashboardDateRange, limit = 5): Promise<CategoryPerformanceItem[]> {
    const db = getDb()

    const rows = await db.select<Array<{
      category_id: string | null
      name_ar: string | null
      name_en: string | null
      quantity_sold: number
      sales_total: number
    }>>(`
      SELECT 
        p.category_id,
        c.name_ar,
        c.name_en,
        COALESCE(SUM(si.quantity), 0) AS quantity_sold,
        COALESCE(SUM(si.subtotal), 0) AS sales_total
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      LEFT JOIN product_categories c ON p.category_id = c.id
      WHERE s.created_at >= ? AND s.created_at <= ? AND s.status = 'completed'
      GROUP BY p.category_id, c.name_ar, c.name_en
      ORDER BY sales_total DESC
      LIMIT ?
    `, [range.startDate, range.endDate, limit])

    return rows.map(r => ({
      categoryId: r.category_id || 'uncategorized',
      nameAr: r.name_ar || 'غير مصنف',
      nameEn: r.name_en || 'Uncategorized',
      quantitySold: Number(r.quantity_sold) || 0,
      salesTotal: Number((Number(r.sales_total) || 0).toFixed(2)),
    }))
  }

  /**
   * Inventory summary & valuation
   */
  async getInventorySummary(): Promise<InventorySummary> {
    const db = getDb()

    const [row] = await db.select<Array<{
      total_products: number
      total_units: number
      cost_val: number
      retail_val: number
      low_stock_count: number
      out_of_stock_count: number
    }>>(`
      SELECT 
        COUNT(id) AS total_products,
        COALESCE(SUM(current_stock), 0) AS total_units,
        COALESCE(SUM(current_stock * purchase_price), 0) AS cost_val,
        COALESCE(SUM(current_stock * selling_price), 0) AS retail_val,
        COALESCE(SUM(CASE WHEN current_stock <= min_stock AND min_stock > 0 THEN 1 ELSE 0 END), 0) AS low_stock_count,
        COALESCE(SUM(CASE WHEN current_stock <= 0 THEN 1 ELSE 0 END), 0) AS out_of_stock_count
      FROM products
      WHERE is_active = 1
    `)

    return {
      totalProducts: Number(row?.total_products) || 0,
      totalStockUnits: Number(row?.total_units) || 0,
      inventoryCostValue: Number((Number(row?.cost_val) || 0).toFixed(2)),
      inventoryRetailValue: Number((Number(row?.retail_val) || 0).toFixed(2)),
      lowStockCount: Number(row?.low_stock_count) || 0,
      outOfStockCount: Number(row?.out_of_stock_count) || 0,
    }
  }

  /**
   * Low Stock items list
   */
  async getLowStockProducts(limit = 8): Promise<LowStockItem[]> {
    const db = getDb()

    const rows = await db.select<Array<{
      id: string
      name_ar: string
      name_en: string
      sku: string
      current_stock: number
      min_stock: number
      unit_symbol: string | null
      drawer_location: string | null
    }>>(`
      SELECT 
        p.id,
        p.name_ar,
        p.name_en,
        p.sku,
        p.current_stock,
        p.min_stock,
        pu.symbol AS unit_symbol,
        p.drawer_location
      FROM products p
      LEFT JOIN product_units pu ON p.unit_id = pu.id
      WHERE p.current_stock <= p.min_stock AND p.min_stock > 0 AND p.is_active = 1
      ORDER BY (p.current_stock - p.min_stock) ASC, p.current_stock ASC
      LIMIT ?
    `, [limit])

    return rows.map(r => ({
      id: r.id,
      nameAr: r.name_ar,
      nameEn: r.name_en,
      sku: r.sku,
      currentStock: Number(r.current_stock) || 0,
      minStock: Number(r.min_stock) || 0,
      unitSymbol: r.unit_symbol || 'قطعة',
      drawerLocation: r.drawer_location,
    }))
  }

  /**
   * Out of Stock items list
   */
  async getOutOfStockProducts(limit = 8): Promise<OutOfStockItem[]> {
    const db = getDb()

    const rows = await db.select<Array<{
      id: string
      name_ar: string
      name_en: string
      sku: string
      min_stock: number
      unit_symbol: string | null
    }>>(`
      SELECT 
        p.id,
        p.name_ar,
        p.name_en,
        p.sku,
        p.min_stock,
        pu.symbol AS unit_symbol
      FROM products p
      LEFT JOIN product_units pu ON p.unit_id = pu.id
      WHERE p.current_stock <= 0 AND p.is_active = 1
      ORDER BY p.name_ar ASC
      LIMIT ?
    `, [limit])

    return rows.map(r => ({
      id: r.id,
      nameAr: r.name_ar,
      nameEn: r.name_en,
      sku: r.sku,
      minStock: Number(r.min_stock) || 0,
      unitSymbol: r.unit_symbol || 'قطعة',
    }))
  }

  /**
   * Customer snapshot metrics
   */
  async getCustomerSummary(range: DashboardDateRange): Promise<CustomerSummary> {
    const db = getDb()

    const [row] = await db.select<Array<{
      total_count: number
      active_count: number
      new_in_period: number
    }>>(`
      SELECT 
        COUNT(id) AS total_count,
        COALESCE(SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END), 0) AS active_count,
        COALESCE(SUM(CASE WHEN created_at >= ? AND created_at <= ? THEN 1 ELSE 0 END), 0) AS new_in_period
      FROM customers
    `, [range.startDate, range.endDate])

    return {
      totalCustomers: Number(row?.total_count) || 0,
      activeCustomers: Number(row?.active_count) || 0,
      newCustomersInPeriod: Number(row?.new_in_period) || 0,
    }
  }

  /**
   * Supplier snapshot metrics
   */
  async getSupplierSummary(): Promise<SupplierSummary> {
    const db = getDb()

    const [row] = await db.select<Array<{
      total_count: number
      active_count: number
      with_balance: number
    }>>(`
      SELECT 
        COUNT(id) AS total_count,
        COALESCE(SUM(CASE WHEN is_active = 1 AND archived_at IS NULL THEN 1 ELSE 0 END), 0) AS active_count,
        COALESCE(SUM(CASE WHEN balance > 0 THEN 1 ELSE 0 END), 0) AS with_balance
      FROM suppliers
    `)

    return {
      totalSuppliers: Number(row?.total_count) || 0,
      activeSuppliers: Number(row?.active_count) || 0,
      suppliersWithBalance: Number(row?.with_balance) || 0,
    }
  }

  /**
   * Recent Activity Feed across Sales, Returns, Expenses, Purchases, Cash Movements
   */
  async getRecentActivity(limit = 12): Promise<RecentActivityItem[]> {
    const db = getDb()

    // 1. Recent completed sales
    const sales = await db.select<Array<{
      id: string
      invoice_number: string
      total: number
      created_at: string
      cashier_name: string | null
      status: string
    }>>(`
      SELECT 
        s.id,
        s.invoice_number,
        s.total,
        s.created_at,
        COALESCE(u.full_name, u.username) AS cashier_name,
        s.status
      FROM sales s
      LEFT JOIN users u ON s.cashier_id = u.id
      WHERE s.status = 'completed'
      ORDER BY s.created_at DESC
      LIMIT ?
    `, [limit])

    // 2. Recent returns
    const returns = await db.select<Array<{
      id: string
      return_number: string
      refund_amount: number
      created_at: string
      user_name: string | null
      status: string
    }>>(`
      SELECT 
        r.id,
        r.return_number,
        r.refund_amount,
        r.created_at,
        COALESCE(u.full_name, u.username) AS user_name,
        COALESCE(r.status, 'completed') AS status
      FROM returns r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE (r.status = 'completed' OR r.status IS NULL)
      ORDER BY r.created_at DESC
      LIMIT ?
    `, [limit])

    // 3. Recent expenses
    const expenses = await db.select<Array<{
      id: string
      expense_number: string
      amount: number
      description: string
      expense_date: string
      created_at: string
      user_name: string | null
      status: string
    }>>(`
      SELECT 
        e.id,
        e.expense_number,
        e.amount,
        e.description,
        e.expense_date,
        e.created_at,
        COALESCE(u.full_name, u.username) AS user_name,
        COALESCE(e.status, 'completed') AS status
      FROM expenses e
      LEFT JOIN users u ON COALESCE(e.user_id, e.recorded_by_id) = u.id
      ORDER BY e.created_at DESC
      LIMIT ?
    `, [limit])

    // Combine into unified feed
    const list: RecentActivityItem[] = []

    for (const s of sales) {
      list.push({
        id: s.id,
        type: 'sale',
        referenceNumber: s.invoice_number,
        description: 'عملية بيع مكتملة',
        amount: Number(s.total) || 0,
        date: s.created_at,
        userName: s.cashier_name || undefined,
        status: s.status,
      })
    }

    for (const r of returns) {
      list.push({
        id: r.id,
        type: 'return',
        referenceNumber: r.return_number,
        description: 'مرتجع مبيعات',
        amount: Number(r.refund_amount) || 0,
        date: r.created_at,
        userName: r.user_name || undefined,
        status: r.status,
      })
    }

    for (const e of expenses) {
      list.push({
        id: e.id,
        type: 'expense',
        referenceNumber: e.expense_number || 'EXP',
        description: e.description || 'مصروف تشغيلي',
        amount: Number(e.amount) || 0,
        date: e.expense_date || e.created_at,
        userName: e.user_name || undefined,
        status: e.status,
      })
    }

    // Sort descending by timestamp and slice
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    return list.slice(0, limit)
  }

  /**
   * Fetch all dashboard data concurrently
   */
  async getDashboardData(range: DashboardDateRange, userId?: string): Promise<DashboardData> {
    let activeShift = null
    let shiftReconciliation = null

    if (userId) {
      activeShift = await cashRegisterService.getActiveShift(userId)
      if (activeShift) {
        shiftReconciliation = await cashRegisterService.getShiftReconciliation(activeShift.id)
      }
    }

    const [
      kpis,
      salesTrend,
      paymentMethods,
      expenseCategories,
      topProducts,
      categoryPerformance,
      inventory,
      lowStock,
      outOfStock,
      customers,
      suppliers,
      recentActivity,
    ] = await Promise.all([
      this.getKPIs(range),
      this.getSalesTrend(range),
      this.getPaymentMethodBreakdown(range),
      this.getExpenseCategoryBreakdown(range),
      this.getTopProducts(range),
      this.getCategoryPerformance(range),
      this.getInventorySummary(),
      this.getLowStockProducts(),
      this.getOutOfStockProducts(),
      this.getCustomerSummary(range),
      this.getSupplierSummary(),
      this.getRecentActivity(),
    ])

    return {
      kpis,
      salesTrend,
      paymentMethods,
      expenseCategories,
      topProducts,
      categoryPerformance,
      inventory,
      lowStock,
      outOfStock,
      customers,
      suppliers,
      recentActivity,
      shiftReconciliation,
      activeShift,
    }
  }
}

export const dashboardService = new DashboardService()

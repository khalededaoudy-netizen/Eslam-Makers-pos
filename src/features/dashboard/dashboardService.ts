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
  KpiTrend,
  SalesTrendPoint,
  HourlySalesPoint,
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
  DashboardAlert,
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
      case 'thisWeek': {
        // Start from beginning of current week (Saturday = 6 in JS Date or 7 days ago)
        const day = start.getDay() // 0 = Sunday, 6 = Saturday
        const diff = (day + 1) % 7 // Distance from Saturday
        start.setDate(start.getDate() - diff)
        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)
        break
      }
      case 'last7days': {
        start.setDate(start.getDate() - 6)
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
        end.setDate(0)
        end.setHours(23, 59, 59, 999)
        break
      }
      case 'thisYear': {
        start.setMonth(0, 1)
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
   * Helper to compute comparison date range (e.g. yesterday for today, previous month for this month)
   */
  getPreviousDateRange(range: DashboardDateRange): { startDate: string; endDate: string } {
    const curStart = new Date(range.startDate)
    const curEnd = new Date(range.endDate)
    const duration = curEnd.getTime() - curStart.getTime()

    if (range.preset === 'today') {
      const pStart = new Date(curStart)
      pStart.setDate(pStart.getDate() - 1)
      const pEnd = new Date(curEnd)
      pEnd.setDate(pEnd.getDate() - 1)
      return { startDate: pStart.toISOString(), endDate: pEnd.toISOString() }
    }

    if (range.preset === 'thisMonth') {
      const pStart = new Date(curStart)
      pStart.setMonth(pStart.getMonth() - 1)
      const pEnd = new Date(curStart)
      pEnd.setMilliseconds(-1)
      return { startDate: pStart.toISOString(), endDate: pEnd.toISOString() }
    }

    if (range.preset === 'thisYear') {
      const pStart = new Date(curStart)
      pStart.setFullYear(pStart.getFullYear() - 1)
      const pEnd = new Date(curEnd)
      pEnd.setFullYear(pEnd.getFullYear() - 1)
      return { startDate: pStart.toISOString(), endDate: pEnd.toISOString() }
    }

    const prevEnd = new Date(curStart.getTime() - 1)
    const prevStart = new Date(prevEnd.getTime() - duration)
    return { startDate: prevStart.toISOString(), endDate: prevEnd.toISOString() }
  }

  /**
   * Compute percentage trend and direction
   */
  private computeTrend(current: number, previous: number): KpiTrend {
    const diff = current - previous
    let percent = 0
    if (previous > 0) {
      percent = Math.round((diff / previous) * 100)
    } else if (current > 0) {
      percent = 100
    }
    return {
      value: Number(diff.toFixed(2)),
      percent: Math.abs(percent),
      isUp: current >= previous,
    }
  }

  /**
   * Fetch 7-day sparklines for primary KPIs
   */
  async getSparklines(): Promise<Record<string, number[]>> {
    const db = getDb()
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
    sevenDaysAgo.setHours(0, 0, 0, 0)

    const dailyRows = await db.select<Array<{
      day: string
      sales: number
      count: number
      profit: number
    }>>(`
      SELECT 
        strftime('%Y-%m-%d', s.created_at) AS day,
        COALESCE(SUM(s.total), 0) AS sales,
        COUNT(s.id) AS count,
        COALESCE(SUM(si.profit), 0) AS profit
      FROM sales s
      LEFT JOIN sale_items si ON si.sale_id = s.id
      WHERE s.created_at >= ? AND s.status = 'completed'
      GROUP BY strftime('%Y-%m-%d', s.created_at)
      ORDER BY day ASC
    `, [sevenDaysAgo.toISOString()])

    const map = new Map<string, { sales: number; count: number; profit: number }>()
    for (const r of dailyRows) {
      map.set(r.day, {
        sales: Number(r.sales) || 0,
        count: Number(r.count) || 0,
        profit: Number(r.profit) || 0,
      })
    }

    const sales: number[] = []
    const counts: number[] = []
    const profits: number[] = []
    const avgs: number[] = []

    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dayKey = d.toISOString().slice(0, 10)
      const item = map.get(dayKey) || { sales: 0, count: 0, profit: 0 }
      sales.push(Number(item.sales.toFixed(2)))
      counts.push(item.count)
      profits.push(Number(item.profit.toFixed(2)))
      avgs.push(item.count > 0 ? Number((item.sales / item.count).toFixed(2)) : 0)
    }

    return {
      totalSales: sales,
      netSales: sales,
      grossProfit: profits,
      salesCount: counts,
      avgSale: avgs,
    }
  }

  /**
   * Fetch all main operational KPIs with trends, active customers, avg sale, and low stock
   */
  async getKPIs(range: DashboardDateRange): Promise<DashboardKPIs> {
    const db = getDb()
    const prevRange = this.getPreviousDateRange(range)

    // Helper query for sales aggregates
    const querySalesAgg = async (start: string, end: string) => {
      const [sales] = await db.select<Array<{ total: number; count: number }>>(`
        SELECT COALESCE(SUM(total), 0) AS total, COUNT(id) AS count
        FROM sales
        WHERE created_at >= ? AND created_at <= ? AND status = 'completed'
      `, [start, end])

      const [items] = await db.select<Array<{ items: number; gross_profit: number }>>(`
        SELECT COALESCE(SUM(si.quantity), 0) AS items, COALESCE(SUM(si.profit), 0) AS gross_profit
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        WHERE s.created_at >= ? AND s.created_at <= ? AND s.status = 'completed'
      `, [start, end])

      const [returns] = await db.select<Array<{ total_refund: number }>>(`
        SELECT COALESCE(SUM(refund_amount), 0) AS total_refund
        FROM returns
        WHERE created_at >= ? AND created_at <= ? AND (status = 'completed' OR status IS NULL)
      `, [start, end])

      const [returnProfit] = await db.select<Array<{ return_profit: number }>>(`
        SELECT COALESCE(SUM(ri.quantity * ((si.unit_price - si.cost_price) - (si.discount_amount / NULLIF(si.quantity, 0)))), 0) AS return_profit
        FROM return_items ri
        JOIN returns r ON ri.return_id = r.id
        JOIN sale_items si ON ri.sale_item_id = si.id
        WHERE r.created_at >= ? AND r.created_at <= ? AND (r.status = 'completed' OR r.status IS NULL)
      `, [start, end])

      const [expenses] = await db.select<Array<{ total: number }>>(`
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM expenses
        WHERE (expense_date >= ? AND expense_date <= ?) AND (status = 'completed' OR status IS NULL)
      `, [start, end])

      const [purchases] = await db.select<Array<{ total: number }>>(`
        SELECT COALESCE(SUM(total), 0) AS total
        FROM purchases
        WHERE (purchased_at >= ? AND purchased_at <= ?) AND (status = 'received' OR status = 'completed' OR status IS NULL)
      `, [start, end])

      const [customers] = await db.select<Array<{ active: number }>>(`
        SELECT COUNT(DISTINCT customer_id) AS active
        FROM sales
        WHERE created_at >= ? AND created_at <= ? AND status = 'completed' AND customer_id IS NOT NULL
      `, [start, end])

      const totalSales = Number(sales?.total) || 0
      const salesCount = Number(sales?.count) || 0
      const itemsSold = Number(items?.items) || 0
      const grossProfitRaw = Number(items?.gross_profit) || 0
      const totalReturns = Number(returns?.total_refund) || 0
      const retProfit = Number(returnProfit?.return_profit) || 0
      const totalExpenses = Number(expenses?.total) || 0
      const totalPurchases = Number(purchases?.total) || 0
      const activeCustomers = Number(customers?.active) || 0

      const netSales = Number((totalSales - totalReturns).toFixed(2))
      const grossProfit = Number((grossProfitRaw - retProfit).toFixed(2))
      const avgSale = salesCount > 0 ? Number((totalSales / salesCount).toFixed(2)) : 0

      return {
        totalSales,
        salesCount,
        itemsSold,
        totalReturns,
        totalExpenses,
        totalPurchases,
        netSales,
        grossProfit,
        avgSale,
        activeCustomers,
      }
    }

    // Query current and previous periods concurrently
    const [curr, prev, sparklines, stockCounts] = await Promise.all([
      querySalesAgg(range.startDate, range.endDate),
      querySalesAgg(prevRange.startDate, prevRange.endDate),
      this.getSparklines(),
      db.select<Array<{ low_count: number; oos_count: number }>>(`
        SELECT 
          COALESCE(SUM(CASE WHEN current_stock <= min_stock AND min_stock > 0 THEN 1 ELSE 0 END), 0) AS low_count,
          COALESCE(SUM(CASE WHEN current_stock <= 0 THEN 1 ELSE 0 END), 0) AS oos_count
        FROM products
        WHERE is_active = 1
      `),
    ])

    const lowStockCount = Number(stockCounts[0]?.low_count) || 0
    const outOfStockCount = Number(stockCounts[0]?.oos_count) || 0

    const trends: Record<string, KpiTrend> = {
      totalSales: this.computeTrend(curr.totalSales, prev.totalSales),
      netSales: this.computeTrend(curr.netSales, prev.netSales),
      grossProfit: this.computeTrend(curr.grossProfit, prev.grossProfit),
      totalExpenses: this.computeTrend(curr.totalExpenses, prev.totalExpenses),
      totalPurchases: this.computeTrend(curr.totalPurchases, prev.totalPurchases),
      totalReturns: this.computeTrend(curr.totalReturns, prev.totalReturns),
      salesCount: this.computeTrend(curr.salesCount, prev.salesCount),
      avgSale: this.computeTrend(curr.avgSale, prev.avgSale),
      activeCustomers: this.computeTrend(curr.activeCustomers, prev.activeCustomers),
      lowStockCount: { value: lowStockCount, percent: 0, isUp: lowStockCount === 0 },
    }

    return {
      totalSales: Number(curr.totalSales.toFixed(2)),
      totalReturns: Number(curr.totalReturns.toFixed(2)),
      netSales: curr.netSales,
      grossProfit: curr.grossProfit,
      totalExpenses: Number(curr.totalExpenses.toFixed(2)),
      totalPurchases: Number(curr.totalPurchases.toFixed(2)),
      salesCount: curr.salesCount,
      itemsSold: curr.itemsSold,
      avgSale: curr.avgSale,
      activeCustomers: curr.activeCustomers,
      lowStockCount,
      outOfStockCount,
      trends,
      sparklines,
    }
  }

  /**
   * Sales & Net Sales Trend with comparison to previous period
   */
  async getSalesTrend(range: DashboardDateRange): Promise<SalesTrendPoint[]> {
    const db = getDb()
    const prevRange = this.getPreviousDateRange(range)

    // Current daily sales
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

    // Current daily returns
    const returnRows = await db.select<Array<{ day: string; returns: number }>>(`
      SELECT 
        strftime('%Y-%m-%d', created_at) AS day,
        COALESCE(SUM(refund_amount), 0) AS returns
      FROM returns
      WHERE created_at >= ? AND created_at <= ? AND (status = 'completed' OR status IS NULL)
      GROUP BY strftime('%Y-%m-%d', created_at)
    `, [range.startDate, range.endDate])

    // Current daily expenses
    const expenseRows = await db.select<Array<{ day: string; expenses: number }>>(`
      SELECT 
        strftime('%Y-%m-%d', expense_date) AS day,
        COALESCE(SUM(amount), 0) AS expenses
      FROM expenses
      WHERE expense_date >= ? AND expense_date <= ? AND (status = 'completed' OR status IS NULL)
      GROUP BY strftime('%Y-%m-%d', expense_date)
    `, [range.startDate, range.endDate])

    // Previous period sales to align comparison
    const prevSalesRows = await db.select<Array<{ day: string; sales: number }>>(`
      SELECT 
        strftime('%Y-%m-%d', created_at) AS day,
        COALESCE(SUM(total), 0) AS sales
      FROM sales
      WHERE created_at >= ? AND created_at <= ? AND status = 'completed'
      GROUP BY strftime('%Y-%m-%d', created_at)
      ORDER BY day ASC
    `, [prevRange.startDate, prevRange.endDate])

    const prevList = prevSalesRows.map(r => Number(r.sales) || 0)

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

    const sortedDays = Array.from(map.keys()).sort()

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
        previousSales: prevList[0] || 0,
      }]
    }

    return sortedDays.map((day, idx) => {
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
        previousSales: prevList[idx] != null ? Number(prevList[idx].toFixed(2)) : undefined,
      }
    })
  }

  /**
   * Hourly sales distribution for peak store hours analysis
   */
  async getHourlySales(range: DashboardDateRange): Promise<HourlySalesPoint[]> {
    const db = getDb()
    const rows = await db.select<Array<{ hour: string; sales: number; count: number }>>(`
      SELECT 
        strftime('%H', created_at) AS hour,
        COALESCE(SUM(total), 0) AS sales,
        COUNT(id) AS count
      FROM sales
      WHERE created_at >= ? AND created_at <= ? AND status = 'completed'
      GROUP BY strftime('%H', created_at)
      ORDER BY hour ASC
    `, [range.startDate, range.endDate])

    const map = new Map<number, { sales: number; count: number }>()
    for (const r of rows) {
      map.set(parseInt(r.hour, 10), {
        sales: Number(r.sales) || 0,
        count: Number(r.count) || 0,
      })
    }

    const points: HourlySalesPoint[] = []
    for (let h = 8; h <= 23; h++) {
      const item = map.get(h) || { sales: 0, count: 0 }
      points.push({
        hour: h,
        label: `${String(h).padStart(2, '0')}:00`,
        sales: Number(item.sales.toFixed(2)),
        count: item.count,
      })
    }
    return points
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
   * Category sales performance
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
   * Operational Alerts (Out of Stock, Low Stock, Overdue Debts, Backup, Shift)
   */
  async getAlerts(userId?: string): Promise<DashboardAlert[]> {
    const db = getDb()
    const alerts: DashboardAlert[] = []

    try {
      // 1. Out of stock products
      const [outOfStock] = await db.select<Array<{ count: number }>>(`
        SELECT COUNT(id) AS count FROM products WHERE current_stock <= 0 AND is_active = 1
      `)
      const oosCount = Number(outOfStock?.count) || 0
      if (oosCount > 0) {
        alerts.push({
          id: 'out_of_stock',
          type: 'out_of_stock',
          severity: 'critical',
          titleAr: `منتجات نفذت من المخزون: ${oosCount}`,
          titleEn: `Out of Stock Products: ${oosCount}`,
          subtitleAr: 'أصناف تحتاج إعادة توريد فورية',
          subtitleEn: 'Items require immediate restocking',
          count: oosCount,
          route: '/inventory',
        })
      }

      // 2. Low stock products
      const [lowStock] = await db.select<Array<{ count: number }>>(`
        SELECT COUNT(id) AS count FROM products WHERE current_stock <= min_stock AND current_stock > 0 AND min_stock > 0 AND is_active = 1
      `)
      const lsCount = Number(lowStock?.count) || 0
      if (lsCount > 0) {
        alerts.push({
          id: 'low_stock',
          type: 'low_stock',
          severity: 'warning',
          titleAr: `منتجات أقل من الحد الأدنى: ${lsCount}`,
          titleEn: `Low Stock Items: ${lsCount}`,
          subtitleAr: 'أصناف اقتربت من النفاد ويجب طلبها',
          subtitleEn: 'Items approaching reorder threshold',
          count: lsCount,
          route: '/inventory',
        })
      }

      // 3. Customer outstanding debts
      const [debts] = await db.select<Array<{ count: number; total: number }>>(`
        SELECT COUNT(id) AS count, COALESCE(SUM(balance), 0) AS total FROM customers WHERE balance > 0 AND is_active = 1
      `)
      const debtCount = Number(debts?.count) || 0
      const debtTotal = Number(debts?.total) || 0
      if (debtCount > 0) {
        alerts.push({
          id: 'overdue_debt',
          type: 'overdue_debt',
          severity: 'warning',
          titleAr: `ديون عملاء مستحقة: ${debtCount} عميل (${debtTotal.toLocaleString()} ج.م)`,
          titleEn: `Customer Debts: ${debtCount} (${debtTotal.toLocaleString()} EGP)`,
          subtitleAr: 'أرصدة آجلة تتطلب متابعة تحصيل',
          subtitleEn: 'Accounts receivable requiring collection',
          count: debtCount,
          amount: debtTotal,
          route: '/customers',
        })
      }

      // 4. Old backup check
      const [backupSetting] = await db.select<Array<{ value: string }>>(`
        SELECT value FROM settings WHERE key = 'last_auto_backup_at'
      `)
      const lastBackupStr = backupSetting?.value
      const daysSinceBackup = lastBackupStr
        ? Math.floor((Date.now() - new Date(lastBackupStr).getTime()) / (1000 * 60 * 60 * 24))
        : 999
      if (daysSinceBackup >= 7) {
        alerts.push({
          id: 'old_backup',
          type: 'old_backup',
          severity: 'info',
          titleAr: `نسخة احتياطية قديمة: منذ ${daysSinceBackup === 999 ? 'فترة طويلة' : `${daysSinceBackup} أيام`}`,
          titleEn: `Backup Overdue: ${daysSinceBackup === 999 ? 'Never backed up' : `${daysSinceBackup} days ago`}`,
          subtitleAr: 'يُنصح بإنشاء نسخة احتياطية جديدة لحماية البيانات',
          subtitleEn: 'Recommended to create a fresh backup',
          date: lastBackupStr,
          route: '/settings',
        })
      }

      // 5. Shift status check
      if (userId) {
        const activeShift = await cashRegisterService.getActiveShift(userId)
        if (!activeShift) {
          alerts.push({
            id: 'no_shift',
            type: 'no_shift',
            severity: 'info',
            titleAr: 'لا توجد وردية مفتوحة حالياً للكاشير',
            titleEn: 'No cash shift currently open',
            subtitleAr: 'قم بفتح وردية لتسجيل الحركات النقدية بدقة',
            subtitleEn: 'Open a shift to track cash movements',
            route: '/cash-register',
          })
        }
      }

      // 6. All clear if no critical or warning alerts
      if (alerts.length === 0) {
        alerts.push({
          id: 'all_good',
          type: 'all_good',
          severity: 'success',
          titleAr: 'كل شيء يعمل بصورة ممتازة',
          titleEn: 'All Systems Operational',
          subtitleAr: 'المخزون آمن والنسخ الاحتياطي منتظم ولا توجد تنبيهات عاجلة',
          subtitleEn: 'Healthy inventory levels, fresh backups, and no critical issues',
          route: '/reports',
        })
      }
    } catch (err) {
      console.warn('Failed to compute dashboard alerts:', err)
    }

    return alerts
  }

  /**
   * Recent Activity Feed across Sales, Customers, Inventory Movements, Returns, Expenses
   */
  async getRecentActivity(limit = 10): Promise<RecentActivityItem[]> {
    const db = getDb()
    const list: RecentActivityItem[] = []

    try {
      // 1. Last 5 completed sales
      const sales = await db.select<Array<{
        id: string
        invoice_number: string
        total: number
        created_at: string
        cashier_name: string | null
        customer_name: string | null
      }>>(`
        SELECT 
          s.id,
          s.invoice_number,
          s.total,
          s.created_at,
          COALESCE(u.full_name, u.username) AS cashier_name,
          c.name AS customer_name
        FROM sales s
        LEFT JOIN users u ON s.cashier_id = u.id
        LEFT JOIN customers c ON s.customer_id = c.id
        WHERE s.status = 'completed'
        ORDER BY s.created_at DESC
        LIMIT 5
      `)

      for (const s of sales) {
        list.push({
          id: s.id,
          type: 'sale',
          referenceNumber: s.invoice_number,
          description: s.customer_name ? `فاتورة بيع للعميل ${s.customer_name}` : 'عملية بيع مكتملة',
          amount: Number(s.total) || 0,
          date: s.created_at,
          userName: s.cashier_name || undefined,
          status: 'completed',
        })
      }

      // 2. Last 3 customers created
      const customers = await db.select<Array<{
        id: string
        name: string
        phone: string | null
        created_at: string
      }>>(`
        SELECT id, name, phone, created_at
        FROM customers
        WHERE is_active = 1
        ORDER BY created_at DESC
        LIMIT 3
      `)

      for (const c of customers) {
        list.push({
          id: c.id,
          type: 'customer',
          referenceNumber: c.phone || 'عميل',
          description: `إضافة عميل جديد: ${c.name}`,
          date: c.created_at,
          status: 'active',
        })
      }

      // 3. Last 2 inventory movements
      const movements = await db.select<Array<{
        id: string
        type: string
        quantity: number
        created_at: string
        product_name: string | null
        sku: string | null
      }>>(`
        SELECT 
          im.id,
          im.type,
          im.quantity,
          im.created_at,
          p.name_ar AS product_name,
          p.sku
        FROM inventory_movements im
        LEFT JOIN products p ON im.product_id = p.id
        ORDER BY im.created_at DESC
        LIMIT 2
      `)

      for (const m of movements) {
        const isPositive = m.quantity > 0 || m.type === 'in' || m.type === 'purchase'
        list.push({
          id: m.id,
          type: isPositive ? 'stock_in' : 'stock_out',
          referenceNumber: m.sku || 'حركة مخزنية',
          description: `حركة مخزون (${m.type}): ${m.product_name || 'منتج'} (${Math.abs(m.quantity)})`,
          date: m.created_at,
          status: 'completed',
        })
      }
    } catch (err) {
      console.warn('Failed to load recent activity feed:', err)
    }

    // Sort descending by timestamp
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    return list.slice(0, limit)
  }

  /**
   * STEP 9 API: getDashboardStats method for range-based analytics
   */
  async getDashboardStats(dateRange: { from: string; to: string }) {
    const range: DashboardDateRange = {
      preset: 'custom',
      startDate: dateRange.from,
      endDate: dateRange.to,
    }
    const data = await this.getDashboardData(range)
    return {
      kpis: data.kpis,
      charts: {
        salesOverTime: data.salesTrend,
        topProducts: data.topProducts,
        paymentMethods: data.paymentMethods,
        categoryDistribution: data.categoryPerformance,
        hourlySales: data.hourlySales,
      },
      alerts: data.alerts,
      recentActivity: data.recentActivity,
    }
  }

  /**
   * Fetch all dashboard data concurrently
   */
  async getDashboardData(range: DashboardDateRange, userId?: string): Promise<DashboardData> {
    let activeShift = null
    let shiftReconciliation = null

    if (userId) {
      try {
        activeShift = await cashRegisterService.getActiveShift(userId)
        if (activeShift) {
          shiftReconciliation = await cashRegisterService.getShiftReconciliation(activeShift.id)
        }
      } catch (e) {
        console.warn('Failed to check active shift:', e)
      }
    }

    const [
      kpis,
      salesTrend,
      hourlySales,
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
      alerts,
    ] = await Promise.all([
      this.getKPIs(range),
      this.getSalesTrend(range),
      this.getHourlySales(range),
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
      this.getAlerts(userId),
    ])

    return {
      kpis,
      salesTrend,
      hourlySales,
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
      alerts,
      shiftReconciliation,
      activeShift,
    }
  }
}

export const dashboardService = new DashboardService()

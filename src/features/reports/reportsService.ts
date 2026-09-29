/**
 * MAKERS POS — Reports & Analytics Service
 * Authoritative, read-only SQL aggregation service consuming production SQLite database.
 */

import { getDb } from '@/services/db/database'
import {
  ReportDateRange,
  ReportFilterParams,
  ReportOverviewKPIs,
  SalesSummaryReport,
  SalesByDatePoint,
  SalesTransactionRow,
  ProfitSummaryReport,
  ReturnsSummaryReport,
  ReturnTransactionRow,
  ExpensesSummaryReport,
  ExpenseRow,
  PurchasesSummaryReport,
  PurchaseRow,
  InventoryStockReport,
  StockMovementRow,
  CustomersReport,
  SuppliersReport,
  ShiftsSummaryReport,
  CashMovementRow,
  PaymentMethodBreakdownReport,
  ProductPerformanceRow,
  CategoryPerformanceRow,
} from './types'

export class ReportsService {
  /**
   * 1. High-Level Executive Overview KPIs
   */
  async getOverviewKPIs(range: ReportDateRange): Promise<ReportOverviewKPIs> {
    const db = getDb()

    // 1. Sales
    const [salesRow] = await db.select<Array<{ total: number; count: number }>>(`
      SELECT 
        COALESCE(SUM(total), 0) AS total,
        COUNT(id) AS count
      FROM sales
      WHERE created_at >= ? AND created_at <= ? AND status = 'completed'
    `, [range.startDate, range.endDate])

    // 2. Returns
    const [returnsRow] = await db.select<Array<{ refund_total: number; count: number }>>(`
      SELECT 
        COALESCE(SUM(refund_amount), 0) AS refund_total,
        COUNT(id) AS count
      FROM returns
      WHERE created_at >= ? AND created_at <= ? AND (status = 'completed' OR status IS NULL)
    `, [range.startDate, range.endDate])

    // 3. Profit from sale_items
    const [profitRow] = await db.select<Array<{ gross_profit: number }>>(`
      SELECT 
        COALESCE(SUM(si.profit), 0) AS gross_profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE s.created_at >= ? AND s.created_at <= ? AND s.status = 'completed'
    `, [range.startDate, range.endDate])

    // 4. Return profit reduction
    const [returnProfitRow] = await db.select<Array<{ ret_profit: number }>>(`
      SELECT 
        COALESCE(SUM(ri.quantity * ((si.unit_price - si.cost_price) - (si.discount_amount / NULLIF(si.quantity, 0)))), 0) AS ret_profit
      FROM return_items ri
      JOIN returns r ON ri.return_id = r.id
      JOIN sale_items si ON ri.sale_item_id = si.id
      WHERE r.created_at >= ? AND r.created_at <= ? AND (r.status = 'completed' OR r.status IS NULL)
    `, [range.startDate, range.endDate])

    // 5. Expenses
    const [expensesRow] = await db.select<Array<{ total: number; count: number }>>(`
      SELECT 
        COALESCE(SUM(amount), 0) AS total,
        COUNT(id) AS count
      FROM expenses
      WHERE (expense_date >= ? AND expense_date <= ?)
        AND (status = 'completed' OR status IS NULL)
    `, [range.startDate, range.endDate])

    // 6. Purchases
    const [purchasesRow] = await db.select<Array<{ total: number; count: number }>>(`
      SELECT 
        COALESCE(SUM(total), 0) AS total,
        COUNT(id) AS count
      FROM purchases
      WHERE (purchased_at >= ? AND purchased_at <= ?)
        AND (status = 'received' OR status = 'completed' OR status IS NULL)
    `, [range.startDate, range.endDate])

    // 7. Inventory Value
    const [inventoryRow] = await db.select<Array<{ cost_val: number }>>(`
      SELECT 
        COALESCE(SUM(current_stock * purchase_price), 0) AS cost_val
      FROM products
      WHERE is_active = 1
    `)

    // 8. Active entities
    const [custRow] = await db.select<Array<{ count: number }>>('SELECT COUNT(id) AS count FROM customers WHERE is_active = 1')
    const [suppRow] = await db.select<Array<{ count: number }>>('SELECT COUNT(id) AS count FROM suppliers WHERE is_active = 1')

    const totalSales = Number(salesRow?.total) || 0
    const salesCount = Number(salesRow?.count) || 0
    const totalReturns = Number(returnsRow?.refund_total) || 0
    const returnsCount = Number(returnsRow?.count) || 0
    const netSales = Number((totalSales - totalReturns).toFixed(2))

    const grossProfitInitial = Number(profitRow?.gross_profit) || 0
    const returnProfitDeduction = Number(returnProfitRow?.ret_profit) || 0
    const grossProfit = Number((grossProfitInitial - returnProfitDeduction).toFixed(2))
    const profitMarginPct = netSales > 0 ? Number(((grossProfit / netSales) * 100).toFixed(1)) : 0

    return {
      totalSales: Number(totalSales.toFixed(2)),
      totalReturns: Number(totalReturns.toFixed(2)),
      netSales,
      grossProfit,
      profitMarginPct,
      totalExpenses: Number((Number(expensesRow?.total) || 0).toFixed(2)),
      totalPurchases: Number((Number(purchasesRow?.total) || 0).toFixed(2)),
      inventoryValue: Number((Number(inventoryRow?.cost_val) || 0).toFixed(2)),
      salesCount,
      returnsCount,
      expensesCount: Number(expensesRow?.count) || 0,
      purchasesCount: Number(purchasesRow?.count) || 0,
      activeCustomers: Number(custRow?.count) || 0,
      activeSuppliers: Number(suppRow?.count) || 0,
    }
  }

  /**
   * 2. Sales Summary Report
   */
  async getSalesSummary(range: ReportDateRange): Promise<SalesSummaryReport> {
    const db = getDb()

    const [salesRow] = await db.select<Array<{
      gross_total: number
      discount_total: number
      tax_total: number
      net_total: number
      count: number
    }>>(`
      SELECT 
        COALESCE(SUM(subtotal), 0) AS gross_total,
        COALESCE(SUM(discount_amount), 0) AS discount_total,
        COALESCE(SUM(tax_amount), 0) AS tax_total,
        COALESCE(SUM(total), 0) AS net_total,
        COUNT(id) AS count
      FROM sales
      WHERE created_at >= ? AND created_at <= ? AND status = 'completed'
    `, [range.startDate, range.endDate])

    const [itemsRow] = await db.select<Array<{ items_sold: number }>>(`
      SELECT 
        COALESCE(SUM(si.quantity), 0) AS items_sold
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE s.created_at >= ? AND s.created_at <= ? AND s.status = 'completed'
    `, [range.startDate, range.endDate])

    // Payment methods breakdown for sales
    const payments = await db.select<Array<{ method: string; total: number }>>(`
      SELECT 
        p.method,
        COALESCE(SUM(p.amount), 0) AS total
      FROM payments p
      JOIN sales s ON p.sale_id = s.id
      WHERE s.created_at >= ? AND s.created_at <= ? AND s.status = 'completed'
      GROUP BY p.method
    `, [range.startDate, range.endDate])

    const payMap: Record<string, number> = {}
    for (const p of payments) {
      payMap[p.method.toLowerCase()] = Number(p.total) || 0
    }

    const netSales = Number(salesRow?.net_total) || 0
    const salesCount = Number(salesRow?.count) || 0
    const averageSale = salesCount > 0 ? Number((netSales / salesCount).toFixed(2)) : 0

    return {
      grossSales: Number((Number(salesRow?.gross_total) || 0).toFixed(2)),
      discountTotal: Number((Number(salesRow?.discount_total) || 0).toFixed(2)),
      taxTotal: Number((Number(salesRow?.tax_total) || 0).toFixed(2)),
      netSales: Number(netSales.toFixed(2)),
      salesCount,
      itemsSold: Number(itemsRow?.items_sold) || 0,
      averageSale,
      cashSales: Number((payMap['cash'] || 0).toFixed(2)),
      cardSales: Number((payMap['card'] || 0).toFixed(2)),
      instaPaySales: Number((payMap['instapay'] || 0).toFixed(2)),
      vodafoneCashSales: Number((payMap['vodafone_cash'] || 0).toFixed(2)),
      bankTransferSales: Number((payMap['bank_transfer'] || 0).toFixed(2)),
      otherSales: Number((payMap['other'] || 0).toFixed(2)),
    }
  }

  /**
   * 3. Sales By Date Trend
   */
  async getSalesByDate(range: ReportDateRange): Promise<SalesByDatePoint[]> {
    const db = getDb()

    const rows = await db.select<Array<{
      day: string
      sales: number
      count: number
      discount: number
      tax: number
      profit: number
    }>>(`
      SELECT 
        strftime('%Y-%m-%d', s.created_at) AS day,
        COALESCE(SUM(s.total), 0) AS sales,
        COUNT(s.id) AS count,
        COALESCE(SUM(s.discount_amount), 0) AS discount,
        COALESCE(SUM(s.tax_amount), 0) AS tax,
        COALESCE(SUM(si.profit), 0) AS profit
      FROM sales s
      LEFT JOIN sale_items si ON si.sale_id = s.id
      WHERE s.created_at >= ? AND s.created_at <= ? AND s.status = 'completed'
      GROUP BY strftime('%Y-%m-%d', s.created_at)
      ORDER BY day ASC
    `, [range.startDate, range.endDate])

    return rows.map(r => ({
      date: r.day,
      label: r.day.slice(5),
      sales: Number((Number(r.sales) || 0).toFixed(2)),
      count: Number(r.count) || 0,
      discount: Number((Number(r.discount) || 0).toFixed(2)),
      tax: Number((Number(r.tax) || 0).toFixed(2)),
      profit: Number((Number(r.profit) || 0).toFixed(2)),
    }))
  }

  /**
   * 4. Sales Transactions Table
   */
  async getSalesTransactions(params: ReportFilterParams): Promise<{ rows: SalesTransactionRow[]; totalCount: number }> {
    const db = getDb()
    const { range, search, status, customerId, userId, paymentMethod, page = 1, pageSize = 20 } = params

    const conditions: string[] = ['s.created_at >= ? AND s.created_at <= ?']
    const queryParams: any[] = [range.startDate, range.endDate]

    if (status) {
      conditions.push('s.status = ?')
      queryParams.push(status)
    }

    if (customerId) {
      conditions.push('s.customer_id = ?')
      queryParams.push(customerId)
    }

    if (userId) {
      conditions.push('s.cashier_id = ?')
      queryParams.push(userId)
    }

    if (search && search.trim()) {
      conditions.push('(s.invoice_number LIKE ? OR c.name LIKE ?)')
      const searchPattern = `%${search.trim()}%`
      queryParams.push(searchPattern, searchPattern)
    }

    if (paymentMethod) {
      conditions.push(`EXISTS (SELECT 1 FROM payments p WHERE p.sale_id = s.id AND p.method = ?)`)
      queryParams.push(paymentMethod)
    }

    const whereClause = conditions.join(' AND ')

    // Count total
    const [countRow] = await db.select<Array<{ total_count: number }>>(`
      SELECT COUNT(s.id) AS total_count
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE ${whereClause}
    `, queryParams)

    const offset = (page - 1) * pageSize
    const rows = await db.select<Array<{
      id: string
      invoice_number: string
      created_at: string
      customer_name: string | null
      cashier_name: string | null
      items_count: number
      subtotal: number
      discount_amount: number
      tax_amount: number
      total: number
      status: string
      payment_methods: string | null
    }>>(`
      SELECT 
        s.id,
        s.invoice_number,
        s.created_at,
        c.name AS customer_name,
        COALESCE(u.full_name, u.username) AS cashier_name,
        (SELECT COUNT(si.id) FROM sale_items si WHERE si.sale_id = s.id) AS items_count,
        s.subtotal,
        s.discount_amount,
        s.tax_amount,
        s.total,
        s.status,
        (SELECT GROUP_CONCAT(DISTINCT p.method) FROM payments p WHERE p.sale_id = s.id) AS payment_methods
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users u ON s.cashier_id = u.id
      WHERE ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
    `, [...queryParams, pageSize, offset])

    return {
      totalCount: Number(countRow?.total_count) || 0,
      rows: rows.map(r => ({
        id: r.id,
        invoiceNumber: r.invoice_number,
        createdAt: r.created_at,
        customerName: r.customer_name || undefined,
        cashierName: r.cashier_name || undefined,
        itemsCount: Number(r.items_count) || 0,
        subtotal: Number(r.subtotal) || 0,
        discountAmount: Number(r.discount_amount) || 0,
        taxAmount: Number(r.tax_amount) || 0,
        total: Number(r.total) || 0,
        status: r.status,
        paymentMethods: r.payment_methods || '—',
      })),
    }
  }

  /**
   * 5. Profit Summary & Breakdowns
   */
  async getProfitReport(range: ReportDateRange): Promise<ProfitSummaryReport> {
    const db = getDb()

    // 1. Sales & Revenue
    const [salesRow] = await db.select<Array<{ gross_sales: number; net_sales: number }>>(`
      SELECT 
        COALESCE(SUM(subtotal), 0) AS gross_sales,
        COALESCE(SUM(total), 0) AS net_sales
      FROM sales
      WHERE created_at >= ? AND created_at <= ? AND status = 'completed'
    `, [range.startDate, range.endDate])

    // 2. Returns
    const [returnsRow] = await db.select<Array<{ total_refund: number }>>(`
      SELECT 
        COALESCE(SUM(refund_amount), 0) AS total_refund
      FROM returns
      WHERE created_at >= ? AND created_at <= ? AND (status = 'completed' OR status IS NULL)
    `, [range.startDate, range.endDate])

    // 3. COGS & Profit from sale_items
    const [cogsRow] = await db.select<Array<{ cogs: number; profit: number }>>(`
      SELECT 
        COALESCE(SUM(si.quantity * si.cost_price), 0) AS cogs,
        COALESCE(SUM(si.profit), 0) AS profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE s.created_at >= ? AND s.created_at <= ? AND s.status = 'completed'
    `, [range.startDate, range.endDate])

    // 4. Return items profit reduction
    const [returnProfitRow] = await db.select<Array<{ return_profit: number }>>(`
      SELECT 
        COALESCE(SUM(ri.quantity * ((si.unit_price - si.cost_price) - (si.discount_amount / NULLIF(si.quantity, 0)))), 0) AS return_profit
      FROM return_items ri
      JOIN returns r ON ri.return_id = r.id
      JOIN sale_items si ON ri.sale_item_id = si.id
      WHERE r.created_at >= ? AND r.created_at <= ? AND (r.status = 'completed' OR r.status IS NULL)
    `, [range.startDate, range.endDate])

    const grossSales = Number((Number(salesRow?.gross_sales) || 0).toFixed(2))
    const netSales = Number((Number(salesRow?.net_sales) || 0).toFixed(2))
    const returnsTotal = Number((Number(returnsRow?.total_refund) || 0).toFixed(2))
    const cogs = Number((Number(cogsRow?.cogs) || 0).toFixed(2))
    const grossProfitInitial = Number(cogsRow?.profit) || 0
    const returnProfitDeduction = Number(returnProfitRow?.return_profit) || 0
    const grossProfit = Number((grossProfitInitial - returnProfitDeduction).toFixed(2))
    const profitMarginPct = netSales > 0 ? Number(((grossProfit / netSales) * 100).toFixed(1)) : 0

    // Breakdown By Product
    const byProductRows = await db.select<Array<{
      product_id: string
      name_ar: string
      name_en: string
      sku: string
      quantity_sold: number
      revenue: number
      cost: number
      profit: number
    }>>(`
      SELECT 
        si.product_id,
        p.name_ar,
        p.name_en,
        COALESCE(si.product_sku, p.sku) AS sku,
        COALESCE(SUM(si.quantity), 0) AS quantity_sold,
        COALESCE(SUM(si.subtotal), 0) AS revenue,
        COALESCE(SUM(si.quantity * si.cost_price), 0) AS cost,
        COALESCE(SUM(si.profit), 0) AS profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      LEFT JOIN products p ON si.product_id = p.id
      WHERE s.created_at >= ? AND s.created_at <= ? AND s.status = 'completed'
      GROUP BY si.product_id, p.name_ar, p.name_en, sku
      ORDER BY profit DESC
      LIMIT 10
    `, [range.startDate, range.endDate])

    // Breakdown By Category
    const byCategoryRows = await db.select<Array<{
      category_id: string | null
      name_ar: string | null
      name_en: string | null
      quantity_sold: number
      revenue: number
      cost: number
      profit: number
    }>>(`
      SELECT 
        p.category_id,
        c.name_ar,
        c.name_en,
        COALESCE(SUM(si.quantity), 0) AS quantity_sold,
        COALESCE(SUM(si.subtotal), 0) AS revenue,
        COALESCE(SUM(si.quantity * si.cost_price), 0) AS cost,
        COALESCE(SUM(si.profit), 0) AS profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      LEFT JOIN product_categories c ON p.category_id = c.id
      WHERE s.created_at >= ? AND s.created_at <= ? AND s.status = 'completed'
      GROUP BY p.category_id, c.name_ar, c.name_en
      ORDER BY profit DESC
      LIMIT 10
    `, [range.startDate, range.endDate])

    // Breakdown By Date
    const byDateRows = await db.select<Array<{
      date: string
      revenue: number
      cost: number
      profit: number
    }>>(`
      SELECT 
        strftime('%Y-%m-%d', s.created_at) AS date,
        COALESCE(SUM(si.subtotal), 0) AS revenue,
        COALESCE(SUM(si.quantity * si.cost_price), 0) AS cost,
        COALESCE(SUM(si.profit), 0) AS profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE s.created_at >= ? AND s.created_at <= ? AND s.status = 'completed'
      GROUP BY strftime('%Y-%m-%d', s.created_at)
      ORDER BY date ASC
    `, [range.startDate, range.endDate])

    return {
      grossSales,
      returnsTotal,
      netSales,
      cogs,
      grossProfit,
      profitMarginPct,
      byProduct: byProductRows.map(r => {
        const rev = Number(r.revenue) || 0
        const prof = Number(r.profit) || 0
        return {
          productId: r.product_id,
          nameAr: r.name_ar || 'منتج',
          nameEn: r.name_en || 'Product',
          sku: r.sku || '—',
          quantitySold: Number(r.quantity_sold) || 0,
          revenue: Number(rev.toFixed(2)),
          cost: Number((Number(r.cost) || 0).toFixed(2)),
          profit: Number(prof.toFixed(2)),
          marginPct: rev > 0 ? Number(((prof / rev) * 100).toFixed(1)) : 0,
        }
      }),
      byCategory: byCategoryRows.map(r => {
        const rev = Number(r.revenue) || 0
        const prof = Number(r.profit) || 0
        return {
          categoryId: r.category_id || 'uncategorized',
          nameAr: r.name_ar || 'غير مصنف',
          nameEn: r.name_en || 'Uncategorized',
          quantitySold: Number(r.quantity_sold) || 0,
          revenue: Number(rev.toFixed(2)),
          cost: Number((Number(r.cost) || 0).toFixed(2)),
          profit: Number(prof.toFixed(2)),
          marginPct: rev > 0 ? Number(((prof / rev) * 100).toFixed(1)) : 0,
        }
      }),
      byDate: byDateRows.map(r => {
        const rev = Number(r.revenue) || 0
        const prof = Number(r.profit) || 0
        return {
          date: r.date,
          revenue: Number(rev.toFixed(2)),
          cost: Number((Number(r.cost) || 0).toFixed(2)),
          profit: Number(prof.toFixed(2)),
          marginPct: rev > 0 ? Number(((prof / rev) * 100).toFixed(1)) : 0,
        }
      }),
    }
  }

  /**
   * 6. Returns Report
   */
  async getReturnsReport(params: ReportFilterParams): Promise<{ summary: ReturnsSummaryReport; rows: ReturnTransactionRow[]; totalCount: number }> {
    const db = getDb()
    const { range, search, customerId, condition, page = 1, pageSize = 20 } = params

    // Summary query
    const [summaryRow] = await db.select<Array<{
      total_returns: number
      count: number
      qty_returned: number
      resellable_count: number
      damaged_count: number
      defective_count: number
    }>>(`
      SELECT 
        COALESCE(SUM(r.refund_amount), 0) AS total_returns,
        COUNT(DISTINCT r.id) AS count,
        COALESCE(SUM(ri.quantity), 0) AS qty_returned,
        COALESCE(SUM(CASE WHEN ri.condition = 'resellable' THEN ri.quantity ELSE 0 END), 0) AS resellable_count,
        COALESCE(SUM(CASE WHEN ri.condition = 'damaged' THEN ri.quantity ELSE 0 END), 0) AS damaged_count,
        COALESCE(SUM(CASE WHEN ri.condition = 'defective' THEN ri.quantity ELSE 0 END), 0) AS defective_count
      FROM returns r
      LEFT JOIN return_items ri ON ri.return_id = r.id
      WHERE r.created_at >= ? AND r.created_at <= ? AND (r.status = 'completed' OR r.status IS NULL)
    `, [range.startDate, range.endDate])

    const totalRefund = Number(summaryRow?.total_returns) || 0

    const conditions: string[] = ['r.created_at >= ? AND r.created_at <= ? AND (r.status = \'completed\' OR r.status IS NULL)']
    const queryParams: any[] = [range.startDate, range.endDate]

    if (customerId) {
      conditions.push('r.customer_id = ?')
      queryParams.push(customerId)
    }

    if (search && search.trim()) {
      conditions.push('(r.return_number LIKE ? OR s.invoice_number LIKE ?)')
      const p = `%${search.trim()}%`
      queryParams.push(p, p)
    }

    if (condition) {
      conditions.push('EXISTS (SELECT 1 FROM return_items ri2 WHERE ri2.return_id = r.id AND ri2.condition = ?)')
      queryParams.push(condition)
    }

    const whereClause = conditions.join(' AND ')

    const [countRow] = await db.select<Array<{ total_count: number }>>(`
      SELECT COUNT(DISTINCT r.id) AS total_count
      FROM returns r
      LEFT JOIN sales s ON r.sale_id = s.id
      WHERE ${whereClause}
    `, queryParams)

    const offset = (page - 1) * pageSize
    const rows = await db.select<Array<{
      id: string
      return_number: string
      sale_invoice: string
      created_at: string
      customer_name: string | null
      user_name: string | null
      items_count: number
      condition: string | null
      refund_amount: number
      status: string
    }>>(`
      SELECT 
        r.id,
        r.return_number,
        COALESCE(s.invoice_number, '—') AS sale_invoice,
        r.created_at,
        c.name AS customer_name,
        COALESCE(u.full_name, u.username) AS user_name,
        (SELECT COUNT(ri.id) FROM return_items ri WHERE ri.return_id = r.id) AS items_count,
        (SELECT GROUP_CONCAT(DISTINCT ri.condition) FROM return_items ri WHERE ri.return_id = r.id) AS condition,
        r.refund_amount,
        COALESCE(r.status, 'completed') AS status
      FROM returns r
      LEFT JOIN sales s ON r.sale_id = s.id
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN users u ON r.user_id = u.id
      WHERE ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `, [...queryParams, pageSize, offset])

    return {
      summary: {
        totalReturns: Number(totalRefund.toFixed(2)),
        returnsCount: Number(summaryRow?.count) || 0,
        returnedQuantity: Number(summaryRow?.qty_returned) || 0,
        totalRefundAmount: Number(totalRefund.toFixed(2)),
        cashRefunds: Number(totalRefund.toFixed(2)), // authoritative refund sum
        nonCashRefunds: 0,
        resellableCount: Number(summaryRow?.resellable_count) || 0,
        damagedCount: Number(summaryRow?.damaged_count) || 0,
        defectiveCount: Number(summaryRow?.defective_count) || 0,
      },
      totalCount: Number(countRow?.total_count) || 0,
      rows: rows.map(r => ({
        id: r.id,
        returnNumber: r.return_number,
        originalSaleNumber: r.sale_invoice,
        createdAt: r.created_at,
        customerName: r.customer_name || undefined,
        userName: r.user_name || undefined,
        itemsCount: Number(r.items_count) || 0,
        condition: r.condition || 'resellable',
        refundAmount: Number((Number(r.refund_amount) || 0).toFixed(2)),
        status: r.status,
      })),
    }
  }

  /**
   * 7. Expenses Report
   */
  async getExpensesReport(params: ReportFilterParams): Promise<{ summary: ExpensesSummaryReport; rows: ExpenseRow[]; totalCount: number }> {
    const db = getDb()
    const { range, search, categoryId, supplierId, paymentMethod, page = 1, pageSize = 20 } = params

    // 1. Summary
    const [sumRow] = await db.select<Array<{
      total_amount: number
      count: number
      cash_amount: number
      non_cash_amount: number
    }>>(`
      SELECT 
        COALESCE(SUM(amount), 0) AS total_amount,
        COUNT(id) AS count,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN amount ELSE 0 END), 0) AS cash_amount,
        COALESCE(SUM(CASE WHEN payment_method != 'cash' THEN amount ELSE 0 END), 0) AS non_cash_amount
      FROM expenses
      WHERE (expense_date >= ? AND expense_date <= ?) AND (status = 'completed' OR status IS NULL)
    `, [range.startDate, range.endDate])

    const [cancRow] = await db.select<Array<{ count: number }>>(`
      SELECT COUNT(id) AS count
      FROM expenses
      WHERE (expense_date >= ? AND expense_date <= ?) AND status = 'cancelled'
    `, [range.startDate, range.endDate])

    // Breakdown By Category
    const catBreakdown = await db.select<Array<{
      category_id: string | null
      name_ar: string | null
      name_en: string | null
      amount: number
    }>>(`
      SELECT 
        e.category_id,
        ec.name_ar,
        ec.name_en,
        COALESCE(SUM(e.amount), 0) AS amount
      FROM expenses e
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      WHERE (e.expense_date >= ? AND e.expense_date <= ?) AND (e.status = 'completed' OR e.status IS NULL)
      GROUP BY e.category_id, ec.name_ar, ec.name_en
      ORDER BY amount DESC
    `, [range.startDate, range.endDate])

    const totalExp = Number(sumRow?.total_amount) || 0

    // Breakdown By Payment Method
    const payBreakdown = await db.select<Array<{ method: string; amount: number }>>(`
      SELECT 
        payment_method AS method,
        COALESCE(SUM(amount), 0) AS amount
      FROM expenses
      WHERE (expense_date >= ? AND expense_date <= ?) AND (status = 'completed' OR status IS NULL)
      GROUP BY payment_method
      ORDER BY amount DESC
    `, [range.startDate, range.endDate])

    // Table rows query
    const conditions: string[] = ['(e.expense_date >= ? AND e.expense_date <= ?)']
    const queryParams: any[] = [range.startDate, range.endDate]

    if (categoryId) {
      conditions.push('e.category_id = ?')
      queryParams.push(categoryId)
    }

    if (supplierId) {
      conditions.push('e.supplier_id = ?')
      queryParams.push(supplierId)
    }

    if (paymentMethod) {
      conditions.push('e.payment_method = ?')
      queryParams.push(paymentMethod)
    }

    if (search && search.trim()) {
      conditions.push('(e.expense_number LIKE ? OR e.description LIKE ?)')
      const p = `%${search.trim()}%`
      queryParams.push(p, p)
    }

    const whereClause = conditions.join(' AND ')

    const [countRow] = await db.select<Array<{ total_count: number }>>(`
      SELECT COUNT(e.id) AS total_count
      FROM expenses e
      WHERE ${whereClause}
    `, queryParams)

    const offset = (page - 1) * pageSize
    const rows = await db.select<Array<{
      id: string
      expense_number: string
      expense_date: string
      name_ar: string | null
      name_en: string | null
      supplier_name: string | null
      payment_method: string
      amount: number
      status: string
      user_name: string | null
      description: string
    }>>(`
      SELECT 
        e.id,
        e.expense_number,
        e.expense_date,
        ec.name_ar,
        ec.name_en,
        sup.name AS supplier_name,
        e.payment_method,
        e.amount,
        COALESCE(e.status, 'completed') AS status,
        COALESCE(u.full_name, u.username) AS user_name,
        e.description
      FROM expenses e
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      LEFT JOIN suppliers sup ON e.supplier_id = sup.id
      LEFT JOIN users u ON COALESCE(e.user_id, e.recorded_by_id) = u.id
      WHERE ${whereClause}
      ORDER BY e.expense_date DESC
      LIMIT ? OFFSET ?
    `, [...queryParams, pageSize, offset])

    return {
      summary: {
        totalExpenses: Number(totalExp.toFixed(2)),
        cashExpenses: Number((Number(sumRow?.cash_amount) || 0).toFixed(2)),
        nonCashExpenses: Number((Number(sumRow?.non_cash_amount) || 0).toFixed(2)),
        expensesCount: Number(sumRow?.count) || 0,
        cancelledCount: Number(cancRow?.count) || 0,
        byCategory: catBreakdown.map(c => {
          const amt = Number(c.amount) || 0
          return {
            categoryId: c.category_id || 'general',
            nameAr: c.name_ar || 'عام',
            nameEn: c.name_en || 'General',
            amount: Number(amt.toFixed(2)),
            percentage: totalExp > 0 ? Number(((amt / totalExp) * 100).toFixed(1)) : 0,
          }
        }),
        byPaymentMethod: payBreakdown.map(p => {
          const amt = Number(p.amount) || 0
          return {
            method: p.method,
            amount: Number(amt.toFixed(2)),
            percentage: totalExp > 0 ? Number(((amt / totalExp) * 100).toFixed(1)) : 0,
          }
        }),
      },
      totalCount: Number(countRow?.total_count) || 0,
      rows: rows.map(r => ({
        id: r.id,
        expenseNumber: r.expense_number,
        date: r.expense_date,
        categoryNameAr: r.name_ar || 'عام',
        categoryNameEn: r.name_en || 'General',
        supplierName: r.supplier_name || undefined,
        paymentMethod: r.payment_method,
        amount: Number(r.amount) || 0,
        status: r.status,
        userName: r.user_name || undefined,
        description: r.description,
      })),
    }
  }

  /**
   * 8. Purchases Report
   */
  async getPurchasesReport(params: ReportFilterParams): Promise<{ summary: PurchasesSummaryReport; rows: PurchaseRow[]; totalCount: number }> {
    const db = getDb()
    const { range, search, supplierId, status, page = 1, pageSize = 20 } = params

    const [sumRow] = await db.select<Array<{
      total_purchases: number
      count: number
      paid_amount: number
      balance: number
    }>>(`
      SELECT 
        COALESCE(SUM(total), 0) AS total_purchases,
        COUNT(id) AS count,
        COALESCE(SUM(paid_amount), 0) AS paid_amount,
        COALESCE(SUM(balance), 0) AS balance
      FROM purchases
      WHERE (purchased_at >= ? AND purchased_at <= ?)
        AND (status = 'received' OR status = 'completed' OR status IS NULL)
    `, [range.startDate, range.endDate])

    // By supplier breakdown
    const bySupplier = await db.select<Array<{
      supplier_id: string
      supplier_name: string
      total_amount: number
      paid_amount: number
      balance: number
      invoices_count: number
    }>>(`
      SELECT 
        p.supplier_id,
        COALESCE(s.name, 'مورد غير محدد') AS supplier_name,
        COALESCE(SUM(p.total), 0) AS total_amount,
        COALESCE(SUM(p.paid_amount), 0) AS paid_amount,
        COALESCE(SUM(p.balance), 0) AS balance,
        COUNT(p.id) AS invoices_count
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE (p.purchased_at >= ? AND p.purchased_at <= ?)
        AND (p.status = 'received' OR p.status = 'completed' OR p.status IS NULL)
      GROUP BY p.supplier_id, s.name
      ORDER BY total_amount DESC
    `, [range.startDate, range.endDate])

    const conditions: string[] = ['(p.purchased_at >= ? AND p.purchased_at <= ?)']
    const queryParams: any[] = [range.startDate, range.endDate]

    if (supplierId) {
      conditions.push('p.supplier_id = ?')
      queryParams.push(supplierId)
    }

    if (status) {
      conditions.push('p.status = ?')
      queryParams.push(status)
    }

    if (search && search.trim()) {
      conditions.push('(p.purchase_number LIKE ? OR s.name LIKE ?)')
      const ptrn = `%${search.trim()}%`
      queryParams.push(ptrn, ptrn)
    }

    const whereClause = conditions.join(' AND ')

    const [countRow] = await db.select<Array<{ total_count: number }>>(`
      SELECT COUNT(p.id) AS total_count
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE ${whereClause}
    `, queryParams)

    const offset = (page - 1) * pageSize
    const rows = await db.select<Array<{
      id: string
      purchase_number: string
      supplier_name: string | null
      purchased_at: string
      items_count: number
      total: number
      paid_amount: number
      balance: number
      status: string
      payment_status: string | null
    }>>(`
      SELECT 
        p.id,
        p.purchase_number,
        s.name AS supplier_name,
        p.purchased_at,
        (SELECT COUNT(pi.id) FROM purchase_items pi WHERE pi.purchase_id = p.id) AS items_count,
        p.total,
        p.paid_amount,
        p.balance,
        p.status,
        p.payment_status
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE ${whereClause}
      ORDER BY p.purchased_at DESC
      LIMIT ? OFFSET ?
    `, [...queryParams, pageSize, offset])

    const totalPurch = Number(sumRow?.total_purchases) || 0
    const paidAmt = Number(sumRow?.paid_amount) || 0
    const unpaidAmt = Number(sumRow?.balance) || 0

    return {
      summary: {
        totalPurchases: Number(totalPurch.toFixed(2)),
        invoicesCount: Number(sumRow?.count) || 0,
        receivedValue: Number(totalPurch.toFixed(2)),
        paidAmount: Number(paidAmt.toFixed(2)),
        unpaidAmount: Number(unpaidAmt.toFixed(2)),
        bySupplier: bySupplier.map(s => ({
          supplierId: s.supplier_id || 'unassigned',
          supplierName: s.supplier_name,
          totalAmount: Number((Number(s.total_amount) || 0).toFixed(2)),
          paidAmount: Number((Number(s.paid_amount) || 0).toFixed(2)),
          balance: Number((Number(s.balance) || 0).toFixed(2)),
          invoicesCount: Number(s.invoices_count) || 0,
        })),
      },
      totalCount: Number(countRow?.total_count) || 0,
      rows: rows.map(r => ({
        id: r.id,
        purchaseNumber: r.purchase_number,
        supplierName: r.supplier_name || '—',
        purchasedAt: r.purchased_at,
        itemsCount: Number(r.items_count) || 0,
        total: Number(r.total) || 0,
        paidAmount: Number(r.paid_amount) || 0,
        balance: Number(r.balance) || 0,
        status: r.status,
        paymentStatus: r.payment_status || 'unpaid',
      })),
    }
  }

  /**
   * 9. Inventory Stock Summary & Movements
   */
  async getInventoryStockReport(): Promise<InventoryStockReport> {
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

    // By location breakdown
    const locRows = await db.select<Array<{
      drawer_location: string | null
      product_count: number
      quantity: number
      stock_val: number
    }>>(`
      SELECT 
        COALESCE(drawer_location, 'المستودع الرئيسي') AS drawer_location,
        COUNT(id) AS product_count,
        COALESCE(SUM(current_stock), 0) AS quantity,
        COALESCE(SUM(current_stock * purchase_price), 0) AS stock_val
      FROM products
      WHERE is_active = 1
      GROUP BY drawer_location
      ORDER BY stock_val DESC
    `)

    return {
      totalProducts: Number(row?.total_products) || 0,
      totalUnits: Number(row?.total_units) || 0,
      totalStockUnits: Number(row?.total_units) || 0,
      inventoryCostValue: Number((Number(row?.cost_val) || 0).toFixed(2)),
      inventoryRetailValue: Number((Number(row?.retail_val) || 0).toFixed(2)),
      lowStockCount: Number(row?.low_stock_count) || 0,
      outOfStockCount: Number(row?.out_of_stock_count) || 0,
      byLocation: locRows.map(l => ({
        location: l.drawer_location || 'المستودع الرئيسي',
        productCount: Number(l.product_count) || 0,
        quantity: Number(l.quantity) || 0,
        stockValue: Number((Number(l.stock_val) || 0).toFixed(2)),
      })),
    }
  }

  /**
   * 10. Stock Movements Table
   */
  async getStockMovements(params: ReportFilterParams): Promise<{ rows: StockMovementRow[]; totalCount: number }> {
    const db = getDb()
    const { range, search, page = 1, pageSize = 20 } = params

    const conditions: string[] = ['im.created_at >= ? AND im.created_at <= ?']
    const queryParams: any[] = [range.startDate, range.endDate]

    if (search && search.trim()) {
      conditions.push('(p.name_ar LIKE ? OR p.name_en LIKE ? OR p.sku LIKE ? OR im.reason LIKE ?)')
      const ptrn = `%${search.trim()}%`
      queryParams.push(ptrn, ptrn, ptrn, ptrn)
    }

    const whereClause = conditions.join(' AND ')

    const [countRow] = await db.select<Array<{ total_count: number }>>(`
      SELECT COUNT(im.id) AS total_count
      FROM inventory_movements im
      JOIN products p ON im.product_id = p.id
      WHERE ${whereClause}
    `, queryParams)

    const offset = (page - 1) * pageSize
    const rows = await db.select<Array<{
      id: string
      created_at: string
      name_ar: string
      name_en: string
      sku: string
      type: string
      quantity: number
      stock_before: number
      stock_after: number
      reference_type: string | null
      reference_id: string | null
      user_name: string | null
      reason: string | null
    }>>(`
      SELECT 
        im.id,
        im.created_at,
        p.name_ar,
        p.name_en,
        p.sku,
        im.type,
        im.quantity,
        im.stock_before,
        im.stock_after,
        im.reference_type,
        im.reference_id,
        COALESCE(u.full_name, u.username) AS user_name,
        im.reason
      FROM inventory_movements im
      JOIN products p ON im.product_id = p.id
      LEFT JOIN users u ON im.user_id = u.id
      WHERE ${whereClause}
      ORDER BY im.created_at DESC
      LIMIT ? OFFSET ?
    `, [...queryParams, pageSize, offset])

    return {
      totalCount: Number(countRow?.total_count) || 0,
      rows: rows.map(r => ({
        id: r.id,
        date: r.created_at,
        productNameAr: r.name_ar,
        productNameEn: r.name_en,
        sku: r.sku,
        type: r.type,
        quantity: Number(r.quantity) || 0,
        stockBefore: Number(r.stock_before) || 0,
        stockAfter: Number(r.stock_after) || 0,
        referenceType: r.reference_type || undefined,
        referenceId: r.reference_id || undefined,
        userName: r.user_name || undefined,
        reason: r.reason || undefined,
      })),
    }
  }

  /**
   * 11. Customer Performance Report
   */
  async getCustomersReport(range: ReportDateRange): Promise<CustomersReport> {
    const db = getDb()

    const [statRow] = await db.select<Array<{
      total_customers: number
      active_customers: number
      with_balance: number
      total_balance: number
    }>>(`
      SELECT 
        COUNT(id) AS total_customers,
        COALESCE(SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END), 0) AS active_customers,
        COALESCE(SUM(CASE WHEN balance > 0 THEN 1 ELSE 0 END), 0) AS with_balance,
        COALESCE(SUM(balance), 0) AS total_balance
      FROM customers
    `)

    const topCust = await db.select<Array<{
      id: string
      name: string
      phone: string | null
      balance: number
      total_purchases: number
      sales_count: number
    }>>(`
      SELECT 
        c.id,
        c.name,
        c.phone,
        c.balance,
        COALESCE(SUM(s.total), 0) AS total_purchases,
        COUNT(s.id) AS sales_count
      FROM customers c
      LEFT JOIN sales s ON s.customer_id = c.id AND s.created_at >= ? AND s.created_at <= ? AND s.status = 'completed'
      GROUP BY c.id, c.name, c.phone, c.balance
      ORDER BY total_purchases DESC
      LIMIT 15
    `, [range.startDate, range.endDate])

    return {
      totalCustomers: Number(statRow?.total_customers) || 0,
      activeCustomers: Number(statRow?.active_customers) || 0,
      customersWithBalance: Number(statRow?.with_balance) || 0,
      totalOutstandingBalance: Number((Number(statRow?.total_balance) || 0).toFixed(2)),
      topCustomers: topCust.map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone || undefined,
        balance: Number(c.balance) || 0,
        totalPurchases: Number((Number(c.total_purchases) || 0).toFixed(2)),
        salesCount: Number(c.sales_count) || 0,
      })),
    }
  }

  /**
   * 12. Supplier Performance Report
   */
  async getSuppliersReport(range: ReportDateRange): Promise<SuppliersReport> {
    const db = getDb()

    const [statRow] = await db.select<Array<{
      total_suppliers: number
      active_suppliers: number
      with_balance: number
      total_balance: number
    }>>(`
      SELECT 
        COUNT(id) AS total_suppliers,
        COALESCE(SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END), 0) AS active_suppliers,
        COALESCE(SUM(CASE WHEN balance > 0 THEN 1 ELSE 0 END), 0) AS with_balance,
        COALESCE(SUM(balance), 0) AS total_balance
      FROM suppliers
    `)

    const topSupp = await db.select<Array<{
      id: string
      name: string
      phone: string | null
      balance: number
      total_purchases: number
      purchases_count: number
    }>>(`
      SELECT 
        sup.id,
        sup.name,
        sup.phone,
        sup.balance,
        COALESCE(SUM(p.total), 0) AS total_purchases,
        COUNT(p.id) AS purchases_count
      FROM suppliers sup
      LEFT JOIN purchases p ON p.supplier_id = sup.id AND p.purchased_at >= ? AND p.purchased_at <= ? AND (p.status = 'received' OR p.status = 'completed')
      GROUP BY sup.id, sup.name, sup.phone, sup.balance
      ORDER BY total_purchases DESC
      LIMIT 15
    `, [range.startDate, range.endDate])

    return {
      totalSuppliers: Number(statRow?.total_suppliers) || 0,
      activeSuppliers: Number(statRow?.active_suppliers) || 0,
      suppliersWithBalance: Number(statRow?.with_balance) || 0,
      totalOutstandingBalance: Number((Number(statRow?.total_balance) || 0).toFixed(2)),
      topSuppliers: topSupp.map(s => ({
        id: s.id,
        name: s.name,
        phone: s.phone || undefined,
        balance: Number(s.balance) || 0,
        totalPurchases: Number((Number(s.total_purchases) || 0).toFixed(2)),
        purchasesCount: Number(s.purchases_count) || 0,
      })),
    }
  }

  /**
   * 13. Cash Shifts & Reconciliation Report
   */
  async getShiftsReport(range: ReportDateRange): Promise<ShiftsSummaryReport> {
    const db = getDb()

    const rows = await db.select<Array<{
      id: string
      register_name: string | null
      user_name: string | null
      opened_at: string
      closed_at: string | null
      opening_balance: number
      cash_sales: number
      cash_refunds: number
      cash_expenses: number
      cash_deposits: number
      cash_withdrawals: number
      closing_balance: number | null
      difference: number | null
      status: string
    }>>(`
      SELECT 
        s.id,
        cr.name AS register_name,
        COALESCE(u.full_name, u.username) AS user_name,
        s.opened_at,
        s.closed_at,
        s.opening_balance,
        s.cash_sales,
        s.cash_refunds,
        s.cash_expenses,
        s.cash_deposits,
        s.cash_withdrawals,
        s.closing_balance,
        s.difference,
        s.status
      FROM shifts s
      LEFT JOIN cash_registers cr ON s.register_id = cr.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.opened_at >= ? AND s.opened_at <= ?
      ORDER BY s.opened_at DESC
    `, [range.startDate, range.endDate])

    let totalSales = 0
    let totalRefunds = 0
    let totalExpenses = 0
    let totalDeposits = 0
    let totalWithdrawals = 0

    const shifts = rows.map(r => {
      const openBal = Number(r.opening_balance) || 0
      const cSales = Number(r.cash_sales) || 0
      const cRefunds = Number(r.cash_refunds) || 0
      const cExpenses = Number(r.cash_expenses) || 0
      const cDeposits = Number(r.cash_deposits) || 0
      const cWithdrawals = Number(r.cash_withdrawals) || 0

      totalSales += cSales
      totalRefunds += cRefunds
      totalExpenses += cExpenses
      totalDeposits += cDeposits
      totalWithdrawals += cWithdrawals

      const expected = openBal + cSales + cDeposits - cRefunds - cExpenses - cWithdrawals

      return {
        id: r.id,
        registerName: r.register_name || 'الخزينة الرئيسية',
        userName: r.user_name || 'كاشير',
        openedAt: r.opened_at,
        closedAt: r.closed_at || undefined,
        openingBalance: openBal,
        cashSales: cSales,
        cashRefunds: cRefunds,
        cashExpenses: cExpenses,
        expectedCash: Number(expected.toFixed(2)),
        actualCash: r.closing_balance !== null ? Number(r.closing_balance) : undefined,
        difference: r.difference !== null ? Number(r.difference) : undefined,
        status: r.status,
      }
    })

    return {
      shiftsCount: shifts.length,
      totalCashSales: Number(totalSales.toFixed(2)),
      totalCashRefunds: Number(totalRefunds.toFixed(2)),
      totalCashExpenses: Number(totalExpenses.toFixed(2)),
      totalCashDeposits: Number(totalDeposits.toFixed(2)),
      totalCashWithdrawals: Number(totalWithdrawals.toFixed(2)),
      shifts,
    }
  }

  /**
   * 14. Cash Movements Ledger Report
   */
  async getCashMovements(range: ReportDateRange): Promise<CashMovementRow[]> {
    const db = getDb()

    const rows = await db.select<Array<{
      id: string
      created_at: string
      register_name: string | null
      shift_id: string
      type: string
      direction: string
      amount: number
      reason: string
      notes: string | null
      user_name: string | null
    }>>(`
      SELECT 
        cm.id,
        cm.created_at,
        cr.name AS register_name,
        cm.shift_id,
        cm.type,
        cm.direction,
        cm.amount,
        cm.reason,
        cm.notes,
        COALESCE(u.full_name, u.username) AS user_name
      FROM cash_movements cm
      LEFT JOIN cash_registers cr ON cm.register_id = cr.id
      LEFT JOIN users u ON cm.user_id = u.id
      WHERE cm.created_at >= ? AND cm.created_at <= ?
      ORDER BY cm.created_at DESC
    `, [range.startDate, range.endDate])

    return rows.map(r => ({
      id: r.id,
      createdAt: r.created_at,
      registerName: r.register_name || 'الخزينة',
      shiftId: r.shift_id,
      type: r.type,
      direction: r.direction as 'in' | 'out',
      amount: Number(r.amount) || 0,
      reason: r.reason,
      notes: r.notes || undefined,
      userName: r.user_name || undefined,
    }))
  }

  /**
   * 15. Payment Methods Breakdown Report
   */
  async getPaymentMethodBreakdown(range: ReportDateRange): Promise<PaymentMethodBreakdownReport> {
    const db = getDb()

    // 1. Sales payments
    const salesPay = await db.select<Array<{ method: string; amount: number; count: number }>>(`
      SELECT 
        p.method,
        COALESCE(SUM(p.amount), 0) AS amount,
        COUNT(p.id) AS count
      FROM payments p
      JOIN sales s ON p.sale_id = s.id
      WHERE s.created_at >= ? AND s.created_at <= ? AND s.status = 'completed'
      GROUP BY p.method
    `, [range.startDate, range.endDate])

    const labels: Record<string, { ar: string; en: string }> = {
      cash: { ar: 'نقداً', en: 'Cash' },
      card: { ar: 'بطاقة بنكية', en: 'Card' },
      instapay: { ar: 'إنستاباي', en: 'InstaPay' },
      vodafone_cash: { ar: 'فودافون كاش', en: 'Vodafone Cash' },
      bank_transfer: { ar: 'تحويل بنكي', en: 'Bank Transfer' },
      other: { ar: 'أخرى', en: 'Other' },
    }

    let totalNet = 0
    const methodMap = new Map<string, { labelAr: string; labelEn: string; sales: number; count: number }>()

    for (const p of salesPay) {
      const k = p.method.toLowerCase()
      const amt = Number(p.amount) || 0
      totalNet += amt
      const meta = labels[k] || { ar: k, en: k }
      methodMap.set(k, {
        labelAr: meta.ar,
        labelEn: meta.en,
        sales: amt,
        count: Number(p.count) || 0,
      })
    }

    const methods = Array.from(methodMap.entries()).map(([method, data]) => ({
      method,
      labelAr: data.labelAr,
      labelEn: data.labelEn,
      salesAmount: Number(data.sales.toFixed(2)),
      salesCount: data.count,
      refundsAmount: 0,
      netAmount: Number(data.sales.toFixed(2)),
      percentage: totalNet > 0 ? Number(((data.sales / totalNet) * 100).toFixed(1)) : 0,
    }))

    return {
      methods,
      totalNet: Number(totalNet.toFixed(2)),
    }
  }

  /**
   * 16. Product Sales Ranking & Margins
   */
  async getProductPerformance(params: ReportFilterParams): Promise<ProductPerformanceRow[]> {
    const db = getDb()
    const { range, search, categoryId } = params

    const conditions: string[] = ['s.created_at >= ? AND s.created_at <= ? AND s.status = \'completed\'']
    const queryParams: any[] = [range.startDate, range.endDate]

    if (categoryId) {
      conditions.push('p.category_id = ?')
      queryParams.push(categoryId)
    }

    if (search && search.trim()) {
      conditions.push('(p.name_ar LIKE ? OR p.name_en LIKE ? OR p.sku LIKE ?)')
      const ptrn = `%${search.trim()}%`
      queryParams.push(ptrn, ptrn, ptrn)
    }

    const whereClause = conditions.join(' AND ')

    const rows = await db.select<Array<{
      product_id: string
      name_ar: string
      name_en: string
      sku: string
      cat_name_ar: string | null
      cat_name_en: string | null
      quantity_sold: number
      revenue: number
      cost: number
      profit: number
    }>>(`
      SELECT 
        si.product_id,
        p.name_ar,
        p.name_en,
        COALESCE(si.product_sku, p.sku) AS sku,
        c.name_ar AS cat_name_ar,
        c.name_en AS cat_name_en,
        COALESCE(SUM(si.quantity), 0) AS quantity_sold,
        COALESCE(SUM(si.subtotal), 0) AS revenue,
        COALESCE(SUM(si.quantity * si.cost_price), 0) AS cost,
        COALESCE(SUM(si.profit), 0) AS profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      LEFT JOIN products p ON si.product_id = p.id
      LEFT JOIN product_categories c ON p.category_id = c.id
      WHERE ${whereClause}
      GROUP BY si.product_id, p.name_ar, p.name_en, sku, c.name_ar, c.name_en
      ORDER BY revenue DESC
    `, queryParams)

    return rows.map(r => {
      const rev = Number(r.revenue) || 0
      const prof = Number(r.profit) || 0
      return {
        id: r.product_id,
        nameAr: r.name_ar || 'منتج',
        nameEn: r.name_en || 'Product',
        sku: r.sku || '—',
        categoryNameAr: r.cat_name_ar || undefined,
        categoryNameEn: r.cat_name_en || undefined,
        quantitySold: Number(r.quantity_sold) || 0,
        revenue: Number(rev.toFixed(2)),
        cost: Number((Number(r.cost) || 0).toFixed(2)),
        profit: Number(prof.toFixed(2)),
        marginPct: rev > 0 ? Number(((prof / rev) * 100).toFixed(1)) : 0,
        returnQuantity: 0,
      }
    })
  }

  /**
   * 17. Category Sales Ranking & Margins
   */
  async getCategoryPerformance(range: ReportDateRange): Promise<CategoryPerformanceRow[]> {
    const db = getDb()

    const rows = await db.select<Array<{
      category_id: string | null
      name_ar: string | null
      name_en: string | null
      product_count: number
      quantity_sold: number
      revenue: number
      cost: number
      profit: number
    }>>(`
      SELECT 
        p.category_id,
        c.name_ar,
        c.name_en,
        COUNT(DISTINCT p.id) AS product_count,
        COALESCE(SUM(si.quantity), 0) AS quantity_sold,
        COALESCE(SUM(si.subtotal), 0) AS revenue,
        COALESCE(SUM(si.quantity * si.cost_price), 0) AS cost,
        COALESCE(SUM(si.profit), 0) AS profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      LEFT JOIN product_categories c ON p.category_id = c.id
      WHERE s.created_at >= ? AND s.created_at <= ? AND s.status = 'completed'
      GROUP BY p.category_id, c.name_ar, c.name_en
      ORDER BY revenue DESC
    `, [range.startDate, range.endDate])

    return rows.map(r => {
      const rev = Number(r.revenue) || 0
      const prof = Number(r.profit) || 0
      return {
        id: r.category_id || 'uncategorized',
        nameAr: r.name_ar || 'غير مصنف',
        nameEn: r.name_en || 'Uncategorized',
        productCount: Number(r.product_count) || 0,
        quantitySold: Number(r.quantity_sold) || 0,
        revenue: Number(rev.toFixed(2)),
        cost: Number((Number(r.cost) || 0).toFixed(2)),
        profit: Number(prof.toFixed(2)),
        marginPct: rev > 0 ? Number(((prof / rev) * 100).toFixed(1)) : 0,
        returnQuantity: 0,
      }
    })
  }
}

export const reportsService = new ReportsService()

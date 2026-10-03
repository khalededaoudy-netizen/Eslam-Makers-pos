/**
 * MAKERS POS — Sales Service
 * Authoritative financial engine for POS checkout, sales completion, atomic transactions,
 * inventory deduction, cash register integration, and receipt generation.
 */

import { v4 as uuidv4 } from 'uuid'
import { getDb, withTransaction } from '@/services/db/database'
import { auditService } from '@/services/audit/auditService'
import { receiptService } from './receiptService'
import {
  Sale,
  SaleItem,
  SalePayment,
  CreateSaleInput,
  ReceiptData,
  SalesFilter,
} from './types'
import { PaymentMethodType } from '@/features/payments/types'

export interface UserContext {
  id: string
  fullName?: string
  role?: string
}

// In-flight idempotency guard to prevent rapid double-clicks
const inFlightTransactions = new Set<string>()

class SalesService {
  /**
   * Generate human-readable sequential Sale Number: SAL-YYYYMMDD-XXXXXX
   */
  private async generateSaleNumber(): Promise<string> {
    const db = getDb()
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const datePrefix = `SAL-${yyyy}${mm}${dd}-`

    const rows = await db.select<Array<{ invoice_number: string }>>(
      'SELECT invoice_number FROM sales WHERE invoice_number LIKE ? ORDER BY invoice_number DESC LIMIT 1',
      [`${datePrefix}%`]
    )

    let nextSeq = 1
    if (rows && rows.length > 0) {
      const lastNum = rows[0].invoice_number
      const lastSeqStr = lastNum.replace(datePrefix, '')
      const lastSeq = parseInt(lastSeqStr, 10)
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1
      }
    }

    return `${datePrefix}${String(nextSeq).padStart(6, '0')}`
  }

  /**
   * Create and Finalize Sale (Atomic Operation)
   */
  async createSale(
    input: CreateSaleInput,
    user: UserContext
  ): Promise<{ sale: Sale; receipt: ReceiptData }> {
    // 1. Basic Validations
    if (!user || !user.id) {
      throw new Error('Authenticated cashier user is required')
    }

    if (!input.items || input.items.length === 0) {
      throw new Error('Cannot complete sale: Cart is empty')
    }

    if (!input.shiftId) {
      throw new Error('Active shift ID is required to process sale')
    }

    // 2. Idempotency Check
    const idempotencyKey = input.idempotencyKey || `${user.id}-${Date.now()}`
    if (inFlightTransactions.has(idempotencyKey)) {
      throw new Error('Sale transaction is already in progress. Please wait.')
    }
    inFlightTransactions.add(idempotencyKey)

    const db = getDb()

    try {
      // 3. Verify Active Shift is OPEN
      const shiftRows = await db.select<Array<{ id: string; status: string; register_id: string }>>(
        'SELECT id, status, register_id FROM shifts WHERE id = ? LIMIT 1',
        [input.shiftId]
      )
      if (!shiftRows || shiftRows.length === 0) {
        throw new Error('Shift not found')
      }
      if (shiftRows[0].status !== 'open') {
        throw new Error('Cannot process sales on a closed shift')
      }

      let registerId = input.registerId || shiftRows[0].register_id
      if (!registerId) {
        const defaultReg = await db.select<Array<{ id: string }>>('SELECT id FROM cash_registers WHERE is_active = 1 LIMIT 1')
        if (defaultReg && defaultReg.length > 0) {
          registerId = defaultReg[0].id
        }
      }

      // 4. Verify Customer if attached
      let customerName: string | undefined = undefined
      let customerCode: string | undefined = undefined
      let customerPhone: string | undefined = undefined
      if (input.customerId) {
        const custRows = await db.select<Array<{ id: string; name: string; customer_code: string; phone: string; is_active: number }>>(
          'SELECT id, name, customer_code, phone, is_active FROM customers WHERE id = ? LIMIT 1',
          [input.customerId]
        )
        if (!custRows || custRows.length === 0) {
          throw new Error('Attached customer was not found')
        }
        if (custRows[0].is_active === 0) {
          throw new Error('Attached customer account is inactive/archived')
        }
        customerName = custRows[0].name
        customerCode = custRows[0].customer_code
        customerPhone = custRows[0].phone
      }

      // 5. Authoritative Stock Revalidation & Product Snapshots
      const productIds = input.items.map(i => i.productId)
      const placeholders = productIds.map(() => '?').join(',')
      const productRows = await db.select<Array<{
        id: string
        sku: string
        name_ar: string
        name_en: string
        selling_price: number
        purchase_price: number
        current_stock: number
        is_active: number
      }>>(`SELECT id, sku, name_ar, name_en, selling_price, purchase_price, current_stock, is_active FROM products WHERE id IN (${placeholders})`, productIds)

      const productMap = new Map<string, typeof productRows[0]>()
      for (const p of productRows) {
        productMap.set(p.id, p)
      }

      // Check allow_negative_stock setting
      const settings = await db.select<Array<{ value: string }>>("SELECT value FROM settings WHERE key = 'allow_negative_stock'")
      const allowNegative = settings.length > 0 && settings[0].value === '1'

      // Check tax settings
      const taxEnabledSetting = await db.select<Array<{ value: string }>>("SELECT value FROM settings WHERE key = 'tax_enabled'")
      const taxRateSetting = await db.select<Array<{ value: string }>>("SELECT value FROM settings WHERE key = 'tax_rate'")
      const isTaxEnabled = taxEnabledSetting.length > 0 && (taxEnabledSetting[0].value === '1' || taxEnabledSetting[0].value === 'true')
      const systemTaxRate = taxRateSetting.length > 0 ? parseFloat(taxRateSetting[0].value) || 0 : 0

      // Validate each line item & compute line subtotal
      let computedSubtotal = 0
      const processedItems: Array<{
        productId: string
        productName: string
        productSku: string
        barcode?: string | null
        quantity: number
        unitPrice: number
        costPrice: number
        discountAmount: number
        discountPct: number
        subtotal: number
        profit: number
        stockBefore: number
        stockAfter: number
      }> = []

      for (const item of input.items) {
        const prod = productMap.get(item.productId)
        if (!prod) {
          throw new Error(`Product ${item.productName || item.productId} not found in database`)
        }
        if (prod.is_active === 0) {
          throw new Error(`Product ${prod.name_ar || prod.name_en} is inactive and cannot be sold`)
        }

        const qty = Number(item.quantity)
        if (isNaN(qty) || qty <= 0) {
          throw new Error(`Invalid quantity for product ${prod.name_ar || prod.name_en}`)
        }

        const currentStock = Number(prod.current_stock) || 0
        if (currentStock < qty && !allowNegative) {
          throw new Error(
            `Insufficient stock for "${prod.name_ar || prod.name_en}". Current stock: ${currentStock}, requested: ${qty}`
          )
        }

        const unitPrice = Number(item.unitPrice)
        const costPrice = Number(prod.purchase_price) || 0
        const lineDiscountAmt = Number(item.discountAmount) || 0
        const lineDiscountPct = Number(item.discountPct) || 0
        const lineSubtotal = Math.max(0, unitPrice * qty - lineDiscountAmt)
        const lineProfit = lineSubtotal - costPrice * qty

        computedSubtotal += lineSubtotal

        processedItems.push({
          productId: prod.id,
          productName: prod.name_ar || prod.name_en || item.productName,
          productSku: prod.sku || item.productSku,
          barcode: item.barcode || null,
          quantity: qty,
          unitPrice,
          costPrice,
          discountAmount: lineDiscountAmt,
          discountPct: lineDiscountPct,
          subtotal: Number(lineSubtotal.toFixed(2)),
          profit: Number(lineProfit.toFixed(2)),
          stockBefore: currentStock,
          stockAfter: currentStock - qty,
        })
      }

      // 6. Authoritative Totals Calculation
      const cartDiscountAmount = Math.min(computedSubtotal, Math.max(0, Number(input.discountAmount) || 0))
      const cartDiscountPct = Number(input.discountPct) || (computedSubtotal > 0 ? (cartDiscountAmount / computedSubtotal) * 100 : 0)
      const discountType = input.discountType || (input.discountPct && input.discountPct > 0 ? 'pct' : 'fixed')
      const taxableAmount = Math.max(0, computedSubtotal - cartDiscountAmount)

      const taxRate = input.taxRate !== undefined ? input.taxRate : (isTaxEnabled ? systemTaxRate : 0)
      const taxAmount = isTaxEnabled && taxRate > 0 ? Number(((taxableAmount * taxRate) / 100).toFixed(2)) : 0
      const totalAmount = Number((taxableAmount + taxAmount).toFixed(2))

      // 7. Validate Payments
      if (!input.payments || input.payments.length === 0) {
        throw new Error('Payment information is required')
      }

      let totalPaid = 0
      let totalChange = 0

      for (const p of input.payments) {
        const amt = Number(p.amount)
        if (isNaN(amt) || amt <= 0) {
          throw new Error('Payment amount must be greater than zero')
        }
        totalPaid += amt
        if (p.changeAmount && p.changeAmount > 0) {
          totalChange += Number(p.changeAmount)
        }
      }

      totalPaid = Number(totalPaid.toFixed(2))
      totalChange = Number(totalChange.toFixed(2))

      if (totalPaid < totalAmount) {
        throw new Error(`Insufficient payment. Total due is ${totalAmount} EGP, but paid ${totalPaid} EGP`)
      }

      // 8. Generate Sale Number & Sale ID
      const saleId = uuidv4()
      const saleNumber = await this.generateSaleNumber()

      // 9. Execute Atomic SQLite Transaction
      await withTransaction(async (d) => {
        // A. Insert Sales Row
        await d.execute(`
          INSERT INTO sales (
            id, invoice_number, shift_id, register_id, cashier_id, customer_id,
            status, subtotal, discount_amount, discount_pct, discount_type, tax_amount,
            total, paid_amount, change_amount, notes, created_at, updated_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?,
            'completed', ?, ?, ?, ?, ?,
            ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
          )
        `, [
          saleId,
          saleNumber,
          input.shiftId,
          registerId || null,
          user.id,
          input.customerId || null,
          Number(computedSubtotal.toFixed(2)),
          Number(cartDiscountAmount.toFixed(2)),
          Number(cartDiscountPct.toFixed(2)),
          discountType,
          Number(taxAmount.toFixed(2)),
          totalAmount,
          totalPaid,
          totalChange,
          input.notes || null,
        ])

        // B. Insert Sale Items Snapshot
        for (const it of processedItems) {
          const itemId = uuidv4()
          await d.execute(`
            INSERT INTO sale_items (
              id, sale_id, product_id, product_name, product_sku, barcode,
              quantity, unit_price, cost_price, discount_amount, discount_pct,
              subtotal, profit
            ) VALUES (
              ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?,
              ?, ?
            )
          `, [
            itemId,
            saleId,
            it.productId,
            it.productName,
            it.productSku,
            it.barcode,
            it.quantity,
            it.unitPrice,
            it.costPrice,
            it.discountAmount,
            it.discountPct,
            it.subtotal,
            it.profit,
          ])

          // C. Deduct Stock & Insert Inventory Movement
          await d.execute(
            "UPDATE products SET current_stock = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?",
            [it.stockAfter, it.productId]
          )

          const invMovementId = uuidv4()
          await d.execute(`
            INSERT INTO inventory_movements (
              id, product_id, type, quantity, stock_before, stock_after,
              reference_id, reference_type, reason, notes, user_id, created_at
            ) VALUES (
              ?, ?, 'sale', ?, ?, ?,
              ?, 'sale', ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
            )
          `, [
            invMovementId,
            it.productId,
            -it.quantity,
            it.stockBefore,
            it.stockAfter,
            saleId,
            `POS Sale ${saleNumber}`,
            `Sale Item ${it.productSku}`,
            user.id,
          ])
        }

        // D. Insert Payment Records & Update Cash Drawer if Cash
        for (const p of input.payments) {
          const paymentId = uuidv4()
          await d.execute(`
            INSERT INTO payments (
              id, sale_id, shift_id, register_id, user_id, customer_id,
              method, amount, reference, notes, created_at
            ) VALUES (
              ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
            )
          `, [
            paymentId,
            saleId,
            input.shiftId,
            registerId || null,
            user.id,
            input.customerId || null,
            p.method,
            p.amount,
            p.reference || null,
            p.notes || null,
          ])

          // For Cash: Record in cash_movements ledger (net physical cash received into drawer)
          if (p.method === 'cash') {
            const netCashReceived = p.receivedAmount && p.changeAmount
              ? p.receivedAmount - p.changeAmount
              : p.amount

            const cashMovId = uuidv4()
            await d.execute(`
              INSERT INTO cash_movements (
                id, register_id, shift_id, user_id, amount,
                type, direction, payment_method, reason, reference_id, reference_type, notes, created_at
              ) VALUES (
                ?, ?, ?, ?, ?,
                'sale_cash', 'in', 'cash', ?, ?, 'sale', ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
              )
            `, [
              cashMovId,
              registerId,
              input.shiftId,
              user.id,
              netCashReceived,
              `POS Cash Sale ${saleNumber}`,
              saleId,
              p.notes || null,
            ])
          }
        }

        // E. Remove Held Cart if resumed/attached
        if (input.heldCartId) {
          await d.execute('DELETE FROM held_carts WHERE id = ?', [input.heldCartId])
        }
      })

      // 10. Audit Logging
      await auditService.log({
        userId: user.id,
        userFullName: user.fullName || 'Cashier',
        action: 'sale',
        resource: 'sales',
        resourceId: saleId,
        details: {
          invoiceNumber: saleNumber,
          total: totalAmount,
          itemsCount: processedItems.length,
          totalQuantity: processedItems.reduce((acc, it) => acc + it.quantity, 0),
          customerName,
        },
      })

      // 11. Fetch and Return Completed Sale & Structured Receipt
      const completedSale = await this.getSaleById(saleId)
      if (!completedSale) {
        throw new Error('Sale completed but failed to reload details')
      }

      const receipt = await receiptService.buildReceiptData(completedSale)

      return {
        sale: completedSale,
        receipt,
      }
    } finally {
      inFlightTransactions.delete(idempotencyKey)
    }
  }

  /**
   * Get Sale by ID with line items and payments
   */
  async getSaleById(saleId: string): Promise<Sale | null> {
    const db = getDb()
    const rows = await db.select<Array<{
      id: string
      invoice_number: string
      shift_id: string
      register_id: string
      cashier_id: string
      cashier_name: string
      customer_id: string
      customer_name: string
      customer_code: string
      customer_phone: string
      status: string
      subtotal: number
      discount_amount: number
      discount_pct: number
      discount_type?: 'pct' | 'fixed'
      tax_amount: number
      total: number
      paid_amount: number
      change_amount: number
      notes: string
      created_at: string
      updated_at: string
    }>>(`
      SELECT
        s.*,
        u.full_name as cashier_name,
        c.name as customer_name,
        c.customer_code as customer_code,
        c.phone as customer_phone
      FROM sales s
      LEFT JOIN users u ON u.id = s.cashier_id
      LEFT JOIN customers c ON c.id = s.customer_id
      WHERE s.id = ?
      LIMIT 1
    `, [saleId])

    if (!rows || rows.length === 0) return null
    const s = rows[0]

    const items = await db.select<SaleItem[]>(
      'SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id ASC',
      [saleId]
    )

    const payments = await db.select<SalePayment[]>(
      'SELECT * FROM payments WHERE sale_id = ? ORDER BY created_at ASC',
      [saleId]
    )

    return {
      id: s.id,
      invoice_number: s.invoice_number,
      shift_id: s.shift_id,
      register_id: s.register_id,
      cashier_id: s.cashier_id,
      cashier_name: s.cashier_name,
      customer_id: s.customer_id,
      customer_name: s.customer_name,
      customer_code: s.customer_code,
      customer_phone: s.customer_phone,
      status: s.status as any,
      subtotal: Number(s.subtotal),
      discount_amount: Number(s.discount_amount),
      discount_pct: Number(s.discount_pct),
      discount_type: s.discount_type || (Number(s.discount_pct) > 0 ? 'pct' : 'fixed'),
      tax_amount: Number(s.tax_amount),
      total: Number(s.total),
      paid_amount: Number(s.paid_amount),
      change_amount: Number(s.change_amount),
      notes: s.notes,
      created_at: s.created_at,
      updated_at: s.updated_at,
      items,
      payments,
    }
  }

  /**
   * Search / Query Sales History
   */
  async getSales(filters: SalesFilter = {}): Promise<{ sales: Sale[]; totalCount: number }> {
    const db = getDb()
    const conditions: string[] = []
    const params: unknown[] = []

    if (filters.search) {
      conditions.push('(s.invoice_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)')
      const q = `%${filters.search.trim()}%`
      params.push(q, q, q)
    }

    if (filters.customerId) {
      conditions.push('s.customer_id = ?')
      params.push(filters.customerId)
    }

    if (filters.cashierId) {
      conditions.push('s.cashier_id = ?')
      params.push(filters.cashierId)
    }

    if (filters.status) {
      conditions.push('s.status = ?')
      params.push(filters.status)
    }

    if (filters.startDate) {
      conditions.push("s.created_at >= ?")
      params.push(filters.startDate)
    }

    if (filters.endDate) {
      conditions.push("s.created_at <= ?")
      params.push(filters.endDate)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const countRows = await db.select<Array<{ count: number }>>(
      `SELECT COUNT(*) as count FROM sales s LEFT JOIN customers c ON c.id = s.customer_id ${whereClause}`,
      params
    )
    const totalCount = countRows && countRows.length > 0 ? countRows[0].count : 0

    const limit = filters.limit || 50
    const offset = filters.offset || 0

    const query = `
      SELECT
        s.*,
        u.full_name as cashier_name,
        c.name as customer_name,
        c.customer_code as customer_code,
        c.phone as customer_phone
      FROM sales s
      LEFT JOIN users u ON u.id = s.cashier_id
      LEFT JOIN customers c ON c.id = s.customer_id
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
    `

    const rows = await db.select<any[]>(query, [...params, limit, offset])

    const sales: Sale[] = rows.map(s => ({
      id: s.id,
      invoice_number: s.invoice_number,
      shift_id: s.shift_id,
      register_id: s.register_id,
      cashier_id: s.cashier_id,
      cashier_name: s.cashier_name,
      customer_id: s.customer_id,
      customer_name: s.customer_name,
      customer_code: s.customer_code,
      customer_phone: s.customer_phone,
      status: s.status,
      subtotal: Number(s.subtotal),
      discount_amount: Number(s.discount_amount),
      discount_pct: Number(s.discount_pct),
      discount_type: s.discount_type || (Number(s.discount_pct) > 0 ? 'pct' : 'fixed'),
      tax_amount: Number(s.tax_amount),
      total: Number(s.total),
      paid_amount: Number(s.paid_amount),
      change_amount: Number(s.change_amount),
      notes: s.notes,
      created_at: s.created_at,
      updated_at: s.updated_at,
    }))

    return { sales, totalCount }
  }
}

export const salesService = new SalesService()

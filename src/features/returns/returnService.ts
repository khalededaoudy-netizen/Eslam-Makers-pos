/**
 * MAKERS POS — Returns & Refunds Service
 * Authoritative financial & inventory engine for processing returns against completed sales,
 * historical price & tax calculation, multi-location inventory restoration, cash register deduction,
 * and return receipt generation.
 */

import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/services/db/database'
import { auditService } from '@/services/audit/auditService'
import { returnReceiptService } from './returnReceiptService'
import {
  Return,
  ReturnItem,
  ReturnPayment,
  CreateReturnInput,
  SaleReturnEligibility,
  SaleReturnableItem,
  ReturnReceiptData,
  ReturnFilter,
} from './types'
import { PaymentMethodType } from '@/features/payments/types'

export interface UserContext {
  id: string
  fullName?: string
  role?: string
}

// In-flight idempotency guard to prevent rapid double-clicks
const inFlightReturnTransactions = new Set<string>()

class ReturnService {
  /**
   * Generate human-readable sequential Return Number: RET-YYYYMMDD-XXXXXX
   */
  private async generateReturnNumber(): Promise<string> {
    const db = getDb()
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const datePrefix = `RET-${yyyy}${mm}${dd}-`

    const rows = await db.select<Array<{ return_number: string }>>(
      'SELECT return_number FROM returns WHERE return_number LIKE ? ORDER BY return_number DESC LIMIT 1',
      [`${datePrefix}%`]
    )

    let nextSeq = 1
    if (rows && rows.length > 0) {
      const lastNum = rows[0].return_number
      const lastSeqStr = lastNum.replace(datePrefix, '')
      const lastSeq = parseInt(lastSeqStr, 10)
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1
      }
    }

    return `${datePrefix}${String(nextSeq).padStart(6, '0')}`
  }

  /**
   * Search eligible completed sales for returns
   */
  async searchSaleForReturn(query: string): Promise<Array<{
    id: string
    invoiceNumber: string
    createdAt: string
    total: number
    status: string
    customerName?: string | null
    customerPhone?: string | null
    itemsCount: number
  }>> {
    const db = getDb()
    const cleanQuery = `%${query.trim()}%`

    const rows = await db.select<Array<{
      id: string
      invoice_number: string
      created_at: string
      total: number
      status: string
      customer_name: string | null
      customer_phone: string | null
      items_count: number
    }>>(`
      SELECT 
        s.id,
        s.invoice_number,
        s.created_at,
        s.total,
        s.status,
        c.name as customer_name,
        c.phone as customer_phone,
        (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) as items_count
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.status = 'completed'
        AND (
          s.invoice_number LIKE ?
          OR c.name LIKE ?
          OR c.phone LIKE ?
        )
      ORDER BY s.created_at DESC
      LIMIT 20
    `, [cleanQuery, cleanQuery, cleanQuery])

    return rows.map(r => ({
      id: r.id,
      invoiceNumber: r.invoice_number,
      createdAt: r.created_at,
      total: r.total,
      status: r.status,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      itemsCount: r.items_count,
    }))
  }

  /**
   * Calculate detailed return eligibility for a sale
   */
  async getSaleReturnEligibility(saleId: string): Promise<SaleReturnEligibility> {
    const db = getDb()

    // 1. Fetch Sale Header
    const saleRows = await db.select<Array<{
      id: string
      invoice_number: string
      created_at: string
      status: string
      customer_id: string | null
      cashier_id: string
      subtotal: number
      discount_amount: number
      tax_amount: number
      total: number
      paid_amount: number
      customer_name: string | null
      customer_phone: string | null
      cashier_name: string | null
    }>>(`
      SELECT 
        s.id,
        s.invoice_number,
        s.created_at,
        s.status,
        s.customer_id,
        s.cashier_id,
        s.subtotal,
        s.discount_amount,
        s.tax_amount,
        s.total,
        s.paid_amount,
        c.name as customer_name,
        c.phone as customer_phone,
        u.full_name as cashier_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users u ON s.cashier_id = u.id
      WHERE s.id = ?
      LIMIT 1
    `, [saleId])

    if (!saleRows || saleRows.length === 0) {
      throw new Error('Sale not found')
    }

    const sale = saleRows[0]
    if (sale.status !== 'completed') {
      throw new Error(`Cannot return items from a sale with status "${sale.status}"`)
    }

    // 2. Fetch Original Sale Items
    const itemsRows = await db.select<Array<{
      id: string
      product_id: string
      product_name: string
      product_sku: string
      barcode: string | null
      quantity: number
      unit_price: number
      cost_price: number
      discount_amount: number
      discount_pct: number
      subtotal: number
      profit: number
    }>>(`
      SELECT 
        id, product_id, product_name, product_sku, barcode,
        quantity, unit_price, cost_price, discount_amount, discount_pct, subtotal, profit
      FROM sale_items
      WHERE sale_id = ?
    `, [saleId])

    // 3. Fetch Previously Returned Items for this Sale
    const returnedRows = await db.select<Array<{
      sale_item_id: string
      returned_qty: number
      returned_refund: number
    }>>(`
      SELECT 
        ri.sale_item_id,
        COALESCE(SUM(ri.quantity), 0) as returned_qty,
        COALESCE(SUM(ri.line_total), 0) as returned_refund
      FROM return_items ri
      JOIN returns r ON ri.return_id = r.id
      WHERE r.sale_id = ? AND r.status = 'completed'
      GROUP BY ri.sale_item_id
    `, [saleId])

    const returnedMap = new Map<string, { qty: number; refund: number }>()
    for (const r of returnedRows) {
      returnedMap.set(r.sale_item_id, {
        qty: Number(r.returned_qty) || 0,
        refund: Number(r.returned_refund) || 0,
      })
    }

    // 4. Fetch Original Payments
    const payRows = await db.select<Array<{
      method: PaymentMethodType
      amount: number
      reference: string | null
    }>>(`
      SELECT method, amount, reference FROM payments WHERE sale_id = ?
    `, [saleId])

    // 5. Total Previously Refunded for this Sale
    const prevRefundRow = await db.select<Array<{ total_refunded: number }>>(`
      SELECT COALESCE(SUM(refund_amount), 0) as total_refunded
      FROM returns
      WHERE sale_id = ? AND status = 'completed'
    `, [saleId])

    const totalPreviouslyRefunded = Number(prevRefundRow[0]?.total_refunded || 0)
    const remainingRefundableAmount = Math.max(0, Number((sale.total - totalPreviouslyRefunded).toFixed(2)))

    // 6. Build Returnable Item Economics
    const returnableItems: SaleReturnableItem[] = []
    let allItemsFullyReturned = true

    for (const item of itemsRows) {
      const prev = returnedMap.get(item.id) || { qty: 0, refund: 0 }
      const soldQty = Number(item.quantity)
      const prevReturnedQty = prev.qty
      const remainingQty = Math.max(0, soldQty - prevReturnedQty)

      if (remainingQty > 0) {
        allItemsFullyReturned = false
      }

      // Proportional economics from original sale snapshot
      const lineGross = item.unit_price * soldQty
      const lineDiscount = item.discount_amount || 0
      const lineSubtotal = Math.max(0, lineGross - lineDiscount)

      // Proportion of cart-level discount allocated to this line
      const cartDiscountShare = sale.discount_amount > 0 && sale.subtotal > 0
        ? (lineSubtotal / sale.subtotal) * sale.discount_amount
        : 0
      const lineTaxable = Math.max(0, lineSubtotal - cartDiscountShare)

      // Proportion of tax allocated to this line
      const saleTaxable = Math.max(0, sale.subtotal - sale.discount_amount)
      const lineTaxShare = sale.tax_amount > 0 && saleTaxable > 0
        ? (lineTaxable / saleTaxable) * sale.tax_amount
        : 0

      const unitDiscountShare = soldQty > 0 ? (lineDiscount + cartDiscountShare) / soldQty : 0
      const unitTaxShare = soldQty > 0 ? lineTaxShare / soldQty : 0
      const unitRefundAmount = Number((item.unit_price - unitDiscountShare + unitTaxShare).toFixed(4))

      returnableItems.push({
        saleItemId: item.id,
        productId: item.product_id,
        productName: item.product_name,
        productSku: item.product_sku,
        barcode: item.barcode,
        unitPrice: item.unit_price,
        costPrice: item.cost_price,
        soldQuantity: soldQty,
        previouslyReturnedQuantity: prevReturnedQty,
        remainingReturnableQuantity: remainingQty,
        originalDiscountAmount: item.discount_amount,
        originalDiscountPct: item.discount_pct,
        originalSubtotal: item.subtotal,
        originalProfit: item.profit,
        unitDiscountShare: Number(unitDiscountShare.toFixed(4)),
        unitTaxShare: Number(unitTaxShare.toFixed(4)),
        unitRefundAmount: Number(unitRefundAmount.toFixed(2)),
      })
    }

    return {
      saleId: sale.id,
      invoiceNumber: sale.invoice_number,
      saleDate: sale.created_at,
      status: sale.status,
      customerId: sale.customer_id,
      customerName: sale.customer_name,
      customerPhone: sale.customer_phone,
      cashierId: sale.cashier_id,
      cashierName: sale.cashier_name,
      originalSubtotal: sale.subtotal,
      originalDiscountAmount: sale.discount_amount,
      originalTaxAmount: sale.tax_amount,
      originalTotal: sale.total,
      originalPaidAmount: sale.paid_amount,
      originalPayments: payRows.map(p => ({
        method: p.method,
        amount: p.amount,
        reference: p.reference,
      })),
      totalPreviouslyRefunded: Number(totalPreviouslyRefunded.toFixed(2)),
      remainingRefundableAmount,
      items: returnableItems,
      isFullyReturned: allItemsFullyReturned || remainingRefundableAmount <= 0.001,
    }
  }

  /**
   * Create and Finalize Return (Atomic SQLite Transaction)
   */
  async createReturn(
    input: CreateReturnInput,
    user: UserContext
  ): Promise<{ returnData: Return; receipt: ReturnReceiptData }> {
    // 1. Basic Validations
    if (!user || !user.id) {
      throw new Error('Authenticated user is required to process return')
    }

    if (!input.items || input.items.length === 0) {
      throw new Error('Cannot process return: No items selected for return')
    }

    if (!input.shiftId) {
      throw new Error('Active shift ID is required to process return')
    }

    // 2. Idempotency Check
    const idempotencyKey = input.idempotencyKey || `${user.id}-${input.saleId}-${Date.now()}`
    if (inFlightReturnTransactions.has(idempotencyKey)) {
      throw new Error('Return transaction is already in progress. Please wait.')
    }
    inFlightReturnTransactions.add(idempotencyKey)

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
        throw new Error('Cannot process return refunds on a closed shift')
      }

      const registerId = input.registerId || shiftRows[0].register_id

      // 4. Fetch Return Eligibility & Revalidate Quantities against DB
      const eligibility = await this.getSaleReturnEligibility(input.saleId)
      if (eligibility.isFullyReturned) {
        throw new Error('This sale has already been fully returned')
      }

      const itemEligibilityMap = new Map<string, SaleReturnableItem>()
      for (const it of eligibility.items) {
        itemEligibilityMap.set(it.saleItemId, it)
      }

      // 5. Process and Validate Each Return Line Item
      let computedSubtotal = 0
      let computedDiscount = 0
      let computedTax = 0
      let computedRefundTotal = 0

      const processedItems: Array<{
        saleItemId: string
        productId: string
        productName: string
        productSku: string
        barcode?: string | null
        quantity: number
        unitPrice: number
        discountAmount: number
        taxAmount: number
        lineTotal: number
        condition: 'resellable' | 'damaged' | 'defective'
        reason?: string
      }> = []

      for (const itemInput of input.items) {
        const elig = itemEligibilityMap.get(itemInput.saleItemId)
        if (!elig) {
          throw new Error(`Item ${itemInput.saleItemId} does not belong to this sale`)
        }

        const qty = Number(itemInput.quantity)
        if (isNaN(qty) || qty <= 0) {
          throw new Error(`Invalid return quantity for item "${elig.productName}"`)
        }

        if (qty > elig.remainingReturnableQuantity) {
          throw new Error(
            `Requested return quantity (${qty}) exceeds remaining returnable quantity (${elig.remainingReturnableQuantity}) for "${elig.productName}"`
          )
        }

        const lineGross = elig.unitPrice * qty
        const lineDiscount = elig.unitDiscountShare * qty
        const lineTax = elig.unitTaxShare * qty
        const lineRefund = Math.max(0, lineGross - lineDiscount + lineTax)

        computedSubtotal += lineGross
        computedDiscount += lineDiscount
        computedTax += lineTax
        computedRefundTotal += lineRefund

        processedItems.push({
          saleItemId: elig.saleItemId,
          productId: elig.productId,
          productName: elig.productName,
          productSku: elig.productSku,
          barcode: elig.barcode,
          quantity: qty,
          unitPrice: elig.unitPrice,
          discountAmount: Number(lineDiscount.toFixed(2)),
          taxAmount: Number(lineTax.toFixed(2)),
          lineTotal: Number(lineRefund.toFixed(2)),
          condition: itemInput.condition || 'resellable',
          reason: itemInput.reason || input.reason || 'Customer Return',
        })
      }

      computedSubtotal = Number(computedSubtotal.toFixed(2))
      computedDiscount = Number(computedDiscount.toFixed(2))
      computedTax = Number(computedTax.toFixed(2))
      computedRefundTotal = Number(computedRefundTotal.toFixed(2))

      // 6. Validate Refund Amount against Remaining Sale Balance
      if (computedRefundTotal > eligibility.remainingRefundableAmount + 0.01) {
        throw new Error(
          `Calculated refund amount (${computedRefundTotal} EGP) exceeds maximum remaining refundable amount (${eligibility.remainingRefundableAmount} EGP)`
        )
      }

      // 7. Validate Refund Payments
      if (!input.payments || input.payments.length === 0) {
        throw new Error('Refund payment method information is required')
      }

      let totalRefundPaid = 0
      let totalCashRefund = 0

      for (const p of input.payments) {
        const amt = Number(p.amount)
        if (isNaN(amt) || amt <= 0) {
          throw new Error('Refund payment amount must be greater than zero')
        }
        totalRefundPaid += amt
        if (p.method === 'cash') {
          totalCashRefund += amt
        }
      }

      totalRefundPaid = Number(totalRefundPaid.toFixed(2))

      if (Math.abs(totalRefundPaid - computedRefundTotal) > 0.01) {
        throw new Error(
          `Total refund payment allocation (${totalRefundPaid} EGP) does not match the calculated return total (${computedRefundTotal} EGP)`
        )
      }

      // 8. Generate Return Number & Return ID
      const returnId = uuidv4()
      const returnNumber = await this.generateReturnNumber()

      // Primary refund method (for display)
      const primaryRefundMethod = input.payments.length === 1 ? input.payments[0].method : 'other'

      // 9. Execute Atomic SQLite Transaction
      await db.execute('BEGIN TRANSACTION')
      try {
        // A. Insert Returns Record
        await db.execute(`
          INSERT INTO returns (
            id, return_number, sale_id, processed_by_id, user_id, customer_id,
            shift_id, register_id, subtotal, discount_amount, tax_amount,
            total_amount, refund_amount, total_refund, refund_method, status,
            reason, notes, created_at, updated_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, 'completed',
            ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
          )
        `, [
          returnId,
          returnNumber,
          input.saleId,
          user.id,
          user.id,
          eligibility.customerId || null,
          input.shiftId,
          registerId,
          computedSubtotal,
          computedDiscount,
          computedTax,
          computedRefundTotal,
          computedRefundTotal,
          computedRefundTotal,
          primaryRefundMethod,
          input.reason || null,
          input.notes || null,
        ])

        // B. Insert Return Items
        for (const it of processedItems) {
          const returnItemId = uuidv4()
          await db.execute(`
            INSERT INTO return_items (
              id, return_id, sale_item_id, product_id, product_name, product_sku, barcode,
              quantity, unit_price, discount_amount, tax_amount, subtotal, line_total,
              condition, reason, created_at
            ) VALUES (
              ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?, ?,
              ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
            )
          `, [
            returnItemId,
            returnId,
            it.saleItemId,
            it.productId,
            it.productName,
            it.productSku,
            it.barcode || null,
            it.quantity,
            it.unitPrice,
            it.discountAmount,
            it.taxAmount,
            it.lineTotal,
            it.lineTotal,
            it.condition,
            it.reason || null,
          ])

          // C. Inventory Restoration (If resellable -> restore stock & insert movement)
          const prodRows = await db.select<Array<{ current_stock: number }>>(
            'SELECT current_stock FROM products WHERE id = ? LIMIT 1',
            [it.productId]
          )
          const stockBefore = prodRows.length > 0 ? prodRows[0].current_stock : 0

          if (it.condition === 'resellable') {
            const stockAfter = stockBefore + it.quantity
            await db.execute(
              "UPDATE products SET current_stock = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?",
              [stockAfter, it.productId]
            )

            const invMovId = uuidv4()
            await db.execute(`
              INSERT INTO inventory_movements (
                id, product_id, type, quantity, stock_before, stock_after,
                reference_id, reference_type, reason, notes, user_id, created_at
              ) VALUES (
                ?, ?, 'return', ?, ?, ?,
                ?, 'return', ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
              )
            `, [
              invMovId,
              it.productId,
              it.quantity,
              stockBefore,
              stockAfter,
              returnId,
              `Return #${returnNumber} (Sale #${eligibility.invoiceNumber})`,
              `Restocked ${it.quantity} x ${it.productSku}`,
              user.id,
            ])
          } else {
            // Damaged / Defective -> Quarantined (stock not added back to sellable current_stock)
            const invMovId = uuidv4()
            await db.execute(`
              INSERT INTO inventory_movements (
                id, product_id, type, quantity, stock_before, stock_after,
                reference_id, reference_type, reason, notes, user_id, created_at
              ) VALUES (
                ?, ?, 'return_damaged', 0, ?, ?,
                ?, 'return', ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
              )
            `, [
              invMovId,
              it.productId,
              stockBefore,
              stockBefore,
              returnId,
              `Non-sellable Return #${returnNumber} (${it.condition})`,
              `Quarantined ${it.quantity} x ${it.productSku} as ${it.condition}`,
              user.id,
            ])
          }
        }

        // D. Insert Refund Payments
        for (const p of input.payments) {
          const paymentId = uuidv4()
          await db.execute(`
            INSERT INTO payments (
              id, return_id, shift_id, register_id, user_id, customer_id,
              method, amount, reference, notes, created_at
            ) VALUES (
              ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
            )
          `, [
            paymentId,
            returnId,
            input.shiftId,
            registerId,
            user.id,
            eligibility.customerId || null,
            p.method,
            p.amount,
            p.reference || null,
            p.notes || null,
          ])

          // For Cash: Record in cash_movements ledger (physical drawer cash decrease)
          if (p.method === 'cash') {
            const cashMovId = uuidv4()
            await db.execute(`
              INSERT INTO cash_movements (
                id, register_id, shift_id, user_id, amount,
                type, direction, payment_method, reason, reference_id, reference_type, notes, created_at
              ) VALUES (
                ?, ?, ?, ?, ?,
                'return_cash', 'out', 'cash', ?, ?, 'return', ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
              )
            `, [
              cashMovId,
              registerId,
              input.shiftId,
              user.id,
              p.amount,
              `Cash Refund Return #${returnNumber}`,
              returnId,
              p.notes || null,
            ])
          }
        }

        await db.execute('COMMIT')
      } catch (txnError) {
        await db.execute('ROLLBACK')
        throw txnError
      }

      // 10. Audit Logging
      await auditService.log({
        userId: user.id,
        userFullName: user.fullName || 'Cashier',
        action: 'return',
        resource: 'returns',
        resourceId: returnId,
        details: {
          returnNumber,
          saleInvoiceNumber: eligibility.invoiceNumber,
          saleId: eligibility.saleId,
          refundAmount: computedRefundTotal,
          itemsCount: processedItems.length,
          totalQuantity: processedItems.reduce((acc, it) => acc + it.quantity, 0),
          customerName: eligibility.customerName,
        },
      })

      // 11. Fetch and Return Completed Return Entity & Structured Receipt
      const completedReturn = await this.getReturnById(returnId)
      if (!completedReturn) {
        throw new Error('Return completed but failed to reload details')
      }

      const receipt = await returnReceiptService.buildReceiptData(completedReturn)

      return {
        returnData: completedReturn,
        receipt,
      }
    } finally {
      inFlightReturnTransactions.delete(idempotencyKey)
    }
  }

  /**
   * Fetch a return by ID with items, payments, and relations
   */
  async getReturnById(returnId: string): Promise<Return | null> {
    const db = getDb()

    const rows = await db.select<Array<{
      id: string
      return_number: string
      sale_id: string
      customer_id: string | null
      user_id: string
      processed_by_id: string
      shift_id: string | null
      register_id: string | null
      subtotal: number
      discount_amount: number
      tax_amount: number
      total_amount: number
      refund_amount: number
      refund_method: PaymentMethodType
      status: 'completed' | 'cancelled'
      reason: string | null
      notes: string | null
      created_at: string
      updated_at: string | null
      sale_invoice_number: string | null
      customer_name: string | null
      customer_phone: string | null
      user_name: string | null
      register_name: string | null
    }>>(`
      SELECT 
        r.id,
        r.return_number,
        r.sale_id,
        r.customer_id,
        r.user_id,
        r.processed_by_id,
        r.shift_id,
        r.register_id,
        r.subtotal,
        r.discount_amount,
        r.tax_amount,
        r.total_amount,
        r.refund_amount,
        r.refund_method,
        r.status,
        r.reason,
        r.notes,
        r.created_at,
        r.updated_at,
        s.invoice_number as sale_invoice_number,
        c.name as customer_name,
        c.phone as customer_phone,
        u.full_name as user_name,
        reg.name as register_name
      FROM returns r
      LEFT JOIN sales s ON r.sale_id = s.id
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN users u ON COALESCE(r.user_id, r.processed_by_id) = u.id
      LEFT JOIN cash_registers reg ON r.register_id = reg.id
      WHERE r.id = ?
      LIMIT 1
    `, [returnId])

    if (!rows || rows.length === 0) {
      return null
    }

    const r = rows[0]

    // Fetch items
    const itemRows = await db.select<Array<{
      id: string
      return_id: string
      sale_item_id: string
      product_id: string
      product_name: string
      product_sku: string
      barcode: string | null
      quantity: number
      unit_price: number
      discount_amount: number
      tax_amount: number
      line_total: number
      condition: 'resellable' | 'damaged' | 'defective'
      reason: string | null
      created_at: string
    }>>(`
      SELECT 
        id, return_id, sale_item_id, product_id, product_name, product_sku, barcode,
        quantity, unit_price, discount_amount, tax_amount, line_total, condition, reason, created_at
      FROM return_items
      WHERE return_id = ?
    `, [returnId])

    // Fetch payments
    const paymentRows = await db.select<Array<{
      id: string
      return_id: string
      shift_id: string | null
      register_id: string | null
      user_id: string | null
      customer_id: string | null
      method: PaymentMethodType
      amount: number
      reference: string | null
      notes: string | null
      created_at: string
    }>>(`
      SELECT 
        id, return_id, shift_id, register_id, user_id, customer_id,
        method, amount, reference, notes, created_at
      FROM payments
      WHERE return_id = ?
    `, [returnId])

    return {
      id: r.id,
      returnNumber: r.return_number,
      saleId: r.sale_id,
      saleInvoiceNumber: r.sale_invoice_number || undefined,
      customerId: r.customer_id,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      userId: r.user_id || r.processed_by_id,
      userName: r.user_name,
      shiftId: r.shift_id,
      registerId: r.register_id,
      registerName: r.register_name,
      subtotal: r.subtotal,
      discountAmount: r.discount_amount,
      taxAmount: r.tax_amount,
      totalAmount: r.total_amount || r.refund_amount,
      refundAmount: r.refund_amount,
      refundMethod: r.refund_method,
      status: r.status,
      reason: r.reason,
      notes: r.notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at || undefined,
      items: itemRows.map(i => ({
        id: i.id,
        returnId: i.return_id,
        saleItemId: i.sale_item_id,
        productId: i.product_id,
        productName: i.product_name,
        productSku: i.product_sku,
        barcode: i.barcode,
        quantity: i.quantity,
        unitPrice: i.unit_price,
        discountAmount: i.discount_amount,
        taxAmount: i.tax_amount,
        lineTotal: i.line_total,
        condition: i.condition,
        reason: i.reason,
        createdAt: i.created_at,
      })),
      payments: paymentRows.map(p => ({
        id: p.id,
        returnId: p.return_id,
        shiftId: p.shift_id,
        registerId: p.register_id,
        userId: p.user_id,
        customerId: p.customer_id,
        method: p.method,
        amount: p.amount,
        reference: p.reference,
        notes: p.notes,
        createdAt: p.created_at,
      })),
    }
  }

  /**
   * Get returns with search, status filters, and pagination
   */
  async getReturns(filter: ReturnFilter = {}): Promise<{ returns: Return[]; total: number }> {
    const db = getDb()

    const conditions: string[] = []
    const params: any[] = []

    if (filter.search) {
      const q = `%${filter.search.trim()}%`
      conditions.push('(r.return_number LIKE ? OR s.invoice_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)')
      params.push(q, q, q, q)
    }

    if (filter.status) {
      conditions.push('r.status = ?')
      params.push(filter.status)
    }

    if (filter.startDate) {
      conditions.push('r.created_at >= ?')
      params.push(filter.startDate)
    }

    if (filter.endDate) {
      conditions.push('r.created_at <= ?')
      params.push(filter.endDate)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Count
    const countRow = await db.select<Array<{ count: number }>>(
      `SELECT COUNT(*) as count 
       FROM returns r 
       LEFT JOIN sales s ON r.sale_id = s.id 
       LEFT JOIN customers c ON r.customer_id = c.id 
       ${whereClause}`,
      params
    )
    const total = countRow[0]?.count || 0

    // Query
    const limit = filter.limit || 50
    const offset = filter.offset || 0

    const rows = await db.select<Array<{
      id: string
      return_number: string
      sale_id: string
      customer_id: string | null
      user_id: string
      processed_by_id: string
      shift_id: string | null
      register_id: string | null
      subtotal: number
      discount_amount: number
      tax_amount: number
      total_amount: number
      refund_amount: number
      refund_method: PaymentMethodType
      status: 'completed' | 'cancelled'
      reason: string | null
      notes: string | null
      created_at: string
      updated_at: string | null
      sale_invoice_number: string | null
      customer_name: string | null
      customer_phone: string | null
      user_name: string | null
      register_name: string | null
    }>>(`
      SELECT 
        r.id,
        r.return_number,
        r.sale_id,
        r.customer_id,
        r.user_id,
        r.processed_by_id,
        r.shift_id,
        r.register_id,
        r.subtotal,
        r.discount_amount,
        r.tax_amount,
        r.total_amount,
        r.refund_amount,
        r.refund_method,
        r.status,
        r.reason,
        r.notes,
        r.created_at,
        r.updated_at,
        s.invoice_number as sale_invoice_number,
        c.name as customer_name,
        c.phone as customer_phone,
        u.full_name as user_name,
        reg.name as register_name
      FROM returns r
      LEFT JOIN sales s ON r.sale_id = s.id
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN users u ON COALESCE(r.user_id, r.processed_by_id) = u.id
      LEFT JOIN cash_registers reg ON r.register_id = reg.id
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset])

    const returns: Return[] = rows.map(r => ({
      id: r.id,
      returnNumber: r.return_number,
      saleId: r.sale_id,
      saleInvoiceNumber: r.sale_invoice_number || undefined,
      customerId: r.customer_id,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      userId: r.user_id || r.processed_by_id,
      userName: r.user_name,
      shiftId: r.shift_id,
      registerId: r.register_id,
      registerName: r.register_name,
      subtotal: r.subtotal,
      discountAmount: r.discount_amount,
      taxAmount: r.tax_amount,
      totalAmount: r.total_amount || r.refund_amount,
      refundAmount: r.refund_amount,
      refundMethod: r.refund_method,
      status: r.status,
      reason: r.reason,
      notes: r.notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at || undefined,
    }))

    return { returns, total }
  }
}

export const returnService = new ReturnService()

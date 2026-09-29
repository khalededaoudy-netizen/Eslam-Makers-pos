/**
 * MAKERS POS — Purchase Service
 * Centralized business logic for Purchases, Receiving, Partial Receiving, Price History, and Payments.
 * Strictly integrates with inventoryService for stock mutations.
 */

import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/services/db/database'
import { auditService } from '@/services/audit/auditService'
import { inventoryService } from '@/services/inventory/inventoryService'

export type PurchaseStatus = 'draft' | 'partially_received' | 'received' | 'completed' | 'cancelled'
export type PaymentStatus = 'unpaid' | 'partial' | 'paid'

export interface PurchaseItemInput {
  productId: string
  quantity: number
  unitCost: number
  discount?: number
  notes?: string
}

export interface CreatePurchaseInput {
  supplierId: string
  locationId?: string | null
  invoiceRef?: string | null
  purchasedAt?: string
  discountAmount?: number
  taxAmount?: number
  notes?: string | null
  items: PurchaseItemInput[]
  initialPayment?: number
  initialPaymentMethod?: string
  receiveImmediately?: boolean
}

export interface PurchaseListItem {
  id: string
  purchase_number: string
  supplier_id: string | null
  supplier_name: string | null
  location_id: string | null
  location_name: string | null
  status: PurchaseStatus
  subtotal: number
  discount_amount: number
  tax_amount: number
  total: number
  paid_amount: number
  balance: number
  payment_status: PaymentStatus
  invoice_ref: string | null
  notes: string | null
  purchased_at: string
  received_at: string | null
  created_at: string
  items_count: number
}

export interface PurchaseItemDetail {
  id: string
  purchase_id: string
  product_id: string
  product_name_ar: string
  product_name_en: string
  product_sku: string
  unit_symbol: string
  quantity: number
  received_qty: number
  remaining_qty: number
  unit_cost: number
  subtotal: number
}

export interface PurchasePaymentItem {
  id: string
  purchase_id: string
  supplier_id: string
  user_id: string | null
  user_name: string | null
  amount: number
  payment_method: string
  reference: string | null
  notes: string | null
  created_at: string
}

export interface PurchaseOverview {
  totalPurchases: number
  completedCount: number
  partialCount: number
  draftCount: number
  totalSpend: number
  totalUnpaid: number
}

export interface PriceHistoryItem {
  purchase_id: string
  purchase_number: string
  purchased_at: string
  supplier_name: string
  unit_cost: number
  quantity: number
  received_qty: number
}

class PurchaseService {
  /**
   * Generate sequential purchase number (e.g. PUR-2026-0001)
   */
  async generatePurchaseNumber(): Promise<string> {
    const db = getDb()
    const rows = await db.select<any[]>('SELECT COUNT(*) as c FROM purchases')
    const count = (rows[0]?.c ?? 0) + 1
    const year = new Date().getFullYear()
    return `PUR-${year}-${String(count).padStart(4, '0')}`
  }

  /**
   * Get list of purchases with filters
   */
  async getPurchases(params?: {
    search?: string
    supplierId?: string
    status?: string
    dateFrom?: string
    dateTo?: string
    limit?: number
    offset?: number
  }): Promise<PurchaseListItem[]> {
    const db = getDb()
    const conditions: string[] = []
    const sqlParams: unknown[] = []

    if (params?.supplierId) {
      conditions.push('p.supplier_id = ?')
      sqlParams.push(params.supplierId)
    }

    if (params?.status && params.status !== 'all') {
      conditions.push('p.status = ?')
      sqlParams.push(params.status)
    }

    if (params?.dateFrom) {
      conditions.push('p.purchased_at >= ?')
      sqlParams.push(params.dateFrom)
    }

    if (params?.dateTo) {
      conditions.push('p.purchased_at <= ?')
      sqlParams.push(params.dateTo)
    }

    if (params?.search && params.search.trim()) {
      const q = `%${params.search.trim()}%`
      conditions.push(`(
        p.purchase_number LIKE ?
        OR p.invoice_ref LIKE ?
        OR s.name LIKE ?
        OR p.notes LIKE ?
      )`)
      sqlParams.push(q, q, q, q)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const limit = params?.limit ?? 200
    const offset = params?.offset ?? 0

    const query = `
      SELECT p.id, p.purchase_number, p.supplier_id, s.name as supplier_name,
             p.location_id, loc.name as location_name,
             p.status, p.subtotal, p.discount_amount, p.tax_amount, p.total,
             p.paid_amount, p.balance, p.payment_status, p.invoice_ref,
             p.notes, p.purchased_at, p.received_at, p.created_at,
             COUNT(pi.id) as items_count
      FROM purchases p
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      LEFT JOIN storage_locations loc ON loc.id = p.location_id
      LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
      ${whereClause}
      GROUP BY p.id
      ORDER BY p.purchased_at DESC, p.created_at DESC
      LIMIT ? OFFSET ?
    `

    const rows = await db.select<any[]>(query, [...sqlParams, limit, offset])
    return rows.map(r => ({
      ...r,
      subtotal: Number(r.subtotal) || 0,
      discount_amount: Number(r.discount_amount) || 0,
      tax_amount: Number(r.tax_amount) || 0,
      total: Number(r.total) || 0,
      paid_amount: Number(r.paid_amount) || 0,
      balance: Number(r.balance) || 0,
      items_count: Number(r.items_count) || 0,
    }))
  }

  /**
   * Get single purchase details with items, payments, and location
   */
  async getPurchaseById(id: string): Promise<{
    purchase: PurchaseListItem
    items: PurchaseItemDetail[]
    payments: PurchasePaymentItem[]
  } | null> {
    const db = getDb()
    const rows = await db.select<any[]>(`
      SELECT p.id, p.purchase_number, p.supplier_id, s.name as supplier_name,
             p.location_id, loc.name as location_name,
             p.status, p.subtotal, p.discount_amount, p.tax_amount, p.total,
             p.paid_amount, p.balance, p.payment_status, p.invoice_ref,
             p.notes, p.purchased_at, p.received_at, p.created_at
      FROM purchases p
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      LEFT JOIN storage_locations loc ON loc.id = p.location_id
      WHERE p.id = ?
    `, [id])

    if (!rows || rows.length === 0) return null

    const purchaseRow = rows[0]

    const itemRows = await db.select<any[]>(`
      SELECT pi.id, pi.purchase_id, pi.product_id,
             p.name_ar as product_name_ar, p.name_en as product_name_en, p.sku as product_sku,
             pu.symbol as unit_symbol,
             pi.quantity, pi.received_qty, pi.unit_cost, pi.subtotal
      FROM purchase_items pi
      JOIN products p ON p.id = pi.product_id
      JOIN product_units pu ON pu.id = p.unit_id
      WHERE pi.purchase_id = ?
    `, [id])

    const paymentRows = await db.select<any[]>(`
      SELECT pp.id, pp.purchase_id, pp.supplier_id, pp.user_id, u.full_name as user_name,
             pp.amount, pp.payment_method, pp.reference, pp.notes, pp.created_at
      FROM purchase_payments pp
      LEFT JOIN users u ON u.id = pp.user_id
      WHERE pp.purchase_id = ?
      ORDER BY pp.created_at DESC
    `, [id])

    const items: PurchaseItemDetail[] = itemRows.map(i => {
      const qty = Number(i.quantity) || 0
      const rec = Number(i.received_qty) || 0
      return {
        id: i.id,
        purchase_id: i.purchase_id,
        product_id: i.product_id,
        product_name_ar: i.product_name_ar,
        product_name_en: i.product_name_en,
        product_sku: i.product_sku,
        unit_symbol: i.unit_symbol,
        quantity: qty,
        received_qty: rec,
        remaining_qty: Math.max(0, qty - rec),
        unit_cost: Number(i.unit_cost) || 0,
        subtotal: Number(i.subtotal) || 0,
      }
    })

    const payments: PurchasePaymentItem[] = paymentRows.map(pm => ({
      id: pm.id,
      purchase_id: pm.purchase_id,
      supplier_id: pm.supplier_id,
      user_id: pm.user_id,
      user_name: pm.user_name,
      amount: Number(pm.amount) || 0,
      payment_method: pm.payment_method,
      reference: pm.reference,
      notes: pm.notes,
      created_at: pm.created_at,
    }))

    return {
      purchase: {
        ...purchaseRow,
        subtotal: Number(purchaseRow.subtotal) || 0,
        discount_amount: Number(purchaseRow.discount_amount) || 0,
        tax_amount: Number(purchaseRow.tax_amount) || 0,
        total: Number(purchaseRow.total) || 0,
        paid_amount: Number(purchaseRow.paid_amount) || 0,
        balance: Number(purchaseRow.balance) || 0,
        items_count: items.length,
      },
      items,
      payments,
    }
  }

  /**
   * Create a new purchase invoice
   */
  async createPurchase(
    input: CreatePurchaseInput,
    user?: { id?: string; fullName?: string }
  ): Promise<{ purchaseId: string; purchaseNumber: string }> {
    if (!input.supplierId) {
      throw new Error('Supplier is required')
    }

    if (!input.items || input.items.length === 0) {
      throw new Error('At least one purchase item is required')
    }

    for (const item of input.items) {
      if (!item.productId) throw new Error('Valid product is required for each item')
      if (item.quantity <= 0) throw new Error('Quantity must be greater than zero')
      if (item.unitCost < 0) throw new Error('Unit cost cannot be negative')
    }

    const db = getDb()
    const purchaseId = uuidv4()
    const purchaseNumber = await this.generatePurchaseNumber()
    const now = new Date().toISOString()
    const purchasedAt = input.purchasedAt || now

    // Calculate totals
    let subtotal = 0
    for (const it of input.items) {
      subtotal += it.quantity * it.unitCost
    }

    const discountAmount = Math.max(0, Number(input.discountAmount) || 0)
    const taxAmount = Math.max(0, Number(input.taxAmount) || 0)
    const total = Math.max(0, subtotal - discountAmount + taxAmount)

    const initialPay = Math.min(total, Math.max(0, Number(input.initialPayment) || 0))
    const balance = total - initialPay
    const paymentStatus: PaymentStatus = initialPay >= total ? 'paid' : (initialPay > 0 ? 'partial' : 'unpaid')

    const status: PurchaseStatus = input.receiveImmediately ? 'completed' : 'draft'
    const receivedAt = input.receiveImmediately ? now : null

    // ── ATOMIC TRANSACTION ──
    await db.execute('BEGIN TRANSACTION')
    try {
      // 1. Insert Purchase
      await db.execute(`
        INSERT INTO purchases (
          id, purchase_number, supplier_id, received_by_id, location_id,
          status, subtotal, discount_amount, tax_amount, total,
          paid_amount, balance, payment_status, invoice_ref, notes,
          purchased_at, received_at, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?
        )
      `, [
        purchaseId,
        purchaseNumber,
        input.supplierId,
        input.receiveImmediately ? (user?.id || null) : null,
        input.locationId || null,
        status,
        subtotal,
        discountAmount,
        taxAmount,
        total,
        initialPay,
        balance,
        paymentStatus,
        input.invoiceRef?.trim() || null,
        input.notes?.trim() || null,
        purchasedAt,
        receivedAt,
        now,
        now,
      ])

      // 2. Insert Purchase Items
      for (const it of input.items) {
        const itemId = uuidv4()
        const lineTotal = it.quantity * it.unitCost
        const recQty = input.receiveImmediately ? it.quantity : 0

        await db.execute(`
          INSERT INTO purchase_items (
            id, purchase_id, product_id, quantity, unit_cost, subtotal, received_qty
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          itemId,
          purchaseId,
          it.productId,
          it.quantity,
          it.unitCost,
          lineTotal,
          recQty,
        ])

        // If receiveImmediately, execute stockIn via inventoryService
        if (input.receiveImmediately) {
          await inventoryService.stockIn({
            productId: it.productId,
            quantity: it.quantity,
            locationId: input.locationId || null,
            reason: 'Purchase Receipt',
            notes: `Purchase #${purchaseNumber}`,
            referenceId: purchaseId,
            referenceType: 'purchase',
            type: 'purchase',
          }, user)

          // Update product purchase cost
          await db.execute(
            "UPDATE products SET purchase_price = ?, updated_at = ? WHERE id = ?",
            [it.unitCost, now, it.productId]
          )
        }
      }

      // 3. Record Initial Payment if provided
      if (initialPay > 0) {
        await db.execute(`
          INSERT INTO purchase_payments (
            id, purchase_id, supplier_id, user_id, amount, payment_method, reference, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          uuidv4(),
          purchaseId,
          input.supplierId,
          user?.id || null,
          initialPay,
          input.initialPaymentMethod || 'cash',
          `Payment for ${purchaseNumber}`,
          'Initial purchase payment',
          now,
        ])
      }

      // 4. Update Supplier Balance (balance owed += remaining balance)
      if (balance > 0) {
        await db.execute(
          "UPDATE suppliers SET balance = balance + ?, updated_at = ? WHERE id = ?",
          [balance, now, input.supplierId]
        )
      }

      await db.execute('COMMIT')

      // 5. Audit Log
      await auditService.log({
        userId: user?.id,
        userFullName: user?.fullName,
        action: 'create_purchase',
        resource: 'purchases',
        resourceId: purchaseId,
        details: {
          purchaseNumber,
          supplierId: input.supplierId,
          total,
          paidAmount: initialPay,
          status,
          itemsCount: input.items.length,
        },
      })

      return { purchaseId, purchaseNumber }
    } catch (err) {
      await db.execute('ROLLBACK')
      throw err
    }
  }

  /**
   * Receive ordered quantities (Full or Partial Receiving)
   */
  async receivePurchase(
    params: {
      purchaseId: string
      locationId: string
      items: Array<{ itemId: string; quantityToReceive: number }>
      notes?: string
    },
    user?: { id?: string; fullName?: string }
  ): Promise<{ status: PurchaseStatus; totalReceivedNow: number }> {
    if (!params.locationId) {
      throw new Error('Destination storage location is required for receiving')
    }

    if (!params.items || params.items.length === 0) {
      throw new Error('Please specify items to receive')
    }

    const db = getDb()
    const now = new Date().toISOString()

    // ── ATOMIC TRANSACTION ──
    await db.execute('BEGIN TRANSACTION')
    try {
      const purchRows = await db.select<any[]>(
        'SELECT id, purchase_number, status, supplier_id FROM purchases WHERE id = ?',
        [params.purchaseId]
      )
      if (!purchRows || purchRows.length === 0) {
        throw new Error('Purchase not found')
      }

      const purchase = purchRows[0]
      if (purchase.status === 'completed') {
        throw new Error('Purchase is already fully received and completed')
      }
      if (purchase.status === 'cancelled') {
        throw new Error('Cannot receive items for a cancelled purchase')
      }

      // Check Location exists
      const locRows = await db.select<any[]>('SELECT id, name FROM storage_locations WHERE id = ?', [params.locationId])
      if (!locRows || locRows.length === 0) {
        throw new Error('Selected storage location does not exist')
      }

      let totalReceivedNow = 0

      // Process item receiving
      for (const rec of params.items) {
        const qtyToRec = Number(rec.quantityToReceive) || 0
        if (qtyToRec <= 0) continue

        const itemRows = await db.select<any[]>(
          'SELECT id, product_id, quantity, received_qty, unit_cost FROM purchase_items WHERE id = ? AND purchase_id = ?',
          [rec.itemId, params.purchaseId]
        )
        if (!itemRows || itemRows.length === 0) {
          throw new Error('Purchase item not found')
        }

        const item = itemRows[0]
        const currentRec = Number(item.received_qty) || 0
        const ordered = Number(item.quantity) || 0
        const remaining = ordered - currentRec

        // Strict over-receiving check
        if (qtyToRec > remaining) {
          throw new Error(`Cannot receive ${qtyToRec} units for item (Ordered: ${ordered}, Already received: ${currentRec}, Remaining: ${remaining})`)
        }

        const newRecQty = currentRec + qtyToRec

        // 1. Update purchase item received quantity
        await db.execute(
          'UPDATE purchase_items SET received_qty = ? WHERE id = ?',
          [newRecQty, item.id]
        )

        // 2. Call inventoryService stockIn
        await inventoryService.stockIn({
          productId: item.product_id,
          quantity: qtyToRec,
          locationId: params.locationId,
          reason: 'Purchase Receipt',
          notes: `Purchase #${purchase.purchase_number}. ${params.notes || ''}`.trim(),
          referenceId: params.purchaseId,
          referenceType: 'purchase',
          type: 'purchase',
        }, user)

        // 3. Update product purchase price
        await db.execute(
          'UPDATE products SET purchase_price = ?, updated_at = ? WHERE id = ?',
          [item.unit_cost, now, item.product_id]
        )

        totalReceivedNow += qtyToRec
      }

      if (totalReceivedNow <= 0) {
        throw new Error('No valid quantities specified for receiving')
      }

      // 4. Calculate new purchase status
      const allItems = await db.select<any[]>(
        'SELECT quantity, received_qty FROM purchase_items WHERE purchase_id = ?',
        [params.purchaseId]
      )

      let allCompleted = true
      for (const it of allItems) {
        if ((Number(it.received_qty) || 0) < (Number(it.quantity) || 0)) {
          allCompleted = false
          break
        }
      }

      const newStatus: PurchaseStatus = allCompleted ? 'completed' : 'partially_received'

      // 5. Update purchase status, location, and timestamp
      await db.execute(`
        UPDATE purchases SET
          status = ?,
          location_id = ?,
          received_by_id = ?,
          received_at = ?,
          updated_at = ?
        WHERE id = ?
      `, [
        newStatus,
        params.locationId,
        user?.id || null,
        now,
        now,
        params.purchaseId,
      ])

      await db.execute('COMMIT')

      // 6. Audit Log
      await auditService.log({
        userId: user?.id,
        userFullName: user?.fullName,
        action: allCompleted ? 'receive_purchase_complete' : 'receive_purchase_partial',
        resource: 'purchases',
        resourceId: params.purchaseId,
        details: {
          purchaseNumber: purchase.purchase_number,
          totalReceivedNow,
          locationId: params.locationId,
          newStatus,
        },
      })

      return { status: newStatus, totalReceivedNow }
    } catch (err) {
      await db.execute('ROLLBACK')
      throw err
    }
  }

  /**
   * Add payment to purchase invoice
   */
  async addPayment(
    params: {
      purchaseId: string
      amount: number
      paymentMethod: string
      reference?: string
      notes?: string
    },
    user?: { id?: string; fullName?: string }
  ): Promise<{ newPaid: number; newBalance: number; paymentStatus: PaymentStatus }> {
    const payAmount = Number(params.amount)
    if (isNaN(payAmount) || payAmount <= 0) {
      throw new Error('Payment amount must be greater than zero')
    }

    const db = getDb()
    const now = new Date().toISOString()

    // ── ATOMIC TRANSACTION ──
    await db.execute('BEGIN TRANSACTION')
    try {
      const purchRows = await db.select<any[]>(
        'SELECT id, purchase_number, supplier_id, total, paid_amount, balance FROM purchases WHERE id = ?',
        [params.purchaseId]
      )
      if (!purchRows || purchRows.length === 0) {
        throw new Error('Purchase not found')
      }

      const purchase = purchRows[0]
      const currentBalance = Number(purchase.balance) || 0

      if (payAmount > currentBalance) {
        throw new Error(`Payment amount (${payAmount}) cannot exceed remaining balance (${currentBalance})`)
      }

      const newPaid = (Number(purchase.paid_amount) || 0) + payAmount
      const newBalance = currentBalance - payAmount
      const newPaymentStatus: PaymentStatus = newBalance <= 0 ? 'paid' : 'partial'
      const paymentId = uuidv4()

      // 1. Insert Payment Record
      await db.execute(`
        INSERT INTO purchase_payments (
          id, purchase_id, supplier_id, user_id, amount, payment_method, reference, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        paymentId,
        params.purchaseId,
        purchase.supplier_id,
        user?.id || null,
        payAmount,
        params.paymentMethod || 'cash',
        params.reference?.trim() || null,
        params.notes?.trim() || null,
        now,
      ])

      // 2. Update Purchase
      await db.execute(`
        UPDATE purchases SET
          paid_amount = ?,
          balance = ?,
          payment_status = ?,
          updated_at = ?
        WHERE id = ?
      `, [newPaid, newBalance, newPaymentStatus, now, params.purchaseId])

      // 3. Update Supplier Balance
      if (purchase.supplier_id) {
        await db.execute(
          'UPDATE suppliers SET balance = balance - ?, updated_at = ? WHERE id = ?',
          [payAmount, now, purchase.supplier_id]
        )
      }

      await db.execute('COMMIT')

      // 4. Audit Log
      await auditService.log({
        userId: user?.id,
        userFullName: user?.fullName,
        action: 'purchase_payment',
        resource: 'purchases',
        resourceId: params.purchaseId,
        details: {
          purchaseNumber: purchase.purchase_number,
          amountPaid: payAmount,
          newBalance,
          paymentMethod: params.paymentMethod,
        },
      })

      return { newPaid, newBalance, paymentStatus: newPaymentStatus }
    } catch (err) {
      await db.execute('ROLLBACK')
      throw err
    }
  }

  /**
   * Cancel a draft purchase
   */
  async cancelPurchase(
    id: string,
    reason: string = 'Cancelled by user',
    user?: { id?: string; fullName?: string }
  ): Promise<void> {
    const db = getDb()
    const now = new Date().toISOString()

    await db.execute('BEGIN TRANSACTION')
    try {
      const rows = await db.select<any[]>('SELECT * FROM purchases WHERE id = ?', [id])
      if (!rows || rows.length === 0) throw new Error('Purchase not found')

      const purchase = rows[0]
      if (purchase.status === 'completed' || purchase.status === 'partially_received') {
        throw new Error('Cannot cancel a received purchase invoice with active stock movements')
      }
      if (purchase.status === 'cancelled') {
        throw new Error('Purchase is already cancelled')
      }

      // If supplier balance had recorded unpaid amount, reverse it
      const unpaidBalance = Number(purchase.balance) || 0
      if (unpaidBalance > 0 && purchase.supplier_id) {
        await db.execute(
          'UPDATE suppliers SET balance = balance - ?, updated_at = ? WHERE id = ?',
          [unpaidBalance, now, purchase.supplier_id]
        )
      }

      // Update purchase status to cancelled
      await db.execute(
        "UPDATE purchases SET status = 'cancelled', notes = COALESCE(notes || ' | ', '') || ?, updated_at = ? WHERE id = ?",
        [`Cancelled: ${reason}`, now, id]
      )

      await db.execute('COMMIT')

      await auditService.log({
        userId: user?.id,
        userFullName: user?.fullName,
        action: 'cancel_purchase',
        resource: 'purchases',
        resourceId: id,
        details: { purchaseNumber: purchase.purchase_number, reason },
      })
    } catch (err) {
      await db.execute('ROLLBACK')
      throw err
    }
  }

  /**
   * Get historical purchase prices for a product
   */
  async getProductPurchasePriceHistory(productId: string): Promise<PriceHistoryItem[]> {
    const db = getDb()
    const rows = await db.select<any[]>(`
      SELECT pi.purchase_id, p.purchase_number, p.purchased_at,
             s.name as supplier_name, pi.unit_cost, pi.quantity, pi.received_qty
      FROM purchase_items pi
      JOIN purchases p ON p.id = pi.purchase_id
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      WHERE pi.product_id = ? AND p.status != 'cancelled'
      ORDER BY p.purchased_at DESC, p.created_at DESC
      LIMIT 50
    `, [productId])

    return rows.map(r => ({
      purchase_id: r.purchase_id,
      purchase_number: r.purchase_number,
      purchased_at: r.purchased_at,
      supplier_name: r.supplier_name || 'Unknown Supplier',
      unit_cost: Number(r.unit_cost) || 0,
      quantity: Number(r.quantity) || 0,
      received_qty: Number(r.received_qty) || 0,
    }))
  }

  /**
   * Get purchase overview summary statistics
   */
  async getPurchaseOverview(): Promise<PurchaseOverview> {
    const db = getDb()
    const rows = await db.select<any[]>(`
      SELECT 
        COUNT(*) as total_purchases,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
        SUM(CASE WHEN status = 'partially_received' THEN 1 ELSE 0 END) as partial_count,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_count,
        SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END) as total_spend,
        SUM(CASE WHEN status != 'cancelled' THEN balance ELSE 0 END) as total_unpaid
      FROM purchases
    `)

    return {
      totalPurchases: Number(rows[0]?.total_purchases) || 0,
      completedCount: Number(rows[0]?.completed_count) || 0,
      partialCount: Number(rows[0]?.partial_count) || 0,
      draftCount: Number(rows[0]?.draft_count) || 0,
      totalSpend: Number(rows[0]?.total_spend) || 0,
      totalUnpaid: Number(rows[0]?.total_unpaid) || 0,
    }
  }
}

export const purchaseService = new PurchaseService()

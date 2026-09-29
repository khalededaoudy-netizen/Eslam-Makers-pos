/**
 * MAKERS POS — POS Core Service
 * Centralized business logic for Product Lookups, Barcodes, Stock Validation, Hold/Resume Carts, and Shifts.
 */

import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/services/db/database'
import { auditService } from '@/services/audit/auditService'
import {
  PosProduct,
  PosCartItem,
  PosCartSummary,
  HeldCart,
  CreateHeldCartInput,
  PosShiftInfo,
} from './types'

export interface UserContext {
  id?: string
  fullName?: string
  role?: string
}

class PosService {
  /**
   * Fast Parameterized Product Search across Name (Ar/En), SKU, Barcodes, and Attributes
   */
  async searchProducts(query: string, limit = 30): Promise<PosProduct[]> {
    const trimmed = query.trim()
    if (!trimmed) return []

    const db = getDb()
    const q = `%${trimmed}%`

    const rows = await db.select<PosProduct[]>(`
      SELECT DISTINCT
        p.id,
        p.name_ar,
        p.name_en,
        p.sku,
        p.selling_price,
        p.purchase_price,
        p.current_stock,
        pu.symbol as unit_symbol,
        pu.allow_decimal,
        p.drawer_location,
        pc.name_ar as category_name
      FROM products p
      JOIN product_units pu ON pu.id = p.unit_id
      LEFT JOIN product_categories pc ON pc.id = p.category_id
      LEFT JOIN product_barcodes pb ON pb.product_id = p.id
      LEFT JOIN product_attribute_values pav ON pav.product_id = p.id
      WHERE p.is_active = 1 AND (
        p.name_ar LIKE ?
        OR p.name_en LIKE ?
        OR p.sku LIKE ?
        OR pb.barcode LIKE ?
        OR pav.value LIKE ?
      )
      ORDER BY
        CASE
          WHEN p.sku = ? THEN 0
          WHEN p.name_en LIKE ? THEN 1
          WHEN p.name_ar LIKE ? THEN 2
          ELSE 3
        END,
        p.name_ar ASC
      LIMIT ?
    `, [q, q, q, q, q, trimmed, `${trimmed}%`, `${trimmed}%`, limit])

    return rows
  }

  /**
   * Get products by category for POS interactive grid
   */
  async getProductsByCategory(categoryId?: string, limit = 100): Promise<PosProduct[]> {
    const db = getDb()
    const conditions = ['p.is_active = 1']
    const params: unknown[] = []

    if (categoryId) {
      conditions.push('p.category_id = ?')
      params.push(categoryId)
    }

    params.push(limit)

    const rows = await db.select<PosProduct[]>(`
      SELECT DISTINCT
        p.id,
        p.name_ar,
        p.name_en,
        p.sku,
        p.selling_price,
        p.purchase_price,
        p.current_stock,
        pu.symbol as unit_symbol,
        pu.allow_decimal,
        p.drawer_location,
        pc.name_ar as category_name,
        pb.barcode
      FROM products p
      JOIN product_units pu ON pu.id = p.unit_id
      LEFT JOIN product_categories pc ON pc.id = p.category_id
      LEFT JOIN product_barcodes pb ON pb.product_id = p.id AND pb.is_default = 1
      WHERE ${conditions.join(' AND ')}
      ORDER BY p.name_ar ASC
      LIMIT ?
    `, params)

    return rows
  }

  /**
   * Immediate Single Product Lookup by Barcode or SKU (for barcode-first flow)
   */
  async lookupByBarcode(code: string): Promise<PosProduct | null> {
    const trimmed = code.trim()
    if (!trimmed) return null

    const db = getDb()
    const rows = await db.select<PosProduct[]>(`
      SELECT DISTINCT
        p.id,
        p.name_ar,
        p.name_en,
        p.sku,
        p.selling_price,
        p.purchase_price,
        p.current_stock,
        pu.symbol as unit_symbol,
        pu.allow_decimal,
        p.drawer_location,
        pc.name_ar as category_name,
        pb.barcode
      FROM products p
      JOIN product_units pu ON pu.id = p.unit_id
      LEFT JOIN product_categories pc ON pc.id = p.category_id
      LEFT JOIN product_barcodes pb ON pb.product_id = p.id
      WHERE p.is_active = 1 AND (pb.barcode = ? OR p.sku = ?)
      LIMIT 1
    `, [trimmed, trimmed])

    return rows && rows.length > 0 ? rows[0] : null
  }

  /**
   * Get fresh authoritative stock for a product from SQLite
   */
  async getProductStock(productId: string): Promise<{ stock: number; allowDecimal: boolean; is_active: number } | null> {
    const db = getDb()
    const rows = await db.select<Array<{ current_stock: number; allow_decimal: number; is_active: number }>>(`
      SELECT p.current_stock, pu.allow_decimal, p.is_active
      FROM products p
      JOIN product_units pu ON pu.id = p.unit_id
      WHERE p.id = ?
      LIMIT 1
    `, [productId])

    if (!rows || rows.length === 0) return null
    return {
      stock: Number(rows[0].current_stock) || 0,
      allowDecimal: Boolean(rows[0].allow_decimal),
      is_active: Number(rows[0].is_active) || 0,
    }
  }

  /**
   * Check active open shift
   */
  async getActiveShift(userId?: string): Promise<PosShiftInfo> {
    const db = getDb()
    const conditions = ["status = 'open'"]
    const params: unknown[] = []

    if (userId) {
      conditions.push('user_id = ?')
      params.push(userId)
    }

    const rows = await db.select<Array<{ id: string; register_id: string; opened_at: string; opening_balance: number }>>(`
      SELECT id, register_id, opened_at, opening_balance
      FROM shifts
      WHERE ${conditions.join(' AND ')}
      ORDER BY opened_at DESC
      LIMIT 1
    `, params)

    if (rows && rows.length > 0) {
      return {
        isOpen: true,
        shiftId: rows[0].id,
        registerId: rows[0].register_id,
        openedAt: rows[0].opened_at,
        openingBalance: rows[0].opening_balance,
      }
    }

    // Check if any shift is open globally if no user-specific shift
    const anyRows = await db.select<Array<{ id: string; register_id: string; opened_at: string; opening_balance: number }>>(`
      SELECT id, register_id, opened_at, opening_balance
      FROM shifts
      WHERE status = 'open'
      ORDER BY opened_at DESC
      LIMIT 1
    `)

    if (anyRows && anyRows.length > 0) {
      return {
        isOpen: true,
        shiftId: anyRows[0].id,
        registerId: anyRows[0].register_id,
        openedAt: anyRows[0].opened_at,
        openingBalance: anyRows[0].opening_balance,
      }
    }

    return { isOpen: false }
  }

  /**
   * Calculate Cart Totals (Subtotal, Discount, Taxable Amount, Tax, Total)
   */
  calculateTotals(
    items: PosCartItem[],
    cartDiscountAmount = 0,
    taxEnabled = false,
    taxRate = 0
  ): PosCartSummary {
    const itemsCount = items.length
    const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0)
    const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0)

    const cleanDiscount = Math.min(subtotal, Math.max(0, cartDiscountAmount))
    const cartDiscountPct = subtotal > 0 ? (cleanDiscount / subtotal) * 100 : 0

    const taxableAmount = Math.max(0, subtotal - cleanDiscount)
    const taxAmount = taxEnabled ? taxableAmount * (taxRate / 100) : 0
    const total = taxableAmount + taxAmount

    return {
      itemsCount,
      totalQuantity,
      subtotal,
      cartDiscountPct,
      cartDiscountAmount: cleanDiscount,
      taxableAmount,
      taxRate: taxEnabled ? taxRate : 0,
      taxAmount,
      total,
    }
  }

  /**
   * Hold an active Cart
   */
  async holdCart(input: CreateHeldCartInput, user?: UserContext): Promise<HeldCart> {
    if (!input.items || input.items.length === 0) {
      throw new Error('Cannot hold an empty cart')
    }

    const db = getDb()
    const id = uuidv4()
    const cartData = JSON.stringify(input.items)

    await db.execute(`
      INSERT INTO held_carts (
        id, cashier_id, cashier_name, customer_id, customer_name,
        cart_data, subtotal, discount_amount, tax_amount, total, notes,
        held_at, created_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      )
    `, [
      id,
      input.cashierId,
      input.cashierName || user?.fullName || null,
      input.customerId || null,
      input.customerName || null,
      cartData,
      input.subtotal,
      input.discountAmount,
      input.taxAmount,
      input.total,
      input.notes || null,
    ])

    await auditService.log({
      userId: user?.id || input.cashierId,
      userFullName: user?.fullName || input.cashierName || 'Cashier',
      action: 'hold_cart',
      resource: 'pos',
      resourceId: id,
      details: {
        itemsCount: input.items.length,
        total: input.total,
        customerName: input.customerName,
      },
    })

    const rows = await db.select<HeldCart[]>('SELECT * FROM held_carts WHERE id = ?', [id])
    return rows[0]
  }

  /**
   * List all held carts
   */
  async getHeldCarts(): Promise<HeldCart[]> {
    const db = getDb()
    const rows = await db.select<HeldCart[]>('SELECT * FROM held_carts ORDER BY held_at DESC')
    return rows.map(r => {
      try {
        return { ...r, items: JSON.parse(r.cart_data) }
      } catch {
        return { ...r, items: [] }
      }
    })
  }

  /**
   * Resume and revalidate a held cart
   */
  async resumeHeldCart(heldCartId: string, user?: UserContext): Promise<{
    heldCart: HeldCart
    items: PosCartItem[]
    stockWarnings: string[]
  }> {
    const db = getDb()
    const rows = await db.select<HeldCart[]>('SELECT * FROM held_carts WHERE id = ? LIMIT 1', [heldCartId])
    if (!rows || rows.length === 0) {
      throw new Error('Held cart not found')
    }

    const heldCart = rows[0]
    let items: PosCartItem[] = []
    try {
      items = JSON.parse(heldCart.cart_data)
    } catch {
      items = []
    }

    const stockWarnings: string[] = []
    const updatedItems: PosCartItem[] = []

    // Revalidate each product's current stock from DB
    for (const item of items) {
      const liveStock = await this.getProductStock(item.productId)
      if (!liveStock || liveStock.is_active === 0) {
        stockWarnings.push(`المنتج ${item.productNameAr || item.productName} لم يعد متاحاً أو تم إيقافه`)
        continue
      }

      let qty = item.quantity
      if (qty > liveStock.stock) {
        qty = Math.max(1, liveStock.stock)
        stockWarnings.push(
          `تم تعديل كمية ${item.productNameAr || item.productName} من ${item.quantity} إلى ${qty} لتطابق المخزون المتاح الحالي (${liveStock.stock})`
        )
      }

      const itemSubtotal = Math.max(0, qty * item.unitPrice - item.discountAmount)
      const itemProfit = (item.unitPrice - item.costPrice) * qty - item.discountAmount
      updatedItems.push({
        ...item,
        quantity: qty,
        stock: liveStock.stock,
        subtotal: itemSubtotal,
        profit: itemProfit,
      })
    }

    // Delete held cart from database on resume
    await db.execute('DELETE FROM held_carts WHERE id = ?', [heldCartId])

    await auditService.log({
      userId: user?.id,
      userFullName: user?.fullName,
      action: 'resume_cart',
      resource: 'pos',
      resourceId: heldCartId,
      details: {
        total: heldCart.total,
        itemsCount: updatedItems.length,
      },
    })

    return {
      heldCart,
      items: updatedItems,
      stockWarnings,
    }
  }

  /**
   * Delete / Cancel a held cart
   */
  async deleteHeldCart(heldCartId: string, user?: UserContext): Promise<void> {
    const db = getDb()
    await db.execute('DELETE FROM held_carts WHERE id = ?', [heldCartId])

    await auditService.log({
      userId: user?.id,
      userFullName: user?.fullName,
      action: 'delete_held_cart',
      resource: 'pos',
      resourceId: heldCartId,
    })
  }
}

export const posService = new PosService()

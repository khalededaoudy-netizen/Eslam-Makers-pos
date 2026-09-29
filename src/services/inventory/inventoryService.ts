/**
 * MAKERS POS — Centralized Inventory & Stock Management Engine
 * Single authoritative service for all stock mutations, movements, locations, and calculations.
 */

import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/services/db/database'
import { auditService } from '@/services/audit/auditService'

export type MovementType =
  | 'opening'
  | 'manual_in'
  | 'manual_out'
  | 'adjustment'
  | 'transfer_in'
  | 'transfer_out'
  | 'purchase'
  | 'purchase_return'
  | 'sale'
  | 'sale_return'
  | 'damage'
  | 'correction'
  | 'initial'

export interface StorageLocation {
  id: string
  name: string
  name_ar: string | null
  code: string | null
  description: string | null
  is_active: number
  created_at?: string
  updated_at?: string
}

export interface InventoryMovementRecord {
  id: string
  product_id: string
  product_name_ar: string
  product_name_en: string
  product_sku: string
  location_id: string | null
  location_name: string | null
  type: MovementType
  quantity: number
  stock_before: number
  stock_after: number
  reference_id: string | null
  reference_type: string | null
  reason: string | null
  notes: string | null
  user_id: string | null
  user_name: string | null
  created_at: string
}

export interface InventoryOverview {
  totalProducts: number
  totalUnits: number
  totalStockValue: number
  lowStockCount: number
  outOfStockCount: number
}

export interface ProductInventoryRow {
  id: string
  sku: string
  name_ar: string
  name_en: string
  category_id: string | null
  category_name: string | null
  unit_symbol: string
  drawer_location: string | null
  purchase_price: number
  selling_price: number
  current_stock: number
  min_stock: number
  stock_value: number
  status: 'in_stock' | 'low_stock' | 'out_of_stock'
  primary_barcode: string | null
}

export interface UserContext {
  id?: string
  fullName?: string
}

class InventoryService {
  /**
   * Helper: compute canonical stock status from quantities
   */
  getStockStatus(currentStock: number, minStock: number): 'in_stock' | 'low_stock' | 'out_of_stock' {
    if (currentStock <= 0) return 'out_of_stock'
    if (minStock > 0 && currentStock <= minStock) return 'low_stock'
    return 'in_stock'
  }

  /**
   * 1. STOCK IN (Manual In / Stock Arrival)
   */
  async stockIn(
    params: {
      productId: string
      quantity: number
      locationId?: string | null
      reason?: string
      notes?: string
      referenceId?: string | null
      referenceType?: string | null
      type?: MovementType
    },
    user?: UserContext
  ): Promise<{ newStock: number; movementId: string }> {
    const qty = Number(params.quantity)
    if (isNaN(qty) || qty <= 0) {
      throw new Error('Stock in quantity must be greater than zero')
    }

    const db = getDb()
    const rows = await db.select<any[]>('SELECT id, sku, name_en, name_ar, current_stock FROM products WHERE id = ?', [params.productId])
    if (!rows || rows.length === 0) {
      throw new Error('Product not found')
    }

    const product = rows[0]
    const stockBefore = Number(product.current_stock) || 0
    const stockAfter = stockBefore + qty
    const movType = params.type || 'manual_in'
    const movementId = uuidv4()
    const reason = params.reason || (movType === 'purchase' ? 'Purchase Received' : 'Stock In')

    // 1. Record movement
    await db.execute(`
      INSERT INTO inventory_movements (
        id, product_id, location_id, type, quantity, stock_before, stock_after,
        reference_id, reference_type, reason, notes, user_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    `, [
      movementId,
      params.productId,
      params.locationId || null,
      movType,
      qty,
      stockBefore,
      stockAfter,
      params.referenceId || null,
      params.referenceType || 'manual',
      reason,
      params.notes || null,
      user?.id || null,
    ])

    // 2. Update product current stock
    await db.execute(
      "UPDATE products SET current_stock = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?",
      [stockAfter, params.productId]
    )

    // 3. Update location stock if location is provided
    if (params.locationId) {
      await this.updateProductLocationStock(params.productId, params.locationId, qty)
    }

    // 4. Audit Log
    await auditService.log({
      userId: user?.id,
      userFullName: user?.fullName,
      action: 'stock_in',
      resource: 'inventory',
      resourceId: params.productId,
      details: {
        sku: product.sku,
        quantity: qty,
        stockBefore,
        stockAfter,
        locationId: params.locationId,
        reason,
        notes: params.notes,
      },
    })

    return { newStock: stockAfter, movementId }
  }

  /**
   * 2. STOCK OUT (Manual Out / Damaged / Lost / Expired / Internal Use)
   */
  async stockOut(
    params: {
      productId: string
      quantity: number
      locationId?: string | null
      reason: string
      type?: 'manual_out' | 'damage' | 'correction'
      notes?: string
      referenceId?: string | null
      referenceType?: string | null
      allowNegative?: boolean
    },
    user?: UserContext
  ): Promise<{ newStock: number; movementId: string }> {
    const qty = Number(params.quantity)
    if (isNaN(qty) || qty <= 0) {
      throw new Error('Stock out quantity must be greater than zero')
    }

    if (!params.reason || !params.reason.trim()) {
      throw new Error('A valid reason is required for stock out')
    }

    const db = getDb()
    const rows = await db.select<any[]>('SELECT id, sku, name_en, name_ar, current_stock FROM products WHERE id = ?', [params.productId])
    if (!rows || rows.length === 0) {
      throw new Error('Product not found')
    }

    const product = rows[0]
    const stockBefore = Number(product.current_stock) || 0
    const stockAfter = stockBefore - qty

    if (stockAfter < 0 && !params.allowNegative) {
      // Check global settings for allow_negative_stock
      const settings = await db.select<any[]>("SELECT value FROM settings WHERE key = 'allow_negative_stock'")
      const allowNeg = settings.length > 0 && settings[0].value === '1'
      if (!allowNeg) {
        throw new Error(`Insufficient stock. Current stock is ${stockBefore}, cannot remove ${qty}`)
      }
    }

    const movementId = uuidv4()
    const movType = params.type || 'manual_out'

    // 1. Record movement (quantity stored as negative for deduction)
    await db.execute(`
      INSERT INTO inventory_movements (
        id, product_id, location_id, type, quantity, stock_before, stock_after,
        reference_id, reference_type, reason, notes, user_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    `, [
      movementId,
      params.productId,
      params.locationId || null,
      movType,
      -qty,
      stockBefore,
      stockAfter,
      params.referenceId || null,
      params.referenceType || 'manual',
      params.reason.trim(),
      params.notes || null,
      user?.id || null,
    ])

    // 2. Update product current stock
    await db.execute(
      "UPDATE products SET current_stock = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?",
      [stockAfter, params.productId]
    )

    // 3. Update location stock if location is provided
    if (params.locationId) {
      await this.updateProductLocationStock(params.productId, params.locationId, -qty)
    }

    // 4. Audit Log
    await auditService.log({
      userId: user?.id,
      userFullName: user?.fullName,
      action: 'stock_out',
      resource: 'inventory',
      resourceId: params.productId,
      details: {
        sku: product.sku,
        quantity: -qty,
        stockBefore,
        stockAfter,
        locationId: params.locationId,
        reason: params.reason,
        type: movType,
        notes: params.notes,
      },
    })

    return { newStock: stockAfter, movementId }
  }

  /**
   * 3. STOCK ADJUSTMENT (Cycle Count / Physical Inventory Reconciliation)
   */
  async adjustStock(
    params: {
      productId: string
      actualStock: number
      locationId?: string | null
      reason: string
      notes?: string
    },
    user?: UserContext
  ): Promise<{ newStock: number; delta: number; movementId: string }> {
    const actual = Number(params.actualStock)
    if (isNaN(actual) || actual < 0) {
      throw new Error('Actual stock must be a non-negative number')
    }

    if (!params.reason || !params.reason.trim()) {
      throw new Error('A reason is required for stock adjustment')
    }

    const db = getDb()
    const rows = await db.select<any[]>('SELECT id, sku, name_en, name_ar, current_stock FROM products WHERE id = ?', [params.productId])
    if (!rows || rows.length === 0) {
      throw new Error('Product not found')
    }

    const product = rows[0]
    const stockBefore = Number(product.current_stock) || 0
    const delta = actual - stockBefore

    const movementId = uuidv4()

    // 1. Record movement
    await db.execute(`
      INSERT INTO inventory_movements (
        id, product_id, location_id, type, quantity, stock_before, stock_after,
        reference_id, reference_type, reason, notes, user_id, created_at
      ) VALUES (?, ?, ?, 'adjustment', ?, ?, ?, ?, 'adjustment', ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    `, [
      movementId,
      params.productId,
      params.locationId || null,
      delta,
      stockBefore,
      actual,
      movementId,
      params.reason.trim(),
      params.notes || null,
      user?.id || null,
    ])

    // 2. Update product current stock
    await db.execute(
      "UPDATE products SET current_stock = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?",
      [actual, params.productId]
    )

    // 3. Update location stock if location is provided
    if (params.locationId) {
      await this.updateProductLocationStock(params.productId, params.locationId, delta)
    }

    // 4. Audit Log
    await auditService.log({
      userId: user?.id,
      userFullName: user?.fullName,
      action: 'stock_adjustment',
      resource: 'inventory',
      resourceId: params.productId,
      details: {
        sku: product.sku,
        delta,
        stockBefore,
        stockAfter: actual,
        locationId: params.locationId,
        reason: params.reason,
        notes: params.notes,
      },
    })

    return { newStock: actual, delta, movementId }
  }

  /**
   * 4. OPENING BALANCE (Initial Stock Assignment)
   */
  async openBalance(
    params: {
      productId: string
      quantity: number
      locationId?: string | null
      notes?: string
    },
    user?: UserContext
  ): Promise<{ newStock: number; movementId: string }> {
    const qty = Number(params.quantity)
    if (isNaN(qty) || qty < 0) {
      throw new Error('Opening balance quantity must be a non-negative number')
    }

    const db = getDb()
    const rows = await db.select<any[]>('SELECT id, sku, name_en, name_ar, current_stock FROM products WHERE id = ?', [params.productId])
    if (!rows || rows.length === 0) {
      throw new Error('Product not found')
    }

    const product = rows[0]
    const stockBefore = Number(product.current_stock) || 0
    const delta = qty - stockBefore
    const movementId = uuidv4()

    // 1. Record opening movement
    await db.execute(`
      INSERT INTO inventory_movements (
        id, product_id, location_id, type, quantity, stock_before, stock_after,
        reference_id, reference_type, reason, notes, user_id, created_at
      ) VALUES (?, ?, ?, 'opening', ?, ?, ?, ?, 'opening', 'Opening stock balance', ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    `, [
      movementId,
      params.productId,
      params.locationId || null,
      delta,
      stockBefore,
      qty,
      movementId,
      params.notes || null,
      user?.id || null,
    ])

    // 2. Update product current stock
    await db.execute(
      "UPDATE products SET current_stock = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?",
      [qty, params.productId]
    )

    // 3. Update location stock if location is provided
    if (params.locationId) {
      await this.updateProductLocationStock(params.productId, params.locationId, delta)
    }

    // 4. Audit Log
    await auditService.log({
      userId: user?.id,
      userFullName: user?.fullName,
      action: 'opening_balance',
      resource: 'inventory',
      resourceId: params.productId,
      details: {
        sku: product.sku,
        quantity: qty,
        delta,
        stockBefore,
        stockAfter: qty,
        locationId: params.locationId,
        notes: params.notes,
      },
    })

    return { newStock: qty, movementId }
  }

  /**
   * 5. STOCK TRANSFER (Transfer from Location A to Location B)
   * Linked atomic movements: transfer_out (-qty) and transfer_in (+qty). Total stock unchanged.
   */
  async transferStock(
    params: {
      productId: string
      fromLocationId: string
      toLocationId: string
      quantity: number
      notes?: string
    },
    user?: UserContext
  ): Promise<{ transferReference: string; outMovementId: string; inMovementId: string }> {
    const qty = Number(params.quantity)
    if (isNaN(qty) || qty <= 0) {
      throw new Error('Transfer quantity must be greater than zero')
    }

    if (!params.fromLocationId || !params.toLocationId) {
      throw new Error('Both source and destination locations are required')
    }

    if (params.fromLocationId === params.toLocationId) {
      throw new Error('Source and destination locations cannot be the same')
    }

    const db = getDb()
    const rows = await db.select<any[]>('SELECT id, sku, current_stock FROM products WHERE id = ?', [params.productId])
    if (!rows || rows.length === 0) {
      throw new Error('Product not found')
    }

    const product = rows[0]
    const currentStock = Number(product.current_stock) || 0

    // Check source location stock
    const fromLocRows = await db.select<any[]>(
      'SELECT quantity FROM product_locations WHERE product_id = ? AND location_id = ?',
      [params.productId, params.fromLocationId]
    )
    const fromLocStock = fromLocRows.length > 0 ? Number(fromLocRows[0].quantity) || 0 : 0

    if (fromLocStock < qty) {
      throw new Error(`Insufficient stock in source location. Available: ${fromLocStock}, Requested: ${qty}`)
    }

    const transferRef = `TRF-${Date.now().toString().slice(-6)}`
    const outMovementId = uuidv4()
    const inMovementId = uuidv4()

    // 1. Record transfer_out movement
    await db.execute(`
      INSERT INTO inventory_movements (
        id, product_id, location_id, type, quantity, stock_before, stock_after,
        reference_id, reference_type, reason, notes, user_id, created_at
      ) VALUES (?, ?, ?, 'transfer_out', ?, ?, ?, ?, 'transfer', 'Stock transfer outbound', ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    `, [
      outMovementId,
      params.productId,
      params.fromLocationId,
      -qty,
      currentStock,
      currentStock,
      transferRef,
      params.notes || null,
      user?.id || null,
    ])

    // 2. Record transfer_in movement
    await db.execute(`
      INSERT INTO inventory_movements (
        id, product_id, location_id, type, quantity, stock_before, stock_after,
        reference_id, reference_type, reason, notes, user_id, created_at
      ) VALUES (?, ?, ?, 'transfer_in', ?, ?, ?, ?, 'transfer', 'Stock transfer inbound', ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    `, [
      inMovementId,
      params.productId,
      params.toLocationId,
      qty,
      currentStock,
      currentStock,
      transferRef,
      params.notes || null,
      user?.id || null,
    ])

    // 3. Update location-specific balances
    await this.updateProductLocationStock(params.productId, params.fromLocationId, -qty)
    await this.updateProductLocationStock(params.productId, params.toLocationId, qty)

    // Total product stock remains currentStock (no change to products.current_stock)

    // 4. Audit Log
    await auditService.log({
      userId: user?.id,
      userFullName: user?.fullName,
      action: 'stock_transfer',
      resource: 'inventory',
      resourceId: params.productId,
      details: {
        transferReference: transferRef,
        fromLocationId: params.fromLocationId,
        toLocationId: params.toLocationId,
        quantity: qty,
        notes: params.notes,
      },
    })

    return { transferReference: transferRef, outMovementId, inMovementId }
  }

  /**
   * Helper: Update product location stock balance atomically
   */
  private async updateProductLocationStock(productId: string, locationId: string, delta: number): Promise<void> {
    const db = getDb()
    const rows = await db.select<any[]>(
      'SELECT id, quantity FROM product_locations WHERE product_id = ? AND location_id = ?',
      [productId, locationId]
    )

    if (rows.length > 0) {
      const newQty = (Number(rows[0].quantity) || 0) + delta
      await db.execute(
        "UPDATE product_locations SET quantity = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?",
        [newQty, rows[0].id]
      )
    } else {
      const newQty = Math.max(0, delta)
      await db.execute(`
        INSERT INTO product_locations (id, product_id, location_id, quantity, created_at, updated_at)
        VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      `, [uuidv4(), productId, locationId, newQty])
    }
  }

  /**
   * 6. GET INVENTORY OVERVIEW (KPIs)
   */
  async getInventoryOverview(): Promise<InventoryOverview> {
    const db = getDb()
    const prods = await db.select<any[]>(`
      SELECT current_stock, min_stock, purchase_price
      FROM products
      WHERE is_active = 1
    `)

    let totalProducts = prods.length
    let totalUnits = 0
    let totalStockValue = 0
    let lowStockCount = 0
    let outOfStockCount = 0

    for (const p of prods) {
      const stock = Number(p.current_stock) || 0
      const minStock = Number(p.min_stock) || 0
      const cost = Number(p.purchase_price) || 0

      totalUnits += stock
      totalStockValue += stock * cost

      if (stock <= 0) {
        outOfStockCount++
      } else if (minStock > 0 && stock <= minStock) {
        lowStockCount++
      }
    }

    return {
      totalProducts,
      totalUnits,
      totalStockValue,
      lowStockCount,
      outOfStockCount,
    }
  }

  /**
   * 7. GET PRODUCT INVENTORY TABLE WITH SEARCH AND FILTERS
   */
  async getInventoryProducts(params?: {
    search?: string
    categoryId?: string
    statusFilter?: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'
    limit?: number
    offset?: number
  }): Promise<ProductInventoryRow[]> {
    const db = getDb()
    const conditions: string[] = ['p.is_active = 1']
    const sqlParams: unknown[] = []

    if (params?.categoryId) {
      conditions.push('p.category_id = ?')
      sqlParams.push(params.categoryId)
    }

    if (params?.search && params.search.trim()) {
      const q = `%${params.search.trim()}%`
      conditions.push(`(
        p.name_ar LIKE ?
        OR p.name_en LIKE ?
        OR p.sku LIKE ?
        OR p.drawer_location LIKE ?
        OR EXISTS (SELECT 1 FROM product_barcodes pb WHERE pb.product_id = p.id AND pb.barcode LIKE ?)
      )`)
      sqlParams.push(q, q, q, q, q)
    }

    if (params?.statusFilter === 'out_of_stock') {
      conditions.push('p.current_stock <= 0')
    } else if (params?.statusFilter === 'low_stock') {
      conditions.push('p.current_stock > 0 AND p.current_stock <= p.min_stock AND p.min_stock > 0')
    } else if (params?.statusFilter === 'in_stock') {
      conditions.push('(p.current_stock > p.min_stock OR (p.min_stock = 0 AND p.current_stock > 0))')
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`
    const limit = params?.limit ?? 200
    const offset = params?.offset ?? 0

    const rows = await db.select<any[]>(`
      SELECT p.id, p.sku, p.name_ar, p.name_en, p.category_id,
             pc.name_ar as category_name,
             pu.symbol as unit_symbol,
             p.drawer_location,
             p.purchase_price, p.selling_price, p.current_stock, p.min_stock,
             (SELECT pb.barcode FROM product_barcodes pb WHERE pb.product_id = p.id AND pb.is_default = 1 LIMIT 1) as primary_barcode
      FROM products p
      LEFT JOIN product_categories pc ON pc.id = p.category_id
      JOIN product_units pu ON pu.id = p.unit_id
      ${whereClause}
      ORDER BY p.name_en ASC
      LIMIT ? OFFSET ?
    `, [...sqlParams, limit, offset])

    return rows.map((r) => {
      const stock = Number(r.current_stock) || 0
      const minStock = Number(r.min_stock) || 0
      const cost = Number(r.purchase_price) || 0
      return {
        id: r.id,
        sku: r.sku,
        name_ar: r.name_ar,
        name_en: r.name_en,
        category_id: r.category_id,
        category_name: r.category_name,
        unit_symbol: r.unit_symbol,
        drawer_location: r.drawer_location,
        purchase_price: cost,
        selling_price: Number(r.selling_price) || 0,
        current_stock: stock,
        min_stock: minStock,
        stock_value: stock * cost,
        status: this.getStockStatus(stock, minStock),
        primary_barcode: r.primary_barcode,
      }
    })
  }

  /**
   * 8. GET CHRONOLOGICAL MOVEMENT LOG
   */
  async getMovements(filters?: {
    productId?: string
    type?: string
    locationId?: string
    userId?: string
    dateFrom?: string
    dateTo?: string
    limit?: number
    offset?: number
  }): Promise<InventoryMovementRecord[]> {
    const db = getDb()
    const conditions: string[] = []
    const sqlParams: unknown[] = []

    if (filters?.productId) {
      conditions.push('im.product_id = ?')
      sqlParams.push(filters.productId)
    }

    if (filters?.type) {
      conditions.push('im.type = ?')
      sqlParams.push(filters.type)
    }

    if (filters?.locationId) {
      conditions.push('im.location_id = ?')
      sqlParams.push(filters.locationId)
    }

    if (filters?.userId) {
      conditions.push('im.user_id = ?')
      sqlParams.push(filters.userId)
    }

    if (filters?.dateFrom) {
      conditions.push('im.created_at >= ?')
      sqlParams.push(filters.dateFrom)
    }

    if (filters?.dateTo) {
      conditions.push('im.created_at <= ?')
      sqlParams.push(filters.dateTo)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const limit = filters?.limit ?? 100
    const offset = filters?.offset ?? 0

    return db.select<InventoryMovementRecord[]>(`
      SELECT im.id, im.product_id, p.name_ar as product_name_ar, p.name_en as product_name_en,
             p.sku as product_sku, im.location_id, sl.name as location_name,
             im.type, im.quantity, im.stock_before, im.stock_after,
             im.reference_id, im.reference_type, im.reason, im.notes,
             im.user_id, u.full_name as user_name, im.created_at
      FROM inventory_movements im
      JOIN products p ON p.id = im.product_id
      LEFT JOIN storage_locations sl ON sl.id = im.location_id
      LEFT JOIN users u ON u.id = im.user_id
      ${whereClause}
      ORDER BY im.created_at DESC
      LIMIT ? OFFSET ?
    `, [...sqlParams, limit, offset])
  }

  /**
   * 9. STORAGE LOCATIONS CRUD
   */
  async getStorageLocations(): Promise<StorageLocation[]> {
    const db = getDb()
    return db.select<StorageLocation[]>('SELECT * FROM storage_locations WHERE is_active = 1 ORDER BY name ASC')
  }

  async createStorageLocation(
    data: { name: string; nameAr?: string; code?: string; description?: string },
    user?: UserContext
  ): Promise<string> {
    const db = getDb()
    const id = uuidv4()
    await db.execute(`
      INSERT INTO storage_locations (id, name, name_ar, code, description, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    `, [id, data.name.trim(), data.nameAr?.trim() || null, data.code?.trim() || null, data.description?.trim() || null])

    await auditService.log({
      userId: user?.id,
      userFullName: user?.fullName,
      action: 'create_storage_location',
      resource: 'storage_locations',
      resourceId: id,
      details: data,
    })

    return id
  }

  async updateStorageLocation(
    id: string,
    data: { name: string; nameAr?: string; code?: string; description?: string },
    user?: UserContext
  ): Promise<void> {
    const db = getDb()
    await db.execute(`
      UPDATE storage_locations SET
        name = ?,
        name_ar = ?,
        code = ?,
        description = ?,
        updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = ?
    `, [data.name.trim(), data.nameAr?.trim() || null, data.code?.trim() || null, data.description?.trim() || null, id])

    await auditService.log({
      userId: user?.id,
      userFullName: user?.fullName,
      action: 'update_storage_location',
      resource: 'storage_locations',
      resourceId: id,
      details: data,
    })
  }

  async deleteStorageLocation(id: string, user?: UserContext): Promise<void> {
    const db = getDb()
    await db.execute("UPDATE storage_locations SET is_active = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?", [id])

    await auditService.log({
      userId: user?.id,
      userFullName: user?.fullName,
      action: 'delete_storage_location',
      resource: 'storage_locations',
      resourceId: id,
    })
  }

  /**
   * 10. GET STOCK PER LOCATION FOR A PRODUCT
   */
  async getProductLocations(productId: string): Promise<Array<{ locationId: string; locationName: string; locationNameAr: string | null; quantity: number }>> {
    const db = getDb()
    return db.select<any[]>(`
      SELECT pl.location_id as locationId, sl.name as locationName, sl.name_ar as locationNameAr, pl.quantity
      FROM product_locations pl
      JOIN storage_locations sl ON sl.id = pl.location_id
      WHERE pl.product_id = ? AND sl.is_active = 1
      ORDER BY sl.name ASC
    `, [productId])
  }
}

export const inventoryService = new InventoryService()

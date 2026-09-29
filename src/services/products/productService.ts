/**
 * MAKERS POS — Product Service
 * Core business logic for Products, Barcodes, Categories, Units, Brands, Attributes, and Stock Movements
 */

import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/services/db/database'
import { auditService } from '@/services/audit/auditService'

export interface ProductBarcodeItem {
  id?: string
  barcode: string
  type: string
  isDefault: boolean
  source?: string
}

export interface ProductAttributeValueItem {
  attributeId: string
  value: string
}

export interface CreateProductInput {
  sku: string
  nameAr: string
  nameEn: string
  description?: string
  categoryId?: string | null
  unitId: string
  brandId?: string | null
  defaultSupplierId?: string | null
  purchasePrice?: number
  sellingPrice?: number
  currentStock?: number
  minStock?: number
  imagePath?: string | null
  drawerLocation?: string | null
  footprintPackage?: string | null
  datasheetUrl?: string | null
  sourceType?: 'LOCAL' | 'MAKERS_WEBSITE'
  externalProductId?: string | null
  externalSku?: string | null
  externalUrl?: string | null
  websitePrice?: number | null
  notes?: string | null
  isActive?: boolean
  barcodes?: ProductBarcodeItem[]
  attributes?: ProductAttributeValueItem[]
}

export interface UpdateProductInput extends CreateProductInput {
  id: string
}

export interface ProductListItem {
  id: string
  sku: string
  name_ar: string
  name_en: string
  category_id: string | null
  category_name: string | null
  unit_id: string
  unit_symbol: string
  unit_name_ar: string
  unit_name_en: string
  brand_id: string | null
  brand_name: string | null
  purchase_price: number
  selling_price: number
  current_stock: number
  min_stock: number
  is_active: number
  drawer_location: string | null
  footprint_package: string | null
  datasheet_url: string | null
  source_type: string | null
  external_product_id: string | null
  external_sku: string | null
  external_url: string | null
  website_price: number | null
  primary_barcode: string | null
  created_at: string
  updated_at: string
}

export interface BrandItem {
  id: string
  name: string
  is_active: number
  created_at: string
  updated_at: string
}

export interface CategoryItem {
  id: string
  name_ar: string
  name_en: string
  parent_id: string | null
  description: string | null
  color: string | null
  icon: string | null
  is_active: number
  sort_order: number
  created_at: string
}

export interface UnitItem {
  id: string
  name_ar: string
  name_en: string
  symbol: string
  allow_decimal: number
  is_active: number
  created_at: string
}

export interface AttributeDefItem {
  id: string
  name_ar: string
  name_en: string
  unit: string | null
  category_id: string | null
  data_type: string
  sort_order: number
  created_at: string
}

class ProductService {
  /**
   * Check if an internal SKU is unique
   */
  async checkSkuUnique(sku: string, excludeId?: string): Promise<boolean> {
    const db = getDb()
    const trimmed = sku.trim()
    if (!trimmed) return true

    const query = excludeId
      ? 'SELECT id FROM products WHERE LOWER(sku) = LOWER(?) AND id != ? LIMIT 1'
      : 'SELECT id FROM products WHERE LOWER(sku) = LOWER(?) LIMIT 1'
    const params = excludeId ? [trimmed, excludeId] : [trimmed]

    const rows = await db.select<Array<{ id: string }>>(query, params)
    return rows.length === 0
  }

  /**
   * Check if a barcode is unique across all product barcodes
   */
  async checkBarcodeUnique(barcode: string, excludeProductId?: string): Promise<boolean> {
    const db = getDb()
    const trimmed = barcode.trim()
    if (!trimmed) return true

    const query = excludeProductId
      ? 'SELECT id FROM product_barcodes WHERE barcode = ? AND product_id != ? LIMIT 1'
      : 'SELECT id FROM product_barcodes WHERE barcode = ? LIMIT 1'
    const params = excludeProductId ? [trimmed, excludeProductId] : [trimmed]

    const rows = await db.select<Array<{ id: string }>>(query, params)
    return rows.length === 0
  }

  /**
   * Get products with optional search and filters
   */
  async getProducts(params?: {
    search?: string
    categoryId?: string
    brandId?: string
    activeOnly?: boolean
    lowStockOnly?: boolean
    limit?: number
    offset?: number
  }): Promise<ProductListItem[]> {
    const db = getDb()
    const conditions: string[] = []
    const sqlParams: unknown[] = []

    if (params?.activeOnly !== false) {
      conditions.push('p.is_active = 1')
    }

    if (params?.categoryId) {
      conditions.push('p.category_id = ?')
      sqlParams.push(params.categoryId)
    }

    if (params?.brandId) {
      conditions.push('p.brand_id = ?')
      sqlParams.push(params.brandId)
    }

    if (params?.lowStockOnly) {
      conditions.push('p.current_stock <= p.min_stock AND p.min_stock > 0')
    }

    if (params?.search && params.search.trim()) {
      const q = `%${params.search.trim()}%`
      conditions.push(`(
        p.name_ar LIKE ?
        OR p.name_en LIKE ?
        OR p.sku LIKE ?
        OR p.external_sku LIKE ?
        OR p.drawer_location LIKE ?
        OR EXISTS (SELECT 1 FROM product_barcodes pb WHERE pb.product_id = p.id AND pb.barcode LIKE ?)
      )`)
      sqlParams.push(q, q, q, q, q, q)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const limit = params?.limit ?? 500
    const offset = params?.offset ?? 0

    const query = `
      SELECT p.id, p.sku, p.name_ar, p.name_en,
             p.category_id, pc.name_ar as category_name,
             p.unit_id, pu.symbol as unit_symbol, pu.name_ar as unit_name_ar, pu.name_en as unit_name_en,
             p.brand_id, b.name as brand_name,
             p.purchase_price, p.selling_price, p.current_stock, p.min_stock, p.is_active,
             p.drawer_location, p.footprint_package, p.datasheet_url,
             p.source_type, p.external_product_id, p.external_sku, p.external_url, p.website_price,
             (SELECT barcode FROM product_barcodes pb WHERE pb.product_id = p.id AND pb.is_default = 1 LIMIT 1) as primary_barcode,
             p.created_at, p.updated_at
      FROM products p
      LEFT JOIN product_categories pc ON pc.id = p.category_id
      JOIN product_units pu ON pu.id = p.unit_id
      LEFT JOIN brands b ON b.id = p.brand_id
      ${whereClause}
      ORDER BY p.name_en ASC
      LIMIT ? OFFSET ?
    `

    return db.select<ProductListItem[]>(query, [...sqlParams, limit, offset])
  }

  /**
   * Get single product by ID with its barcodes and attributes
   */
  async getProductById(id: string): Promise<{
    product: any
    barcodes: ProductBarcodeItem[]
    attributes: Array<{ attributeId: string; attributeNameAr: string; attributeNameEn: string; unit: string | null; value: string }>
  } | null> {
    const db = getDb()
    const rows = await db.select<any[]>('SELECT * FROM products WHERE id = ?', [id])
    if (!rows || rows.length === 0) return null

    const product = rows[0]

    const barcodes = await db.select<Array<{ id: string; barcode: string; type: string; is_default: number; source: string }>>(
      'SELECT id, barcode, type, is_default, source FROM product_barcodes WHERE product_id = ? ORDER BY is_default DESC, created_at ASC',
      [id]
    )

    const attributes = await db.select<Array<{
      attribute_id: string
      name_ar: string
      name_en: string
      unit: string | null
      value: string
    }>>(`
      SELECT pav.attribute_id, pad.name_ar, pad.name_en, pad.unit, pav.value
      FROM product_attribute_values pav
      JOIN product_attribute_defs pad ON pad.id = pav.attribute_id
      WHERE pav.product_id = ?
      ORDER BY pad.sort_order ASC, pad.name_ar ASC
    `, [id])

    return {
      product,
      barcodes: barcodes.map(b => ({
        id: b.id,
        barcode: b.barcode,
        type: b.type,
        isDefault: Boolean(b.is_default),
        source: b.source,
      })),
      attributes: attributes.map(a => ({
        attributeId: a.attribute_id,
        attributeNameAr: a.name_ar,
        attributeNameEn: a.name_en,
        unit: a.unit,
        value: a.value,
      })),
    }
  }

  /**
   * Create a new product with full relations, barcodes, attributes, inventory movement, and audit log
   */
  async createProduct(
    input: CreateProductInput,
    user?: { id?: string; fullName?: string }
  ): Promise<{ productId: string; sku: string }> {
    const db = getDb()
    const finalSku = input.sku.trim()

    if (!finalSku) {
      throw new Error('Product SKU is required')
    }

    // Uniqueness validation: SKU
    const isSkuUnique = await this.checkSkuUnique(finalSku)
    if (!isSkuUnique) {
      throw new Error(`SKU "${finalSku}" already exists`)
    }

    // Uniqueness validation: Barcodes
    if (input.barcodes && input.barcodes.length > 0) {
      for (const bc of input.barcodes) {
        if (bc.barcode.trim()) {
          const isBcUnique = await this.checkBarcodeUnique(bc.barcode.trim())
          if (!isBcUnique) {
            throw new Error(`Barcode "${bc.barcode.trim()}" already exists for another product`)
          }
        }
      }
    }

    const productId = uuidv4()
    const initialQty = Number(input.currentStock) || 0
    const purchasePrice = Number(input.purchasePrice) || 0
    const sellingPrice = Number(input.sellingPrice) || 0
    const minStock = Number(input.minStock) || 0

    // 1. Insert product
    await db.execute(`
      INSERT INTO products (
        id, sku, name_ar, name_en, description,
        category_id, unit_id, brand_id, default_supplier_id,
        purchase_price, selling_price, current_stock, min_stock,
        image_path, is_active, notes,
        drawer_location, footprint_package, datasheet_url,
        source_type, external_product_id, external_sku, external_url,
        website_price, last_synced_at,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      )
    `, [
      productId,
      finalSku,
      input.nameAr,
      input.nameEn,
      input.description || null,
      input.categoryId || null,
      input.unitId,
      input.brandId || null,
      input.defaultSupplierId || null,
      purchasePrice,
      sellingPrice,
      initialQty,
      minStock,
      input.imagePath || null,
      input.isActive !== false ? 1 : 0,
      input.notes || null,
      input.drawerLocation || null,
      input.footprintPackage || null,
      input.datasheetUrl || null,
      input.sourceType || 'LOCAL',
      input.externalProductId || null,
      input.externalSku || null,
      input.externalUrl || null,
      input.websitePrice || null,
      input.sourceType === 'MAKERS_WEBSITE' ? new Date().toISOString() : null,
    ])

    // 2. Insert Barcodes
    const barcodesToInsert = input.barcodes && input.barcodes.length > 0
      ? input.barcodes
      : [{ barcode: finalSku, type: 'code128', isDefault: true, source: 'manual' }]

    let hasDefault = barcodesToInsert.some(b => b.isDefault)

    for (let i = 0; i < barcodesToInsert.length; i++) {
      const bc = barcodesToInsert[i]
      const trimmedBc = bc.barcode.trim()
      if (!trimmedBc) continue
      const isDefaultVal = bc.isDefault || (!hasDefault && i === 0) ? 1 : 0
      if (isDefaultVal === 1) hasDefault = true

      await db.execute(`
        INSERT OR REPLACE INTO product_barcodes (id, product_id, barcode, type, is_default, is_printed, source, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 0, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      `, [uuidv4(), productId, trimmedBc, bc.type || 'code128', isDefaultVal, bc.source || 'manual'])
    }

    // 3. Insert Attributes
    if (input.attributes && input.attributes.length > 0) {
      for (const attr of input.attributes) {
        if (attr.attributeId && attr.value !== undefined && attr.value !== '') {
          await db.execute(`
            INSERT OR REPLACE INTO product_attribute_values (id, product_id, attribute_id, value)
            VALUES (?, ?, ?, ?)
          `, [uuidv4(), productId, attr.attributeId, String(attr.value)])
        }
      }
    }

    // 4. Record Initial Inventory Movement
    if (initialQty > 0) {
      await db.execute(`
        INSERT INTO inventory_movements (id, product_id, type, quantity, stock_before, stock_after, reason, user_id, created_at)
        VALUES (?, ?, 'initial', ?, 0, ?, 'Initial product creation stock', ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      `, [uuidv4(), productId, initialQty, initialQty, user?.id || null])
    }

    // 5. Audit Log
    await auditService.log({
      userId: user?.id,
      userFullName: user?.fullName,
      action: 'create_product',
      resource: 'products',
      resourceId: productId,
      details: {
        sku: finalSku,
        nameAr: input.nameAr,
        nameEn: input.nameEn,
        sellingPrice,
        purchasePrice,
        initialStock: initialQty,
        sourceType: input.sourceType || 'LOCAL',
      },
    })

    return { productId, sku: finalSku }
  }

  /**
   * Update an existing product with updated barcodes and attributes
   */
  async updateProduct(
    input: UpdateProductInput,
    user?: { id?: string; fullName?: string }
  ): Promise<void> {
    const db = getDb()
    const productId = input.id
    const finalSku = input.sku.trim()

    if (!finalSku) {
      throw new Error('Product SKU is required')
    }

    // Uniqueness validation: SKU
    const isSkuUnique = await this.checkSkuUnique(finalSku, productId)
    if (!isSkuUnique) {
      throw new Error(`SKU "${finalSku}" is already in use by another product`)
    }

    // Uniqueness validation: Barcodes
    if (input.barcodes && input.barcodes.length > 0) {
      for (const bc of input.barcodes) {
        if (bc.barcode.trim()) {
          const isBcUnique = await this.checkBarcodeUnique(bc.barcode.trim(), productId)
          if (!isBcUnique) {
            throw new Error(`Barcode "${bc.barcode.trim()}" already exists for another product`)
          }
        }
      }
    }

    const purchasePrice = Number(input.purchasePrice) || 0
    const sellingPrice = Number(input.sellingPrice) || 0
    const minStock = Number(input.minStock) || 0

    // Update product table (leave current_stock unchanged on edit; stock adjustments happen via addStock/inventory)
    await db.execute(`
      UPDATE products SET
        sku = ?,
        name_ar = ?,
        name_en = ?,
        description = ?,
        category_id = ?,
        unit_id = ?,
        brand_id = ?,
        default_supplier_id = ?,
        purchase_price = ?,
        selling_price = ?,
        min_stock = ?,
        image_path = ?,
        is_active = ?,
        notes = ?,
        drawer_location = ?,
        footprint_package = ?,
        datasheet_url = ?,
        updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = ?
    `, [
      finalSku,
      input.nameAr,
      input.nameEn,
      input.description || null,
      input.categoryId || null,
      input.unitId,
      input.brandId || null,
      input.defaultSupplierId || null,
      purchasePrice,
      sellingPrice,
      minStock,
      input.imagePath || null,
      input.isActive !== false ? 1 : 0,
      input.notes || null,
      input.drawerLocation || null,
      input.footprintPackage || null,
      input.datasheetUrl || null,
      productId,
    ])

    // Update Barcodes: Replace existing barcodes
    if (input.barcodes) {
      await db.execute('DELETE FROM product_barcodes WHERE product_id = ?', [productId])
      let hasDefault = input.barcodes.some(b => b.isDefault)

      for (let i = 0; i < input.barcodes.length; i++) {
        const bc = input.barcodes[i]
        const trimmedBc = bc.barcode.trim()
        if (!trimmedBc) continue
        const isDefaultVal = bc.isDefault || (!hasDefault && i === 0) ? 1 : 0
        if (isDefaultVal === 1) hasDefault = true

        await db.execute(`
          INSERT INTO product_barcodes (id, product_id, barcode, type, is_default, is_printed, source, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 0, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
        `, [uuidv4(), productId, trimmedBc, bc.type || 'code128', isDefaultVal, bc.source || 'manual'])
      }
    }

    // Update Attributes: Replace existing attribute values
    if (input.attributes) {
      await db.execute('DELETE FROM product_attribute_values WHERE product_id = ?', [productId])
      for (const attr of input.attributes) {
        if (attr.attributeId && attr.value !== undefined && attr.value !== '') {
          await db.execute(`
            INSERT INTO product_attribute_values (id, product_id, attribute_id, value)
            VALUES (?, ?, ?, ?)
          `, [uuidv4(), productId, attr.attributeId, String(attr.value)])
        }
      }
    }

    // Audit Log
    await auditService.log({
      userId: user?.id,
      userFullName: user?.fullName,
      action: 'update_product',
      resource: 'products',
      resourceId: productId,
      details: {
        sku: finalSku,
        nameAr: input.nameAr,
        nameEn: input.nameEn,
        sellingPrice,
        purchasePrice,
      },
    })
  }

  /**
   * Deactivate or Delete a product
   */
  async deleteProduct(id: string, user?: { id?: string; fullName?: string }): Promise<void> {
    const db = getDb()
    await db.execute(
      "UPDATE products SET is_active = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?",
      [id]
    )

    await auditService.log({
      userId: user?.id,
      userFullName: user?.fullName,
      action: 'delete_product',
      resource: 'products',
      resourceId: id,
    })
  }

  /**
   * Add stock to product and record movement
   */
  async addStock(
    productId: string,
    quantityToAdd: number,
    reason: string = 'Manual stock adjustment',
    user?: { id?: string; fullName?: string }
  ): Promise<{ newStock: number; movementId: string }> {
    if (quantityToAdd <= 0) {
      throw new Error('Quantity must be greater than zero')
    }

    const db = getDb()
    const rows = await db.select<any[]>('SELECT id, current_stock FROM products WHERE id = ?', [productId])
    if (!rows || rows.length === 0) {
      throw new Error('Product not found')
    }

    const currentStock = Number(rows[0].current_stock) || 0
    const newStock = currentStock + quantityToAdd
    const movementId = uuidv4()

    await db.execute(`
      INSERT INTO inventory_movements (id, product_id, type, quantity, stock_before, stock_after, reason, user_id, created_at)
      VALUES (?, ?, 'adjustment', ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    `, [movementId, productId, quantityToAdd, currentStock, newStock, reason, user?.id || null])

    await db.execute(
      "UPDATE products SET current_stock = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?",
      [newStock, productId]
    )

    await auditService.log({
      userId: user?.id,
      userFullName: user?.fullName,
      action: 'stock_adjustment',
      resource: 'products',
      resourceId: productId,
      details: {
        quantityAdded: quantityToAdd,
        stockBefore: currentStock,
        stockAfter: newStock,
        reason,
      },
    })

    return { newStock, movementId }
  }

  /**
   * Look up product by Barcode or SKU for POS and scanner lookup
   */
  async lookupByBarcode(barcodeOrSku: string): Promise<any | null> {
    const db = getDb()
    const trimmed = barcodeOrSku.trim()
    if (!trimmed) return null

    const rows = await db.select<any[]>(`
      SELECT p.id, p.sku, p.name_ar, p.name_en, p.selling_price, p.purchase_price,
             p.current_stock, pu.symbol as unit_symbol, pu.allow_decimal,
             p.drawer_location, pb.barcode as matched_barcode
      FROM products p
      JOIN product_units pu ON pu.id = p.unit_id
      LEFT JOIN product_barcodes pb ON pb.product_id = p.id AND pb.barcode = ?
      WHERE p.is_active = 1 AND (pb.barcode = ? OR p.sku = ? OR p.external_sku = ?)
      LIMIT 1
    `, [trimmed, trimmed, trimmed, trimmed])

    return rows.length > 0 ? rows[0] : null
  }

  // ─── Brands CRUD ───────────────────────────────────────────────────────────

  async getBrands(): Promise<BrandItem[]> {
    const db = getDb()
    return db.select<BrandItem[]>('SELECT * FROM brands WHERE is_active = 1 ORDER BY name ASC')
  }

  async createBrand(name: string, user?: { id?: string; fullName?: string }): Promise<BrandItem> {
    const db = getDb()
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Brand name is required')

    const id = uuidv4()
    await db.execute(`
      INSERT INTO brands (id, name, is_active, created_at, updated_at)
      VALUES (?, ?, 1, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    `, [id, trimmed])

    await auditService.log({
      userId: user?.id,
      userFullName: user?.fullName,
      action: 'create_brand',
      resource: 'brands',
      resourceId: id,
      details: { name: trimmed },
    })

    return { id, name: trimmed, is_active: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  }

  async updateBrand(id: string, name: string, user?: { id?: string; fullName?: string }): Promise<void> {
    const db = getDb()
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Brand name is required')

    await db.execute(`
      UPDATE brands SET name = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?
    `, [trimmed, id])

    await auditService.log({
      userId: user?.id,
      userFullName: user?.fullName,
      action: 'update_brand',
      resource: 'brands',
      resourceId: id,
      details: { name: trimmed },
    })
  }

  async deleteBrand(id: string, user?: { id?: string; fullName?: string }): Promise<void> {
    const db = getDb()
    await db.execute('DELETE FROM brands WHERE id = ?', [id])

    await auditService.log({
      userId: user?.id,
      userFullName: user?.fullName,
      action: 'delete_brand',
      resource: 'brands',
      resourceId: id,
    })
  }

  // ─── Categories CRUD ───────────────────────────────────────────────────────

  async getCategories(): Promise<CategoryItem[]> {
    const db = getDb()
    return db.select<CategoryItem[]>('SELECT * FROM product_categories ORDER BY sort_order ASC, name_ar ASC')
  }

  async createCategory(
    data: { nameAr: string; nameEn: string; parentId?: string | null; icon?: string; color?: string },
    user?: { id?: string; fullName?: string }
  ): Promise<string> {
    const db = getDb()
    const id = uuidv4()
    await db.execute(`
      INSERT INTO product_categories (id, name_ar, name_en, parent_id, icon, color, is_active, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    `, [id, data.nameAr.trim(), data.nameEn.trim(), data.parentId || null, data.icon || 'folder', data.color || '#3b82f6'])

    await auditService.log({
      userId: user?.id,
      userFullName: user?.fullName,
      action: 'create_category',
      resource: 'product_categories',
      resourceId: id,
      details: data,
    })

    return id
  }

  async updateCategory(
    id: string,
    data: { nameAr: string; nameEn: string; parentId?: string | null; icon?: string; color?: string },
    user?: { id?: string; fullName?: string }
  ): Promise<void> {
    const db = getDb()
    await db.execute(`
      UPDATE product_categories SET
        name_ar = ?,
        name_en = ?,
        parent_id = ?,
        icon = COALESCE(?, icon),
        color = COALESCE(?, color),
        updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = ?
    `, [data.nameAr.trim(), data.nameEn.trim(), data.parentId || null, data.icon || null, data.color || null, id])

    await auditService.log({
      userId: user?.id,
      userFullName: user?.fullName,
      action: 'update_category',
      resource: 'product_categories',
      resourceId: id,
      details: data,
    })
  }

  async deleteCategory(id: string, user?: { id?: string; fullName?: string }): Promise<void> {
    const db = getDb()
    await db.execute('DELETE FROM product_categories WHERE id = ?', [id])

    await auditService.log({
      userId: user?.id,
      userFullName: user?.fullName,
      action: 'delete_category',
      resource: 'product_categories',
      resourceId: id,
    })
  }

  // ─── Units CRUD ────────────────────────────────────────────────────────────

  async getUnits(): Promise<UnitItem[]> {
    const db = getDb()
    return db.select<UnitItem[]>('SELECT * FROM product_units ORDER BY name_ar ASC')
  }

  async createUnit(
    data: { nameAr: string; nameEn: string; symbol: string; allowDecimal: boolean },
    user?: { id?: string; fullName?: string }
  ): Promise<string> {
    const db = getDb()
    const id = uuidv4()
    await db.execute(`
      INSERT INTO product_units (id, name_ar, name_en, symbol, allow_decimal, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    `, [id, data.nameAr.trim(), data.nameEn.trim(), data.symbol.trim(), data.allowDecimal ? 1 : 0])

    await auditService.log({
      userId: user?.id,
      userFullName: user?.fullName,
      action: 'create_unit',
      resource: 'product_units',
      resourceId: id,
      details: data,
    })

    return id
  }

  async updateUnit(
    id: string,
    data: { nameAr: string; nameEn: string; symbol: string; allowDecimal: boolean },
    user?: { id?: string; fullName?: string }
  ): Promise<void> {
    const db = getDb()
    await db.execute(`
      UPDATE product_units SET
        name_ar = ?,
        name_en = ?,
        symbol = ?,
        allow_decimal = ?,
        updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = ?
    `, [data.nameAr.trim(), data.nameEn.trim(), data.symbol.trim(), data.allowDecimal ? 1 : 0, id])

    await auditService.log({
      userId: user?.id,
      userFullName: user?.fullName,
      action: 'update_unit',
      resource: 'product_units',
      resourceId: id,
      details: data,
    })
  }

  async deleteUnit(id: string, user?: { id?: string; fullName?: string }): Promise<void> {
    const db = getDb()
    await db.execute('DELETE FROM product_units WHERE id = ?', [id])

    await auditService.log({
      userId: user?.id,
      userFullName: user?.fullName,
      action: 'delete_unit',
      resource: 'product_units',
      resourceId: id,
    })
  }

  // ─── Attribute Definitions CRUD ───────────────────────────────────────────

  async getAttributeDefs(): Promise<AttributeDefItem[]> {
    const db = getDb()
    return db.select<AttributeDefItem[]>('SELECT * FROM product_attribute_defs ORDER BY sort_order ASC, name_ar ASC')
  }

  async createAttributeDef(
    data: { nameAr: string; nameEn: string; unit?: string | null; dataType?: string },
    user?: { id?: string; fullName?: string }
  ): Promise<string> {
    const db = getDb()
    const id = uuidv4()
    await db.execute(`
      INSERT INTO product_attribute_defs (id, name_ar, name_en, unit, data_type, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    `, [id, data.nameAr.trim(), data.nameEn.trim(), data.unit?.trim() || null, data.dataType || 'text'])

    await auditService.log({
      userId: user?.id,
      userFullName: user?.fullName,
      action: 'create_attribute_def',
      resource: 'product_attribute_defs',
      resourceId: id,
      details: data,
    })

    return id
  }

  async updateAttributeDef(
    id: string,
    data: { nameAr: string; nameEn: string; unit?: string | null; dataType?: string },
    user?: { id?: string; fullName?: string }
  ): Promise<void> {
    const db = getDb()
    await db.execute(`
      UPDATE product_attribute_defs SET
        name_ar = ?,
        name_en = ?,
        unit = ?,
        data_type = ?,
        updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = ?
    `, [data.nameAr.trim(), data.nameEn.trim(), data.unit?.trim() || null, data.dataType || 'text', id])

    await auditService.log({
      userId: user?.id,
      userFullName: user?.fullName,
      action: 'update_attribute_def',
      resource: 'product_attribute_defs',
      resourceId: id,
      details: data,
    })
  }

  async deleteAttributeDef(id: string, user?: { id?: string; fullName?: string }): Promise<void> {
    const db = getDb()
    await db.execute('DELETE FROM product_attribute_defs WHERE id = ?', [id])

    await auditService.log({
      userId: user?.id,
      userFullName: user?.fullName,
      action: 'delete_attribute_def',
      resource: 'product_attribute_defs',
      resourceId: id,
    })
  }

  // ─── Normalization & MAKERS Catalog Helpers ──────────────────────────────

  /**
   * Safe category lookup or creation with duplicate prevention across Arabic/English names.
   */
  async findOrCreateCategory(nameAr: string, nameEn?: string): Promise<string> {
    const db = getDb()
    const trimmedAr = (nameAr || '').trim()
    const trimmedEn = (nameEn || trimmedAr).trim()
    if (!trimmedAr && !trimmedEn) {
      throw new Error('Category name cannot be empty')
    }

    const existing = await db.select<CategoryItem[]>(`
      SELECT * FROM product_categories
      WHERE LOWER(TRIM(name_ar)) = LOWER(?)
         OR LOWER(TRIM(name_en)) = LOWER(?)
      LIMIT 1
    `, [trimmedAr, trimmedEn])

    if (existing && existing.length > 0) {
      return existing[0].id
    }

    return this.createCategory({
      nameAr: trimmedAr || trimmedEn,
      nameEn: trimmedEn || trimmedAr,
    })
  }

  /**
   * Safe brand lookup or creation with duplicate prevention.
   */
  async findOrCreateBrand(name: string): Promise<string> {
    const db = getDb()
    const trimmed = (name || '').trim()
    if (!trimmed) {
      throw new Error('Brand name cannot be empty')
    }

    const existing = await db.select<BrandItem[]>(`
      SELECT * FROM product_brands
      WHERE LOWER(TRIM(name)) = LOWER(?)
      LIMIT 1
    `, [trimmed])

    if (existing && existing.length > 0) {
      return existing[0].id
    }

    const created = await this.createBrand(trimmed)
    return created.id
  }

  /**
   * Safe unit lookup with alias support (Piece, PCS, pc, قطعة, etc.)
   */
  async findOrCreateUnit(nameAr: string, nameEn?: string, symbol?: string): Promise<string> {
    const db = getDb()
    const raw = ((nameAr || nameEn || symbol || '') as string).trim().toLowerCase()
    
    // Check known aliases for Piece
    const pieceAliases = ['piece', 'pcs', 'pc', 'قطعة', 'حبة', 'عدد', 'item']
    const isPiece = pieceAliases.some(a => raw.includes(a) || raw === a)

    if (isPiece) {
      const canonicalPiece = await db.select<UnitItem[]>(`
        SELECT * FROM product_units
        WHERE LOWER(TRIM(name_ar)) = 'قطعة' 
           OR LOWER(TRIM(name_en)) = 'piece'
           OR LOWER(TRIM(symbol)) = 'pcs'
        LIMIT 1
      `)
      if (canonicalPiece && canonicalPiece.length > 0) {
        return canonicalPiece[0].id
      }
    }

    const existing = await db.select<UnitItem[]>(`
      SELECT * FROM product_units
      WHERE LOWER(TRIM(name_ar)) = LOWER(?)
         OR LOWER(TRIM(name_en)) = LOWER(?)
         OR LOWER(TRIM(symbol)) = LOWER(?)
      LIMIT 1
    `, [nameAr.trim(), (nameEn || '').trim(), (symbol || '').trim()])

    if (existing && existing.length > 0) {
      return existing[0].id
    }

    return this.createUnit({
      nameAr: nameAr.trim(),
      nameEn: (nameEn || nameAr).trim(),
      symbol: (symbol || nameAr).trim(),
      allowDecimal: false,
    })
  }
}

export const productService = new ProductService()

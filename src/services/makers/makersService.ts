/**
 * MAKERS Product Service
 * Handles searching, mapping, duplicate detection, stock additions, and persistence
 */

import { v4 as uuidv4 } from 'uuid'
import { AppDatabase } from '@/services/db/database'
import { fetchMakersProducts, fetchMakersProductById } from './client'
import { mapMakersProduct } from './mapper'
import {
  MakersMappedProduct,
  MakersSearchResult,
  DuplicateCheckResult,
  SaveImportedProductPayload,
} from './types'

/**
 * Search MAKERS online public catalog
 */
export async function searchMakersCatalog(
  query: string,
  page = 1,
  perPage = 10
): Promise<MakersSearchResult> {
  const response = await fetchMakersProducts(query, page, perPage)
  const mapped = response.products.map(mapMakersProduct)
  return {
    products: mapped,
    total: response.total,
    totalPages: response.totalPages,
    currentPage: page,
  }
}

/**
 * Get product details from MAKERS website by ID
 */
export async function getMakersProductDetails(id: number | string): Promise<MakersMappedProduct> {
  const raw = await fetchMakersProductById(id)
  return mapMakersProduct(raw)
}

/**
 * Duplicate Detection
 * Checks whether the product already exists using strict priority:
 * 1. Website Product ID (external_product_id)
 * 2. Website SKU (external_sku)
 * 3. Barcode / GTIN
 * 4. Internal SKU
 */
export async function checkDuplicateProduct(
  db: AppDatabase,
  websiteProduct: { id: number | string; sku?: string }
): Promise<DuplicateCheckResult> {
  const extId = String(websiteProduct.id)
  const sku = websiteProduct.sku ? websiteProduct.sku.trim() : ''

  // 1. Check by Website Product ID
  if (extId) {
    const rows = await db.select<any[]>(
      `SELECT id, sku, name_ar, name_en, current_stock, selling_price, purchase_price, drawer_location, category_id
       FROM products
       WHERE external_product_id = ?
       LIMIT 1`,
      [extId]
    )
    if (rows && rows.length > 0) {
      return {
        isDuplicate: true,
        matchedProduct: rows[0],
        matchReason: 'website_id',
      }
    }
  }

  // 2. Check by Website SKU (external_sku)
  if (sku) {
    const rows = await db.select<any[]>(
      `SELECT id, sku, name_ar, name_en, current_stock, selling_price, purchase_price, drawer_location, category_id
       FROM products
       WHERE external_sku = ?
       LIMIT 1`,
      [sku]
    )
    if (rows && rows.length > 0) {
      return {
        isDuplicate: true,
        matchedProduct: rows[0],
        matchReason: 'website_sku',
      }
    }
  }

  // 3. Check by Barcode / GTIN in product_barcodes table
  if (sku) {
    const rows = await db.select<any[]>(
      `SELECT p.id, p.sku, p.name_ar, p.name_en, p.current_stock, p.selling_price, p.purchase_price, p.drawer_location, p.category_id
       FROM products p
       JOIN product_barcodes pb ON pb.product_id = p.id
       WHERE pb.barcode = ?
       LIMIT 1`,
      [sku]
    )
    if (rows && rows.length > 0) {
      return {
        isDuplicate: true,
        matchedProduct: rows[0],
        matchReason: 'barcode',
      }
    }
  }

  // 4. Check by Internal SKU
  if (sku) {
    const rows = await db.select<any[]>(
      `SELECT id, sku, name_ar, name_en, current_stock, selling_price, purchase_price, drawer_location, category_id
       FROM products
       WHERE sku = ?
       LIMIT 1`,
      [sku]
    )
    if (rows && rows.length > 0) {
      return {
        isDuplicate: true,
        matchedProduct: rows[0],
        matchReason: 'sku',
      }
    }
  }

  return {
    isDuplicate: false,
    matchedProduct: null,
    matchReason: null,
  }
}

/**
 * Add stock to an existing product with proper inventory movement
 */
export async function addStockToExistingProduct(
  db: AppDatabase,
  productId: string,
  quantityToAdd: number,
  userId?: string | null
): Promise<{ newStock: number; movementId: string }> {
  if (quantityToAdd <= 0) {
    throw new Error('Quantity to add must be greater than zero')
  }

  const [product] = await db.select<any[]>(
    'SELECT id, current_stock FROM products WHERE id = ?',
    [productId]
  )

  if (!product) {
    throw new Error('Product not found in local database')
  }

  const stockBefore = product.current_stock || 0
  const stockAfter = stockBefore + quantityToAdd
  const movementId = uuidv4()

  // 1. Record inventory movement
  await db.execute(
    `INSERT INTO inventory_movements (
       id, product_id, type, quantity, stock_before, stock_after, reason, user_id, created_at
     ) VALUES (?, ?, 'adjustment', ?, ?, ?, 'Stock addition from MAKERS website import', ?, datetime('now'))`,
    [movementId, productId, quantityToAdd, stockBefore, stockAfter, userId || null]
  )

  // 2. Update product current stock
  await db.execute(
    `UPDATE products SET current_stock = ?, updated_at = datetime('now') WHERE id = ?`,
    [stockAfter, productId]
  )

  return { newStock: stockAfter, movementId }
}

/**
 * Resolve existing category or create a new one safely
 */
export async function resolveOrCreateCategory(
  db: AppDatabase,
  categoryName: string
): Promise<string | null> {
  const trimmed = categoryName.trim()
  if (!trimmed) return null

  // 1. Try to find existing category (case-insensitive)
  const existing = await db.select<any[]>(
    `SELECT id FROM product_categories
     WHERE LOWER(TRIM(name_en)) = LOWER(?) OR LOWER(TRIM(name_ar)) = LOWER(?)
     LIMIT 1`,
    [trimmed, trimmed]
  )

  if (existing && existing.length > 0) {
    return existing[0].id
  }

  // 2. Also check if singular/plural or partial match
  const similar = await db.select<any[]>(
    `SELECT id FROM product_categories
     WHERE LOWER(TRIM(name_en)) LIKE LOWER(?)
     LIMIT 1`,
    [`%${trimmed}%`]
  )
  if (similar && similar.length > 0) {
    return similar[0].id
  }

  // 3. Create new category if not found
  const newCatId = uuidv4()
  await db.execute(
    `INSERT INTO product_categories (
       id, name_ar, name_en, icon, color, is_active, sort_order, created_at, updated_at
     ) VALUES (?, ?, ?, 'box', '#0078D7', 1, 0, datetime('now'), datetime('now'))`,
    [newCatId, trimmed, trimmed]
  )

  return newCatId
}

/**
 * Save an imported product, its barcode, and its initial inventory movement
 */
export async function saveImportedProduct(
  db: AppDatabase,
  payload: SaveImportedProductPayload,
  userId?: string | null
): Promise<{ productId: string; sku: string }> {
  const productId = uuidv4()
  const initialQty = Number(payload.initial_quantity) || 0
  const purchasePrice = Number(payload.purchase_price) || 0
  const sellingPrice = Number(payload.selling_price) || 0
  const minStock = Number(payload.min_stock) || 0

  // Resolve category
  let finalCategoryId = payload.category_id || null
  if (!finalCategoryId && payload.new_category_name) {
    finalCategoryId = await resolveOrCreateCategory(db, payload.new_category_name)
  }

  const finalSku = payload.sku.trim() || `PRD-${Date.now().toString().slice(-6)}`

  // 1. Insert product record with external metadata
  await db.execute(
    `INSERT INTO products (
       id, sku, name_ar, name_en, description,
       category_id, unit_id, default_supplier_id,
       purchase_price, selling_price, current_stock, min_stock,
       image_path, is_active, notes,
       drawer_location, footprint_package, datasheet_url,
       source_type, external_product_id, external_sku, external_url,
       website_price, last_synced_at,
       created_at, updated_at
     ) VALUES (
       ?, ?, ?, ?, ?,
       ?, ?, ?,
       ?, ?, ?, ?,
       ?, 1, ?,
       ?, ?, ?,
       'MAKERS_WEBSITE', ?, ?, ?,
       ?, datetime('now'),
       datetime('now'), datetime('now')
     )`,
    [
      productId,
      finalSku,
      payload.name_ar || payload.name_en,
      payload.name_en,
      payload.description || '',
      finalCategoryId,
      payload.unit_id,
      payload.default_supplier_id || null,
      purchasePrice,
      sellingPrice,
      initialQty,
      minStock,
      payload.image_path || null,
      payload.notes || null,
      payload.drawer_location || null,
      payload.footprint_package || null,
      payload.datasheet_url || null,
      payload.external_product_id || null,
      payload.external_sku || finalSku,
      payload.external_url || null,
      payload.website_price || null,
    ]
  )

  // 2. Store manufacturer barcode if provided
  if (payload.sku) {
    try {
      await db.execute(
        `INSERT OR IGNORE INTO product_barcodes (
           id, product_id, barcode, type, is_default, is_printed, source, created_at, updated_at
         ) VALUES (?, ?, ?, 'code128', 1, 0, 'manufacturer', datetime('now'), datetime('now'))`,
        [uuidv4(), productId, payload.sku.trim()]
      )
    } catch (barcodeErr) {
      console.warn('Barcode already exists in barcodes table or non-fatal error:', barcodeErr)
    }
  }

  // 3. Create initial inventory movement
  await db.execute(
    `INSERT INTO inventory_movements (
       id, product_id, type, quantity, stock_before, stock_after, reason, user_id, created_at
     ) VALUES (?, ?, 'initial', ?, 0, ?, 'Initial creation from MAKERS import', ?, datetime('now'))`,
    [uuidv4(), productId, initialQty, initialQty, userId || null]
  )

  return { productId, sku: finalSku }
}

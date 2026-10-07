/**
 * MAKERS Product Service
 * Handles searching, mapping, duplicate detection, stock additions, and persistence
 */

import { v4 as uuidv4 } from 'uuid'
import { AppDatabase } from '@/services/db/database'
import { fetchMakersProducts, fetchMakersProductById } from './client'
import { mapMakersProduct, isValidImageUrl, parseWebsitePrice, toMakersCdnUrl } from './mapper'
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
       WHERE is_active = 1 AND external_product_id = ?
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
       WHERE is_active = 1 AND external_sku = ?
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
       WHERE p.is_active = 1 AND pb.barcode = ?
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
       WHERE is_active = 1 AND sku = ?
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
 * Save an imported product, its barcode, and its initial inventory movement.
 * If the product was previously soft-deleted (is_active = 0), this reactivates
 * and updates the existing record with fresh data, ensuring zero UNIQUE constraint collision.
 */
export async function saveImportedProduct(
  db: AppDatabase,
  payload: SaveImportedProductPayload,
  userId?: string | null
): Promise<{ productId: string; sku: string; isReactivated?: boolean }> {
  try {
    const initialQty = Number(payload.initial_quantity) || 0
    const purchasePrice = Number(payload.purchase_price) || 0
    const sellingPrice = Number(payload.selling_price) || 0
    const minStock = Number(payload.min_stock) || 0

    // Resolve category
    let finalCategoryId = payload.category_id || null
    if (!finalCategoryId && payload.new_category_name) {
      finalCategoryId = await resolveOrCreateCategory(db, payload.new_category_name)
    }

    const finalSku = payload.sku ? payload.sku.trim() : `PRD-${Date.now().toString().slice(-6)}`
    const extId = payload.external_product_id ? String(payload.external_product_id).trim() : null
    const extSku = payload.external_sku ? payload.external_sku.trim() : null
    const cleanImagePath = (payload.image_path && isValidImageUrl(payload.image_path)) ? payload.image_path.trim() : null

    // Check if there is an existing inactive (soft-deleted) product record to reactivate and update
    let existingInactiveId: string | null = null

    // Priority 1: Match inactive by external_product_id
    if (extId) {
      const rows = await db.select<Array<{ id: string }>>(
        'SELECT id FROM products WHERE is_active = 0 AND external_product_id = ? LIMIT 1',
        [extId]
      )
      if (rows && rows.length > 0) {
        existingInactiveId = rows[0].id
      }
    }

    // Priority 2: Match inactive by external_sku
    if (!existingInactiveId && extSku) {
      const rows = await db.select<Array<{ id: string }>>(
        'SELECT id FROM products WHERE is_active = 0 AND (external_sku = ? OR sku = ?) LIMIT 1',
        [extSku, extSku]
      )
      if (rows && rows.length > 0) {
        existingInactiveId = rows[0].id
      }
    }

    // Priority 3: Match inactive by SKU
    if (!existingInactiveId && finalSku) {
      const rows = await db.select<Array<{ id: string }>>(
        'SELECT id FROM products WHERE is_active = 0 AND (sku = ? OR external_sku = ?) LIMIT 1',
        [finalSku, finalSku]
      )
      if (rows && rows.length > 0) {
        existingInactiveId = rows[0].id
      }
    }

    const finalProductId = existingInactiveId || uuidv4()

    // Safety: If there is any OTHER inactive product that holds this finalSku, release its SKU to prevent UNIQUE collision
    await db.execute(
      "UPDATE products SET sku = sku || '_del_' || substr(id, 1, 8), external_sku = NULL WHERE is_active = 0 AND sku = ? AND id != ?",
      [finalSku, finalProductId]
    )

    if (existingInactiveId) {
      // Reactivate and update existing product record with latest imported Makers data
      await db.execute(
        `UPDATE products SET
           sku = ?,
           name_ar = ?,
           name_en = ?,
           description = ?,
           category_id = ?,
           unit_id = ?,
           default_supplier_id = ?,
           purchase_price = ?,
           selling_price = ?,
           current_stock = ?,
           min_stock = ?,
           image_path = ?,
           is_active = 1,
           notes = ?,
           drawer_location = ?,
           footprint_package = ?,
           datasheet_url = ?,
           source_type = 'MAKERS_WEBSITE',
           external_product_id = ?,
           external_sku = ?,
           external_url = ?,
           website_price = ?,
           last_synced_at = datetime('now'),
           updated_at = datetime('now')
         WHERE id = ?`,
        [
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
          cleanImagePath,
          payload.notes || null,
          payload.drawer_location || null,
          payload.footprint_package || null,
          payload.datasheet_url || null,
          extId,
          extSku || finalSku,
          payload.external_url || null,
          payload.website_price || null,
          finalProductId,
        ]
      )
    } else {
      // Insert brand new product record
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
          finalProductId,
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
          cleanImagePath,
          payload.notes || null,
          payload.drawer_location || null,
          payload.footprint_package || null,
          payload.datasheet_url || null,
          extId,
          extSku || finalSku,
          payload.external_url || null,
          payload.website_price || null,
        ]
      )
    }

    // 2. Store / update manufacturer barcode
    if (payload.sku) {
      try {
        await db.execute(
          'DELETE FROM product_barcodes WHERE barcode = ? AND product_id != ?',
          [payload.sku.trim(), finalProductId]
        )

        await db.execute(
          `INSERT OR REPLACE INTO product_barcodes (
             id, product_id, barcode, type, is_default, is_printed, source, created_at, updated_at
           ) VALUES (?, ?, ?, 'code128', 1, 0, 'manufacturer', datetime('now'), datetime('now'))`,
          [uuidv4(), finalProductId, payload.sku.trim()]
        )
      } catch (barcodeErr) {
        console.warn('Barcode upsert warning:', barcodeErr)
      }
    }

    // 3. Create initial inventory movement
    const movementReason = existingInactiveId
      ? 'Re-imported from MAKERS website after deletion'
      : 'Initial creation from MAKERS import'

    await db.execute(
      `INSERT INTO inventory_movements (
         id, product_id, type, quantity, stock_before, stock_after, reason, user_id, created_at
       ) VALUES (?, ?, 'initial', ?, 0, ?, ?, ?, datetime('now'))`,
      [uuidv4(), finalProductId, initialQty, initialQty, movementReason, userId || null]
    )

    return { productId: finalProductId, sku: finalSku, isReactivated: !!existingInactiveId }
  } catch (err: any) {
    console.error('❌ Error in saveImportedProduct:', {
      message: err?.message,
      code: err?.code,
      stack: err?.stack,
      payloadSku: payload.sku,
      payloadExtId: payload.external_product_id,
      payloadName: payload.name_en || payload.name_ar,
    })
    throw err
  }
}

/**
 * Download product image from MAKERS website and save to %APPDATA%/com.makers.pos/product_images/
 */
export async function downloadMakersProductImage(
  imageUrl: string,
  skuOrId: string
): Promise<string | null> {
  if (!imageUrl || !isValidImageUrl(imageUrl)) return null
  try {
    const isTauri = typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
    if (isTauri) {
      const { invoke } = await import('@tauri-apps/api/core')
      const sanitizedSku = (skuOrId || `img_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_')
      const filename = `${sanitizedSku}_1.jpg`
      const targetUrl = toMakersCdnUrl(imageUrl) || imageUrl
      const path = await invoke<string>('download_makers_image', {
        imageUrl: targetUrl,
        saveFilename: filename,
      })
      if (path && isValidImageUrl(path)) {
        return path
      }
    }
  } catch (err) {
    console.warn('Image download to local storage failed, will use remote image URL:', err)
  }
  return null
}

/**
 * Import a product directly from MAKERS Catalog with duplicate detection,
 * automatic category mapping, image downloading, and default commercial values.
 */
export async function importMakersProductDirect(
  db: AppDatabase,
  product: MakersMappedProduct,
  options?: {
    categoryId?: string | null
    unitId?: string
    purchasePriceRatio?: number
    defaultSupplierId?: string | null
    userId?: string | null
    sellingPriceOverride?: number
    purchasePriceOverride?: number
    stockOverride?: number
  }
): Promise<{
  status: 'success' | 'duplicate' | 'error'
  product?: { id: string; sku: string; name: string }
  existing?: any
  error?: string
}> {
  try {
    // 1. Check duplicate BEFORE import
    const dup = await checkDuplicateProduct(db, { id: product.id, sku: product.sku })
    if (dup.isDuplicate) {
      return {
        status: 'duplicate',
        existing: dup.matchedProduct,
        product: { id: dup.matchedProduct?.id || '', sku: product.sku, name: product.name },
      }
    }

    // 2. Resolve default Unit
    let unitId = options?.unitId
    if (!unitId) {
      const units = await db.select<Array<{ id: string }>>('SELECT id FROM product_units WHERE is_active = 1 LIMIT 1')
      unitId = units && units.length > 0 ? units[0].id : 'unit_piece'
    }

    // 3. Resolve Category
    let categoryId = options?.categoryId || null
    if (!categoryId && product.categories && product.categories.length > 0) {
      categoryId = await resolveOrCreateCategory(db, product.categories[0])
    }

    // 4. Download main image or preserve primary image URL
    let imagePath: string | null = null
    const targetImageUrl = (product.imageUrl && isValidImageUrl(product.imageUrl))
      ? product.imageUrl
      : (product.images && product.images.length > 0 && isValidImageUrl(product.images[0]))
        ? product.images[0]
        : null

    if (targetImageUrl) {
      console.log('[Import] Product:', product.name)
      console.log('[Import] Image URL from API:', targetImageUrl)
      try {
        console.log('[Import] Attempting download...')
        const downloadedLocalPath = await downloadMakersProductImage(targetImageUrl, product.sku || String(product.id))
        console.log('[Import] Image saved to:', downloadedLocalPath)
        imagePath = (downloadedLocalPath && isValidImageUrl(downloadedLocalPath)) ? downloadedLocalPath : targetImageUrl
      } catch (imgErr) {
        console.warn('Image download attempt failed, saving remote URL fallback:', imgErr)
        imagePath = targetImageUrl
      }
      console.log('[Import] Setting image_path:', imagePath)
    }

    // 5. Calculate prices (use overrides if provided)
    const defaultSellingPrice = product.websitePrice || 0
    const sellingPrice = options?.sellingPriceOverride != null && options.sellingPriceOverride > 0
      ? options.sellingPriceOverride
      : defaultSellingPrice
    const ratio = options?.purchasePriceRatio ?? 0.7
    const purchasePrice = options?.purchasePriceOverride != null && options.purchasePriceOverride > 0
      ? options.purchasePriceOverride
      : Math.round(defaultSellingPrice * ratio * 100) / 100
    const initialStock = options?.stockOverride != null && options.stockOverride >= 0
      ? options.stockOverride
      : 0

    // 6. Save product
    const payload: SaveImportedProductPayload = {
      external_product_id: String(product.id),
      external_sku: product.sku || `PRD-${product.id}`,
      external_url: product.permalink,
      website_price: product.websitePrice,
      name_en: product.name,
      name_ar: product.name,
      sku: product.sku || `PRD-${product.id}`,
      description: product.description || product.shortDescription || '',
      image_path: imagePath,
      category_id: categoryId,
      unit_id: unitId,
      purchase_price: purchasePrice,
      selling_price: sellingPrice,
      initial_quantity: initialStock,
      min_stock: 0,
      drawer_location: null,
      footprint_package: product.footprintPackage,
      datasheet_url: product.datasheetUrl,
      default_supplier_id: options?.defaultSupplierId || null,
      notes: null,
    }

    const saved = await saveImportedProduct(db, payload, options?.userId)
    return {
      status: 'success',
      product: { id: saved.productId, sku: saved.sku, name: product.name },
    }
  } catch (err: any) {
    console.error('❌ Failed to import MAKERS product:', {
      error: err?.message,
      code: err?.code,
      stack: err?.stack,
      rawError: err,
      productId: product.id,
      sku: product.sku,
      productName: product.name,
    })
    return {
      status: 'error',
      product: { id: '', sku: product.sku, name: product.name },
      error: err?.message || 'Unknown error importing product',
    }
  }
}

export interface BackfillProgress {
  current: number
  total: number
  updated: number
  skipped: number
  failed: number
  currentProductName: string
}

/**
 * Backfill missing images for already imported products without changing prices, stock, or names.
 */
export async function backfillMissingProductImages(
  db: AppDatabase,
  onProgress?: (progress: BackfillProgress) => void
): Promise<{ updated: number; skipped: number; failed: number }> {
  // Find active products where image_path is missing or invalid
  const productsWithoutImages = await db.select<Array<{
    id: string
    sku: string
    name_ar: string
    name_en: string
    external_product_id?: string | null
    external_sku?: string | null
    image_path?: string | null
  }>>(
    `SELECT id, sku, name_ar, name_en, external_product_id, external_sku, image_path
     FROM products
     WHERE is_active = 1
       AND (image_path IS NULL OR TRIM(image_path) = '' OR image_path = 'null' OR image_path = 'undefined')`
  )

  const stats = { updated: 0, skipped: 0, failed: 0 }
  const total = productsWithoutImages.length

  for (let i = 0; i < total; i++) {
    const prod = productsWithoutImages[i]
    if (onProgress) {
      onProgress({
        current: i + 1,
        total,
        updated: stats.updated,
        skipped: stats.skipped,
        failed: stats.failed,
        currentProductName: prod.name_ar || prod.name_en || prod.sku,
      })
    }

    try {
      let rawProduct: any = null

      // Priority 1: Match by WooCommerce/Makers Product ID
      if (prod.external_product_id && /^\d+$/.test(prod.external_product_id)) {
        try {
          rawProduct = await fetchMakersProductById(prod.external_product_id)
        } catch {
          // Fallback to SKU search if ID lookup fails
        }
      }

      // Priority 2: Match by SKU / external_sku
      const searchSku = (prod.external_sku || prod.sku || '').trim()
      if (!rawProduct && searchSku) {
        try {
          const searchRes = await fetchMakersProducts(searchSku, 1, 5)
          if (searchRes.products && searchRes.products.length > 0) {
            const match = searchRes.products.find(
              (p) => (p.sku && p.sku.trim().toLowerCase() === searchSku.toLowerCase()) || String(p.id) === prod.external_product_id
            ) || searchRes.products[0]
            rawProduct = match
          }
        } catch {
          // Search failed
        }
      }

      if (!rawProduct) {
        stats.skipped++
        continue
      }

      const mapped = mapMakersProduct(rawProduct)
      const targetImageUrl = (mapped.imageUrl && isValidImageUrl(mapped.imageUrl))
        ? mapped.imageUrl
        : (mapped.images && mapped.images.length > 0 && isValidImageUrl(mapped.images[0]))
          ? mapped.images[0]
          : null

      if (targetImageUrl) {
        let savedPath = await downloadMakersProductImage(targetImageUrl, prod.sku || prod.id)
        if (!savedPath || !isValidImageUrl(savedPath)) {
          savedPath = targetImageUrl
        }

        // ONLY update image_path (never modify prices, stock, names, or SKUs)
        await db.execute(
          `UPDATE products
           SET image_path = ?,
               updated_at = datetime('now')
           WHERE id = ? AND (image_path IS NULL OR TRIM(image_path) = '' OR image_path = 'null' OR image_path = 'undefined')`,
          [savedPath, prod.id]
        )
        stats.updated++
      } else {
        stats.skipped++
      }
    } catch (err) {
      console.warn(`Failed to backfill image for product ${prod.id}:`, err)
      stats.failed++
    }
  }

  return stats
}

export const makersService = {
  searchCatalog: async (query: string) => {
    const res = await fetchMakersProducts(query, 1, 10)
    return res.products
  },
  fetchProductDetail: async (id: number | string) => {
    const raw = await fetchMakersProductById(id)
    return {
      ...raw,
      price: parseWebsitePrice(raw.prices),
    }
  },
  getDetails: getMakersProductDetails,
  checkDuplicate: checkDuplicateProduct,
  saveProduct: saveImportedProduct,
  downloadImage: downloadMakersProductImage,
}



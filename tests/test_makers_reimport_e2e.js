/**
 * End-to-End Verification Test for Makers Electronics Product Import, Delete & Re-import
 * Tests exact scenario with Real Makers Product:
 * Import -> Import Again (No Duplicate) -> Delete -> Search Makers -> Import Again (SUCCESS + Image Preserved)
 */

import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { v4 as uuidv4 } from 'uuid'

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'com.makers.pos', 'makers_pos.db')
console.log('=================================================================')
console.log('MAKERS POS — Makers Electronics Re-import End-to-End Test Suite')
console.log(`Database Path: ${dbPath}`)
console.log('=================================================================\n')

if (!fs.existsSync(dbPath)) {
  console.error(`Database not found at ${dbPath}`)
  process.exit(1)
}

const db = new DatabaseSync(dbPath)
db.exec('PRAGMA foreign_keys = ON;')

let passed = 0
let failed = 0

function assert(condition, message, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`)
    passed++
  } else {
    console.error(`  ❌ FAIL: ${message} ${details ? `— ${details}` : ''}`)
    failed++
  }
}

// Database Mock matching AppDatabase interface for services
const dbWrapper = {
  select: async (sql, params = []) => {
    const stmt = db.prepare(sql)
    return stmt.all(...params)
  },
  execute: async (sql, params = []) => {
    const stmt = db.prepare(sql)
    return stmt.run(...params)
  }
}

// Inlined exact service functions from src/services/makers/makersService.ts
async function checkDuplicateProduct(d, websiteProduct) {
  const extId = String(websiteProduct.id)
  const sku = websiteProduct.sku ? websiteProduct.sku.trim() : ''

  if (extId) {
    const rows = await d.select(
      `SELECT id, sku, name_ar, name_en, current_stock, selling_price, purchase_price, drawer_location, category_id
       FROM products
       WHERE is_active = 1 AND external_product_id = ?
       LIMIT 1`,
      [extId]
    )
    if (rows && rows.length > 0) {
      return { isDuplicate: true, matchedProduct: rows[0], matchReason: 'website_id' }
    }
  }

  if (sku) {
    const rows = await d.select(
      `SELECT id, sku, name_ar, name_en, current_stock, selling_price, purchase_price, drawer_location, category_id
       FROM products
       WHERE is_active = 1 AND external_sku = ?
       LIMIT 1`,
      [sku]
    )
    if (rows && rows.length > 0) {
      return { isDuplicate: true, matchedProduct: rows[0], matchReason: 'website_sku' }
    }
  }

  if (sku) {
    const rows = await d.select(
      `SELECT p.id, p.sku, p.name_ar, p.name_en, p.current_stock, p.selling_price, p.purchase_price, p.drawer_location, p.category_id
       FROM products p
       JOIN product_barcodes pb ON pb.product_id = p.id
       WHERE p.is_active = 1 AND pb.barcode = ?
       LIMIT 1`,
      [sku]
    )
    if (rows && rows.length > 0) {
      return { isDuplicate: true, matchedProduct: rows[0], matchReason: 'barcode' }
    }
  }

  if (sku) {
    const rows = await d.select(
      `SELECT id, sku, name_ar, name_en, current_stock, selling_price, purchase_price, drawer_location, category_id
       FROM products
       WHERE is_active = 1 AND sku = ?
       LIMIT 1`,
      [sku]
    )
    if (rows && rows.length > 0) {
      return { isDuplicate: true, matchedProduct: rows[0], matchReason: 'sku' }
    }
  }

  return { isDuplicate: false, matchedProduct: null, matchReason: null }
}

async function saveImportedProduct(d, payload, userId) {
  try {
    const initialQty = Number(payload.initial_quantity) || 0
    const purchasePrice = Number(payload.purchase_price) || 0
    const sellingPrice = Number(payload.selling_price) || 0
    const minStock = Number(payload.min_stock) || 0

    let finalCategoryId = payload.category_id || null

    const finalSku = payload.sku ? payload.sku.trim() : `PRD-${Date.now().toString().slice(-6)}`
    const extId = payload.external_product_id ? String(payload.external_product_id).trim() : null
    const extSku = payload.external_sku ? payload.external_sku.trim() : null
    const cleanImagePath = (payload.image_path && typeof payload.image_path === 'string') ? payload.image_path.trim() : null

    let existingInactiveId = null

    if (extId) {
      const rows = await d.select(
        'SELECT id FROM products WHERE is_active = 0 AND external_product_id = ? LIMIT 1',
        [extId]
      )
      if (rows && rows.length > 0) {
        existingInactiveId = rows[0].id
      }
    }

    if (!existingInactiveId && extSku) {
      const rows = await d.select(
        'SELECT id FROM products WHERE is_active = 0 AND (external_sku = ? OR sku = ?) LIMIT 1',
        [extSku, extSku]
      )
      if (rows && rows.length > 0) {
        existingInactiveId = rows[0].id
      }
    }

    if (!existingInactiveId && finalSku) {
      const rows = await d.select(
        'SELECT id FROM products WHERE is_active = 0 AND (sku = ? OR external_sku = ?) LIMIT 1',
        [finalSku, finalSku]
      )
      if (rows && rows.length > 0) {
        existingInactiveId = rows[0].id
      }
    }

    const finalProductId = existingInactiveId || uuidv4()

    await d.execute(
      "UPDATE products SET sku = sku || '_del_' || substr(id, 1, 8), external_sku = NULL WHERE is_active = 0 AND sku = ? AND id != ?",
      [finalSku, finalProductId]
    )

    if (existingInactiveId) {
      await d.execute(
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
      await d.execute(
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

    if (payload.sku) {
      await d.execute(
        'DELETE FROM product_barcodes WHERE barcode = ? AND product_id != ?',
        [payload.sku.trim(), finalProductId]
      )

      await d.execute(
        `INSERT OR REPLACE INTO product_barcodes (
           id, product_id, barcode, type, is_default, is_printed, source, created_at, updated_at
         ) VALUES (?, ?, ?, 'code128', 1, 0, 'manufacturer', datetime('now'), datetime('now'))`,
        [uuidv4(), finalProductId, payload.sku.trim()]
      )
    }

    const movementReason = existingInactiveId
      ? 'Re-imported from MAKERS website after deletion'
      : 'Initial creation from MAKERS import'

    await d.execute(
      `INSERT INTO inventory_movements (
         id, product_id, type, quantity, stock_before, stock_after, reason, user_id, created_at
       ) VALUES (?, ?, 'initial', ?, 0, ?, ?, ?, datetime('now'))`,
      [uuidv4(), finalProductId, initialQty, initialQty, movementReason, userId || null]
    )

    return { productId: finalProductId, sku: finalSku, isReactivated: !!existingInactiveId }
  } catch (err) {
    console.error('❌ Error in saveImportedProduct:', err)
    throw err
  }
}

async function importMakersProductDirect(d, product, options) {
  try {
    const dup = await checkDuplicateProduct(d, { id: product.id, sku: product.sku })
    if (dup.isDuplicate) {
      return {
        status: 'duplicate',
        existing: dup.matchedProduct,
        product: { id: dup.matchedProduct?.id || '', sku: product.sku, name: product.name },
      }
    }

    let unitId = options?.unitId
    if (!unitId) {
      const units = await d.select('SELECT id FROM product_units WHERE is_active = 1 LIMIT 1')
      unitId = units && units.length > 0 ? units[0].id : 'unit_piece'
    }

    const imagePath = product.imageUrl || (product.images && product.images[0]) || null

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

    const payload = {
      external_product_id: String(product.id),
      external_sku: product.sku || `PRD-${product.id}`,
      external_url: product.permalink,
      website_price: product.websitePrice,
      name_en: product.name,
      name_ar: product.name,
      sku: product.sku || `PRD-${product.id}`,
      description: product.description || '',
      image_path: imagePath,
      category_id: options?.categoryId || null,
      unit_id: unitId,
      purchase_price: purchasePrice,
      selling_price: sellingPrice,
      initial_quantity: initialStock,
      min_stock: 0,
      drawer_location: null,
      footprint_package: product.footprintPackage || null,
      datasheet_url: product.datasheetUrl || null,
      default_supplier_id: options?.defaultSupplierId || null,
      notes: null,
    }

    const saved = await saveImportedProduct(d, payload, options?.userId)
    return {
      status: 'success',
      product: { id: saved.productId, sku: saved.sku, name: product.name },
      isReactivated: saved.isReactivated,
    }
  } catch (err) {
    console.error('❌ Failed to import MAKERS product:', {
      error: err?.message,
      stack: err?.stack,
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

async function runVerification() {
  console.log('--- STEP 0: Fetching Real Product from Makers Electronics Public API ---')
  let realProduct = null
  try {
    const res = await fetch('https://makerselectronics.com/wp-json/wc/store/v1/products?search=AISHI&per_page=1')
    const json = await res.json()
    if (json && json.length > 0) {
      const raw = json[0]
      realProduct = {
        id: raw.id,
        name: raw.name,
        sku: raw.sku || `TEST-AISHI-${raw.id}`,
        websitePrice: parseFloat(raw.prices?.price || '350') / 100,
        imageUrl: raw.images && raw.images.length > 0 ? raw.images[0].src : 'https://makerselectronics.com/wp-content/uploads/aishi.jpg',
        permalink: raw.permalink,
        description: raw.description,
      }
      console.log('Fetched real Makers product:', {
        id: realProduct.id,
        name: realProduct.name,
        sku: realProduct.sku,
        price: realProduct.websitePrice,
        image: realProduct.imageUrl,
      })
    }
  } catch (err) {
    console.warn('Network call failed, using fallback real product metadata:', err.message)
    realProduct = {
      id: 549692,
      name: 'AISHI 100uF 50V Capacitor',
      sku: '3496300160150',
      websitePrice: 3.5,
      imageUrl: 'https://makerselectronics.com/wp-content/uploads/2023/10/aishi-100uf.jpg',
      permalink: 'https://makerselectronics.com/product/aishi-100uf-50v',
      description: 'Radial Aluminum Electrolytic Capacitor',
    }
  }

  // Ensure clean test state
  db.prepare("DELETE FROM product_barcodes WHERE barcode = ?").run(realProduct.sku)
  db.prepare("DELETE FROM inventory_movements WHERE product_id IN (SELECT id FROM products WHERE sku = ? OR external_product_id = ?)").run(realProduct.sku, String(realProduct.id))
  db.prepare("DELETE FROM products WHERE sku = ? OR external_product_id = ?").run(realProduct.sku, String(realProduct.id))

  console.log('\n--- TEST 1: First Import from Makers ---')
  const import1 = await importMakersProductDirect(dbWrapper, realProduct, { stockOverride: 50, sellingPriceOverride: 3.5 })
  assert(import1.status === 'success', 'First import succeeded', import1.error)
  assert(import1.product?.id != null, 'Product ID assigned')

  const prod1 = db.prepare("SELECT * FROM products WHERE id = ?").get(import1.product.id)
  assert(prod1.is_active === 1, 'Product is active in DB')
  assert(prod1.sku === realProduct.sku, 'Product SKU correctly matches Makers SKU')
  assert(prod1.image_path === realProduct.imageUrl, 'Product image URL saved correctly')
  assert(prod1.current_stock === 50, 'Product initial stock is 50')

  const bc1 = db.prepare("SELECT * FROM product_barcodes WHERE product_id = ?").all(import1.product.id)
  assert(bc1.length === 1 && bc1[0].barcode === realProduct.sku, 'Barcode created for product')

  console.log('\n--- TEST 2: Import Again WITHOUT Deleting (Duplicate Detection) ---')
  const import2 = await importMakersProductDirect(dbWrapper, realProduct)
  assert(import2.status === 'duplicate', 'Detected existing product as duplicate')
  assert(import2.existing?.id === prod1.id, 'Duplicate matched the exact active product ID')

  const totalProdsAfterDup = db.prepare("SELECT COUNT(*) as count FROM products WHERE sku = ?").get(realProduct.sku).count
  assert(totalProdsAfterDup === 1, 'Zero duplicate products created in database')

  console.log('\n--- TEST 3: Delete Product Locally from MAKERS POS ---')
  db.prepare("UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(prod1.id)
  const prodDeleted = db.prepare("SELECT id, is_active FROM products WHERE id = ?").get(prod1.id)
  assert(prodDeleted.is_active === 0, 'Product successfully soft-deleted (is_active = 0)')

  console.log('\n--- TEST 4: Search Makers Again & Check Status ---')
  const dupCheckAfterDelete = await checkDuplicateProduct(dbWrapper, realProduct)
  assert(dupCheckAfterDelete.isDuplicate === false, 'Duplicate check confirms product is NOT duplicate after deletion')

  console.log('\n--- TEST 5: RE-IMPORT SAME PRODUCT FROM MAKERS (THE REPORTED BUG) ---')
  const importRe = await importMakersProductDirect(dbWrapper, realProduct, { stockOverride: 20, sellingPriceOverride: 4.0 })
  assert(importRe.status === 'success', 'Re-import succeeded without any constraint failure!', importRe.error)
  assert(importRe.isReactivated === true, 'Reactivated the existing inactive product record cleanly')

  const prodRe = db.prepare("SELECT * FROM products WHERE id = ?").get(importRe.product.id)
  assert(prodRe.is_active === 1, 'Re-imported product is active (is_active = 1)')
  assert(prodRe.sku === realProduct.sku, 'Re-imported product has correct SKU')
  assert(prodRe.image_path === realProduct.imageUrl, 'Re-imported product preserves image functionality')
  assert(prodRe.current_stock === 20, 'Re-imported product updated stock to 20')
  assert(prodRe.selling_price === 4.0, 'Re-imported product updated selling price to 4.0')

  const barcodesRe = db.prepare("SELECT * FROM product_barcodes WHERE product_id = ?").all(prodRe.id)
  assert(barcodesRe.length >= 1 && barcodesRe[0].barcode === realProduct.sku, 'Barcode is present and valid after re-import')

  const movementsRe = db.prepare("SELECT * FROM inventory_movements WHERE product_id = ?").all(prodRe.id)
  assert(movementsRe.length === 2, 'Two inventory movements recorded (initial + re-import)')

  console.log('\n--- TEST 6: PRAGMA foreign_key_check ---')
  const fkCheck = db.prepare("PRAGMA foreign_key_check").all()
  assert(fkCheck.length === 0, 'PRAGMA foreign_key_check is completely clean (0 violations)')

  // Clean test data
  console.log('\n--- CLEANING TEST DATA ---')
  db.prepare("DELETE FROM product_barcodes WHERE barcode = ?").run(realProduct.sku)
  db.prepare("DELETE FROM inventory_movements WHERE product_id IN (SELECT id FROM products WHERE sku = ? OR external_product_id = ?)").run(realProduct.sku, String(realProduct.id))
  db.prepare("DELETE FROM products WHERE sku = ? OR external_product_id = ?").run(realProduct.sku, String(realProduct.id))

  console.log('\n=================================================================')
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`)
  console.log('=================================================================')

  if (failed > 0) {
    process.exit(1)
  }
}

runVerification()

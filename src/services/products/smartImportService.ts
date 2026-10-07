/**
 * MAKERS POS — Smart Excel Import Service
 * Automatically searches and matches products from MAKERS website catalog
 * Auto-fills SKU, images, specifications, datasheets, while strictly using
 * the user's provided selling price and stock quantity from the Excel sheet.
 */

import * as XLSX from 'xlsx'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/services/db/database'
import { productService } from '@/services/products/productService'
import { auditService } from '@/services/audit/auditService'
import { makersService } from '@/services/makers'
import { resolveOrCreateCategory } from '@/services/makers/makersService'
import { extractFootprintPackage, extractDatasheetUrl, toMakersCdnUrl } from '@/services/makers/mapper'

export interface SmartImportRow {
  rowNumber: number
  productName: string
  quantity: number
  sellingPrice: number
}

export interface SmartImportResult {
  rowNumber: number
  status: 'success' | 'not_found' | 'duplicate' | 'error'
  productName: string
  sku?: string
  error?: string
  matchedProduct?: any
}

/**
 * Match existing category by name or create a new one
 */
async function matchOrCreateCategory(cat: any): Promise<string | null> {
  if (!cat) return null
  const catName = typeof cat === 'string' ? cat : (cat.name || '')
  if (!catName || !catName.trim()) return null
  const db = getDb()
  return await resolveOrCreateCategory(db, catName.trim())
}

/**
 * Get default unit ID (Piece / قطعة)
 */
async function getDefaultUnit(): Promise<string> {
  return await productService.findOrCreateUnit('قطعة', 'Piece', 'pcs')
}

/**
 * Extract attribute value like Package or Datasheet from product detail
 */
function extractAttribute(detail: any, attrName: string): string | null {
  if (!detail) return null

  // 1. Check raw attributes array from WooCommerce
  if (Array.isArray(detail.attributes)) {
    const target = attrName.toLowerCase()
    const found = detail.attributes.find((a: any) =>
      a.name && a.name.toLowerCase() === target
    )
    if (found) {
      if (Array.isArray(found.terms) && found.terms.length > 0) {
        return found.terms[0].name || null
      }
      if (typeof found.options === 'string') return found.options
      if (Array.isArray(found.options) && found.options.length > 0) return found.options[0]
    }
  }

  // 2. Pattern extraction heuristics
  if (attrName.toLowerCase().includes('package')) {
    return extractFootprintPackage(detail.name || '', detail.description || '')
  }
  if (attrName.toLowerCase().includes('datasheet')) {
    return extractDatasheetUrl(detail.description || '')
  }

  return null
}

/**
 * Process Excel file with automatic MAKERS lookup
 */
export async function importFromExcel(
  file: File,
  userId: string,
  onProgress: (current: number, total: number, item: string) => void
): Promise<SmartImportResult[]> {
  const db = getDb()

  // 1. Parse Excel
  const workbook = XLSX.read(await file.arrayBuffer())
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 })

  // 2. Skip header row
  const dataRows = rows.slice(1).filter(r => r && r[0])

  const results: SmartImportResult[] = []

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    const rowNumber = i + 2
    const productName = String(row[0] || '').trim()
    const quantity = Number(row[1]) || 0
    const sellingPrice = Number(row[2]) || 0

    onProgress(i + 1, dataRows.length, productName)

    if (!productName) {
      results.push({
        rowNumber,
        status: 'error',
        productName: '(فارغ)',
        error: 'اسم المنتج مطلوب',
      })
      continue
    }

    if (quantity <= 0 || sellingPrice <= 0) {
      results.push({
        rowNumber,
        status: 'error',
        productName,
        error: 'الكمية والسعر يجب أن يكونا أكبر من صفر',
      })
      continue
    }

    try {
      // 3. Search MAKERS by name
      const searchResults = await makersService.searchCatalog(productName)

      if (!searchResults || searchResults.length === 0) {
        results.push({
          rowNumber,
          status: 'not_found',
          productName,
          error: 'مش موجود في موقع MAKERS',
        })
        continue
      }

      const bestMatch = searchResults[0]

      // 4. Check if already imported
      if (bestMatch.sku) {
        const existing = await db.select<any[]>(
          `SELECT id FROM products WHERE (external_sku = ? OR sku = ?) AND is_active = 1`,
          [bestMatch.sku, bestMatch.sku]
        )
        if (existing && existing.length > 0) {
          results.push({
            rowNumber,
            status: 'duplicate',
            productName,
            sku: bestMatch.sku,
            error: 'موجود مسبقاً في النظام',
          })
          continue
        }
      }

      // 5. Fetch full product detail
      const detail = await makersService.fetchProductDetail(bestMatch.id)

      // 6. Create product — CRITICAL: USER'S price, NOT website price
      const productData = {
        sku: detail.sku || `MKR-${Date.now()}-${i}`,
        name_ar: detail.name,
        name_en: detail.name,
        description: detail.description || '',
        category_id: await matchOrCreateCategory(detail.categories?.[0]),
        unit_id: await getDefaultUnit(),

        // ⚠️ USER PROVIDES THESE — USE THEM DIRECTLY:
        selling_price: sellingPrice,           // ← USER'S PRICE (NEVER website price)
        current_stock: quantity,                // ← USER'S QUANTITY

        // Auto-computed from user's price:
        purchase_price: Math.round(sellingPrice * 0.7 * 100) / 100,

        min_stock: 0,
        image_path: null as string | null,
        footprint_package: extractAttribute(detail, 'Package'),
        datasheet_url: extractAttribute(detail, 'Datasheet'),
        source_type: 'MAKERS_WEBSITE',
        external_product_id: String(detail.id),
        external_sku: detail.sku,
        external_url: detail.permalink,
        website_price: detail.price ?? null,  // ← reference only, NOT used for sale
        last_synced_at: new Date().toISOString(),
        is_active: 1,
      }

      // 7. Download main image
      console.log('[Import] Product:', detail.name)
      const rawImgUrl = detail.images?.[0]?.src || (typeof detail.images?.[0] === 'string' ? detail.images[0] : null)
      console.log('[Import] Image URL from API:', rawImgUrl)

      if (rawImgUrl) {
        try {
          const imgSrc = toMakersCdnUrl(rawImgUrl) || rawImgUrl
          console.log('[Import] Attempting download...')
          const filename = `${detail.sku || `MKR_${Date.now()}`}_1.jpg`
          const isTauriEnv = typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
          if (isTauriEnv) {
            const { invoke } = await import('@tauri-apps/api/core')
            const savedPath = await invoke<string>('download_makers_image', {
              imageUrl: imgSrc,
              saveFilename: filename,
            })
            console.log('[Import] Image saved to:', savedPath)
            productData.image_path = savedPath
          } else {
            productData.image_path = imgSrc
          }
        } catch (imgErr) {
          console.warn('[Import] Image download failed:', imgErr)
          productData.image_path = toMakersCdnUrl(rawImgUrl) || rawImgUrl
        }
      }
      console.log('[Import] Setting image_path:', productData.image_path)

      // 8. Save product
      const product = await productService.create(productData, { id: userId })

      // 9. Save barcode
      if (detail.sku) {
        try {
          const existingBc = await db.select<any[]>(
            `SELECT id FROM product_barcodes WHERE product_id = ? AND barcode = ?`,
            [product.id, detail.sku]
          )
          if (!existingBc || existingBc.length === 0) {
            await db.execute(
              `INSERT INTO product_barcodes (id, product_id, barcode, type, is_default, source)
               VALUES (?, ?, ?, 'code128', 1, 'auto')`,
              [uuidv4(), product.id, detail.sku]
            )
          }
        } catch (bcErr) {
          console.warn('Barcode insert skipped or existing:', bcErr)
        }
      }

      results.push({
        rowNumber,
        status: 'success',
        productName,
        sku: detail.sku,
        matchedProduct: detail,
      })
    } catch (err: any) {
      results.push({
        rowNumber,
        status: 'error',
        productName,
        error: String(err?.message || err),
      })
    }
  }

  const successCount = results.filter(r => r.status === 'success').length
  try {
    await auditService.log({
      action: 'bulk_import_excel',
      userId,
      details: {
        total: results.length,
        success: successCount,
        notFound: results.filter(r => r.status === 'not_found').length,
        duplicates: results.filter(r => r.status === 'duplicate').length,
        errors: results.filter(r => r.status === 'error').length,
      },
    })
  } catch (auditErr) {
    console.warn('[smartImportService] Audit log failed:', auditErr)
  }

  return results
}

/**
 * MAKERS POS — Excel Product Import & Export Service
 * Utilizes SheetJS (xlsx) for genuine .xlsx file generation and parsing.
 */

import * as XLSX from 'xlsx'
import { getDb } from '@/services/db/database'
import { productService, ProductListItem, CreateProductInput } from '@/services/products/productService'
import { v4 as uuidv4 } from 'uuid'

export interface ExcelImportRow {
  rowNumber: number
  nameAr: string
  nameEn: string
  sku: string
  barcode?: string
  categoryName?: string
  brandName?: string
  unitSymbol?: string
  purchasePrice: number
  sellingPrice: number
  initialStock: number
  minStockLevel: number
  location?: string
  isValid: boolean
  errors: string[]
  warnings: string[]
  isDuplicateSku?: boolean
  isDuplicateBarcode?: boolean
}

export interface ExcelImportSummary {
  totalRows: number
  validCount: number
  warningCount: number
  errorCount: number
  duplicateCount: number
  rows: ExcelImportRow[]
}

export class ExcelProductService {
  /**
   * Export product list to a genuine .xlsx workbook and trigger browser download
   */
  async exportProductsToExcel(products: ProductListItem[], filename = 'MAKERS_POS_Products.xlsx'): Promise<void> {
    const data = products.map((p) => ({
      'ID': p.id,
      'الاسم بالعربية (Name Ar)': p.name_ar,
      'الاسم بالإنجليزية (Name En)': p.name_en || '',
      'كود الصنف (SKU)': p.sku,
      'الباركود (Barcode)': p.primary_barcode || '',
      'التصنيف (Category)': p.category_name || '',
      'الماركة (Brand)': p.brand_name || '',
      'الوحدة (Unit)': p.unit_name_ar || p.unit_symbol || 'قطعة',
      'سعر الشراء / التكلفة (Cost)': p.purchase_price,
      'سعر البيع (Price)': p.selling_price,
      'المخزون الحالي (Stock)': p.current_stock,
      'حد الطلب الأدنى (Min Stock)': p.min_stock,
      'مكان الدرج / الرف (Location)': p.drawer_location || '',
      'الحالة (Status)': p.is_active ? 'Active' : 'Inactive',
    }))

    const worksheet = XLSX.utils.json_to_sheet(data)
    
    // Auto-fit column widths
    const colWidths = Object.keys(data[0] || {}).map((key) => ({
      wch: Math.max(key.length * 2, 15),
    }))
    worksheet['!cols'] = colWidths

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products')

    // Generate buffer and trigger download
    XLSX.writeFile(workbook, filename)
  }

  /**
   * Parse an uploaded .xlsx file and validate rows against database schema and uniqueness rules
   */
  async parseAndValidateExcel(file: File): Promise<ExcelImportSummary> {
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]

    const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' })
    const db = getDb()

    // Query existing SKUs and Barcodes from database for fast duplicate checking
    const existingSkus = new Set(
      (await db.select<Array<{ sku: string }>>('SELECT sku FROM products')).map((r) => r.sku.trim().toLowerCase())
    )
    const existingBarcodes = new Set(
      (await db.select<Array<{ barcode: string }>>('SELECT barcode FROM product_barcodes')).map((r) => r.barcode.trim().toLowerCase())
    )

    // Query Categories, Brands, Units
    const categories = await productService.getCategories()
    const brands = await productService.getBrands()
    const units = await productService.getUnits()

    const seenSkusInFile = new Set<string>()
    const seenBarcodesInFile = new Set<string>()

    const parsedRows: ExcelImportRow[] = []
    let validCount = 0
    let warningCount = 0
    let errorCount = 0
    let duplicateCount = 0

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i]
      const rowNum = i + 2 // 1-indexed including header
      const errors: string[] = []
      const warnings: string[] = []

      // Extract fields flexibly
      const nameAr = (row['الاسم بالعربية (Name Ar)'] || row['name_ar'] || row['Name Ar'] || row['الاسم'] || row['Name'] || '').toString().trim()
      const nameEn = (row['الاسم بالإنجليزية (Name En)'] || row['name_en'] || row['Name En'] || '').toString().trim()
      let sku = (row['كود الصنف (SKU)'] || row['sku'] || row['SKU'] || '').toString().trim()
      const barcode = (row['الباركود (Barcode)'] || row['barcode'] || row['Barcode'] || '').toString().trim()
      const categoryName = (row['التصنيف (Category)'] || row['category'] || row['Category'] || '').toString().trim()
      const brandName = (row['الماركة (Brand)'] || row['brand'] || row['Brand'] || '').toString().trim()
      const unitSymbol = (row['الوحدة (Unit)'] || row['unit'] || row['Unit'] || 'قطعة').toString().trim()
      
      const purchasePrice = parseFloat(row['سعر الشراء / التكلفة (Cost)'] || row['purchase_price'] || row['Cost'] || 0) || 0
      const sellingPrice = parseFloat(row['سعر البيع (Price)'] || row['selling_price'] || row['Price'] || 0) || 0
      const initialStock = parseFloat(row['المخزون الحالي (Stock)'] || row['stock'] || row['Stock'] || 0) || 0
      const minStockLevel = parseFloat(row['حد الطلب الأدنى (Min Stock)'] || row['min_stock'] || 5) || 5
      const location = (row['مكان الدرج / الرف (Location)'] || row['location'] || row['Location'] || '').toString().trim()

      // Validation 1: Name is required
      if (!nameAr && !nameEn) {
        errors.push('اسم المنتج مطلوب (عربي أو إنجليزي)')
      }

      // Validation 2: Auto-generate SKU if empty, otherwise check uniqueness
      if (!sku) {
        sku = `SKU-${Date.now().toString().slice(-6)}-${i}`
        warnings.push(`تم إنشاء كود صنف تلقائي: ${sku}`)
      } else {
        const skuLower = sku.toLowerCase()
        if (seenSkusInFile.has(skuLower)) {
          errors.push(`كود الصنف مكرر داخل الملف: ${sku}`)
          duplicateCount++
        } else if (existingSkus.has(skuLower)) {
          errors.push(`كود الصنف موجود مسبقاً في قاعدة البيانات: ${sku}`)
          duplicateCount++
        }
        seenSkusInFile.add(skuLower)
      }

      // Validation 3: Barcode uniqueness
      if (barcode) {
        const bcLower = barcode.toLowerCase()
        if (seenBarcodesInFile.has(bcLower)) {
          errors.push(`الباركود مكرر داخل الملف: ${barcode}`)
          duplicateCount++
        } else if (existingBarcodes.has(bcLower)) {
          errors.push(`الباركود مسجل مسبقاً لمنتج آخر: ${barcode}`)
          duplicateCount++
        }
        seenBarcodesInFile.add(bcLower)
      }

      // Validation 4: Prices & Stock non-negative
      if (sellingPrice < 0) {
        errors.push('سعر البيع لا يمكن أن يكون سالباً')
      }
      if (purchasePrice < 0) {
        errors.push('سعر الشراء لا يمكن أن يكون سالباً')
      }
      if (initialStock < 0) {
        errors.push('كمية المخزون لا يمكن أن تكون سالبة')
      }

      const isValid = errors.length === 0
      if (isValid) {
        validCount++
      } else {
        errorCount++
      }
      if (warnings.length > 0) {
        warningCount++
      }

      parsedRows.push({
        rowNumber: rowNum,
        nameAr: nameAr || nameEn,
        nameEn: nameEn || nameAr,
        sku,
        barcode: barcode || undefined,
        categoryName: categoryName || undefined,
        brandName: brandName || undefined,
        unitSymbol: unitSymbol || 'قطعة',
        purchasePrice,
        sellingPrice,
        initialStock,
        minStockLevel,
        location: location || undefined,
        isValid,
        errors,
        warnings,
      })
    }

    return {
      totalRows: parsedRows.length,
      validCount,
      warningCount,
      errorCount,
      duplicateCount,
      rows: parsedRows,
    }
  }

  /**
   * Commit valid rows into the database inside a transaction
   */
  async commitValidRows(validRows: ExcelImportRow[], user: { id: string; fullName: string }): Promise<number> {
    const db = getDb()
    let imported = 0

    // Cache categories, brands, units map
    const categories = await productService.getCategories()
    const brands = await productService.getBrands()
    const units = await productService.getUnits()

    const catMap = new Map<string, string>()
    for (const c of categories) {
      if (c.name_ar) catMap.set(c.name_ar.trim().toLowerCase(), c.id)
      if (c.name_en) catMap.set(c.name_en.trim().toLowerCase(), c.id)
    }

    const brandMap = new Map<string, string>()
    for (const b of brands) {
      if (b.name) brandMap.set(b.name.trim().toLowerCase(), b.id)
    }

    const unitMap = new Map<string, string>()
    for (const u of units) {
      if (u.name_ar) unitMap.set(u.name_ar.trim().toLowerCase(), u.id)
      if (u.symbol) unitMap.set(u.symbol.trim().toLowerCase(), u.id)
    }

    const defaultUnitId = units.length > 0 ? units[0].id : 'unit-piece-default'

    for (const r of validRows) {
      if (!r.isValid) continue

      let categoryId: string | undefined = undefined
      if (r.categoryName) {
        const catKey = r.categoryName.trim().toLowerCase()
        categoryId = catMap.get(catKey)
        if (!categoryId) {
          // Create category on the fly
          const newCatId = await productService.createCategory({ nameAr: r.categoryName, nameEn: r.categoryName }, user)
          categoryId = newCatId
          catMap.set(catKey, categoryId)
        }
      }

      let brandId: string | undefined = undefined
      if (r.brandName) {
        const brandKey = r.brandName.trim().toLowerCase()
        brandId = brandMap.get(brandKey)
        if (!brandId) {
          // Create brand on the fly
          const newBrand = await productService.createBrand(r.brandName, user)
          brandId = newBrand.id
          brandMap.set(brandKey, brandId)
        }
      }

      let unitId = defaultUnitId
      if (r.unitSymbol) {
        const unitKey = r.unitSymbol.trim().toLowerCase()
        unitId = unitMap.get(unitKey) || defaultUnitId
      }

      const barcodes = r.barcode
        ? [{ barcode: r.barcode, type: 'code128', isDefault: true, source: 'manual' }]
        : []

      await productService.createProduct(
        {
          nameAr: r.nameAr,
          nameEn: r.nameEn,
          sku: r.sku,
          categoryId,
          brandId,
          unitId,
          purchasePrice: r.purchasePrice,
          sellingPrice: r.sellingPrice,
          currentStock: r.initialStock,
          minStock: r.minStockLevel,
          drawerLocation: r.location,
          barcodes,
        },
        user
      )

      imported++
    }

    return imported
  }
}

export const excelProductService = new ExcelProductService()

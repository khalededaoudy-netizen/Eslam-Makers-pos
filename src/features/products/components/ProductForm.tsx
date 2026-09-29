import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  X,
  Save,
  AlertCircle,
  MapPin,
  Cpu,
  Link,
  Sparkles,
  Truck,
  Package,
  Layers,
  CheckCircle,
  Scan,
  Plus,
  Trash2,
  Award,
  Tag,
} from 'lucide-react'
import { getDb } from '@/services/db/database'
import { generateSKU } from '@/lib/formatters'
import { MakersImportSection } from './MakersImportSection'
import { MakersProductPreviewModal } from './MakersProductPreviewModal'
import { MakersDuplicateModal } from './MakersDuplicateModal'
import {
  MakersMappedProduct,
  DuplicateCheckResult,
} from '@/services/makers/types'
import {
  checkDuplicateProduct,
  addStockToExistingProduct,
  saveImportedProduct,
  downloadMakersProductImage,
} from '@/services/makers/makersService'
import { ProductImage } from '@/components/common/ProductImage'
import {
  productService,
  CategoryItem,
  UnitItem,
  BrandItem,
  AttributeDefItem,
  ProductBarcodeItem,
} from '@/services/products/productService'
import { useAuthStore } from '@/stores/authStore'

export interface Supplier {
  id: string
  name: string
}

interface ProductFormProps {
  initialData?: any // if editing
  onClose: () => void
  onSaved: () => void
}

export function ProductForm({ initialData, onClose, onSaved }: ProductFormProps) {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [isEditing, setIsEditing] = useState(!!initialData)
  const [currentEditData, setCurrentEditData] = useState<any>(initialData)

  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [units, setUnits] = useState<UnitItem[]>([])
  const [brands, setBrands] = useState<BrandItem[]>([])
  const [attributeDefs, setAttributeDefs] = useState<AttributeDefItem[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Form Fields State
  const [formData, setFormData] = useState({
    name_ar: initialData?.name_ar || '',
    name_en: initialData?.name_en || '',
    sku: initialData?.sku || '',
    category_id: initialData?.category_id || '',
    unit_id: initialData?.unit_id || '',
    brand_id: initialData?.brand_id || '',
    purchase_price: initialData?.purchase_price?.toString() || '',
    selling_price: initialData?.selling_price?.toString() || '',
    initial_quantity: initialData?.current_stock?.toString() || '0',
    min_stock: initialData?.min_stock?.toString() || '0',
    description: initialData?.description || '',
    drawer_location: initialData?.drawer_location || '',
    footprint_package: initialData?.footprint_package || '',
    datasheet_url: initialData?.datasheet_url || '',
    image_path: initialData?.image_path || '',
    default_supplier_id: initialData?.default_supplier_id || '',
    notes: initialData?.notes || '',
    is_active: initialData?.is_active !== undefined ? Boolean(initialData.is_active) : true,
  })

  // Barcodes State
  const [barcodes, setBarcodes] = useState<ProductBarcodeItem[]>([])

  // Dynamic Attributes State: Record<attributeId, value>
  const [attributeValues, setAttributeValues] = useState<Record<string, string>>({})

  // MAKERS Website Import Specific State
  const [previewProduct, setPreviewProduct] = useState<MakersMappedProduct | null>(null)
  const [duplicateResult, setDuplicateResult] = useState<DuplicateCheckResult | null>(null)
  const [importedWebsiteMeta, setImportedWebsiteMeta] = useState<{
    id: number
    sku: string
    websitePrice: number
    permalink: string
    categoryName?: string
  } | null>(
    initialData?.source_type === 'MAKERS_WEBSITE'
      ? {
          id: Number(initialData.external_product_id) || 0,
          sku: initialData.external_sku || initialData.sku,
          websitePrice: initialData.website_price || 0,
          permalink: initialData.external_url || '',
        }
      : null
  )

  useEffect(() => {
    loadLookups()
  }, [])

  async function loadLookups() {
    try {
      const db = getDb()
      const [cats, uns, brs, defs, sups] = await Promise.all([
        productService.getCategories(),
        productService.getUnits(),
        productService.getBrands(),
        productService.getAttributeDefs(),
        db.select<Supplier[]>('SELECT id, name FROM suppliers WHERE is_active = 1 ORDER BY name'),
      ])

      setCategories(cats)
      setUnits(uns)
      setBrands(brs)
      setAttributeDefs(defs)
      setSuppliers(sups)

      // If adding new and unit not set, pick default unit
      if (!isEditing && !formData.unit_id && uns.length > 0) {
        setFormData((prev) => ({ ...prev, unit_id: uns[0].id }))
      }

      // If editing, load product barcodes and attribute values
      if (initialData?.id) {
        const full = await productService.getProductById(initialData.id)
        if (full) {
          setBarcodes(full.barcodes)
          const attrMap: Record<string, string> = {}
          full.attributes.forEach((a) => {
            attrMap[a.attributeId] = a.value
          })
          setAttributeValues(attrMap)
        }
      } else {
        // New product default barcode
        if (formData.sku) {
          setBarcodes([{ barcode: formData.sku, type: 'code128', isDefault: true, source: 'manual' }])
        }
      }
    } catch (err) {
      console.error('Failed to load lookups', err)
    }
  }

  const handleGenerateSKU = () => {
    let newSku = ''
    if (formData.name_en) {
      newSku = generateSKU(formData.name_en)
    } else if (formData.name_ar) {
      newSku = 'PRD-' + Date.now().toString().slice(-6)
    } else {
      newSku = 'PRD-' + Date.now().toString().slice(-6)
    }
    setFormData((prev) => ({ ...prev, sku: newSku }))

    // Update or add barcode if empty or matching old sku
    if (barcodes.length === 0 || (barcodes.length === 1 && barcodes[0].barcode === formData.sku)) {
      setBarcodes([{ barcode: newSku, type: 'code128', isDefault: true, source: 'manual' }])
    }
  }

  // Barcode Management Helpers
  const handleAddBarcode = () => {
    setBarcodes((prev) => [
      ...prev,
      {
        barcode: '',
        type: 'code128',
        isDefault: prev.length === 0,
        source: 'manual',
      },
    ])
  }

  const handleRemoveBarcode = (index: number) => {
    setBarcodes((prev) => {
      const next = [...prev]
      const wasDefault = next[index]?.isDefault
      next.splice(index, 1)
      if (wasDefault && next.length > 0) {
        next[0].isDefault = true
      }
      return next
    })
  }

  const handleBarcodeChange = (index: number, field: keyof ProductBarcodeItem, value: any) => {
    setBarcodes((prev) => {
      const next = [...prev]
      if (field === 'isDefault' && value === true) {
        // Only one can be default
        next.forEach((b, i) => {
          b.isDefault = i === index
        })
      } else {
        next[index] = { ...next[index], [field]: value }
      }
      return next
    })
  }

  // User clicked a search result card in the MAKERS import section
  const handleSelectMakersProduct = (product: MakersMappedProduct) => {
    setPreviewProduct(product)
  }

  // User confirmed "Import Product" from the preview modal
  const handleConfirmImport = async (product: MakersMappedProduct) => {
    setPreviewProduct(null)
    setError('')

    try {
      const db = getDb()
      // Duplicate Detection
      const dupCheck = await checkDuplicateProduct(db, {
        id: product.id,
        sku: product.sku,
      })

      if (dupCheck.isDuplicate) {
        setDuplicateResult(dupCheck)
        return
      }

      // Auto-map product data
      let matchedCategoryId = ''
      if (product.categories.length > 0) {
        const catName = product.categories[0].toLowerCase()
        const found = categories.find(
          (c) =>
            c.name_en.toLowerCase() === catName ||
            c.name_ar.toLowerCase() === catName ||
            catName.includes(c.name_en.toLowerCase())
        )
        if (found) {
          matchedCategoryId = found.id
        }
      }

      const importedSku = product.sku || formData.sku || generateSKU(product.name)

      // Try downloading image locally
      let localImagePath: string | null = null
      if (product.imageUrl) {
        localImagePath = await downloadMakersProductImage(product.imageUrl, importedSku)
      }

      setFormData((prev) => ({
        ...prev,
        name_en: product.name,
        name_ar: prev.name_ar || product.name,
        sku: importedSku,
        description: product.shortDescription || product.description || '',
        category_id: matchedCategoryId || prev.category_id,
        footprint_package: product.footprintPackage || prev.footprint_package,
        datasheet_url: product.datasheetUrl || prev.datasheet_url,
        image_path: localImagePath || product.imageUrl || prev.image_path,
        purchase_price: prev.purchase_price || (product.websitePrice ? (product.websitePrice * 0.7).toFixed(2) : ''),
        selling_price: prev.selling_price || (product.websitePrice ? product.websitePrice.toString() : ''),
        initial_quantity: prev.initial_quantity && prev.initial_quantity !== '0' ? prev.initial_quantity : '',
      }))

      if (importedSku) {
        setBarcodes([{ barcode: importedSku, type: 'code128', isDefault: true, source: 'manufacturer' }])
      }

      setImportedWebsiteMeta({
        id: product.id,
        sku: product.sku,
        websitePrice: product.websitePrice,
        permalink: product.permalink,
        categoryName: product.categories[0] || undefined,
      })

      setSuccessMessage(t('makersImport.productImportedSuccess'))
      setTimeout(() => setSuccessMessage(''), 4000)
    } catch (err: any) {
      console.error('Error during product import preparation:', err)
      setError(err.message || t('common.error'))
    }
  }

  // Duplicate Modal: Add stock to existing product
  const handleDuplicateAddStock = async (productId: string, quantityToAdd: number) => {
    try {
      const db = getDb()
      await addStockToExistingProduct(db, productId, quantityToAdd, user?.id)
      setDuplicateResult(null)
      onSaved()
    } catch (err: any) {
      console.error('Failed to add stock:', err)
      throw err
    }
  }

  // Duplicate Modal: Open existing product for editing
  const handleDuplicateOpenProduct = async (product: any) => {
    setDuplicateResult(null)
    const full = await productService.getProductById(product.id)
    if (full) {
      const fullP = full.product
      setCurrentEditData(fullP)
      setIsEditing(true)
      setFormData({
        name_ar: fullP.name_ar || '',
        name_en: fullP.name_en || '',
        sku: fullP.sku || '',
        category_id: fullP.category_id || '',
        unit_id: fullP.unit_id || '',
        brand_id: fullP.brand_id || '',
        purchase_price: fullP.purchase_price?.toString() || '',
        selling_price: fullP.selling_price?.toString() || '',
        initial_quantity: fullP.current_stock?.toString() || '0',
        min_stock: fullP.min_stock?.toString() || '0',
        description: fullP.description || '',
        drawer_location: fullP.drawer_location || '',
        footprint_package: fullP.footprint_package || '',
        datasheet_url: fullP.datasheet_url || '',
        image_path: fullP.image_path || '',
        default_supplier_id: fullP.default_supplier_id || '',
        notes: fullP.notes || '',
        is_active: fullP.is_active !== undefined ? Boolean(fullP.is_active) : true,
      })
      setBarcodes(full.barcodes)
      const attrMap: Record<string, string> = {}
      full.attributes.forEach((a) => {
        attrMap[a.attributeId] = a.value
      })
      setAttributeValues(attrMap)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.name_ar && !formData.name_en) {
      setError(t('products.errorNameRequired'))
      return
    }
    if (!formData.unit_id) {
      setError(t('products.errorUnitRequired'))
      return
    }

    setLoading(true)
    try {
      const p_price = parseFloat(formData.purchase_price) || 0
      const s_price = parseFloat(formData.selling_price) || 0
      const m_stock = parseFloat(formData.min_stock) || 0
      const initQty = parseFloat(formData.initial_quantity) || 0
      const finalSku = formData.sku.trim() || generateSKU(formData.name_en || 'PRD')

      // Prepare attribute array
      const attributesPayload = Object.entries(attributeValues)
        .filter(([_, val]) => val !== undefined && val !== '')
        .map(([attrId, val]) => ({
          attributeId: attrId,
          value: val,
        }))

      // Prepare barcodes array
      const validBarcodes = barcodes.filter((b) => b.barcode.trim() !== '')
      if (validBarcodes.length === 0 && finalSku) {
        validBarcodes.push({ barcode: finalSku, type: 'code128', isDefault: true, source: 'manual' })
      }

      if (isEditing && currentEditData?.id) {
        // Editing existing product
        await productService.updateProduct(
          {
            id: currentEditData.id,
            sku: finalSku,
            nameAr: formData.name_ar,
            nameEn: formData.name_en,
            description: formData.description,
            categoryId: formData.category_id || null,
            unitId: formData.unit_id,
            brandId: formData.brand_id || null,
            defaultSupplierId: formData.default_supplier_id || null,
            purchasePrice: p_price,
            sellingPrice: s_price,
            minStock: m_stock,
            imagePath: formData.image_path || null,
            drawerLocation: formData.drawer_location || null,
            footprintPackage: formData.footprint_package || null,
            datasheetUrl: formData.datasheet_url || null,
            notes: formData.notes || null,
            isActive: formData.is_active,
            barcodes: validBarcodes,
            attributes: attributesPayload,
          },
          { id: user?.id, fullName: user?.fullName }
        )
      } else if (importedWebsiteMeta) {
        // Saving imported product
        const db = getDb()
        await saveImportedProduct(
          db,
          {
            external_product_id: String(importedWebsiteMeta.id),
            external_sku: importedWebsiteMeta.sku || finalSku,
            external_url: importedWebsiteMeta.permalink,
            website_price: importedWebsiteMeta.websitePrice,
            name_en: formData.name_en,
            name_ar: formData.name_ar || formData.name_en,
            sku: finalSku,
            description: formData.description,
            image_path: formData.image_path || null,
            category_id: formData.category_id || null,
            new_category_name: !formData.category_id ? importedWebsiteMeta.categoryName : null,
            unit_id: formData.unit_id,
            drawer_location: formData.drawer_location || null,
            footprint_package: formData.footprint_package || null,
            datasheet_url: formData.datasheet_url || null,
            purchase_price: p_price,
            selling_price: s_price,
            initial_quantity: initQty,
            min_stock: m_stock,
            default_supplier_id: formData.default_supplier_id || null,
            notes: formData.notes || null,
          },
          user?.id
        )
      } else {
        // Manual product creation
        await productService.createProduct(
          {
            sku: finalSku,
            nameAr: formData.name_ar,
            nameEn: formData.name_en,
            description: formData.description,
            categoryId: formData.category_id || null,
            unitId: formData.unit_id,
            brandId: formData.brand_id || null,
            defaultSupplierId: formData.default_supplier_id || null,
            purchasePrice: p_price,
            sellingPrice: s_price,
            currentStock: initQty,
            minStock: m_stock,
            imagePath: formData.image_path || null,
            drawerLocation: formData.drawer_location || null,
            footprintPackage: formData.footprint_package || null,
            datasheetUrl: formData.datasheet_url || null,
            notes: formData.notes || null,
            isActive: formData.is_active,
            barcodes: validBarcodes,
            attributes: attributesPayload,
          },
          { id: user?.id, fullName: user?.fullName }
        )
      }

      onSaved()
    } catch (err: any) {
      console.error(err)
      if (err.message?.includes('already exists') || err.message?.includes('UNIQUE constraint')) {
        setError(err.message || t('products.errorSkuExists'))
      } else {
        setError(err.message || t('common.error'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-card w-full max-w-4xl rounded-2xl shadow-2xl border border-border flex flex-col max-h-[92vh]">
          
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-foreground">
                {isEditing ? t('products.editProduct') : t('products.addProduct')}
              </h2>
              {importedWebsiteMeta && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                  <Sparkles className="w-3 h-3" />
                  {t('makersImport.importedFromMakers')}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Feedback Messages */}
            {error && (
              <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {successMessage && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 text-emerald-600">
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-medium">{successMessage}</p>
              </div>
            )}

            {/* Top Import Section (Only when creating new product) */}
            {!isEditing && (
              <MakersImportSection
                onSelectProduct={handleSelectMakersProduct}
                onManualMode={() => {
                  const nameInput = document.getElementById('product-name-en')
                  if (nameInput) nameInput.focus()
                }}
              />
            )}

            {/* Imported Website Banner & Notice */}
            {importedWebsiteMeta && (
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-primary">
                      {t('makersImport.websitePrice')}:
                    </span>
                    <span className="text-sm font-bold text-foreground display-number">
                      {importedWebsiteMeta.websitePrice.toFixed(2)} EGP
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ⚠️ {t('makersImport.websitePriceNotice')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setImportedWebsiteMeta(null)}
                  className="text-xs text-muted-foreground hover:text-destructive hover:underline"
                >
                  {t('common.cancel')}
                </button>
              </div>
            )}

            {/* Main Form Fields */}
            <form id="product-form" onSubmit={handleSubmit} className="space-y-6">
              
              {/* Product Identity Section */}
              <div className="space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  {t('products.productIdentity', 'بيانات وهوية المنتج')}
                </p>

                {/* Product Image Preview if available */}
                {formData.image_path && (
                  <div className="p-3 rounded-xl bg-card border border-border flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-muted/60 border border-border flex items-center justify-center overflow-hidden p-1 shrink-0">
                      <ProductImage
                        src={formData.image_path}
                        alt={formData.name_en || formData.name_ar}
                        fallbackType="cpu"
                        iconClassName="w-8 h-8 text-muted-foreground/30"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-foreground block truncate">
                        {t('products.productImage', 'صورة المنتج المستوردة')}
                      </span>
                      <span className="text-[11px] font-mono text-muted-foreground block truncate">
                        {formData.image_path}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, image_path: '' })}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title={t('common.delete', 'إزالة الصورة')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Names */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      {t('products.nameAr')} <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name_ar}
                      onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg bg-input border border-border focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                      dir="rtl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      {t('products.nameEn')}
                    </label>
                    <input
                      id="product-name-en"
                      type="text"
                      value={formData.name_en}
                      onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg bg-input border border-border focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* SKU, Category, Unit, Brand */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center justify-between">
                      {t('common.sku')}
                      <button
                        type="button"
                        onClick={handleGenerateSKU}
                        className="text-[10px] text-primary hover:underline"
                      >
                        {t('products.generateSku')}
                      </button>
                    </label>
                    <input
                      type="text"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg bg-input border border-border focus:ring-2 focus:ring-primary focus:border-transparent text-sm font-mono"
                      placeholder={t('products.skuPlaceholder')}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">{t('common.category')}</label>
                    <select
                      value={formData.category_id}
                      onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg bg-input border border-border focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                    >
                      <option value="">{t('common.none')}</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name_ar} - {c.name_en}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      {t('common.unit')} <span className="text-destructive">*</span>
                    </label>
                    <select
                      value={formData.unit_id}
                      onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg bg-input border border-border focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                    >
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name_ar} ({u.symbol})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-muted-foreground" />
                      {t('common.brand', 'الماركة')}
                    </label>
                    <select
                      value={formData.brand_id}
                      onChange={(e) => setFormData({ ...formData, brand_id: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg bg-input border border-border focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                    >
                      <option value="">{t('common.none')}</option>
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Barcodes Section */}
              <div className="p-4 rounded-xl border border-border bg-card/40 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <Scan className="w-3.5 h-3.5" />
                    {t('products.barcodes', 'الباركودات (Multiple Barcodes)')}
                  </p>
                  <button
                    type="button"
                    onClick={handleAddBarcode}
                    className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t('barcodes.addBarcode', 'إضافة باركود')}
                  </button>
                </div>

                {barcodes.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    {t('barcodes.noBarcodes', 'سيتم استخدام كود SKU كباركود رئيسي')}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {barcodes.map((bc, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={bc.barcode}
                          onChange={(e) => handleBarcodeChange(idx, 'barcode', e.target.value)}
                          placeholder="Barcode string..."
                          className="flex-1 h-9 px-3 rounded-lg bg-input border border-border text-sm font-mono focus:ring-2 focus:ring-primary"
                        />
                        <select
                          value={bc.type}
                          onChange={(e) => handleBarcodeChange(idx, 'type', e.target.value)}
                          className="h-9 px-2 rounded-lg bg-input border border-border text-xs focus:ring-2 focus:ring-primary"
                        >
                          <option value="code128">Code 128</option>
                          <option value="ean13">EAN-13</option>
                          <option value="qr">QR Code</option>
                        </select>
                        <label className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted text-xs cursor-pointer">
                          <input
                            type="radio"
                            name="primary-barcode"
                            checked={bc.isDefault}
                            onChange={() => handleBarcodeChange(idx, 'isDefault', true)}
                            className="text-primary"
                          />
                          <span>{t('barcodes.primary', 'الرئيسي')}</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleRemoveBarcode(idx)}
                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Dynamic Product Attributes Section */}
              {attributeDefs.length > 0 && (
                <div className="p-4 rounded-xl border border-border bg-card/40 space-y-3">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" />
                    {t('products.attributes', 'الخصائص والمواصفات (Attributes)')}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {attributeDefs.map((def) => (
                      <div key={def.id} className="space-y-1">
                        <label className="text-xs font-medium text-foreground flex items-center justify-between">
                          <span>{def.name_ar || def.name_en}</span>
                          {def.unit && <span className="text-[10px] text-muted-foreground font-mono">({def.unit})</span>}
                        </label>
                        <input
                          type="text"
                          value={attributeValues[def.id] || ''}
                          onChange={(e) =>
                            setAttributeValues((prev) => ({
                              ...prev,
                              [def.id]: e.target.value,
                            }))
                          }
                          className="w-full h-8 px-2.5 rounded-lg bg-input border border-border text-xs focus:ring-2 focus:ring-primary"
                          placeholder={def.unit ? `e.g. 10 ${def.unit}` : ''}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Local Store & Commercial Data Section */}
              <div className="p-4 rounded-xl border border-border bg-card/60 space-y-4">
                <p className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5" />
                  {t('makersImport.localStoreData')}
                </p>

                {/* Stock & Prices Row */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      {t('makersImport.quantity')}
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={formData.initial_quantity}
                      onChange={(e) => setFormData({ ...formData, initial_quantity: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg bg-input border border-border focus:ring-2 focus:ring-primary focus:border-transparent text-sm display-number"
                      placeholder="0"
                      disabled={isEditing} // Stock adjustments on existing product done via Add Stock
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">{t('products.purchasePrice')}</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.purchase_price}
                      onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg bg-input border border-border focus:ring-2 focus:ring-primary focus:border-transparent text-sm display-number"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center justify-between">
                      <span>{t('makersImport.sellingPrice')}</span>
                      <span className="text-[10px] text-primary font-normal">* Local Store</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.selling_price}
                      onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg bg-input border-2 border-primary/50 focus:ring-2 focus:ring-primary focus:border-transparent text-sm font-semibold display-number"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">{t('products.minStock')}</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={formData.min_stock}
                      onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg bg-input border border-border focus:ring-2 focus:ring-primary focus:border-transparent text-sm display-number"
                    />
                  </div>
                </div>

                {/* Supplier & Storage Location */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-muted-foreground" />
                      {t('makersImport.selectSupplier')}
                    </label>
                    <select
                      value={formData.default_supplier_id}
                      onChange={(e) => setFormData({ ...formData, default_supplier_id: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg bg-input border border-border focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                    >
                      <option value="">{t('common.none')}</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-primary" />
                      {t('products.drawerLocation')}
                    </label>
                    <input
                      type="text"
                      value={formData.drawer_location}
                      onChange={(e) => setFormData({ ...formData, drawer_location: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg bg-input border border-border focus:ring-2 focus:ring-primary focus:border-transparent text-sm font-mono"
                      placeholder="e.g. A3-R2, D1"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>

              {/* Electronics Specifications */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4">
                <p className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" />
                  Electronics / مواصفات المكون
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-primary" />
                      {t('products.footprintPackage')}
                    </label>
                    <input
                      type="text"
                      value={formData.footprint_package}
                      onChange={(e) => setFormData({ ...formData, footprint_package: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg bg-input border border-border focus:ring-2 focus:ring-primary focus:border-transparent text-sm font-mono"
                      placeholder="e.g. SMD 0805, DIP-8, TO-220"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      <Link className="w-3.5 h-3.5 text-primary" />
                      {t('products.datasheetUrl')}
                    </label>
                    <input
                      type="url"
                      value={formData.datasheet_url}
                      onChange={(e) => setFormData({ ...formData, datasheet_url: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg bg-input border border-border focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                      placeholder="https://datasheet.pdf"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>

              {/* Description & Local Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t('products.description')}</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full p-3 rounded-lg bg-input border border-border focus:ring-2 focus:ring-primary focus:border-transparent text-sm min-h-[75px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t('makersImport.localNotes')}</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full p-3 rounded-lg bg-input border border-border focus:ring-2 focus:ring-primary focus:border-transparent text-sm min-h-[75px]"
                    placeholder="Local branch notes..."
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium">{t('common.active')}</span>
              </label>

            </form>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/30">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              form="product-form"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {t('common.save')}
            </button>
          </div>

        </div>
      </div>

      {/* Product Preview Modal */}
      {previewProduct && (
        <MakersProductPreviewModal
          product={previewProduct}
          onConfirmImport={handleConfirmImport}
          onClose={() => setPreviewProduct(null)}
        />
      )}

      {/* Duplicate Product Modal */}
      {duplicateResult && (
        <MakersDuplicateModal
          duplicateResult={duplicateResult}
          onAddStock={handleDuplicateAddStock}
          onOpenProduct={handleDuplicateOpenProduct}
          onClose={() => setDuplicateResult(null)}
        />
      )}
    </>
  )
}

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Plus,
  Search,
  Package,
  Edit2,
  Trash2,
  Filter,
  AlertTriangle,
  Scan,
  Award,
  Globe,
  FileSpreadsheet,
  Download,
  Upload,
  CheckSquare,
  Square,
  Layers,
  FolderEdit,
  Tag,
  ToggleLeft,
  ToggleRight,
  DollarSign,
  TrendingUp,
  Percent,
  CheckCircle2,
  X,
  Sparkles,
  Eye,
  FolderTree,
} from 'lucide-react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useAuthStore, usePermission } from '@/stores/authStore'
import { formatCurrency } from '@/lib/formatters'
import { ProductForm } from './components/ProductForm'
import { ProductDetailsModal } from './components/ProductDetailsModal'
import { ExcelImportModal } from './components/ExcelImportModal'
import { SmartImportModal } from './components/SmartImportModal'
import { MakersImportModal } from './components/MakersImportModal'
import { ProductImage } from '@/components/common/ProductImage'
import { excelProductService } from '@/services/products/excelProductService'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import {
  productService,
  ProductListItem,
  CategoryItem,
  BrandItem,
  UnitItem,
} from '@/services/products/productService'

export function ProductsPage() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const { language, currencySymbol } = useSettingsStore()
  const { can, isAdmin } = usePermission()
  const isAr = language === 'ar'

  const canCreate = isAdmin || can('create', 'products')
  const canUpdate = isAdmin || can('update', 'products')
  const canDelete = isAdmin || can('delete', 'products')

  const [products, setProducts] = useState<ProductListItem[]>([])
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [brands, setBrands] = useState<BrandItem[]>([])
  const [units, setUnits] = useState<UnitItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedBrand, setSelectedBrand] = useState('')
  const [lowStockFilter, setLowStockFilter] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  // Modals & Selection
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false)
  const [isSmartImportOpen, setIsSmartImportOpen] = useState(false)
  const [isMakersModalOpen, setIsMakersModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<any>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Product Details Modal State
  const [viewProductTarget, setViewProductTarget] = useState<ProductListItem | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  // Category Sidebar State & Counts
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({})
  const [isCategorySidebarOpen, setIsCategorySidebarOpen] = useState(true)
  const [categorySearch, setCategorySearch] = useState('')

  // Bulk Edit Modals
  const [bulkCategoryModalOpen, setBulkCategoryModalOpen] = useState(false)
  const [targetBulkCategory, setTargetBulkCategory] = useState('')
  const [bulkPriceModalOpen, setBulkPriceModalOpen] = useState(false)
  const [priceTargetField, setPriceTargetField] = useState<'selling' | 'purchase'>('selling')
  const [priceAdjustType, setPriceAdjustType] = useState<'percent' | 'fixed' | 'set'>('percent')
  const [priceAdjustValue, setPriceAdjustValue] = useState('')
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false)

  // Unified Delete Confirmation Dialog States
  const [deleteProductTarget, setDeleteProductTarget] = useState<ProductListItem | null>(null)
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null)

  // Auto-dismiss feedback banner after 4s
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [feedback])

  useEffect(() => {
    loadFilterLookups()
    loadProducts()
  }, [])

  async function loadFilterLookups() {
    try {
      const [cats, brs, uns, counts] = await Promise.all([
        productService.getCategories(),
        productService.getBrands(),
        productService.getUnits(),
        productService.getCategoryCounts(),
      ])
      setCategories(cats)
      setBrands(brs)
      setUnits(uns)
      setCategoryCounts(counts)
    } catch (err) {
      console.error('Failed to load filter lookups:', err)
    }
  }

  const totalCountAllCategories = React.useMemo(() => {
    return Object.values(categoryCounts).reduce((acc, c) => acc + c, 0)
  }, [categoryCounts])

  const filteredCategoriesList = React.useMemo(() => {
    if (!categorySearch.trim()) return categories
    const q = categorySearch.toLowerCase().trim()
    return categories.filter(
      (c) =>
        (c.name_ar && c.name_ar.toLowerCase().includes(q)) ||
        (c.name_en && c.name_en.toLowerCase().includes(q))
    )
  }, [categories, categorySearch])

  async function loadProducts(q = search, catId = selectedCategory, brId = selectedBrand, lowStock = lowStockFilter) {
    setLoading(true)
    try {
      const results = await productService.getProducts({
        search: q,
        categoryId: catId || undefined,
        brandId: brId || undefined,
        lowStockOnly: lowStock,
        activeOnly: true,
      })
      setProducts(results)
      setSelectedIds(new Set())
    } catch (err) {
      console.error('Failed to load products:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearch(val)
    loadProducts(val, selectedCategory, selectedBrand, lowStockFilter)
  }

  const handleCategoryFilter = (catId: string) => {
    setSelectedCategory(catId)
    loadProducts(search, catId, selectedBrand, lowStockFilter)
  }

  const handleBrandFilter = (brandId: string) => {
    setSelectedBrand(brandId)
    loadProducts(search, selectedCategory, brandId, lowStockFilter)
  }

  const handleToggleLowStock = () => {
    const next = !lowStockFilter
    setLowStockFilter(next)
    loadProducts(search, selectedCategory, selectedBrand, next)
  }

  // Selection Logic
  const handleToggleSelectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)))
    }
  }

  const handleToggleSelectRow = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedIds(next)
  }

  // Excel Export Handler
  const handleExportExcel = async (exportOnlySelected = false) => {
    const targetProducts = exportOnlySelected
      ? products.filter((p) => selectedIds.has(p.id))
      : products

    if (targetProducts.length === 0) {
      setFeedback({ type: 'warning', message: isAr ? 'لا توجد منتجات لتصديرها' : 'No products to export' })
      return
    }

    try {
      await excelProductService.exportProductsToExcel(
        targetProducts,
        exportOnlySelected ? 'MAKERS_Selected_Products.xlsx' : 'MAKERS_Products_Catalog.xlsx'
      )
      setFeedback({ type: 'success', message: isAr ? 'تم تصدير ملف الإكسيل بنجاح' : 'Products exported successfully' })
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || (isAr ? 'فشل تصدير ملف الإكسيل' : 'Export failed') })
    }
  }

  // Bulk Delete Execution
  const executeBulkDelete = async () => {
    if (selectedIds.size === 0) return
    try {
      for (const id of selectedIds) {
        await productService.deleteProduct(id, { id: user?.id || 'admin', fullName: user?.fullName || 'Admin' })
      }
      setSelectedIds(new Set())
      setIsBulkDeleteOpen(false)
      await loadProducts()
      setFeedback({ type: 'success', message: isAr ? 'تم حذف المنتجات المحددة بنجاح' : 'Selected products deleted successfully' })
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || (isAr ? 'حدث خطأ أثناء حذف المنتجات' : 'Failed to delete products') })
    }
  }

  // Bulk Category Update Handler
  const handleBulkUpdateCategory = async () => {
    if (selectedIds.size === 0 || !targetBulkCategory) return

    try {
      for (const id of selectedIds) {
        const res = await productService.getProductById(id)
        if (res && res.product) {
          const product = res.product
          await productService.updateProduct(
            {
              id: product.id,
              sku: product.sku,
              nameAr: product.name_ar,
              nameEn: product.name_en,
              categoryId: targetBulkCategory,
              unitId: product.unit_id,
              brandId: product.brand_id,
              sellingPrice: product.selling_price,
              purchasePrice: product.purchase_price,
              currentStock: product.current_stock,
              minStock: product.min_stock,
            },
            { id: user?.id || 'admin', fullName: user?.fullName || 'Admin' }
          )
        }
      }
      setBulkCategoryModalOpen(false)
      setSelectedIds(new Set())
      await loadProducts()
      setFeedback({ type: 'success', message: isAr ? 'تم تحديث تصنيف المنتجات المحددة بنجاح' : 'Categories updated successfully' })
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || (isAr ? 'فشل تحديث تصنيف المنتجات' : 'Bulk category update failed') })
    }
  }

  // Bulk Price Update Handler
  const handleBulkUpdatePrices = async () => {
    if (selectedIds.size === 0 || !priceAdjustValue) return
    const numVal = parseFloat(priceAdjustValue)
    if (isNaN(numVal)) {
      setFeedback({ type: 'warning', message: isAr ? 'يرجى إدخال قيمة رقمية صحيحة' : 'Please enter a valid numeric value' })
      return
    }

    setIsUpdatingPrices(true)
    try {
      for (const id of selectedIds) {
        const res = await productService.getProductById(id)
        if (res && res.product) {
          const p = res.product
          let newSelling = p.selling_price
          let newPurchase = p.purchase_price

          if (priceTargetField === 'selling') {
            if (priceAdjustType === 'percent') {
              newSelling = Math.max(0, Math.round((p.selling_price * (1 + numVal / 100)) * 100) / 100)
            } else if (priceAdjustType === 'fixed') {
              newSelling = Math.max(0, p.selling_price + numVal)
            } else if (priceAdjustType === 'set') {
              newSelling = Math.max(0, numVal)
            }
          } else if (priceTargetField === 'purchase') {
            if (priceAdjustType === 'percent') {
              newPurchase = Math.max(0, Math.round((p.purchase_price * (1 + numVal / 100)) * 100) / 100)
            } else if (priceAdjustType === 'fixed') {
              newPurchase = Math.max(0, p.purchase_price + numVal)
            } else if (priceAdjustType === 'set') {
              newPurchase = Math.max(0, numVal)
            }
          }

          await productService.updateProduct(
            {
              id: p.id,
              sku: p.sku,
              nameAr: p.name_ar,
              nameEn: p.name_en,
              categoryId: p.category_id,
              unitId: p.unit_id,
              brandId: p.brand_id,
              sellingPrice: newSelling,
              purchasePrice: newPurchase,
              currentStock: p.current_stock,
              minStock: p.min_stock,
            },
            { id: user?.id || 'admin', fullName: user?.fullName || 'Admin' }
          )
        }
      }

      setBulkPriceModalOpen(false)
      setPriceAdjustValue('')
      setSelectedIds(new Set())
      await loadProducts()
      setFeedback({ type: 'success', message: isAr ? 'تم تحديث أسعار المنتجات المحددة بنجاح' : 'Prices updated successfully' })
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || (isAr ? 'فشل تحديث أسعار المنتجات' : 'Bulk price update failed') })
    } finally {
      setIsUpdatingPrices(false)
    }
  }

  // Single Product Delete Execution
  const executeSingleDelete = async () => {
    if (!deleteProductTarget) return
    try {
      await productService.deleteProduct(deleteProductTarget.id, { id: user?.id || 'admin', fullName: user?.fullName || 'Admin' })
      setDeleteProductTarget(null)
      await loadProducts()
      setFeedback({ type: 'success', message: isAr ? 'تم حذف المنتج بنجاح' : 'Product deleted successfully' })
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || (isAr ? 'حدث خطأ أثناء حذف المنتج' : 'Failed to delete product') })
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`border-b px-6 py-2.5 text-xs font-semibold flex items-center justify-between shrink-0 animate-fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : feedback.type === 'warning'
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400'
              : 'bg-destructive/15 border-destructive/30 text-destructive'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="p-0.5 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('products.title')}</h1>
          <p className="text-xs text-muted-foreground">{products.length} {t('products.itemsCount', 'منتج متاح في المتجر')}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Excel Export */}
          <button
            type="button"
            onClick={() => handleExportExcel(false)}
            className="flex items-center gap-1.5 px-3 py-2 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-lg text-xs font-semibold transition-colors shadow-sm"
            title={isAr ? 'تصدير كامل المنتجات إلى ملف Excel' : 'Export all products to Excel'}
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>{isAr ? 'تصدير Excel' : 'Export Excel'}</span>
          </button>

          {/* Download Excel Template */}
          <button
            type="button"
            onClick={() => {
              const link = document.createElement('a')
              link.href = '/templates/products_import_template.xlsx'
              link.download = 'products_import_template.xlsx'
              document.body.appendChild(link)
              link.click()
              document.body.removeChild(link)
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-lg text-xs font-semibold transition-colors shadow-sm"
            title={isAr ? 'تحميل قالب Excel الجاهز للاستيراد (3 أعمدة)' : 'Download Excel Template'}
          >
            <Download className="w-3.5 h-3.5 text-blue-500" />
            <span>{isAr ? 'تحميل قالب Excel' : 'Download Template'}</span>
          </button>

          {/* Smart Excel Import */}
          {canCreate && (
            <button
              type="button"
              onClick={() => setIsSmartImportOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg text-xs font-bold transition-colors shadow-sm"
              title={isAr ? 'استيراد ذكي من Excel مع البحث التلقائي في MAKERS' : 'Smart Excel Import with MAKERS lookup'}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isAr ? 'استيراد من Excel (ذكي)' : 'Smart Excel Import'}</span>
            </button>
          )}

          {/* Excel Import */}
          {canCreate && (
            <button
              type="button"
              onClick={() => setIsExcelModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-lg text-xs font-semibold transition-colors shadow-sm"
              title={isAr ? 'استيراد منتجات وقوائم أسعار من ملف Excel' : 'Import products from Excel'}
            >
              <Upload className="w-3.5 h-3.5 text-primary" />
              <span>{isAr ? 'استيراد Excel' : 'Import Excel'}</span>
            </button>
          )}

          {/* MAKERS Website Catalog Import */}
          {canCreate && (
            <button
              type="button"
              onClick={() => setIsMakersModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-lg text-xs font-semibold transition-colors shadow-sm"
              title={isAr ? 'البحث والاستيراد المباشر من كتالوج موقع ميكرز' : 'Search and import directly from MAKERS website catalog'}
            >
              <Globe className="w-3.5 h-3.5 text-primary" />
              <span>{isAr ? 'استيراد من ميكرز' : 'Import from MAKERS'}</span>
            </button>
          )}

          {/* Add Product */}
          {canCreate && (
            <button
              type="button"
              onClick={() => {
                setEditingProduct(null)
                setIsFormOpen(true)
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>{t('products.addProduct')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="px-6 py-3 border-b border-border flex flex-wrap items-center justify-between gap-3 bg-muted/10 shrink-0">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search Input */}
          <div className="relative min-w-[240px] max-w-md flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={handleSearchChange}
              className="w-full h-9 ps-9 pe-4 rounded-lg bg-input border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={t('products.searchPlaceholder', 'بحث بالاسم، الكود، الباركود، مكان الدرج...')}
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => handleCategoryFilter(e.target.value)}
            className="h-9 px-3 rounded-lg bg-input border border-border text-xs text-foreground focus:ring-2 focus:ring-ring"
          >
            <option value="">{t('products.allCategories', 'كل التصنيفات')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {isAr ? c.name_ar : c.name_en || c.name_ar}
              </option>
            ))}
          </select>

          {/* Brand Filter */}
          <select
            value={selectedBrand}
            onChange={(e) => handleBrandFilter(e.target.value)}
            className="h-9 px-3 rounded-lg bg-input border border-border text-xs text-foreground focus:ring-2 focus:ring-ring"
          >
            <option value="">{t('brands.allBrands', 'كل الماركات')}</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          {/* Low Stock Toggle */}
          <button
            type="button"
            onClick={handleToggleLowStock}
            className={`flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium border transition-colors ${
              lowStockFilter
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold'
                : 'bg-input border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{t('products.lowStock', 'المخزون المنخفض فقط')}</span>
          </button>

          {/* Category Sidebar Toggle Button */}
          <button
            type="button"
            onClick={() => setIsCategorySidebarOpen((prev) => !prev)}
            className={`flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium border transition-colors ${
              isCategorySidebarOpen
                ? 'bg-primary/10 border-primary/30 text-primary font-bold'
                : 'bg-input border-border text-muted-foreground hover:text-foreground'
            }`}
            title={isAr ? 'عرض أو إخفاء شريط التصنيفات الجانبي' : 'Toggle Category Sidebar'}
          >
            <FolderTree className="w-3.5 h-3.5 text-primary" />
            <span>{isAr ? 'شريط التصنيفات' : 'Categories'}</span>
          </button>
        </div>

        {/* Selected Count Indicator */}
        {selectedIds.size > 0 && (
          <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-lg">
            {isAr ? `${selectedIds.size} منتج محدد` : `${selectedIds.size} selected`}
          </span>
        )}
      </div>

      {/* Floating Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="px-6 py-2.5 bg-primary/10 border-b border-primary/20 flex flex-wrap items-center justify-between gap-3 animate-fade-in shrink-0">
          <div className="flex items-center gap-2 text-xs font-bold text-primary">
            <CheckSquare className="w-4 h-4" />
            <span>{isAr ? `إجراءات جماعية على (${selectedIds.size}) منتج:` : `Bulk Actions (${selectedIds.size}):`}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Bulk Change Category */}
            {canUpdate && (
              <button
                type="button"
                onClick={() => setBulkCategoryModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border hover:bg-muted text-foreground rounded-lg text-xs font-semibold transition-colors"
              >
                <FolderEdit className="w-3.5 h-3.5 text-primary" />
                <span>{isAr ? 'تغيير التصنيف' : 'Change Category'}</span>
              </button>
            )}

            {/* Bulk Adjust Price */}
            {canUpdate && (
              <button
                type="button"
                onClick={() => {
                  setPriceAdjustValue('')
                  setBulkPriceModalOpen(true)
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border hover:bg-muted text-foreground rounded-lg text-xs font-semibold transition-colors"
              >
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                <span>{isAr ? 'تعديل الأسعار' : 'Adjust Prices'}</span>
              </button>
            )}

            {/* Export Selected */}
            <button
              type="button"
              onClick={() => handleExportExcel(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border hover:bg-muted text-foreground rounded-lg text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>{isAr ? 'تصدير المحدد' : 'Export Selected'}</span>
            </button>

            {/* Bulk Delete */}
            {canDelete && (
              <button
                type="button"
                onClick={() => setIsBulkDeleteOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 border border-destructive/20 hover:bg-destructive text-destructive hover:text-destructive-foreground rounded-lg text-xs font-semibold transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isAr ? 'حذف المحدد' : 'Delete Selected'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area: Category Filter Sidebar + Products Table */}
      <div className="flex-1 flex overflow-hidden">
        {/* Category Filter Sidebar (Right side in RTL) */}
        {isCategorySidebarOpen ? (
          <aside className="w-64 xl:w-72 border-e border-border bg-card/60 flex flex-col shrink-0 animate-fade-in select-none">
            {/* Sidebar Header */}
            <div className="p-3 border-b border-border flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-foreground">
                  {isAr ? 'تصنيفات المتجر' : 'Categories'}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                  {categories.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsCategorySidebarOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
                title={isAr ? 'إخفاء الشريط الجانبي' : 'Hide Sidebar'}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Category Search Input */}
            {categories.length > 4 && (
              <div className="p-2 border-b border-border/60 bg-muted/10">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute start-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    placeholder={isAr ? 'بحث في التصنيفات...' : 'Search categories...'}
                    className="w-full h-8 ps-8 pe-2 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {categorySearch && (
                    <button
                      type="button"
                      onClick={() => setCategorySearch('')}
                      className="absolute end-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Categories Scrollable List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {/* All Categories Item */}
              <button
                type="button"
                onClick={() => handleCategoryFilter('')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  selectedCategory === ''
                    ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                    : 'text-foreground hover:bg-muted'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{isAr ? 'كل التصنيفات' : 'All Categories'}</span>
                </span>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                    selectedCategory === ''
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {totalCountAllCategories}
                </span>
              </button>

              {/* Category Items */}
              {filteredCategoriesList.map((cat) => {
                const isSelected = selectedCategory === cat.id
                const count = categoryCounts[cat.id] || 0
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategoryFilter(isSelected ? '' : cat.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all ${
                      isSelected
                        ? 'bg-primary/10 text-primary border border-primary/25 font-bold shadow-xs'
                        : 'text-foreground hover:bg-muted font-medium'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isSelected ? 'bg-primary' : 'bg-muted-foreground/40'
                        }`}
                      />
                      <span className="truncate">{isAr ? cat.name_ar : cat.name_en || cat.name_ar}</span>
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}

              {/* Uncategorized products if any */}
              {(categoryCounts['uncategorized'] || 0) > 0 && (
                <button
                  type="button"
                  onClick={() => handleCategoryFilter(selectedCategory === 'uncategorized' ? '' : 'uncategorized')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all ${
                    selectedCategory === 'uncategorized'
                      ? 'bg-primary/10 text-primary border border-primary/25 font-bold'
                      : 'text-muted-foreground hover:bg-muted font-medium'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span className="w-2 h-2 rounded-full bg-amber-500/60 shrink-0" />
                    <span className="truncate">{isAr ? 'بدون تصنيف' : 'Uncategorized'}</span>
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-bold">
                    {categoryCounts['uncategorized']}
                  </span>
                </button>
              )}
            </div>
          </aside>
        ) : (
          /* Collapsed Mini Tab */
          <div className="border-e border-border bg-card/40 flex flex-col items-center py-3 px-1 shrink-0">
            <button
              type="button"
              onClick={() => setIsCategorySidebarOpen(true)}
              className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-colors flex flex-col items-center gap-1.5"
              title={isAr ? 'عرض تصنيفات المنتجات' : 'Show Categories'}
            >
              <FolderTree className="w-4 h-4 text-primary" />
              <span className="text-[10px] font-bold [writing-mode:vertical-lr] my-1 text-muted-foreground hover:text-primary">
                {isAr ? 'التصنيفات' : 'Categories'}
              </span>
            </button>
          </div>
        )}

        {/* Products Table Area */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground space-y-3">
              <Package className="w-12 h-12 opacity-30" />
              <p className="text-sm font-semibold">{t('common.noData', 'لا توجد منتجات مطابقة')}</p>
              {canCreate && (
                <button
                  onClick={() => setIsFormOpen(true)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors"
                >
                  {t('products.addProduct', 'إضافة أول منتج')}
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-xs text-start border-collapse">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border sticky top-0 z-10 select-none">
                <tr>
                  <th className="p-3 text-center w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === products.length && products.length > 0}
                      onChange={handleToggleSelectAll}
                      className="rounded border-border text-primary focus:ring-primary cursor-pointer"
                    />
                  </th>
                  <th className="p-3 text-center w-12">{isAr ? 'الصورة' : 'Image'}</th>
                  <th className="p-3 text-start">{isAr ? 'الصنف / الاسم' : 'Product Name'}</th>
                  <th className="p-3 text-start">SKU</th>
                  <th className="p-3 text-start">{isAr ? 'الباركود' : 'Barcode'}</th>
                  <th className="p-3 text-start">{isAr ? 'التصنيف' : 'Category'}</th>
                  <th className="p-3 text-start">{isAr ? 'مكان الدرج' : 'Location'}</th>
                  <th className="p-3 text-end">{isAr ? 'سعر البيع' : 'Selling Price'}</th>
                  <th className="p-3 text-center">{isAr ? 'المخزون' : 'Stock'}</th>
                  <th className="p-3 text-center w-24">{isAr ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {products.map((p) => {
                  const isSelected = selectedIds.has(p.id)
                  const isLowStock = p.current_stock <= p.min_stock
                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors hover:bg-muted/30 ${
                        isSelected ? 'bg-primary/5' : ''
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectRow(p.id)}
                          className="rounded border-border text-primary focus:ring-primary cursor-pointer"
                        />
                      </td>
                      <td className="p-2 text-center w-12">
                        <div className="w-10 h-10 rounded-lg bg-muted/60 border border-border flex items-center justify-center overflow-hidden p-0.5 mx-auto">
                          <ProductImage
                            src={p.image_path}
                            alt={p.name_en || p.name_ar}
                            fallbackType="cpu"
                            iconClassName="w-5 h-5 text-muted-foreground/30"
                          />
                        </div>
                      </td>
                      <td className="p-3 font-semibold text-foreground">
                        <p className="font-bold">{isAr ? p.name_ar : p.name_en || p.name_ar}</p>
                        {p.name_en && isAr && <p className="text-[10px] text-muted-foreground font-sans">{p.name_en}</p>}
                      </td>
                      <td className="p-3 font-mono text-muted-foreground font-semibold">{p.sku}</td>
                      <td className="p-3 font-mono text-muted-foreground text-[11px]">
                        {p.primary_barcode || <span className="opacity-40">—</span>}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {p.category_name || '—'}
                      </td>
                      <td className="p-3 text-muted-foreground font-mono text-[11px]">
                        {p.drawer_location || <span className="opacity-40">—</span>}
                      </td>
                      <td className="p-3 text-end font-mono font-bold text-foreground">
                        {formatCurrency(p.selling_price, currencySymbol)}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                            isLowStock
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              : 'bg-emerald-500/10 text-emerald-600'
                          }`}
                        >
                          {p.current_stock}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setViewProductTarget(p)
                              setIsDetailsOpen(true)
                            }}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            title={isAr ? 'عرض التفاصيل' : 'View Details'}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {canUpdate && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingProduct(p)
                                setIsFormOpen(true)
                              }}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              title={t('common.edit', 'تعديل')}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setDeleteProductTarget(p)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              title={t('common.delete', 'حذف')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Product Create / Edit Modal Form */}
      {isFormOpen && (
        <ProductForm
          initialData={editingProduct}
          onClose={() => {
            setIsFormOpen(false)
            setEditingProduct(null)
          }}
          onSaved={() => {
            setIsFormOpen(false)
            setEditingProduct(null)
            loadProducts()
          }}
        />
      )}

      {/* Excel Import Modal */}
      {isExcelModalOpen && (
        <ExcelImportModal
          isOpen={isExcelModalOpen}
          onClose={() => setIsExcelModalOpen(false)}
          onImportComplete={() => {
            loadProducts()
            loadFilterLookups()
          }}
        />
      )}

      {/* Smart Excel Import Modal */}
      {isSmartImportOpen && (
        <SmartImportModal
          isOpen={isSmartImportOpen}
          onClose={() => setIsSmartImportOpen(false)}
          onSuccess={() => {
            loadProducts()
            loadFilterLookups()
          }}
        />
      )}

      {/* MAKERS Direct Catalog Import Modal */}
      {isMakersModalOpen && (
        <MakersImportModal
          isOpen={isMakersModalOpen}
          onClose={() => setIsMakersModalOpen(false)}
          onImportComplete={() => {
            loadProducts()
            loadFilterLookups()
          }}
        />
      )}

      {/* Bulk Category Change Modal Dialog */}
      {bulkCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <FolderEdit className="w-4 h-4 text-primary" />
              {isAr ? `تغيير تصنيف (${selectedIds.size}) منتج محدد` : `Change Category for (${selectedIds.size}) items`}
            </h3>

            <div>
              <label className="text-xs text-muted-foreground block mb-2">
                {isAr ? 'اختر التصنيف الجديد للمنتجات المحددة:' : 'Select Target Category:'}
              </label>
              <select
                value={targetBulkCategory}
                onChange={(e) => setTargetBulkCategory(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-input border border-border text-xs text-foreground focus:ring-2 focus:ring-ring"
              >
                <option value="">{isAr ? '-- اختر التصنيف --' : '-- Select Category --'}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {isAr ? c.name_ar : c.name_en || c.name_ar}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setBulkCategoryModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-border bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold"
              >
                {t('common.cancel', 'إلغاء')}
              </button>
              <button
                type="button"
                disabled={!targetBulkCategory}
                onClick={handleBulkUpdateCategory}
                className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                {isAr ? 'تطبيق التغيير' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Price Adjustment Modal Dialog */}
      {bulkPriceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              {isAr ? `تعديل أسعار (${selectedIds.size}) منتج محدد` : `Adjust Prices for (${selectedIds.size}) items`}
            </h3>

            {/* Target Field */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                {isAr ? 'الحقل المستهدف:' : 'Target Price:'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPriceTargetField('selling')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                    priceTargetField === 'selling'
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-input border-border text-muted-foreground'
                  }`}
                >
                  {isAr ? 'سعر البيع' : 'Selling Price'}
                </button>
                <button
                  type="button"
                  onClick={() => setPriceTargetField('purchase')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                    priceTargetField === 'purchase'
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-input border-border text-muted-foreground'
                  }`}
                >
                  {isAr ? 'سعر الشراء / التكلفة' : 'Cost / Purchase'}
                </button>
              </div>
            </div>

            {/* Adjustment Type */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                {isAr ? 'نوع العملية:' : 'Adjustment Type:'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPriceAdjustType('percent')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                    priceAdjustType === 'percent'
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-input border-border text-muted-foreground'
                  }`}
                >
                  {isAr ? 'نسبة مئوية %' : 'Percentage %'}
                </button>
                <button
                  type="button"
                  onClick={() => setPriceAdjustType('fixed')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                    priceAdjustType === 'fixed'
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-input border-border text-muted-foreground'
                  }`}
                >
                  {isAr ? 'مبلغ ثابت (+/-)' : 'Fixed (+/-)'}
                </button>
                <button
                  type="button"
                  onClick={() => setPriceAdjustType('set')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                    priceAdjustType === 'set'
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-input border-border text-muted-foreground'
                  }`}
                >
                  {isAr ? 'تحديد سعر محدد' : 'Set Exact'}
                </button>
              </div>
            </div>

            {/* Adjustment Value */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                {priceAdjustType === 'percent'
                  ? isAr ? 'نسبة الزيادة (+) أو الخصم (-) %:' : 'Percentage (+ or -) %:'
                  : priceAdjustType === 'fixed'
                  ? isAr ? `قيمة الإضافة (+) أو الخصم (-) بـ ${currencySymbol}:` : `Amount (+ or -) in ${currencySymbol}:`
                  : isAr ? `السعر الجديد الثابت بـ ${currencySymbol}:` : `Exact New Price in ${currencySymbol}:`}
              </label>
              <input
                type="number"
                step="any"
                value={priceAdjustValue}
                onChange={(e) => setPriceAdjustValue(e.target.value)}
                placeholder={priceAdjustType === 'percent' ? 'e.g. 10 or -5' : 'e.g. 25'}
                className="w-full h-10 px-3 rounded-xl bg-input border border-border text-sm font-mono text-foreground focus:ring-2 focus:ring-ring"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setBulkPriceModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-border bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold"
              >
                {t('common.cancel', 'إلغاء')}
              </button>
              <button
                type="button"
                disabled={!priceAdjustValue || isUpdatingPrices}
                onClick={handleBulkUpdatePrices}
                className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                {isUpdatingPrices ? (isAr ? 'جاري التحديث...' : 'Updating...') : (isAr ? 'تطبيق التعديل' : 'Apply')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Details Modal */}
      <ProductDetailsModal
        isOpen={isDetailsOpen}
        product={viewProductTarget}
        onClose={() => {
          setIsDetailsOpen(false)
          setViewProductTarget(null)
        }}
        onEdit={(p) => {
          setIsDetailsOpen(false)
          setViewProductTarget(null)
          setEditingProduct(p)
          setIsFormOpen(true)
        }}
      />

      {/* Single Product Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteProductTarget}
        onClose={() => setDeleteProductTarget(null)}
        onConfirm={executeSingleDelete}
        title={isAr ? 'تأكيد حذف المنتج' : 'Confirm Product Deletion'}
        itemName={deleteProductTarget ? (isAr ? deleteProductTarget.name_ar : deleteProductTarget.name_en) : ''}
        confirmText={t('common.delete', 'حذف')}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isBulkDeleteOpen}
        onClose={() => setIsBulkDeleteOpen(false)}
        onConfirm={executeBulkDelete}
        title={isAr ? 'تأكيد حذف المنتجات المحددة' : 'Confirm Bulk Product Deletion'}
        itemCount={selectedIds.size}
        itemsList={products.filter(p => selectedIds.has(p.id)).slice(0, 3).map(p => isAr ? p.name_ar : p.name_en)}
        confirmText={t('common.delete', 'حذف')}
      />
    </div>
  )
}

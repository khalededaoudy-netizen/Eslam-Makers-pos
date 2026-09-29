import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Search,
  Globe,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Cpu,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  CheckSquare,
  Square,
  Download,
  FileText,
  Layers,
  Image as ImageIcon,
  Check,
  AlertTriangle,
  Info,
} from 'lucide-react'
import { getDb } from '@/services/db/database'
import { searchMakersCatalog, importMakersProductDirect } from '@/services/makers/makersService'
import { MakersMappedProduct } from '@/services/makers/types'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency } from '@/lib/formatters'
import { useSettingsStore } from '@/stores/settingsStore'

interface MakersImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImportComplete: () => void
}

interface ProductStatusInfo {
  isDuplicate: boolean
  matchedName?: string
  status: 'new' | 'duplicate' | 'error'
}

interface ImportReport {
  success: number
  duplicate: number
  failed: number
  items: Array<{ name: string; status: 'success' | 'duplicate' | 'error'; message?: string }>
}

export function MakersImportModal({
  isOpen,
  onClose,
  onImportComplete,
}: MakersImportModalProps) {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language !== 'en'
  const { user } = useAuthStore()
  const { currencySymbol } = useSettingsStore()

  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<MakersMappedProduct[]>([])
  const [statusMap, setStatusMap] = useState<Record<number, ProductStatusInfo>>({})
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [hasSearched, setHasSearched] = useState(false)

  // Selection & Preview
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set())
  const [previewProduct, setPreviewProduct] = useState<MakersMappedProduct | null>(null)

  // Import Progress & Results State
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; currentName: string }>({
    current: 0,
    total: 0,
    currentName: '',
  })
  const [importReport, setImportReport] = useState<ImportReport | null>(null)

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Check duplicate status for a list of products against local SQLite database
  const checkStatusForResults = useCallback(async (prods: MakersMappedProduct[]) => {
    if (prods.length === 0) {
      setStatusMap({})
      return
    }

    try {
      const db = getDb()
      const extIds = prods.map((p) => String(p.id))
      const skus = prods.map((p) => p.sku).filter(Boolean)

      const extPlaceholders = extIds.map(() => '?').join(',')
      const skuPlaceholders = skus.length > 0 ? skus.map(() => '?').join(',') : "''"

      const querySql = `
        SELECT id, sku, external_sku, external_product_id, name_ar, name_en
        FROM products
        WHERE external_product_id IN (${extPlaceholders})
           OR external_sku IN (${skuPlaceholders})
           OR sku IN (${skuPlaceholders})
      `

      const params = [...extIds, ...skus, ...skus]
      const rows = await db.select<any[]>(querySql, params)

      const map: Record<number, ProductStatusInfo> = {}
      prods.forEach((p) => {
        const pIdStr = String(p.id)
        const pSku = p.sku?.trim().toLowerCase()

        const match = rows.find(
          (r) =>
            r.external_product_id === pIdStr ||
            (pSku && r.external_sku && r.external_sku.trim().toLowerCase() === pSku) ||
            (pSku && r.sku && r.sku.trim().toLowerCase() === pSku)
        )

        if (match) {
          map[p.id] = {
            isDuplicate: true,
            matchedName: match.name_ar || match.name_en,
            status: 'duplicate',
          }
        } else {
          map[p.id] = {
            isDuplicate: false,
            status: 'new',
          }
        }
      })

      setStatusMap(map)
    } catch (err) {
      console.error('Error checking duplicate status:', err)
    }
  }, [])

  // Execute catalog search
  const performSearch = useCallback(
    async (searchTerm: string, page = 1) => {
      const term = searchTerm.trim()
      if (!term) {
        setResults([])
        setStatusMap({})
        setTotalCount(null)
        setHasSearched(false)
        setError(null)
        setPreviewProduct(null)
        return
      }

      setLoading(true)
      setError(null)
      try {
        const res = await searchMakersCatalog(term, page, 16)
        setResults(res.products)
        setTotalCount(res.total)
        setTotalPages(res.totalPages)
        setCurrentPage(page)
        setHasSearched(true)
        if (res.products.length > 0) {
          setPreviewProduct(res.products[0])
          await checkStatusForResults(res.products)
        } else {
          setPreviewProduct(null)
        }
      } catch (err: any) {
        setError(err.message || t('makersImport.errorConnecting'))
        setResults([])
        setStatusMap({})
      } finally {
        setLoading(false)
      }
    },
    [checkStatusForResults, t]
  )

  // Debounced input change
  const handleQueryChange = (val: string) => {
    setQuery(val)
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    if (!val.trim()) {
      setResults([])
      setStatusMap({})
      setTotalCount(null)
      setHasSearched(false)
      setError(null)
      setPreviewProduct(null)
      return
    }

    debounceTimerRef.current = setTimeout(() => {
      performSearch(val, 1)
    }, 500)
  }

  // Handle immediate search submit
  const handleImmediateSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    performSearch(query, 1)
  }

  // Selection toggle
  const toggleSelectProduct = (id: number) => {
    const next = new Set(selectedProductIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedProductIds(next)
  }

  const handleSelectAll = () => {
    if (selectedProductIds.size === results.length) {
      setSelectedProductIds(new Set())
    } else {
      setSelectedProductIds(new Set(results.map((p) => p.id)))
    }
  }

  const handleSelectOnlyNew = () => {
    const newIds = results.filter((p) => statusMap[p.id]?.status === 'new').map((p) => p.id)
    setSelectedProductIds(new Set(newIds))
  }

  // Bulk Import Execution
  const handleExecuteImport = async () => {
    const productsToImport = results.filter((p) => selectedProductIds.has(p.id))
    if (productsToImport.length === 0) return

    setIsImporting(true)
    setImportProgress({
      current: 0,
      total: productsToImport.length,
      currentName: productsToImport[0].name,
    })

    const report: ImportReport = {
      success: 0,
      duplicate: 0,
      failed: 0,
      items: [],
    }

    const db = getDb()

    for (let i = 0; i < productsToImport.length; i++) {
      const prod = productsToImport[i]
      setImportProgress({
        current: i + 1,
        total: productsToImport.length,
        currentName: prod.name,
      })

      try {
        const res = await importMakersProductDirect(db, prod, {
          userId: user?.id,
          purchasePriceRatio: 0.7,
        })

        if (res.status === 'success') {
          report.success++
          report.items.push({ name: prod.name, status: 'success' })
        } else if (res.status === 'duplicate') {
          report.duplicate++
          report.items.push({ name: prod.name, status: 'duplicate' })
        } else {
          report.failed++
          report.items.push({ name: prod.name, status: 'error', message: res.error })
        }
      } catch (err: any) {
        report.failed++
        report.items.push({ name: prod.name, status: 'error', message: err?.message || 'Error' })
      }
    }

    setIsImporting(false)
    setImportReport(report)
    setSelectedProductIds(new Set())
    // Refresh status map
    await checkStatusForResults(results)
    onImportComplete()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-card border border-border rounded-2xl w-full max-w-6xl h-[90vh] max-h-[860px] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">
                  {t('makersImport.title')}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground">
                  makerselectronics.com
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('makersImport.subtitle')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Toolbar */}
        <div className="p-4 border-b border-border bg-card/60 shrink-0">
          <form onSubmit={handleImmediateSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder={t('makersImport.searchPlaceholder')}
                autoFocus
                className="w-full h-11 ps-10 pe-10 rounded-xl bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-inner"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    setResults([])
                    setStatusMap({})
                    setPreviewProduct(null)
                  }}
                  className="absolute end-3.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-6 h-11 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-all disabled:opacity-50 shadow-sm flex items-center gap-2 flex-shrink-0"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span>{t('makersImport.searchButton')}</span>
            </button>
          </form>

          {/* Action Row when results are present */}
          {results.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-muted/50 hover:bg-muted text-foreground font-semibold transition-colors"
                >
                  {selectedProductIds.size === results.length ? (
                    <CheckSquare className="w-4 h-4 text-primary" />
                  ) : (
                    <Square className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span>
                    {selectedProductIds.size === results.length
                      ? t('makersImport.deselectAll')
                      : t('makersImport.selectAll')}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleSelectOnlyNew}
                  className="px-3 py-1.5 rounded-lg border border-border bg-muted/50 hover:bg-muted text-foreground font-semibold transition-colors"
                >
                  <span>{isArabic ? 'تحديد الجديد فقط' : 'Select New Only'}</span>
                </button>

                <span className="text-muted-foreground font-medium ms-2">
                  {results.length} {t('makersImport.productsFound')}
                  {selectedProductIds.size > 0 && (
                    <span className="text-primary font-bold ms-1">
                      ({selectedProductIds.size} {isArabic ? 'محدد' : 'selected'})
                    </span>
                  )}
                </span>
              </div>

              {/* Import Button */}
              <button
                type="button"
                disabled={selectedProductIds.size === 0 || isImporting}
                onClick={handleExecuteImport}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-md disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>
                  {t('makersImport.importSelected')} ({selectedProductIds.size})
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Main Content Area (Results List + Preview Panel) */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Results Grid / List (8 cols on desktop) */}
          <div className="lg:col-span-7 xl:col-span-8 p-4 overflow-y-auto border-e border-border flex flex-col space-y-2">
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm font-semibold">{t('makersImport.searching')}</p>
              </div>
            ) : error ? (
              <div className="m-4 p-5 rounded-2xl bg-destructive/10 border border-destructive/20 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-destructive">{error}</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('makersImport.websitePriceNotice')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => performSearch(query, currentPage)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-xs font-bold hover:bg-destructive/90 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{t('makersImport.retry')}</span>
                </button>
              </div>
            ) : !hasSearched ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-muted-foreground text-center space-y-3">
                <Globe className="w-16 h-16 opacity-20 text-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  {isArabic ? 'ابحث في كتالوج موقع ميكرز للإلكترونيات' : 'Search MAKERS Electronics Catalog'}
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  {isArabic
                    ? 'أدخل اسم المكون الإلكتروني، كود SKU، أو رقم الشريحة للبحث الفوري واستيراد المواصفات والصور'
                    : 'Enter component name, SKU or part number to search and import details with images'}
                </p>
              </div>
            ) : results.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-muted-foreground text-center space-y-2">
                <Cpu className="w-12 h-12 opacity-25" />
                <h3 className="text-sm font-bold text-foreground">
                  {t('makersImport.noProductsFound')}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t('makersImport.productNotFound')}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {results.map((prod) => {
                  const isSelected = selectedProductIds.has(prod.id)
                  const isPreview = previewProduct?.id === prod.id
                  const status = statusMap[prod.id]?.status || 'new'

                  return (
                    <div
                      key={prod.id}
                      onClick={() => setPreviewProduct(prod)}
                      className={`group relative p-3 rounded-xl border transition-all cursor-pointer flex gap-3 items-center ${
                        isPreview
                          ? 'border-primary bg-primary/5 shadow-md ring-1 ring-primary'
                          : 'border-border bg-card hover:border-primary/40 hover:bg-muted/30 shadow-sm'
                      }`}
                    >
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleSelectProduct(prod.id)
                        }}
                        className="p-1 text-muted-foreground hover:text-primary transition-colors shrink-0"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-primary" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>

                      {/* Thumbnail Image */}
                      <div className="w-14 h-14 rounded-lg bg-muted/80 border border-border flex items-center justify-center shrink-0 overflow-hidden p-0.5">
                        {prod.imageUrl ? (
                          <img
                            src={prod.imageUrl}
                            alt={prod.name}
                            className="w-full h-full object-contain rounded"
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : (
                          <Cpu className="w-6 h-6 text-muted-foreground/30" />
                        )}
                      </div>

                      {/* Info & Badges */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {/* Status Badge */}
                          {status === 'duplicate' ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              {t('makersImport.statusExists')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              {t('makersImport.statusNew')}
                            </span>
                          )}

                          {prod.sku && (
                            <span className="text-[10px] font-mono text-muted-foreground truncate">
                              {prod.sku}
                            </span>
                          )}
                        </div>

                        <h4 className="text-xs font-bold text-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                          {prod.name}
                        </h4>

                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs font-mono font-bold text-foreground">
                            {formatCurrency(prod.websitePrice, currencySymbol)}
                          </span>

                          {prod.footprintPackage && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                              {prod.footprintPackage}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Right Side: Product Preview Panel (4-5 cols) */}
          <div className="lg:col-span-5 xl:col-span-4 p-5 bg-muted/10 overflow-y-auto flex flex-col space-y-4">
            {previewProduct ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <FileText className="w-4 h-4" />
                    {t('makersImport.previewTitle')}
                  </span>
                  <a
                    href={previewProduct.permalink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 hover:underline"
                  >
                    <span>{isArabic ? 'فتح بالموقع' : 'View on Store'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {/* Big Image Preview */}
                <div className="w-full h-48 rounded-2xl bg-card border border-border flex items-center justify-center p-3 overflow-hidden shadow-inner">
                  {previewProduct.imageUrl ? (
                    <img
                      src={previewProduct.imageUrl}
                      alt={previewProduct.name}
                      className="max-h-full max-w-full object-contain rounded-lg"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                      <ImageIcon className="w-10 h-10 opacity-30" />
                      <span className="text-xs">{isArabic ? 'لا توجد صورة' : 'No Image'}</span>
                    </div>
                  )}
                </div>

                {/* Title & SKU */}
                <div>
                  <h3 className="text-sm font-bold text-foreground leading-snug">
                    {previewProduct.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
                    {previewProduct.sku && (
                      <span className="font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-md text-[11px]">
                        SKU: {previewProduct.sku}
                      </span>
                    )}
                    <span className="font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-md text-[11px]">
                      {previewProduct.formattedPrice}
                    </span>
                  </div>
                </div>

                {/* Categories & Specs */}
                <div className="space-y-2 text-xs">
                  {previewProduct.categories.length > 0 && (
                    <div>
                      <span className="text-muted-foreground block text-[11px] mb-1">
                        {isArabic ? 'التصنيفات:' : 'Categories:'}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {previewProduct.categories.map((c, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-medium"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {previewProduct.footprintPackage && (
                    <div className="p-2.5 rounded-xl bg-card border border-border flex items-center justify-between">
                      <span className="text-muted-foreground">{isArabic ? 'نوع الغلاف (Package):' : 'Package:'}</span>
                      <span className="font-mono font-bold text-foreground">
                        {previewProduct.footprintPackage}
                      </span>
                    </div>
                  )}

                  {previewProduct.datasheetUrl && (
                    <a
                      href={previewProduct.datasheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between text-primary hover:bg-primary/10 transition-colors"
                    >
                      <span className="font-semibold">{isArabic ? 'الداتاشيت (Datasheet PDF)' : 'Datasheet PDF'}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                {/* Description */}
                {previewProduct.description && (
                  <div className="pt-2 border-t border-border/60">
                    <span className="text-[11px] font-bold text-muted-foreground block mb-1">
                      {isArabic ? 'الوصف والتفاصيل:' : 'Description:'}
                    </span>
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line line-clamp-6 bg-card p-3 rounded-xl border border-border/60">
                      {previewProduct.description}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-center space-y-2 py-20">
                <Info className="w-8 h-8 opacity-30" />
                <p className="text-xs">
                  {isArabic ? 'اختر منتجاً من القائمة لعرض معاينة كاملة وتفاصيل' : 'Select a product to preview full details'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar Modal Overlay (during batch import) */}
        {isImporting && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-6 animate-fade-in">
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {t('makersImport.importingProgress', {
                    current: importProgress.current,
                    total: importProgress.total,
                  })}
                </h3>
                <p className="text-xs text-muted-foreground truncate mt-1 max-w-xs mx-auto">
                  {importProgress.currentName}
                </p>
              </div>

              {/* Progress Bar Track */}
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden border border-border">
                <div
                  className="bg-primary h-full transition-all duration-300 rounded-full"
                  style={{
                    width: `${Math.round(
                      (importProgress.current / Math.max(1, importProgress.total)) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Import Results Summary Modal */}
        {importReport && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-6 animate-fade-in">
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div>
                <h3 className="text-base font-bold text-foreground">
                  {t('makersImport.importResultsTitle')}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {isArabic ? 'ملخص نتائج عملية الاستيراد' : 'Batch import execution summary'}
                </p>
              </div>

              {/* Stats Counters */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600">
                  <span className="text-lg font-bold block">{importReport.success}</span>
                  <span className="text-[10px] font-semibold">{t('makersImport.successCount')}</span>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600">
                  <span className="text-lg font-bold block">{importReport.duplicate}</span>
                  <span className="text-[10px] font-semibold">{t('makersImport.duplicateCount')}</span>
                </div>
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive">
                  <span className="text-lg font-bold block">{importReport.failed}</span>
                  <span className="text-[10px] font-semibold">{t('makersImport.failedCount')}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setImportReport(null)}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-all shadow-md"
              >
                {t('makersImport.done')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

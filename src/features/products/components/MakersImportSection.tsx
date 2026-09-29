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
  Sparkles,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react'
import { searchMakersCatalog } from '@/services/makers/makersService'
import { MakersMappedProduct } from '@/services/makers/types'

interface MakersImportSectionProps {
  onSelectProduct: (product: MakersMappedProduct) => void
  onManualMode: () => void
}

export function MakersImportSection({
  onSelectProduct,
  onManualMode,
}: MakersImportSectionProps) {
  const { t } = useTranslation()

  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<MakersMappedProduct[]>([])
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  const performSearch = useCallback(
    async (searchTerm: string, page = 1) => {
      const term = searchTerm.trim()
      if (!term) {
        setResults([])
        setTotalCount(null)
        setHasSearched(false)
        setError(null)
        return
      }

      setLoading(true)
      setError(null)
      try {
        const res = await searchMakersCatalog(term, page, 8)
        setResults(res.products)
        setTotalCount(res.total)
        setTotalPages(res.totalPages)
        setCurrentPage(page)
        setHasSearched(true)
        setSelectedIndex(-1)
      } catch (err: any) {
        setError(err.message || t('makersImport.errorConnecting'))
        setResults([])
      } finally {
        setLoading(false)
      }
    },
    [t]
  )

  // Debounced auto-search on typing (600ms)
  const handleQueryChange = (val: string) => {
    setQuery(val)
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    if (!val.trim()) {
      setResults([])
      setTotalCount(null)
      setHasSearched(false)
      setError(null)
      return
    }

    debounceTimerRef.current = setTimeout(() => {
      performSearch(val, 1)
    }, 600)
  }

  // Handle immediate search (e.g. click search button or press Enter)
  const handleImmediateSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    performSearch(query, 1)
  }

  // Clear search
  const handleClear = () => {
    setQuery('')
    setResults([])
    setTotalCount(null)
    setHasSearched(false)
    setError(null)
    setSelectedIndex(-1)
  }

  // Keyboard navigation for POS efficiency
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (results.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === 'Enter' && selectedIndex >= 0 && selectedIndex < results.length) {
      e.preventDefault()
      onSelectProduct(results[selectedIndex])
    } else if (e.key === 'Escape') {
      handleClear()
    }
  }

  return (
    <div className="rounded-2xl border-2 border-primary/30 bg-primary/[0.03] p-5 space-y-4 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground">
                {t('makersImport.title')}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary text-primary-foreground">
                MAKERS Catalog
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('makersImport.subtitle')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onManualMode}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 hover:underline transition-colors"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          {t('makersImport.createManually')}
        </button>
      </div>

      {/* Search Input Bar */}
      <form onSubmit={handleImmediateSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('makersImport.searchPlaceholder')}
            className="w-full h-11 ps-9 pe-10 rounded-xl bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-inner"
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute end-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="flex items-center gap-2 px-5 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm flex-shrink-0"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          <span>{t('makersImport.searchButton')}</span>
        </button>
      </form>

      {/* Loading State */}
      {loading && (
        <div className="py-6 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-xs">{t('makersImport.searching')}</p>
        </div>
      )}

      {/* Network / Website Error State */}
      {!loading && error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 space-y-2">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-destructive">{error}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {t('makersImport.websitePriceNotice')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1 ps-7">
            <button
              type="button"
              onClick={() => performSearch(query, currentPage)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <RefreshCw className="w-3 h-3" />
              {t('makersImport.retry')}
            </button>
            <button
              type="button"
              onClick={onManualMode}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted"
            >
              {t('makersImport.createManually')}
            </button>
          </div>
        </div>
      )}

      {/* Search Results */}
      {!loading && !error && hasSearched && results.length > 0 && (
        <div className="space-y-3">
          {/* Header count + pagination */}
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span className="font-medium text-foreground">
              {totalCount !== null ? totalCount : results.length} {t('makersImport.productsFound')}
            </span>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => performSearch(query, currentPage - 1)}
                  className="p-1 rounded-md hover:bg-muted disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-1 text-[11px]">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => performSearch(query, currentPage + 1)}
                  className="p-1 rounded-md hover:bg-muted disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Product Items List */}
          <div
            ref={listRef}
            className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[360px] overflow-y-auto pe-1"
          >
            {results.map((prod, idx) => {
              const isSelected = idx === selectedIndex
              return (
                <div
                  key={prod.id}
                  onClick={() => onSelectProduct(prod)}
                  className={`group relative p-3 rounded-xl border transition-all cursor-pointer flex gap-3 items-center ${
                    isSelected
                      ? 'border-primary bg-primary/10 shadow-md ring-1 ring-primary'
                      : 'border-border bg-card hover:border-primary/50 hover:bg-muted/30 shadow-sm'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="w-14 h-14 rounded-lg bg-muted/60 border border-border flex items-center justify-center flex-shrink-0 overflow-hidden p-0.5">
                    {prod.imageUrl ? (
                      <img
                        src={prod.imageUrl}
                        alt={prod.name}
                        className="w-full h-full object-contain rounded"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : (
                      <Cpu className="w-6 h-6 text-muted-foreground/40" />
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                      {prod.name}
                    </h4>

                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {prod.sku && (
                        <span className="text-[10px] font-mono text-muted-foreground px-1.5 py-0.2 rounded bg-muted">
                          {prod.sku}
                        </span>
                      )}
                      {prod.categories.length > 0 && (
                        <span className="text-[10px] text-primary/80 font-medium truncate max-w-[120px]">
                          {prod.categories[0]}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-xs font-bold text-foreground display-number">
                        {prod.formattedPrice}
                      </span>
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          prod.isInStock
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-destructive/10 text-destructive'
                        }`}
                      >
                        {prod.isInStock ? t('makersImport.inStock') : t('makersImport.outOfStock')}
                      </span>
                    </div>
                  </div>

                  {/* Select button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectProduct(prod)
                    }}
                    className="self-center px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all flex-shrink-0"
                  >
                    {t('makersImport.select')}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && hasSearched && results.length === 0 && (
        <div className="py-6 px-4 rounded-xl border border-dashed border-border bg-card flex flex-col items-center justify-center text-center space-y-2">
          <p className="text-xs font-medium text-foreground">
            {t('makersImport.noProductsFound')}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {t('makersImport.productNotFound')}
          </p>
          <button
            type="button"
            onClick={onManualMode}
            className="mt-1 px-4 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {t('makersImport.createManually')}
          </button>
        </div>
      )}
    </div>
  )
}

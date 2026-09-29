/**
 * MAKERS POS — Search Sale for Return Modal
 */

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, X, Receipt, User, Phone, ArrowRight, Clock, AlertCircle } from 'lucide-react'
import { returnService } from '../returnService'

interface ReturnSaleSearchModalProps {
  onSelectSale: (saleId: string) => void
  onClose: () => void
}

export function ReturnSaleSearchModal({ onSelectSale, onClose }: ReturnSaleSearchModalProps) {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'ar'
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Array<{
    id: string
    invoiceNumber: string
    createdAt: string
    total: number
    status: string
    customerName?: string | null
    customerPhone?: string | null
    itemsCount: number
  }>>([])
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = async (term: string) => {
    if (!term || term.trim().length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    setHasSearched(true)
    try {
      const sales = await returnService.searchSaleForReturn(term)
      setResults(sales)
    } catch (err) {
      console.error('Failed to search sales for return:', err)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.trim().length >= 2) {
        handleSearch(searchTerm)
      } else {
        setResults([])
        setHasSearched(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-lg font-bold">{t('returns.searchSaleTitle', 'البحث عن فاتورة للمرتجع')}</h2>
              <p className="text-xs text-muted-foreground">
                {t('returns.searchSaleSubtitle', 'أدخل رقم الفاتورة، اسم العميل، أو رقم الهاتف للعثور على الفاتورة الأصلية')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-6 border-b border-border bg-muted/10">
          <div className="relative">
            <Search className="w-5 h-5 absolute start-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('returns.searchPlaceholder', 'مثال: SAL-20260929-000001 أو 010... أو اسم العميل')}
              className="w-full ps-11 pe-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm font-medium"
            />
          </div>
        </div>

        {/* Results List */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {loading && (
            <div className="py-12 text-center text-muted-foreground">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent mb-3" />
              <p className="text-sm">{t('common.loading', 'جاري البحث...')}</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="space-y-2.5">
              {results.map((sale) => (
                <div
                  key={sale.id}
                  onClick={() => onSelectSale(sale.id)}
                  className="p-4 rounded-xl border border-border bg-card hover:bg-muted/50 hover:border-primary/50 cursor-pointer transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold font-mono text-sm group-hover:scale-105 transition-transform">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-sm font-mono">{sale.invoiceNumber}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          {t('sales.completed', 'مكتملة')}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(sale.createdAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}
                        </span>
                        {sale.customerName && (
                          <span className="flex items-center gap-1 text-foreground/80 font-medium">
                            <User className="w-3.5 h-3.5" />
                            {sale.customerName}
                          </span>
                        )}
                        {sale.customerPhone && (
                          <span className="flex items-center gap-1 font-mono">
                            <Phone className="w-3.5 h-3.5" />
                            {sale.customerPhone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-end flex items-center gap-4">
                    <div>
                      <span className="text-xs text-muted-foreground block">{sale.itemsCount} {t('returns.itemsCount', 'أصناف')}</span>
                      <span className="text-base font-extrabold text-primary font-mono">{sale.total.toFixed(2)} ج.م</span>
                    </div>
                    <div className="p-2 rounded-lg bg-primary/10 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowRight className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && hasSearched && results.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-40 text-amber-500" />
              <p className="font-semibold text-sm">{t('returns.noSalesFound', 'لم يتم العثور على فواتير مكتملة مطابقة')}</p>
              <p className="text-xs mt-1 text-muted-foreground/80">
                {t('returns.noSalesHelp', 'تأكد من رقم الفاتورة أو بيانات العميل وحاول مجدداً')}
              </p>
            </div>
          )}

          {!hasSearched && (
            <div className="py-12 text-center text-muted-foreground">
              <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">{t('returns.startTyping', 'ابدأ بكتابة رقم الفاتورة أو اسم العميل للبحث')}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-muted/20 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-accent text-accent-foreground font-semibold hover:bg-accent/80 transition-all text-sm"
          >
            {t('common.cancel', 'إلغاء')}
          </button>
        </div>
      </div>
    </div>
  )
}

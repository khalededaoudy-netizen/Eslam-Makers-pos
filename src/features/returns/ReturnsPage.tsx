/**
 * MAKERS POS — Returns & Refunds Management Page
 */

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  RotateCcw, Search, Plus, Filter, Eye, Printer,
  Calendar, User, Clock, CheckCircle2, AlertCircle, RefreshCw
} from 'lucide-react'
import { returnService } from './returnService'
import { Return, ReturnReceiptData } from './types'
import { returnReceiptService } from './returnReceiptService'
import { ReturnSaleSearchModal } from './components/ReturnSaleSearchModal'
import { CreateReturnModal } from './components/CreateReturnModal'
import { ReturnDetailsModal } from './components/ReturnDetailsModal'
import { ReturnReceiptModal } from './components/ReturnReceiptModal'

export function ReturnsPage() {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'ar'

  const [returns, setReturns] = useState<Return[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'cancelled'>('all')

  // Modals state
  const [isSearchSaleOpen, setIsSearchSaleOpen] = useState(false)
  const [selectedSaleIdForReturn, setSelectedSaleIdForReturn] = useState<string | null>(null)
  const [selectedReturnIdForDetails, setSelectedReturnIdForDetails] = useState<string | null>(null)
  const [activeReceiptData, setActiveReceiptData] = useState<ReturnReceiptData | null>(null)

  const loadReturns = async () => {
    setLoading(true)
    try {
      const result = await returnService.getReturns({
        search: searchTerm || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: 50,
      })
      setReturns(result.returns)
      setTotalCount(result.total)
    } catch (err) {
      console.error('Failed to load returns:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReturns()
  }, [searchTerm, statusFilter])

  const handleSaleSelected = (saleId: string) => {
    setIsSearchSaleOpen(false)
    setSelectedSaleIdForReturn(saleId)
  }

  const handleReturnSuccess = (receipt: ReturnReceiptData) => {
    setSelectedSaleIdForReturn(null)
    setActiveReceiptData(receipt)
    loadReturns()
  }

  const handleOpenReceiptFromList = async (ret: Return) => {
    try {
      const detailed = await returnService.getReturnById(ret.id)
      if (!detailed) return
      const receipt = await returnReceiptService.buildReceiptData(detailed)
      setActiveReceiptData(receipt)
    } catch (err) {
      console.error('Failed to build return receipt:', err)
    }
  }

  // Summary Metrics
  const totalRefundAmount = returns.reduce((sum, r) => sum + r.refundAmount, 0)

  return (
    <div className="flex-1 flex flex-col p-6 space-y-6 overflow-y-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2.5">
            <RotateCcw className="w-7 h-7 text-amber-500" />
            <span>{t('returns.title', 'سجل المرتجعات والاسترداد')}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('returns.subtitle', 'إدارة مرتجعات المبيعات، استرجاع المخزون، وتسجيل حركات الاسترداد المالي')}
          </p>
        </div>

        <button
          onClick={() => setIsSearchSaleOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-extrabold shadow-lg shadow-amber-500/20 active:scale-95 transition-all text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>{t('returns.newReturn', 'معالجة مرتجع جديد')}</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <RotateCcw className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground block font-medium">{t('returns.totalReturns', 'إجمالي حركات المرتجع')}</span>
            <span className="text-xl font-black text-foreground font-mono mt-0.5 block">{totalCount}</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground block font-medium">{t('returns.totalRefundsValue', 'إجمالي مبالغ الاسترداد')}</span>
            <span className="text-xl font-black text-primary font-mono mt-0.5 block">
              {totalRefundAmount.toFixed(2)} ج.م
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
            <RefreshCw className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground block font-medium">{t('returns.statusCompleted', 'مرتجعات مكتملة')}</span>
            <span className="text-xl font-black text-foreground font-mono mt-0.5 block">
              {returns.filter(r => r.status === 'completed').length}
            </span>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-card p-3 rounded-2xl border border-border">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute start-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('returns.searchPlaceholder', 'بحث برقم المرتجع، رقم الفاتورة، اسم العميل أو الهاتف...')}
            className="w-full ps-10 pe-4 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="py-2 px-3 bg-background border border-border rounded-xl text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="all">{t('common.allStatuses', 'جميع الحالات')}</option>
            <option value="completed">{t('sales.completed', 'مكتملة')}</option>
            <option value="cancelled">{t('sales.cancelled', 'ملغاة')}</option>
          </select>

          <button
            onClick={loadReturns}
            className="p-2 rounded-xl border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title={t('common.refresh', 'تحديث')}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Returns Table */}
      <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-muted-foreground font-bold text-start">
                <th className="py-3.5 px-4 text-start">{t('returns.returnNumber', 'رقم المرتجع')}</th>
                <th className="py-3.5 px-4 text-start">{t('returns.originalSale', 'الفاتورة الأصلية')}</th>
                <th className="py-3.5 px-4 text-start">{t('common.date', 'التاريخ')}</th>
                <th className="py-3.5 px-4 text-start">{t('sales.customer', 'العميل')}</th>
                <th className="py-3.5 px-4 text-start">{t('sales.cashier', 'الكاشير')}</th>
                <th className="py-3.5 px-4 text-end">{t('returns.refundAmount', 'مبلغ الاسترداد')}</th>
                <th className="py-3.5 px-4 text-center">{t('common.status', 'الحالة')}</th>
                <th className="py-3.5 px-4 text-center">{t('common.actions', 'إجراءات')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent mb-2" />
                    <p>{t('common.loading', 'جاري التحميل...')}</p>
                  </td>
                </tr>
              )}

              {!loading && returns.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <RotateCcw className="w-10 h-10 mx-auto mb-2 opacity-30 text-amber-500" />
                    <p className="font-semibold">{t('returns.noReturnsRecorded', 'لا توجد حركات مرتجعات مسجلة')}</p>
                  </td>
                </tr>
              )}

              {!loading &&
                returns.map((ret) => (
                  <tr key={ret.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-foreground">
                      {ret.returnNumber}
                    </td>
                    <td className="py-3 px-4 font-mono text-muted-foreground">
                      {ret.saleInvoiceNumber || 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                      {new Date(ret.createdAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}
                    </td>
                    <td className="py-3 px-4 font-medium text-foreground">
                      {ret.customerName || t('common.walkInCustomer', 'عميل نقدي')}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {ret.userName || 'Cashier'}
                    </td>
                    <td className="py-3 px-4 font-mono font-extrabold text-end text-primary">
                      {ret.refundAmount.toFixed(2)} ج.م
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        {t('sales.completed', 'مكتملة')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelectedReturnIdForDetails(ret.id)}
                          className="p-1.5 rounded-lg bg-accent hover:bg-accent/80 text-foreground transition-colors"
                          title={t('common.details', 'التفاصيل')}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenReceiptFromList(ret)}
                          className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                          title={t('returns.printReceipt', 'طباعة الإشعار')}
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {isSearchSaleOpen && (
        <ReturnSaleSearchModal
          onSelectSale={handleSaleSelected}
          onClose={() => setIsSearchSaleOpen(false)}
        />
      )}

      {selectedSaleIdForReturn && (
        <CreateReturnModal
          saleId={selectedSaleIdForReturn}
          onClose={() => setSelectedSaleIdForReturn(null)}
          onSuccess={handleReturnSuccess}
        />
      )}

      {selectedReturnIdForDetails && (
        <ReturnDetailsModal
          returnId={selectedReturnIdForDetails}
          onClose={() => setSelectedReturnIdForDetails(null)}
          onOpenReceipt={(receipt) => {
            setSelectedReturnIdForDetails(null)
            setActiveReceiptData(receipt)
          }}
        />
      )}

      {activeReceiptData && (
        <ReturnReceiptModal
          receipt={activeReceiptData}
          onClose={() => setActiveReceiptData(null)}
        />
      )}
    </div>
  )
}

/**
 * MAKERS POS — Sales History & Invoices Page
 * Complete sales ledger with search, date filters, sale details modal, and receipt printing.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Receipt,
  Search,
  Calendar,
  Eye,
  Printer,
  RefreshCw,
  Clock,
  User,
  Hash,
  Filter,
} from 'lucide-react'
import { salesService } from './salesService'
import { receiptService } from './receiptService'
import { Sale, ReceiptData } from './types'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { useSettingsStore } from '@/stores/settingsStore'
import { SaleDetailsModal } from './components/SaleDetailsModal'
import { ReceiptModal } from './components/ReceiptModal'

export function SalesPage() {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language !== 'en'
  const { currencySymbol } = useSettingsStore()

  const [sales, setSales] = useState<Sale[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('ALL')

  // Modals state
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [activeReceipt, setActiveReceipt] = useState<ReceiptData | null>(null)
  const [receiptModalOpen, setReceiptModalOpen] = useState(false)

  const loadSales = useCallback(async () => {
    try {
      setLoading(true)
      const res = await salesService.getSales({
        search: searchQuery || undefined,
        startDate: startDate ? `${startDate}T00:00:00Z` : undefined,
        endDate: endDate ? `${endDate}T23:59:59Z` : undefined,
        limit: 100,
      })
      
      let filtered = res.sales
      if (paymentMethodFilter && paymentMethodFilter !== 'ALL') {
        filtered = filtered.filter((s) => 
          s.payments?.some((p) => p.method === paymentMethodFilter) ||
          (s as any).payment_method === paymentMethodFilter
        )
      }
      
      setSales(filtered)
      setTotalCount(filtered.length)
    } catch (err) {
      console.error('Failed to load sales history:', err)
    } finally {
      setLoading(false)
    }
  }, [searchQuery, startDate, endDate, paymentMethodFilter])

  useEffect(() => {
    loadSales()
  }, [loadSales])

  const handleOpenDetails = (saleId: string) => {
    setSelectedSaleId(saleId)
    setDetailsModalOpen(true)
  }

  const handleOpenReceipt = async (sale: Sale) => {
    try {
      const fullSale = await salesService.getSaleById(sale.id)
      if (fullSale) {
        const receipt = await receiptService.buildReceiptData(fullSale)
        setActiveReceipt(receipt)
        setReceiptModalOpen(true)
      }
    } catch (err) {
      console.error('Error generating receipt preview:', err)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background overflow-hidden">
      {/* Top Header */}
      <div className="px-6 py-4 border-b border-border bg-card/50 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            <span>{t('sales.title', 'سجل المبيعات والفواتير')}</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('sales.subtitle', 'عرض وإدارة فواتير المبيعات، تفاصيل العمليات، وطباعة الإيصالات')}
          </p>
        </div>

        <button
          type="button"
          onClick={loadSales}
          disabled={loading}
          className="p-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground transition-colors text-xs font-semibold flex items-center gap-1.5 shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>{t('common.refresh', 'تحديث')}</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-4 border-b border-border bg-card/30 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 text-muted-foreground start-3" />
          <input
            type="text"
            placeholder={t('sales.searchPlaceholder', 'بحث برقم الفاتورة، اسم العميل أو الهاتف...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full ps-9 pe-4 py-2 rounded-xl border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Payment Method Filter */}
        <select
          value={paymentMethodFilter}
          onChange={(e) => setPaymentMethodFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="ALL">{isArabic ? 'جميع طرق الدفع' : 'All Payment Methods'}</option>
          <option value="cash">{isArabic ? 'نقدي (Cash)' : 'Cash'}</option>
          <option value="card">{isArabic ? 'بطاقة (Card)' : 'Card'}</option>
          <option value="credit">{isArabic ? 'آجل / حساب عميل (Credit)' : 'Customer Credit'}</option>
          <option value="split">{isArabic ? 'دفع متعدد (Split)' : 'Split Payment'}</option>
        </select>

        {/* Date From */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="w-4 h-4 text-primary" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Date To */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{t('common.to', 'إلى')}</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {(searchQuery || startDate || endDate || paymentMethodFilter !== 'ALL') && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('')
              setStartDate('')
              setEndDate('')
              setPaymentMethodFilter('ALL')
            }}
            className="px-3 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            {t('common.clear', 'مسح التصفية')}
          </button>
        )}
      </div>

      {/* Sales Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-sm">
          <table className="w-full data-table text-xs">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
              <tr>
                <th className="px-4 py-3 text-start">{t('sales.invoiceNumber', 'رقم الفاتورة')}</th>
                <th className="px-4 py-3 text-start">{t('sales.customer', 'العميل')}</th>
                <th className="px-4 py-3 text-start">{t('sales.cashier', 'الكاشير')}</th>
                <th className="px-4 py-3 text-end">{t('pos.subtotal', 'المجموع')}</th>
                <th className="px-4 py-3 text-end">{t('pos.discount', 'الخصم')}</th>
                <th className="px-4 py-3 text-end">{t('common.total', 'الإجمالي')}</th>
                <th className="px-4 py-3 text-center">{t('common.status', 'الحالة')}</th>
                <th className="px-4 py-3 text-start">{t('common.date', 'التاريخ والوقت')}</th>
                <th className="px-4 py-3 text-center">{t('common.actions', 'الإجراءات')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground">
                    {t('common.loading', 'جاري التحميل...')}
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground">
                    {t('sales.noSales', 'لا توجد فواتير مبيعات مسجلة')}
                  </td>
                </tr>
              ) : (
                sales.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-primary">
                      {s.invoice_number}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {s.customer_name || <span className="text-muted-foreground">{t('pos.walkIn', 'عميل عابر')}</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{s.cashier_name}</td>
                    <td className="px-4 py-3 text-end font-mono">
                      {formatCurrency(s.subtotal)}
                    </td>
                    <td className="px-4 py-3 text-end font-mono text-destructive">
                      {s.discount_amount > 0 ? `-${formatCurrency(s.discount_amount)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-end font-mono font-bold text-foreground">
                      {formatCurrency(s.total)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          s.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                            : 'bg-destructive/10 text-destructive border border-destructive/20'
                        }`}
                      >
                        {s.status === 'completed' ? t('sales.completed', 'مكتملة') : t('sales.voided', 'ملغاة')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-[11px]">
                      {formatDate(s.created_at, true)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenDetails(s.id)}
                          className="p-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors"
                          title={t('sales.viewDetails', 'عرض التفاصيل')}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenReceipt(s)}
                          className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                          title={t('sales.printReceipt', 'طباعة الإيصال')}
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sale Details Modal */}
      <SaleDetailsModal
        saleId={selectedSaleId}
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        onViewReceipt={(s) => {
          setDetailsModalOpen(false)
          handleOpenReceipt(s)
        }}
      />

      {/* Receipt Modal */}
      <ReceiptModal
        receipt={activeReceipt}
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
      />
    </div>
  )
}

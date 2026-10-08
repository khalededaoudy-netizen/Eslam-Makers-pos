/**
 * MAKERS POS — Sale Details Modal Component
 * Displays complete transaction record with line items, payments, and receipt launcher.
 */

import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FileText,
  X,
  Printer,
  Calendar,
  User,
  Hash,
  CreditCard,
  Layers,
  AlertCircle,
  Clock,
  ShieldCheck,
  MessageSquare,
} from 'lucide-react'
import { Sale, SaleItem, SalePayment } from '../types'
import { salesService } from '../salesService'
import { receiptService } from '../receiptService'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { PAYMENT_METHODS, PaymentMethodType } from '@/features/payments/types'
import { useSettingsStore } from '@/stores/settingsStore'

interface SaleDetailsModalProps {
  saleId: string | null
  isOpen: boolean
  onClose: () => void
  onViewReceipt: (sale: Sale, autoWhatsApp?: boolean) => void
}

export function SaleDetailsModal({
  saleId,
  isOpen,
  onClose,
  onViewReceipt,
}: SaleDetailsModalProps) {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language !== 'en'
  const { currencySymbol } = useSettingsStore()

  const [sale, setSale] = useState<Sale | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && saleId) {
      setLoading(true)
      setError(null)
      salesService
        .getSaleById(saleId)
        .then((data) => {
          if (data) setSale(data)
          else setError(t('sales.notFound', 'لم يتم العثور على تفاصيل الفاتورة'))
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false))
    }
  }, [isOpen, saleId])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h3 className="text-base font-bold text-foreground">
              {t('sales.saleDetails', 'تفاصيل فاتورة المبيعات')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Loading / Error States */}
        {loading && (
          <div className="p-12 text-center text-xs text-muted-foreground">
            {t('common.loading', 'جاري التحميل...')}
          </div>
        )}

        {error && (
          <div className="p-6 text-center text-destructive text-xs font-semibold">
            {error}
          </div>
        )}

        {/* Content */}
        {!loading && sale && (
          <div className="p-6 overflow-y-auto space-y-6 text-xs flex-1">
            {/* Meta Top Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-muted/30 border border-border">
                <span className="text-muted-foreground block">{t('sales.invoiceNumber', 'رقم الفاتورة')}</span>
                <span className="font-bold font-mono text-sm text-primary">{sale.invoice_number}</span>
              </div>
              <div className="p-3 rounded-xl bg-muted/30 border border-border">
                <span className="text-muted-foreground block">{t('common.date', 'التاريخ')}</span>
                <span className="font-semibold">{formatDate(sale.created_at, true)}</span>
              </div>
              <div className="p-3 rounded-xl bg-muted/30 border border-border">
                <span className="text-muted-foreground block">{t('sales.cashier', 'الكاشير')}</span>
                <span className="font-semibold">{sale.cashier_name}</span>
              </div>
              <div className="p-3 rounded-xl bg-muted/30 border border-border">
                <span className="text-muted-foreground block">{t('sales.customer', 'العميل')}</span>
                <span className="font-semibold">{sale.customer_name || t('pos.walkIn', 'عميل عابر')}</span>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="space-y-2">
              <h4 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-primary" />
                <span>{t('sales.items', 'أصناف الفاتورة')}</span>
              </h4>

              <div className="border border-border rounded-xl overflow-hidden bg-card">
                <table className="w-full text-start">
                  <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold">
                    <tr>
                      <th className="px-3 py-2 text-start">{t('products.name', 'الصنف')}</th>
                      <th className="px-3 py-2 text-center">{t('common.quantity', 'الكمية')}</th>
                      <th className="px-3 py-2 text-end">{t('common.price', 'السعر')}</th>
                      <th className="px-3 py-2 text-end">{t('pos.discount', 'الخصم')}</th>
                      <th className="px-3 py-2 text-end">{t('common.total', 'الإجمالي')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-mono">
                    {(sale.items || []).map((item) => (
                      <tr key={item.id} className="hover:bg-muted/20">
                        <td className="px-3 py-2 font-sans">
                          <p className="font-semibold text-foreground">{item.product_name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{item.product_sku}</p>
                        </td>
                        <td className="px-3 py-2 text-center font-bold">{item.quantity}</td>
                        <td className="px-3 py-2 text-end">{item.unit_price.toFixed(2)}</td>
                        <td className="px-3 py-2 text-end text-destructive">
                          {item.discount_amount > 0 ? `-${item.discount_amount.toFixed(2)}` : '0.00'}
                        </td>
                        <td className="px-3 py-2 text-end font-bold text-foreground">
                          {item.subtotal.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary & Payments */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Payment Methods */}
              <div className="p-4 rounded-xl border border-border bg-muted/10 space-y-2">
                <h4 className="font-bold text-foreground flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-primary" />
                  <span>{t('payments.title', 'طرق السداد المسجلة')}</span>
                </h4>

                <div className="space-y-1.5 pt-1">
                  {(sale.payments || []).map((p) => {
                    const meta = PAYMENT_METHODS[p.method as PaymentMethodType]
                    return (
                      <div key={p.id} className="flex justify-between items-center py-1 border-b border-border/30 last:border-0 font-mono">
                        <span className="font-sans font-medium">
                          {isArabic ? meta?.nameAr || p.method : meta?.nameEn || p.method}
                          {p.reference ? ` (${p.reference})` : ''}
                        </span>
                        <span className="font-bold">{p.amount.toFixed(2)} {currencySymbol}</span>
                      </div>
                    )
                  })}

                  <div className="flex justify-between pt-2 border-t border-border font-bold">
                    <span>{t('payments.paidAmount', 'المدفوع')}:</span>
                    <span>{sale.paid_amount.toFixed(2)} {currencySymbol}</span>
                  </div>
                  {sale.change_amount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-bold">
                      <span>{t('payments.change', 'الفكة المستردة')}:</span>
                      <span>{sale.change_amount.toFixed(2)} {currencySymbol}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Totals */}
              <div className="p-4 rounded-xl border border-border bg-muted/10 space-y-2 font-mono">
                <h4 className="font-bold text-foreground font-sans flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <span>{t('sales.summary', 'ملخص الحسابات')}</span>
                </h4>

                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-sans">{t('pos.subtotal', 'المجموع الفرعي')}:</span>
                    <span>{sale.subtotal.toFixed(2)} {currencySymbol}</span>
                  </div>
                  {sale.discount_amount > 0 && (
                    <div className="flex justify-between text-destructive">
                      <span className="font-sans">{t('pos.discount', 'الخصم')}:</span>
                      <span>-{sale.discount_amount.toFixed(2)} {currencySymbol}</span>
                    </div>
                  )}
                  {sale.tax_amount > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span className="font-sans">{t('pos.tax', 'الضريبة')}:</span>
                      <span>+{sale.tax_amount.toFixed(2)} {currencySymbol}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-foreground pt-2 border-t border-border">
                    <span className="font-sans">{t('common.total', 'الإجمالي')}:</span>
                    <span className="text-primary">{sale.total.toFixed(2)} {currencySymbol}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-card flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold transition-colors"
          >
            {t('common.close', 'إغلاق')}
          </button>

          {sale && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onViewReceipt(sale, true)}
                className="px-4 py-2.5 rounded-xl bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600/25 border border-emerald-500/30 font-bold text-xs transition-colors flex items-center gap-2 shadow-sm"
                title={t('whatsapp.send', 'إرسال على واتساب')}
              >
                <MessageSquare className="w-4 h-4" />
                <span>{t('whatsapp.send', 'إرسال على واتساب')}</span>
              </button>

              <button
                type="button"
                onClick={() => onViewReceipt(sale, false)}
                className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>{t('sales.viewReceipt', 'عرض وطباعة الإيصال')}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

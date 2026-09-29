/**
 * MAKERS POS — Return Details Modal
 */

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { RotateCcw, X, Printer, User, Clock, Package, DollarSign, AlertTriangle, ShieldCheck } from 'lucide-react'
import { Return, ReturnReceiptData } from '../types'
import { returnService } from '../returnService'
import { returnReceiptService } from '../returnReceiptService'

interface ReturnDetailsModalProps {
  returnId: string
  onClose: () => void
  onOpenReceipt: (receipt: ReturnReceiptData) => void
}

export function ReturnDetailsModal({ returnId, onClose, onOpenReceipt }: ReturnDetailsModalProps) {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'ar'
  const [returnData, setReturnData] = useState<Return | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadReturn() {
      setLoading(true)
      try {
        const data = await returnService.getReturnById(returnId)
        if (!data) throw new Error('Return record not found')
        setReturnData(data)
      } catch (err: any) {
        console.error('Failed to load return details:', err)
        setError(err.message || 'Failed to load return details')
      } finally {
        setLoading(false)
      }
    }

    loadReturn()
  }, [returnId])

  const handlePrintReceipt = async () => {
    if (!returnData) return
    try {
      const receipt = await returnReceiptService.buildReceiptData(returnData)
      onOpenReceipt(receipt)
    } catch (err) {
      console.error('Failed to generate return receipt:', err)
    }
  }

  const getConditionLabel = (condition: string) => {
    switch (condition) {
      case 'resellable':
        return isRtl ? 'سليم (مخزون)' : 'Resellable'
      case 'damaged':
        return isRtl ? 'تالف (معزول)' : 'Damaged'
      case 'defective':
        return isRtl ? 'معيب' : 'Defective'
      default:
        return condition
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <span>{t('returns.returnDetails', 'تفاصيل إشعار المرتجع')}</span>
                {returnData && (
                  <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {returnData.returnNumber}
                  </span>
                )}
              </h2>
              <p className="text-xs text-muted-foreground">
                {returnData ? `${t('returns.originalSale', 'الفاتورة الأصلية')}: ${returnData.saleInvoiceNumber || 'N/A'}` : ''}
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

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading && (
            <div className="py-16 text-center text-muted-foreground">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent mb-3" />
              <p className="text-sm">{t('common.loading', 'جاري التحميل...')}</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-3 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && returnData && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-muted/30 border border-border">
                  <span className="text-xs text-muted-foreground block">{t('sales.customer', 'العميل')}</span>
                  <span className="font-bold text-foreground mt-1 block truncate">
                    {returnData.customerName || t('common.walkInCustomer', 'عميل نقدي')}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-muted/30 border border-border">
                  <span className="text-xs text-muted-foreground block">{t('sales.cashier', 'الكاشير')}</span>
                  <span className="font-bold text-foreground mt-1 block truncate">{returnData.userName || 'Cashier'}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-muted/30 border border-border">
                  <span className="text-xs text-muted-foreground block">{t('common.date', 'التاريخ والوقت')}</span>
                  <span className="font-medium text-foreground text-xs mt-1 block">
                    {new Date(returnData.createdAt).toLocaleString(isRtl ? 'ar-EG' : 'en-US')}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20">
                  <span className="text-xs text-primary block font-medium">{t('returns.refundAmount', 'مبلغ الاسترداد')}</span>
                  <span className="text-lg font-extrabold text-primary font-mono mt-0.5 block">
                    {returnData.refundAmount.toFixed(2)} ج.م
                  </span>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" />
                  <span>{t('returns.returnedItems', 'الأصناف المسترجعة')}</span>
                </h3>

                <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
                  <div className="grid grid-cols-12 gap-2 p-3 bg-muted/40 font-bold text-xs text-muted-foreground border-b border-border">
                    <span className="col-span-5">{t('products.name', 'الصنف')}</span>
                    <span className="col-span-2 text-center">{t('common.quantity', 'الكمية')}</span>
                    <span className="col-span-2">{t('returns.condition', 'الحالة')}</span>
                    <span className="col-span-3 text-end">{t('returns.refundValue', 'الاسترداد')}</span>
                  </div>

                  <div className="divide-y divide-border">
                    {(returnData.items || []).map((item) => (
                      <div key={item.id} className="grid grid-cols-12 gap-2 p-3 items-center text-xs">
                        <div className="col-span-5">
                          <span className="font-bold text-foreground block truncate">{item.productName}</span>
                          <span className="text-[11px] text-muted-foreground font-mono">SKU: {item.productSku}</span>
                        </div>
                        <div className="col-span-2 text-center font-mono font-bold">{item.quantity}</div>
                        <div className="col-span-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-block ${
                              item.condition === 'resellable'
                                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                            }`}
                          >
                            {getConditionLabel(item.condition)}
                          </span>
                        </div>
                        <div className="col-span-3 text-end font-mono font-extrabold text-foreground">
                          {item.lineTotal.toFixed(2)} ج.م
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Payments Breakdown */}
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary" />
                  <span>{t('returns.refundMethods', 'طرق السداد / الاسترداد المسجلة')}</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(returnData.payments || []).map((pay) => (
                    <div key={pay.id} className="p-3 rounded-xl bg-muted/20 border border-border flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-foreground uppercase tracking-wider block">{pay.method}</span>
                        {pay.reference && (
                          <span className="text-[11px] text-muted-foreground font-mono">Ref: {pay.reference}</span>
                        )}
                      </div>
                      <span className="font-mono font-extrabold text-sm text-primary">{pay.amount.toFixed(2)} ج.م</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reason / Notes */}
              {(returnData.reason || returnData.notes) && (
                <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-1 text-xs">
                  {returnData.reason && (
                    <p>
                      <span className="font-bold text-muted-foreground">{t('returns.reason', 'السبب')}: </span>
                      <span className="text-foreground">{returnData.reason}</span>
                    </p>
                  )}
                  {returnData.notes && (
                    <p>
                      <span className="font-bold text-muted-foreground">{t('common.notes', 'ملاحظات')}: </span>
                      <span className="text-foreground">{returnData.notes}</span>
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-between gap-3">
          <button
            onClick={handlePrintReceipt}
            disabled={!returnData}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all text-sm active:scale-95 disabled:opacity-40"
          >
            <Printer className="w-4 h-4" />
            <span>{t('returns.viewReceipt', 'عرض وطباعة الإشعار')}</span>
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-accent text-accent-foreground font-semibold hover:bg-accent/80 transition-all text-sm"
          >
            {t('common.close', 'إغلاق')}
          </button>
        </div>
      </div>
    </div>
  )
}

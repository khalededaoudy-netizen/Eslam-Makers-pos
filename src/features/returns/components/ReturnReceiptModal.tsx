/**
 * MAKERS POS — Return Receipt Preview Modal
 */

import React, { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Printer, X, RotateCcw, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { ReturnReceiptData } from '../types'
import { useSettingsStore } from '@/stores/settingsStore'

interface ReturnReceiptModalProps {
  receipt: ReturnReceiptData
  onClose: () => void
}

export function ReturnReceiptModal({ receipt, onClose }: ReturnReceiptModalProps) {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'ar'
  const settingsStore = useSettingsStore()
  const paperWidth = settingsStore.receiptPaperWidth || '80mm'
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = () => {
    window.print()
  }

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'cash':
        return isRtl ? 'نقداً' : 'Cash'
      case 'card':
        return isRtl ? 'بطاقة بنكية' : 'Card'
      case 'instapay':
        return isRtl ? 'إنستاباي (InstaPay)' : 'InstaPay'
      case 'vodafone_cash':
        return isRtl ? 'فودافون كاش' : 'Vodafone Cash'
      case 'bank_transfer':
        return isRtl ? 'تحويل بنكي' : 'Bank Transfer'
      default:
        return method
    }
  }

  const getConditionLabel = (condition: string) => {
    switch (condition) {
      case 'resellable':
        return isRtl ? 'سليم (إعادة للمخزون)' : 'Resellable (Restocked)'
      case 'damaged':
        return isRtl ? 'تالف (عزل)' : 'Damaged (Quarantined)'
      case 'defective':
        return isRtl ? 'معيب / صيانة' : 'Defective'
      default:
        return condition
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header (Hidden on Print) */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40 no-print">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold">{t('returns.receiptPreview', 'إيصال مرتجع مبيعات')}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Thermal Receipt Container */}
        <div className="p-6 overflow-y-auto flex-1 bg-neutral-900/50 flex justify-center">
          <div
            id="printable-receipt"
            ref={printRef}
            className={`w-full max-w-[340px] bg-white text-black p-5 rounded-lg shadow-md font-mono text-xs leading-relaxed print:shadow-none print:max-w-none print:w-full print:p-0 receipt-${paperWidth}`}
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            {/* Header / Store Info */}
            <div className="text-center pb-3 border-b border-dashed border-gray-400">
              <h1 className="text-base font-extrabold uppercase tracking-wider">{receipt.storeName}</h1>
              {receipt.storeSubtitle && <p className="text-[10px] text-gray-700">{receipt.storeSubtitle}</p>}
              {receipt.storeAddress && <p className="text-[10px] text-gray-700 mt-0.5">{receipt.storeAddress}</p>}
              {receipt.storePhone && <p className="text-[10px] text-gray-700 font-sans">{receipt.storePhone}</p>}
              <div className="mt-2 py-1 px-2 bg-amber-100 text-amber-900 font-bold text-center rounded border border-amber-300">
                {receipt.receiptHeader || (isRtl ? 'إشعار مرتجع مبيعات' : 'SALES RETURN NOTE')}
              </div>
            </div>

            {/* Metadata */}
            <div className="py-2.5 border-b border-dashed border-gray-400 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-gray-600">{isRtl ? 'رقم المرتجع:' : 'Return #:'}</span>
                <span className="font-bold">{receipt.returnNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{isRtl ? 'الفاتورة الأصلية:' : 'Original Sale #:'}</span>
                <span className="font-bold">{receipt.originalSaleNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{isRtl ? 'التاريخ:' : 'Date:'}</span>
                <span>{new Date(receipt.createdAt).toLocaleString(isRtl ? 'ar-EG' : 'en-US')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{isRtl ? 'الكاشير:' : 'Cashier:'}</span>
                <span>{receipt.cashierName}</span>
              </div>
              {receipt.customerName && (
                <div className="flex justify-between">
                  <span className="text-gray-600">{isRtl ? 'العميل:' : 'Customer:'}</span>
                  <span className="font-semibold">{receipt.customerName}</span>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="py-3 border-b border-dashed border-gray-400">
              <div className="flex justify-between font-bold pb-1 text-[11px] border-b border-gray-300">
                <span className="w-1/2">{isRtl ? 'الصنف المسترجع' : 'Item'}</span>
                <span className="w-1/6 text-center">{isRtl ? 'الكمية' : 'Qty'}</span>
                <span className="w-1/3 text-end">{isRtl ? 'الاسترداد' : 'Refund'}</span>
              </div>
              <div className="space-y-2 mt-2">
                {receipt.items.map((item, idx) => (
                  <div key={idx} className="flex flex-col">
                    <div className="flex justify-between font-medium">
                      <span className="w-1/2 truncate font-bold">{item.productName}</span>
                      <span className="w-1/6 text-center">{item.quantity}</span>
                      <span className="w-1/3 text-end font-bold">{item.lineTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-600">
                      <span>SKU: {item.sku}</span>
                      <span className="text-amber-800 font-semibold">{getConditionLabel(item.condition)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="py-2.5 border-b border-dashed border-gray-400 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-gray-600">{isRtl ? 'إجمالي الأصناف:' : 'Subtotal:'}</span>
                <span>{receipt.subtotal.toFixed(2)} ج.م</span>
              </div>
              {receipt.discountAmount > 0 && (
                <div className="flex justify-between text-red-700">
                  <span>{isRtl ? 'خصم مسترجع:' : 'Returned Discount:'}</span>
                  <span>-{receipt.discountAmount.toFixed(2)} ج.م</span>
                </div>
              )}
              {receipt.taxAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">{isRtl ? 'ضريبة مستردة:' : 'Refunded Tax:'}</span>
                  <span>+{receipt.taxAmount.toFixed(2)} ج.م</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-extrabold pt-1.5 border-t border-gray-300">
                <span>{isRtl ? 'إجمالي مبلغ الاسترداد:' : 'Total Refund:'}</span>
                <span>{receipt.refundTotal.toFixed(2)} ج.م</span>
              </div>
            </div>

            {/* Refund Payment Breakdown */}
            <div className="py-2.5 border-b border-dashed border-gray-400 space-y-1 text-[11px]">
              <span className="font-bold text-gray-700 block">{isRtl ? 'طريقة الاسترداد:' : 'Refund Method(s):'}</span>
              {receipt.refundMethods.map((p, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{getMethodLabel(p.method)} {p.reference ? `(${p.reference})` : ''}</span>
                  <span className="font-semibold">{p.amount.toFixed(2)} ج.م</span>
                </div>
              ))}
            </div>

            {/* Reason & Notes */}
            {receipt.reason && (
              <div className="py-2 text-[10px] text-gray-600 border-b border-dashed border-gray-400">
                <span className="font-bold">{isRtl ? 'سبب الإرجاع: ' : 'Reason: '}</span>
                <span>{receipt.reason}</span>
              </div>
            )}

            {/* Footer */}
            <div className="text-center pt-3 text-[10px] text-gray-600 space-y-1">
              {receipt.receiptFooter && <p>{receipt.receiptFooter}</p>}
              <p className="text-[9px] text-gray-400">MAKERS POS — Point of Sale</p>
            </div>
          </div>
        </div>

        {/* Action Buttons (Hidden on Print) */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-muted/20 gap-3 no-print">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all shadow-md active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>{t('returns.printReceipt', 'طباعة الإشعار')}</span>
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-accent text-accent-foreground font-semibold hover:bg-accent/80 transition-all active:scale-95"
          >
            {t('common.close', 'إغلاق')}
          </button>
        </div>
      </div>
    </div>
  )
}

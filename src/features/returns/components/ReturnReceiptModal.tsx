/**
 * MAKERS POS — Modern Return Receipt Preview Modal (80mm)
 * Redesigned for high-contrast thermal printing & modern preview.
 */

import React, { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Printer, X, RotateCcw, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { ReturnReceiptData } from '../types'
import { formatDate } from '@/lib/formatters'
import { useSettingsStore } from '@/stores/settingsStore'
import { printReceiptDirect } from '@/services/printer/directPrint'
import makersLogo from '@/assets/logo.png'

interface ReturnReceiptModalProps {
  receipt: ReturnReceiptData
  onClose: () => void
}

export function ReturnReceiptModal({ receipt, onClose }: ReturnReceiptModalProps) {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'ar'
  const settingsStore = useSettingsStore()
  const currencySymbol = settingsStore.currencySymbol || 'ج.م'
  const printRef = useRef<HTMLDivElement>(null)

  const [isPrinting, setIsPrinting] = useState(false)
  const [printFeedback, setPrintFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const handlePrint = async () => {
    if (isPrinting) return
    setIsPrinting(true)
    setPrintFeedback(null)

    try {
      const el = document.getElementById('printable-receipt')
      const targetPrinter = settingsStore.defaultPrinter || 'Default'
      const res = await printReceiptDirect(el, targetPrinter)

      if (res.success) {
        setPrintFeedback({
          type: 'success',
          message: isRtl ? 'تم إرسال إشعار المرتجع للطابعة بنجاح' : 'Return receipt sent to printer',
        })
      } else {
        setPrintFeedback({
          type: 'error',
          message: res.message || (isRtl ? 'فشل في الطباعة' : 'Print failed'),
        })
      }
    } catch (err: any) {
      console.error('[ReturnReceiptModal] Print error:', err)
      setPrintFeedback({
        type: 'error',
        message: err?.message || (isRtl ? 'فشل في إرسال أمر الطباعة' : 'Failed to print'),
      })
    } finally {
      setIsPrinting(false)
      setTimeout(() => {
        setPrintFeedback(null)
      }, 4000)
    }
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
        return isRtl ? 'سليم' : 'Resellable'
      case 'damaged':
        return isRtl ? 'تالف' : 'Damaged'
      case 'defective':
        return isRtl ? 'معيب' : 'Defective'
      default:
        return condition
    }
  }

  const storeNameEn = receipt.storeName || settingsStore.storeName || 'Electronics Components'
  const storeNameAr = receipt.storeSubtitle || settingsStore.storeSubtitle || 'مايكرز لمكونات إلكترونية'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header (Hidden on Print) */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40 no-print">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold">{t('returns.receiptPreview', 'إيصال مرتجع مبيعات')}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert */}
        {printFeedback && (
          <div
            className={`mx-6 mt-3 px-4 py-2.5 rounded-xl flex items-center gap-2 text-xs font-semibold animate-in fade-in ${
              printFeedback.type === 'success'
                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-destructive/15 border border-destructive/30 text-destructive'
            }`}
          >
            {printFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{printFeedback.message}</span>
          </div>
        )}


        {/* Printable Thermal Receipt Container */}
        <div className="p-6 overflow-y-auto flex-1 bg-muted/20 flex justify-center items-start">
          <div
            id="printable-receipt"
            ref={printRef}
            className="w-full max-w-[280px] bg-white text-black p-3 sm:p-4 rounded-lg shadow-md font-sans text-xs leading-relaxed print:shadow-none print:max-w-none print:w-full print:p-0 print:rounded-none"
            style={{ margin: '0 auto', boxSizing: 'border-box', textAlign: 'center', width: '100%', maxWidth: '280px', overflow: 'hidden' }}
            dir="rtl"
          >
            {/* HEADER */}
            <div className="r-header text-center" style={{ textAlign: 'center', marginBottom: '8px', padding: '0 4px' }}>
              <img
                src={makersLogo}
                alt="MAKERS"
                style={{ display: 'block', margin: '0 auto 6px auto', maxWidth: '35mm', height: 'auto' }}
              />
              <div style={{ fontSize: '15px', fontWeight: 'bold', letterSpacing: '0.5px', marginBottom: '2px' }}>
                {storeNameEn}
              </div>
              <div style={{ fontSize: '12px', color: '#222', marginBottom: '4px' }}>
                {storeNameAr}
              </div>
              <div style={{ fontSize: '10.5px', color: '#333', lineHeight: '1.4', marginTop: '3px' }}>
                <div style={{ wordBreak: 'break-word', marginBottom: '2px' }}>
                  {receipt.storeAddress || settingsStore.storeAddress || 'العاشر من رمضان - الموقف الجديد - مول City A'}
                </div>
                <div className="receipt-num" dir="ltr" style={{ fontWeight: '500', whiteSpace: 'nowrap', textAlign: 'center' }}>
                  01002126625 &nbsp;-&nbsp; 01505988928
                </div>
              </div>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#000', margin: '6px 0 2px 0' }}>
                {isRtl ? 'إشعار مرتجع مبيعات' : 'SALES RETURN NOTE'}
              </div>
            </div>

            <div style={{ borderTop: '1px solid #000', margin: '8px 0' }} />

            {/* INFO TABLE */}
            <table style={{ width: '100%', margin: '0 auto', borderCollapse: 'collapse', fontSize: '11.5px', direction: 'rtl' }}>
              <tbody>
                <tr>
                  <td style={{ textAlign: 'right', fontWeight: '600', padding: '2px 4px', whiteSpace: 'nowrap' }}>
                    {isRtl ? 'رقم الفاتورة:' : 'Invoice #:'}
                  </td>
                  <td style={{ textAlign: 'left', direction: 'ltr', padding: '2px 4px' }} className="receipt-num">
                    #{receipt.returnNumber}
                  </td>
                </tr>
                <tr>
                  <td style={{ textAlign: 'right', fontWeight: '600', padding: '2px 4px', whiteSpace: 'nowrap' }}>
                    {isRtl ? 'التاريخ:' : 'Date:'}
                  </td>
                  <td style={{ textAlign: 'left', direction: 'ltr', padding: '2px 4px' }} className="receipt-num">
                    {formatDate(receipt.createdAt, true)}
                  </td>
                </tr>
                <tr>
                  <td style={{ textAlign: 'right', fontWeight: '600', padding: '2px 4px', whiteSpace: 'nowrap' }}>
                    {isRtl ? 'الكاشير:' : 'Cashier:'}
                  </td>
                  <td style={{ textAlign: 'left', padding: '2px 4px' }}>
                    {receipt.cashierName}
                  </td>
                </tr>
                {receipt.customerName && (
                  <tr>
                    <td style={{ textAlign: 'right', fontWeight: '600', padding: '2px 4px', whiteSpace: 'nowrap' }}>
                      {isRtl ? 'العميل:' : 'Customer:'}
                    </td>
                    <td style={{ textAlign: 'left', padding: '2px 4px', wordBreak: 'break-word' }}>
                      {receipt.customerName}
                    </td>
                  </tr>
                )}
                {receipt.customerCode && (
                  <tr>
                    <td style={{ textAlign: 'right', fontWeight: '600', padding: '2px 4px', whiteSpace: 'nowrap' }}>
                      {isRtl ? 'كود العميل:' : 'Customer Code:'}
                    </td>
                    <td style={{ textAlign: 'left', direction: 'ltr', padding: '2px 4px' }} className="receipt-num">
                      {receipt.customerCode}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div style={{ borderTop: '1px solid #000', margin: '8px 0' }} />

            {/* ITEMS TABLE */}
            <table
              className="r-table"
              style={{
                width: '100%',
                margin: '0 auto',
                tableLayout: 'fixed',
                borderCollapse: 'collapse',
                direction: 'rtl',
                fontSize: '11px',
              }}
            >
              <colgroup>
                <col style={{ width: '22px' }} />
                <col style={{ width: 'auto' }} />
                <col style={{ width: '30px' }} />
                <col style={{ width: '58px' }} />
              </colgroup>
              <thead>
                <tr style={{ borderTop: '1px solid #000', borderBottom: '2px solid #000', background: '#fff' }}>
                  <th className="col-index" style={{ width: '22px', textAlign: 'center', padding: '5px 2px', verticalAlign: 'middle', lineHeight: '1.35', border: '1px solid #000', boxSizing: 'border-box' }}>#</th>
                  <th className="col-name th-name" style={{ textAlign: 'right', padding: '5px 4px', verticalAlign: 'middle', lineHeight: '1.35', border: '1px solid #000', boxSizing: 'border-box' }}>{isRtl ? 'الصنف' : 'Item'}</th>
                  <th className="col-qty" style={{ width: '30px', textAlign: 'center', padding: '5px 2px', verticalAlign: 'middle', lineHeight: '1.35', border: '1px solid #000', boxSizing: 'border-box' }}>{isRtl ? 'كم' : 'Qty'}</th>
                  <th className="col-refund" style={{ width: '58px', textAlign: 'center', padding: '5px 2px', verticalAlign: 'middle', lineHeight: '1.35', border: '1px solid #000', boxSizing: 'border-box' }}>{isRtl ? 'الاسترداد' : 'Refund'}</th>
                </tr>
              </thead>
              <tbody>
                {receipt.items.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #000' }}>
                    <td className="col-index receipt-num" style={{ textAlign: 'center', padding: '4px 2px', verticalAlign: 'middle', lineHeight: '1.35', border: '1px solid #000', boxSizing: 'border-box' }}>
                      {i + 1}
                    </td>
                    <td className="col-name td-name" style={{ textAlign: 'right', padding: '4px 4px', verticalAlign: 'middle', lineHeight: '1.35', border: '1px solid #000', wordBreak: 'break-word', overflowWrap: 'break-word', boxSizing: 'border-box' }}>
                      <div dir="auto" style={{ fontWeight: '600', textAlign: 'right', wordBreak: 'break-word', overflowWrap: 'break-word', lineHeight: '1.3' }}>{item.productName}</div>
                      <div style={{ fontSize: '9px', color: '#444', marginTop: '1px', textAlign: 'right', direction: 'rtl', lineHeight: '1.2' }}>
                        {item.sku && <span className="receipt-num" style={{ direction: 'ltr' }}>{item.sku} • </span>}
                        <span>{getConditionLabel(item.condition)}</span>
                      </div>
                    </td>
                    <td className="col-qty" style={{ textAlign: 'center', padding: '4px 2px', verticalAlign: 'middle', lineHeight: '1.35', border: '1px solid #000', boxSizing: 'border-box' }}>
                      <span className="receipt-num" style={{ display: 'block', textAlign: 'center', direction: 'ltr' }}>{item.quantity}</span>
                    </td>
                    <td className="col-refund" style={{ textAlign: 'center', padding: '4px 2px', verticalAlign: 'middle', lineHeight: '1.35', border: '1px solid #000', boxSizing: 'border-box' }}>
                      <span className="receipt-num" style={{ display: 'block', textAlign: 'center', direction: 'ltr', fontWeight: 'bold' }}>{item.lineTotal.toFixed(2)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ borderTop: '1px solid #000', margin: '8px 0' }} />

            {/* SUBTOTAL & DEDUCTIONS */}
            <table style={{ width: '100%', margin: '0 auto', borderCollapse: 'collapse', fontSize: '12px', direction: 'rtl' }}>
              <tbody>
                <tr>
                  <td style={{ textAlign: 'right', padding: '3px 4px', fontWeight: '600' }}>
                    {isRtl ? 'إجمالي الأصناف:' : 'Subtotal:'}
                  </td>
                  <td style={{ textAlign: 'left', direction: 'ltr', padding: '3px 4px' }} className="receipt-num">
                    {receipt.subtotal.toFixed(2)} {currencySymbol}
                  </td>
                </tr>
                {receipt.discountAmount > 0 && (
                  <tr>
                    <td style={{ textAlign: 'right', padding: '3px 4px', fontWeight: '600' }}>
                      {isRtl ? 'خصم مسترجع:' : 'Returned Discount:'}
                    </td>
                    <td style={{ textAlign: 'left', direction: 'ltr', padding: '3px 4px' }} className="receipt-num">
                      -{receipt.discountAmount.toFixed(2)} {currencySymbol}
                    </td>
                  </tr>
                )}
                {receipt.taxAmount > 0 && (
                  <tr>
                    <td style={{ textAlign: 'right', padding: '3px 4px', fontWeight: '600' }}>
                      {isRtl ? 'ضريبة مستردة:' : 'Refunded Tax:'}
                    </td>
                    <td style={{ textAlign: 'left', direction: 'ltr', padding: '3px 4px' }} className="receipt-num">
                      +{receipt.taxAmount.toFixed(2)} {currencySymbol}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div style={{ borderTop: '1px solid #000', margin: '8px 0' }} />

            {/* FINAL REFUND TOTAL (BOLD & LARGER) */}
            <table style={{ width: '100%', margin: '0 auto', borderCollapse: 'collapse', fontSize: '14px', fontWeight: 'bold', direction: 'rtl' }}>
              <tbody>
                <tr>
                  <td style={{ textAlign: 'right', padding: '4px 4px' }}>
                    {isRtl ? 'مبلغ الاسترداد:' : 'Total Refund:'}
                  </td>
                  <td style={{ textAlign: 'left', direction: 'ltr', padding: '4px 4px' }} className="receipt-num">
                    {receipt.refundTotal.toFixed(2)} {currencySymbol}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* DOUBLE DIVIDER */}
            <div style={{ borderTop: '3px double #000', margin: '6px 0' }} />

            {/* REFUND METHODS */}
            {receipt.refundMethods && receipt.refundMethods.length > 0 && (
              <table style={{ width: '100%', margin: '0 auto', borderCollapse: 'collapse', fontSize: '11.5px', direction: 'rtl' }}>
                <tbody>
                  <tr>
                    <td style={{ textAlign: 'right', padding: '2px 4px', fontWeight: '600' }}>
                      {isRtl ? 'طريقة الاسترداد:' : 'Refund Method:'}
                    </td>
                    <td style={{ textAlign: 'left', padding: '2px 4px' }} className="receipt-num">
                      {receipt.refundMethods.map(m => getMethodLabel(m.method)).join(', ')}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}

            {/* FOOTER */}
            <div style={{ textAlign: 'center', marginTop: '14px', fontSize: '11px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '2px' }}>
                {isRtl ? 'إشعار مرتجع' : 'Sales Return Note'}
              </div>
              <div style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '11px', letterSpacing: '1px', marginBottom: '2px' }} className="receipt-num">
                *{receipt.returnNumber}*
              </div>
              <div style={{ fontWeight: 'bold', fontSize: '11px', letterSpacing: '1px' }} className="receipt-num">
                MAKERS POS
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons (Hidden on Print) */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-card gap-3 no-print">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold transition-colors"
          >
            {t('common.close', 'إغلاق')}
          </button>
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            {isPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            <span>{isPrinting ? (isRtl ? 'جاري الطباعة...' : 'Printing...') : t('returns.printReceipt', 'طباعة الإشعار')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

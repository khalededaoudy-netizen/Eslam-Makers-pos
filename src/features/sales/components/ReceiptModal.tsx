/**
 * MAKERS POS — Modern Thermal Receipt Modal Component (80mm)
 * Redesigned for high-contrast, structured 1-bit thermal printer output & rich UI preview.
 */

import React, { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Printer,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  MessageSquare,
  Eye,
} from 'lucide-react'
import { ReceiptData } from '../types'
import { formatDate } from '@/lib/formatters'
import { useSettingsStore } from '@/stores/settingsStore'
import { printReceiptDirect } from '@/services/printer/directPrint'
import { shareReceiptViaWhatsApp, WhatsAppShareResult } from '@/services/whatsapp/whatsappService'
import { WhatsAppShareModal } from './WhatsAppShareModal'
import makersLogo from '@/assets/logo.png'

interface ReceiptModalProps {
  receipt: ReceiptData | null
  isOpen: boolean
  onClose: () => void
  onNewSale?: () => void
  autoWhatsApp?: boolean
  autoPrint?: boolean
}

export function ReceiptModal({
  receipt,
  isOpen,
  onClose,
  onNewSale,
  autoWhatsApp = false,
  autoPrint = false,
}: ReceiptModalProps) {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language !== 'en'
  const settingsStore = useSettingsStore()
  const currencySymbol = settingsStore.currencySymbol || 'ج.م'
  const receiptRef = useRef<HTMLDivElement>(null)

  const [isPrinting, setIsPrinting] = useState(false)
  const [isSharingWhatsApp, setIsSharingWhatsApp] = useState(false)
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false)
  const [shareResult, setShareResult] = useState<WhatsAppShareResult | null>(null)
  const [printFeedback, setPrintFeedback] = useState<{ type: 'success' | 'error'; message: string; showPreview?: boolean } | null>(null)

  const autoWhatsAppTriggered = useRef(false)
  const autoPrintTriggered = useRef(false)

  // Reset auto-trigger refs when modal closes or receipt changes
  React.useEffect(() => {
    if (!isOpen) {
      autoWhatsAppTriggered.current = false
      autoPrintTriggered.current = false
    }
  }, [isOpen])

  const handlePrint = async () => {
    if (!receipt || isPrinting) return
    setIsPrinting(true)
    setPrintFeedback(null)

    try {
      const el = document.getElementById('printable-receipt')
      const targetPrinter = settingsStore.defaultPrinter || 'Default'
      const res = await printReceiptDirect(el, targetPrinter)

      if (res.success) {
        setPrintFeedback({
          type: 'success',
          message: isArabic ? 'تم إرسال الفاتورة للطابعة بنجاح' : 'Receipt sent to printer',
        })
      } else {
        setPrintFeedback({
          type: 'error',
          message: res.message || (isArabic ? 'فشل في الطباعة' : 'Print failed'),
        })
      }
    } catch (err: any) {
      console.error('[ReceiptModal] Print error:', err)
      setPrintFeedback({
        type: 'error',
        message: err?.message || (isArabic ? 'فشل في إرسال أمر الطباعة' : 'Failed to print'),
      })
    } finally {
      setIsPrinting(false)
      setTimeout(() => {
        setPrintFeedback(null)
      }, 4000)
    }
  }

  const handleWhatsApp = async () => {
    if (!receipt || isSharingWhatsApp) return
    setIsSharingWhatsApp(true)
    setPrintFeedback(null)

    try {
      let phone = receipt.customerPhone || null
      if (!phone) {
        const input = window.prompt(
          isArabic
            ? 'أدخل رقم الموبايل (أو اتركه فارغاً للبحث في جهات الاتصال):'
            : 'Enter phone number (or leave empty to pick a contact in WhatsApp):'
        )
        if (input === null) {
          setIsSharingWhatsApp(false)
          return
        }
        phone = input.trim() || null
      }

      const el = document.getElementById('printable-receipt')
      if (!el) {
        throw new Error(isArabic ? 'لم يتم العثور على الإيصال' : 'Receipt element not found')
      }

      const res = await shareReceiptViaWhatsApp(el, {
        phone: phone || undefined,
        customerName: receipt.customerName,
        invoiceNumber: receipt.invoiceNumber,
        total: receipt.total,
        storeName: receipt.storeName || settingsStore.storeName || 'MAKERS',
      })

      setShareResult(res)
      setPrintFeedback({
        type: 'success',
        message: isArabic
          ? 'تم فتح واتساب ونسخ صورة الفاتورة للحافظة (Ctrl+V للصق)'
          : 'Opened WhatsApp & copied receipt image to clipboard',
        showPreview: true,
      })
    } catch (err: any) {
      console.error('[ReceiptModal] WhatsApp share error:', err)
      setPrintFeedback({
        type: 'error',
        message: err?.message || (isArabic ? 'فشل في مشاركة الفاتورة عبر واتساب' : 'Failed to share receipt via WhatsApp'),
      })
    } finally {
      setIsSharingWhatsApp(false)
    }
  }

  // Trigger WhatsApp share automatically if requested via autoWhatsApp prop
  React.useEffect(() => {
    if (isOpen && autoWhatsApp && receipt && !autoWhatsAppTriggered.current) {
      autoWhatsAppTriggered.current = true
      const timer = setTimeout(() => {
        handleWhatsApp()
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [isOpen, autoWhatsApp, receipt])

  // Trigger Direct Print automatically if requested via autoPrint prop
  React.useEffect(() => {
    if (isOpen && autoPrint && receipt && !autoPrintTriggered.current) {
      autoPrintTriggered.current = true
      const timer = setTimeout(() => {
        handlePrint()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen, autoPrint, receipt])

  const handleDone = () => {
    onClose()
    if (onNewSale) {
      onNewSale()
    }
  }

  if (!isOpen || !receipt) return null

  // Store metadata
  const storeNameEn = receipt.storeName || settingsStore.storeName || 'Electronics Components'
  const storeNameAr = receipt.storeSubtitle || settingsStore.storeSubtitle || 'مايكرز لمكونات إلكترونية'
  const storePhone = receipt.storePhone || settingsStore.storePhone
  const storeAddress = receipt.storeAddress || settingsStore.storeAddress

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Actions (Hidden on Print) */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40 shrink-0 no-print">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <h3 className="text-base font-bold text-foreground">
              {t('sales.receiptPreview', 'إيصال البيع والعملية')}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleWhatsApp}
              disabled={isSharingWhatsApp}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1.5 text-xs font-semibold shadow-sm disabled:opacity-50"
              title={t('whatsapp.send', 'إرسال على واتساب')}
            >
              {isSharingWhatsApp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />}
              <span>{isSharingWhatsApp ? (isArabic ? 'جاري الفتح...' : 'Opening...') : t('whatsapp.send', 'واتساب')}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="p-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5 text-xs font-semibold shadow-sm disabled:opacity-50"
              title={t('common.print', 'طباعة')}
            >
              {isPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              <span>{isPrinting ? (isArabic ? 'جاري الطباعة...' : 'Printing...') : t('common.print', 'طباعة')}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {printFeedback && (
          <div
            className={`mx-6 mt-3 px-4 py-2.5 rounded-xl flex items-center justify-between gap-2 text-xs font-semibold animate-in fade-in ${
              printFeedback.type === 'success'
                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-destructive/15 border border-destructive/30 text-destructive'
            }`}
          >
            <div className="flex items-center gap-2">
              {printFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{printFeedback.message}</span>
            </div>
            {printFeedback.showPreview && shareResult && (
              <button
                type="button"
                onClick={() => setWhatsAppModalOpen(true)}
                className="underline hover:no-underline text-xs shrink-0 flex items-center gap-1 font-bold"
              >
                <Eye className="w-3 h-3" />
                <span>{isArabic ? 'عرض الخيارات' : 'Options'}</span>
              </button>
            )}
          </div>
        )}




        {/* Scrollable Receipt Preview Container */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-muted/20 flex justify-center items-start" ref={receiptRef}>
          {/* Printable Thermal Receipt Container */}
          <div
            id="printable-receipt"
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
                  {storeAddress || 'العاشر من رمضان - الموقف الجديد - مول City A'}
                </div>
                <div className="receipt-num" dir="ltr" style={{ fontWeight: '500', whiteSpace: 'nowrap', textAlign: 'center' }}>
                  01002126625 &nbsp;-&nbsp; 01505988928
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #000', margin: '8px 0' }} />

            {/* INFO TABLE */}
            <table style={{ width: '100%', margin: '0 auto', borderCollapse: 'collapse', fontSize: '11.5px', direction: 'rtl' }}>
              <tbody>
                <tr>
                  <td style={{ textAlign: 'right', fontWeight: '600', padding: '2px 4px', whiteSpace: 'nowrap' }}>
                    {t('sales.invoiceNumber', 'رقم الفاتورة')}:
                  </td>
                  <td style={{ textAlign: 'left', direction: 'ltr', padding: '2px 4px' }} className="receipt-num">
                    #{receipt.invoiceNumber}
                  </td>
                </tr>
                <tr>
                  <td style={{ textAlign: 'right', fontWeight: '600', padding: '2px 4px', whiteSpace: 'nowrap' }}>
                    {t('common.date', 'التاريخ')}:
                  </td>
                  <td style={{ textAlign: 'left', direction: 'ltr', padding: '2px 4px' }} className="receipt-num">
                    {formatDate(receipt.date, true)}
                  </td>
                </tr>
                <tr>
                  <td style={{ textAlign: 'right', fontWeight: '600', padding: '2px 4px', whiteSpace: 'nowrap' }}>
                    {t('sales.cashier', 'الكاشير')}:
                  </td>
                  <td style={{ textAlign: 'left', padding: '2px 4px' }}>
                    {receipt.cashierName}
                  </td>
                </tr>
                {receipt.customerName && (
                  <tr>
                    <td style={{ textAlign: 'right', fontWeight: '600', padding: '2px 4px', whiteSpace: 'nowrap' }}>
                      {t('sales.customer', 'العميل')}:
                    </td>
                    <td style={{ textAlign: 'left', padding: '2px 4px', wordBreak: 'break-word' }}>
                      {receipt.customerName}
                    </td>
                  </tr>
                )}
                {receipt.customerCode && (
                  <tr>
                    <td style={{ textAlign: 'right', fontWeight: '600', padding: '2px 4px', whiteSpace: 'nowrap' }}>
                      {isArabic ? 'كود العميل:' : 'Customer Code:'}
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
                <col style={{ width: '48px' }} />
                <col style={{ width: '54px' }} />
              </colgroup>
              <thead>
                <tr style={{ borderTop: '1px solid #000', borderBottom: '2px solid #000', background: '#fff' }}>
                  <th className="col-index" style={{ width: '22px', textAlign: 'center', padding: '5px 2px', verticalAlign: 'middle', lineHeight: '1.35', border: '1px solid #000', boxSizing: 'border-box' }}>#</th>
                  <th className="col-name th-name" style={{ textAlign: 'right', padding: '5px 4px', verticalAlign: 'middle', lineHeight: '1.35', border: '1px solid #000', boxSizing: 'border-box' }}>{t('products.name', 'الصنف')}</th>
                  <th className="col-qty" style={{ width: '30px', textAlign: 'center', padding: '5px 2px', verticalAlign: 'middle', lineHeight: '1.35', border: '1px solid #000', boxSizing: 'border-box' }}>{t('common.qtyShort', 'كم')}</th>
                  <th className="col-price" style={{ width: '48px', textAlign: 'center', padding: '5px 2px', verticalAlign: 'middle', lineHeight: '1.35', border: '1px solid #000', boxSizing: 'border-box' }}>{t('common.price', 'سعر')}</th>
                  <th className="col-total" style={{ width: '54px', textAlign: 'center', padding: '5px 2px', verticalAlign: 'middle', lineHeight: '1.35', border: '1px solid #000', boxSizing: 'border-box' }}>{t('common.total', 'الإجمالي')}</th>
                </tr>
              </thead>
              <tbody>
                {receipt.items.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #000' }}>
                    <td className="col-index receipt-num" style={{ textAlign: 'center', padding: '4px 2px', verticalAlign: 'middle', lineHeight: '1.35', border: '1px solid #000', boxSizing: 'border-box' }}>
                      {i + 1}
                    </td>
                    <td className="col-name td-name" style={{ textAlign: 'right', padding: '4px 4px', verticalAlign: 'middle', lineHeight: '1.35', border: '1px solid #000', wordBreak: 'break-word', overflowWrap: 'break-word', boxSizing: 'border-box' }}>
                      <div dir="auto" style={{ fontWeight: '600', textAlign: 'right', wordBreak: 'break-word', overflowWrap: 'break-word', lineHeight: '1.3' }}>{item.name}</div>
                      {item.sku && <div style={{ fontSize: '9px', color: '#444', marginTop: '1px', textAlign: 'right', direction: 'ltr', lineHeight: '1.2' }} className="receipt-num">{item.sku}</div>}
                    </td>
                    <td className="col-qty" style={{ textAlign: 'center', padding: '4px 2px', verticalAlign: 'middle', lineHeight: '1.35', border: '1px solid #000', boxSizing: 'border-box' }}>
                      <span className="receipt-num" style={{ display: 'block', textAlign: 'center', direction: 'ltr' }}>{item.quantity}</span>
                    </td>
                    <td className="col-price" style={{ textAlign: 'center', padding: '4px 2px', verticalAlign: 'middle', lineHeight: '1.35', border: '1px solid #000', boxSizing: 'border-box' }}>
                      <span className="receipt-num" style={{ display: 'block', textAlign: 'center', direction: 'ltr' }}>{Number(item.unitPrice || 0).toFixed(2)}</span>
                    </td>
                    <td className="col-total" style={{ textAlign: 'center', padding: '4px 2px', verticalAlign: 'middle', lineHeight: '1.35', border: '1px solid #000', boxSizing: 'border-box' }}>
                      <span className="receipt-num" style={{ display: 'block', textAlign: 'center', direction: 'ltr', fontWeight: 'bold' }}>{Number(item.subtotal || 0).toFixed(2)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ borderTop: '1px solid #000', margin: '8px 0' }} />

            {/* SUBTOTAL & DISCOUNT */}
            <table style={{ width: '100%', margin: '0 auto', borderCollapse: 'collapse', fontSize: '12px', direction: 'rtl' }}>
              <tbody>
                <tr>
                  <td style={{ textAlign: 'right', padding: '3px 4px', fontWeight: '600' }}>
                    {t('pos.subtotal', 'المجموع الفرعي')}:
                  </td>
                  <td style={{ textAlign: 'left', direction: 'ltr', padding: '3px 4px' }} className="receipt-num">
                    {Number(receipt.subtotal || 0).toFixed(2)} {currencySymbol}
                  </td>
                </tr>
                {Number(receipt.discountAmount || 0) > 0 && (
                  <tr>
                    <td style={{ textAlign: 'right', padding: '3px 4px', fontWeight: '600' }}>
                      {t('pos.discount', 'الخصم')}:
                    </td>
                    <td style={{ textAlign: 'left', direction: 'ltr', padding: '3px 4px' }} className="receipt-num">
                      -{Number(receipt.discountAmount || 0).toFixed(2)} {currencySymbol}
                    </td>
                  </tr>
                )}
                {Number(receipt.taxAmount || 0) > 0 && (
                  <tr>
                    <td style={{ textAlign: 'right', padding: '3px 4px', fontWeight: '600' }}>
                      {t('pos.tax', 'ضريبة القيمة المضافة')}:
                    </td>
                    <td style={{ textAlign: 'left', direction: 'ltr', padding: '3px 4px' }} className="receipt-num">
                      +{Number(receipt.taxAmount || 0).toFixed(2)} {currencySymbol}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div style={{ borderTop: '1px solid #000', margin: '8px 0' }} />

            {/* FINAL TOTAL (BOLD & LARGER) */}
            <table style={{ width: '100%', margin: '0 auto', borderCollapse: 'collapse', fontSize: '14px', fontWeight: 'bold', direction: 'rtl' }}>
              <tbody>
                <tr>
                  <td style={{ textAlign: 'right', padding: '4px 4px' }}>
                    {t('common.total', 'الإجمالي')}:
                  </td>
                  <td style={{ textAlign: 'left', direction: 'ltr', padding: '4px 4px' }} className="receipt-num">
                    {Number(receipt.total || 0).toFixed(2)} {currencySymbol}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* DOUBLE DIVIDER */}
            <div style={{ borderTop: '3px double #000', margin: '6px 0' }} />

            {/* PAYMENTS */}
            <table style={{ width: '100%', margin: '0 auto', borderCollapse: 'collapse', fontSize: '11.5px', direction: 'rtl' }}>
              <tbody>
                <tr>
                  <td style={{ textAlign: 'right', padding: '2px 4px', fontWeight: '600' }}>
                    {t('payments.methods', 'طرق الدفع')}:
                  </td>
                  <td style={{ textAlign: 'left', direction: 'ltr', padding: '2px 4px' }} className="receipt-num">
                    {Number(receipt.paidAmount || 0).toFixed(2)} {currencySymbol}
                  </td>
                </tr>
                {Number(receipt.changeAmount || 0) > 0 && (
                  <tr>
                    <td style={{ textAlign: 'right', padding: '2px 4px', fontWeight: '600' }}>
                      {t('payments.change', 'المتبقي (الفكة)')}:
                    </td>
                    <td style={{ textAlign: 'left', direction: 'ltr', padding: '2px 4px' }} className="receipt-num">
                      {Number(receipt.changeAmount || 0).toFixed(2)} {currencySymbol}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* FOOTER */}
            <div style={{ textAlign: 'center', marginTop: '14px', fontSize: '11px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '2px' }}>
                شكراً لتعاملكم معنا
              </div>
              <div style={{ fontSize: '10px', color: '#333', marginBottom: '8px' }}>
                Thank you for your visit
              </div>
              <div style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '11px', letterSpacing: '1px', marginBottom: '2px' }} className="receipt-num">
                *{receipt.invoiceNumber}*
              </div>
              <div style={{ fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px' }} className="receipt-num">
                MAKERS POS
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Actions (Hidden on Print) */}
        <div className="px-6 py-4 border-t border-border bg-card flex items-center justify-between gap-3 shrink-0 no-print">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold transition-colors"
          >
            {t('common.close', 'إغلاق')}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting || isSharingWhatsApp}
              className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {isPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              <span>{isPrinting ? (isArabic ? 'جاري الطباعة...' : 'Printing...') : t('common.print', 'طباعة')}</span>
            </button>

            <button
              type="button"
              onClick={handleWhatsApp}
              disabled={isPrinting || isSharingWhatsApp}
              className="px-4 py-2 rounded-xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600/20 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              title={t('whatsapp.send', 'إرسال على واتساب')}
            >
              {isSharingWhatsApp ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
              <span>{isSharingWhatsApp ? (isArabic ? 'جاري الإرسال...' : 'Sending...') : t('whatsapp.send', 'إرسال على واتساب')}</span>
            </button>

            <button
              type="button"
              onClick={handleDone}
              className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{t('pos.newSale', 'عملية جديدة')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* WhatsApp Share Fallback & Options Modal */}
      <WhatsAppShareModal
        isOpen={whatsAppModalOpen}
        onClose={() => setWhatsAppModalOpen(false)}
        imageDataUrl={shareResult?.imageDataUrl || null}
        blob={shareResult?.blob || null}
        invoiceNumber={receipt.invoiceNumber}
        total={receipt.total}
        customerPhone={receipt.customerPhone}
        customerName={receipt.customerName}
      />
    </div>
  )
}

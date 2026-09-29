/**
 * MAKERS POS — Redesigned Thermal Receipt Modal Component
 * Renders structured, high-contrast, professional receipt preview for printing & cashier review.
 * Compatible with 80mm & 58mm ESC/POS thermal printers with cutter margin safety.
 */

import React, { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Printer,
  X,
  CheckCircle2,
  Store,
  Phone,
  MapPin,
  Calendar,
  User,
  Hash,
  CreditCard,
  Layers,
} from 'lucide-react'
import { ReceiptData } from '../types'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { useSettingsStore } from '@/stores/settingsStore'

interface ReceiptModalProps {
  receipt: ReceiptData | null
  isOpen: boolean
  onClose: () => void
  onNewSale?: () => void
}

export function ReceiptModal({
  receipt,
  isOpen,
  onClose,
  onNewSale,
}: ReceiptModalProps) {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language !== 'en'
  const settingsStore = useSettingsStore()
  const paperWidth = settingsStore.receiptPaperWidth || '80mm'
  const currencySymbol = settingsStore.currencySymbol || 'ج.م'
  const receiptRef = useRef<HTMLDivElement>(null)

  if (!isOpen || !receipt) return null

  const handlePrint = () => {
    window.print()
  }

  const handleDone = () => {
    onClose()
    if (onNewSale) {
      onNewSale()
    }
  }

  // Authoritative store header settings
  const storeName = receipt.storeName || settingsStore.storeName || 'MAKERS POS'
  const storeSubtitle = receipt.storeSubtitle || settingsStore.storeSubtitle || (isArabic ? 'للإلكترونيات والمكونات' : 'Electronics & Components')
  const storePhone = receipt.storePhone || settingsStore.storePhone
  const storeAddress = receipt.storeAddress || settingsStore.storeAddress
  const receiptHeader = receipt.receiptHeader || settingsStore.receiptHeader || (isArabic ? 'فاتورة مبيعات' : 'SALES RECEIPT')
  const receiptFooter = receipt.receiptFooter || settingsStore.receiptFooter || (isArabic ? 'شكراً لتعاملكم معنا\nيرجى الاحتفاظ بالإيصال لخدمة ما بعد البيع' : 'Thank you for your business!\nPlease keep receipt for after-sales service')

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
              onClick={handlePrint}
              className="p-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5 text-xs font-semibold shadow-sm"
              title={t('common.print', 'طباعة')}
            >
              <Printer className="w-4 h-4" />
              <span>{t('common.print', 'طباعة')}</span>
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

        {/* Scrollable Receipt Preview Container */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-muted/20 flex justify-center items-start" ref={receiptRef}>
          {/* Printable Thermal Receipt Container */}
          <div
            id="printable-receipt"
            className={`receipt-${paperWidth} w-full max-w-[340px] bg-white text-black p-4 sm:p-5 rounded-lg shadow-md font-mono text-xs leading-relaxed print:shadow-none print:max-w-none print:w-full print:p-0 print:rounded-none`}
            dir={isArabic ? 'rtl' : 'ltr'}
          >
            {/* Store Header Section */}
            <div className="text-center pb-3 border-b-2 border-black space-y-1">
              <h2 className="text-base font-black tracking-wide font-sans uppercase text-black">
                {storeName}
              </h2>
              {storeSubtitle && (
                <p className="text-[11px] font-bold text-neutral-800 font-sans leading-tight">
                  {storeSubtitle}
                </p>
              )}
              {storePhone && (
                <p className="text-[11px] text-neutral-900 font-mono font-medium">
                  {storePhone}
                </p>
              )}
              {storeAddress && (
                <p className="text-[10px] text-neutral-800 font-sans">
                  {storeAddress}
                </p>
              )}
              <div className="mt-2 py-1 px-3 bg-neutral-100 text-black font-black text-[11px] text-center rounded border border-neutral-400 font-sans uppercase tracking-wider">
                {receiptHeader}
              </div>
            </div>

            {/* Sale Metadata Information */}
            <div className="py-2.5 border-b border-dashed border-neutral-400 space-y-1 text-[11px]">
              <div className="flex justify-between items-center">
                <span className="text-neutral-700 font-medium">{t('sales.invoiceNumber', 'رقم الفاتورة')}:</span>
                <span className="font-black text-black font-mono text-xs">#{receipt.invoiceNumber}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-700 font-medium">{t('common.date', 'التاريخ والوقت')}:</span>
                <span className="font-mono text-[10px]">{formatDate(receipt.date, true)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-700 font-medium">{t('sales.cashier', 'الكاشير')}:</span>
                <span className="font-sans font-bold text-black">{receipt.cashierName}</span>
              </div>
              {receipt.customerName && (
                <div className="flex justify-between items-center pt-0.5 border-t border-dotted border-neutral-300">
                  <span className="text-neutral-700 font-medium">{t('sales.customer', 'العميل')}:</span>
                  <span className="font-sans font-black text-black">
                    {receipt.customerName} {receipt.customerCode ? `(${receipt.customerCode})` : ''}
                  </span>
                </div>
              )}
            </div>

            {/* Line Items Table */}
            <div className="py-2.5 border-b-2 border-black">
              <div className="grid grid-cols-12 text-[10px] font-black text-black border-b border-black pb-1 mb-1.5 uppercase">
                <span className="col-span-6">{t('products.name', 'الصنف')}</span>
                <span className="col-span-2 text-center">{t('common.quantity', 'الكمية')}</span>
                <span className="col-span-2 text-end">{t('common.price', 'السعر')}</span>
                <span className="col-span-2 text-end">{t('common.total', 'الإجمالي')}</span>
              </div>

              <div className="space-y-1.5">
                {receipt.items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 text-[11px] items-start border-b border-neutral-200 pb-1.5 last:border-0">
                    <div className="col-span-6 pe-1 font-sans">
                      <p className="font-bold text-black leading-snug">{it.name}</p>
                      {it.sku && <p className="text-[9px] text-neutral-600 font-mono">{it.sku}</p>}
                    </div>
                    <span className="col-span-2 text-center font-bold font-mono text-black">{it.quantity}</span>
                    <span className="col-span-2 text-end font-mono text-neutral-800">{it.unitPrice.toFixed(2)}</span>
                    <span className="col-span-2 text-end font-black font-mono text-black">
                      {it.subtotal.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Totals */}
            <div className="py-2.5 border-b border-dashed border-neutral-400 space-y-1 text-[11px]">
              <div className="flex justify-between items-center">
                <span className="text-neutral-700">{t('pos.subtotal', 'المجموع الفرعي')}:</span>
                <span className="font-mono font-bold">{receipt.subtotal.toFixed(2)} {currencySymbol}</span>
              </div>

              {receipt.discountAmount > 0 && (
                <div className="flex justify-between items-center text-black font-bold">
                  <span>{t('pos.discount', 'الخصم')}:</span>
                  <span className="font-mono">- {receipt.discountAmount.toFixed(2)} {currencySymbol}</span>
                </div>
              )}

              {receipt.taxAmount > 0 && (
                <div className="flex justify-between items-center text-neutral-800">
                  <span>{t('pos.tax', 'ضريبة القيمة المضافة')}:</span>
                  <span className="font-mono">+ {receipt.taxAmount.toFixed(2)} {currencySymbol}</span>
                </div>
              )}

              {/* Dominant Final Total */}
              <div className="flex justify-between items-center text-sm font-black text-black pt-2 border-t-2 border-black mt-1">
                <span className="text-xs uppercase tracking-wide">{t('common.total', 'الإجمالي النهائي')}:</span>
                <span className="font-mono text-base font-black">{receipt.total.toFixed(2)} {currencySymbol}</span>
              </div>
            </div>

            {/* Payment Methods Breakdown */}
            <div className="py-2.5 border-b-2 border-black space-y-1 text-[11px]">
              <span className="text-[10px] font-black text-neutral-800 block uppercase tracking-wider">
                {t('payments.methods', 'طرق الدفع والتحصيل')}
              </span>
              {receipt.payments.map((p, pIdx) => (
                <div key={pIdx} className="flex justify-between items-center">
                  <span className="font-sans font-medium text-neutral-900">
                    {isArabic ? p.labelAr : p.labelEn}
                    {p.reference ? ` (${p.reference})` : ''}
                  </span>
                  <span className="font-bold font-mono">{p.amount.toFixed(2)} {currencySymbol}</span>
                </div>
              ))}

              <div className="flex justify-between items-center pt-1 border-t border-neutral-200">
                <span className="text-neutral-700 font-medium">{t('payments.paidAmount', 'إجمالي المدفوع')}:</span>
                <span className="font-black font-mono text-black">{receipt.paidAmount.toFixed(2)} {currencySymbol}</span>
              </div>

              {receipt.changeAmount > 0 && (
                <div className="flex justify-between items-center font-bold text-black">
                  <span>{t('payments.change', 'المتبقي (الفكة)')}:</span>
                  <span className="font-mono font-bold">{receipt.changeAmount.toFixed(2)} {currencySymbol}</span>
                </div>
              )}
            </div>

            {/* Footer Notice & Thank You */}
            <div className="text-center pt-3 space-y-2">
              {receiptFooter && (
                <p className="text-[10px] text-neutral-800 font-sans font-medium leading-relaxed whitespace-pre-line">
                  {receiptFooter}
                </p>
              )}
              <div className="pt-2 border-t border-dotted border-neutral-400">
                <p className="text-[10px] font-mono font-bold tracking-widest text-black uppercase">
                  *{receipt.invoiceNumber}*
                </p>
                <p className="text-[8px] text-neutral-500 font-sans mt-0.5">
                  MAKERS POS — High Performance Point of Sale
                </p>
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
              className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>{t('common.print', 'طباعة')}</span>
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
    </div>
  )
}

import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  X,
  Printer,
  Barcode as BarcodeIcon,
  Package,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react'
import bwipjs from 'bwip-js'
import { ProductListItem } from '@/services/products/productService'
import { ProductImage } from '@/components/common/ProductImage'
import { useSettingsStore } from '@/stores/settingsStore'
import { formatCurrency } from '@/lib/formatters'

export interface ProductBarcodeModalProps {
  product: ProductListItem | null
  isOpen: boolean
  onClose: () => void
  onPrinted?: () => void
}

interface DimensionPreset {
  id: string
  nameAr: string
  nameEn: string
  widthMm: number
  heightMm: number
}

const PRESET_DIMENSIONS: DimensionPreset[] = [
  { id: '50x25', nameAr: '50 × 25 مم (قياسي)', nameEn: '50 × 25 mm (Standard)', widthMm: 50, heightMm: 25 },
  { id: '40x30', nameAr: '40 × 30 مم (مضغوط)', nameEn: '40 × 30 mm (Compact)', widthMm: 40, heightMm: 30 },
  { id: '60x40', nameAr: '60 × 40 مم (عريض)', nameEn: '60 × 40 mm (Large)', widthMm: 60, heightMm: 40 },
  { id: '38x25', nameAr: '38 × 25 مم (صغير)', nameEn: '38 × 25 mm (Small Part)', widthMm: 38, heightMm: 25 },
]

export function ProductBarcodeModal({
  product,
  isOpen,
  onClose,
  onPrinted,
}: ProductBarcodeModalProps) {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language !== 'en'
  const { storeName, currencySymbol } = useSettingsStore()

  const [quantity, setQuantity] = useState<number>(1)
  const [selectedPreset, setSelectedPreset] = useState<string>('50x25')
  const [barcodeDataUrl, setBarcodeDataUrl] = useState<string>('')
  const [barcodeError, setBarcodeError] = useState<string | null>(null)
  const [printSuccess, setPrintSuccess] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const rawBarcode = product?.primary_barcode?.trim() || product?.sku?.trim() || ''
  const isEan = /^\d{12,13}$/.test(rawBarcode)
  const barcodeType = isEan ? 'ean13' : 'code128'

  const activePreset = PRESET_DIMENSIONS.find((p) => p.id === selectedPreset) || PRESET_DIMENSIONS[0]

  // Render Barcode via bwip-js
  useEffect(() => {
    if (!isOpen || !product || !rawBarcode) return

    setBarcodeError(null)
    const timer = setTimeout(() => {
      try {
        if (canvasRef.current) {
          bwipjs.toCanvas(canvasRef.current, {
            bcid: barcodeType,
            text: rawBarcode,
            scale: 3,
            height: 12,
            includetext: false,
            textxalign: 'center',
          })
          setBarcodeDataUrl(canvasRef.current.toDataURL('image/png'))
        }
      } catch (err: any) {
        console.warn('Barcode render error in modal:', err)
        setBarcodeError(err.message || 'Invalid barcode format')
      }
    }, 50)

    return () => clearTimeout(timer)
  }, [isOpen, product, rawBarcode, barcodeType])

  if (!isOpen || !product) return null

  const handlePrint = () => {
    setPrintSuccess(true)
    setTimeout(() => {
      window.print()
      onPrinted?.()
    }, 100)
    setTimeout(() => {
      setPrintSuccess(false)
    }, 3000)
  }

  const productName = isAr ? product.name_ar : product.name_en || product.name_ar

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in no-print">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <BarcodeIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                {isAr ? 'طباعة ملصق الباركود' : 'Print Barcode Label'}
              </h3>
              <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Product Summary Header */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border">
            <div className="w-12 h-12 rounded-lg bg-background border border-border overflow-hidden shrink-0 flex items-center justify-center p-0.5">
              <ProductImage
                src={product.image_path}
                alt={productName}
                fallbackType="cpu"
                iconClassName="w-6 h-6 text-muted-foreground/30"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-sm text-foreground truncate">{productName}</h4>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span className="font-mono font-bold text-foreground">
                  {formatCurrency(product.selling_price, currencySymbol)}
                </span>
                {product.category_name && (
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-muted border border-border">
                    {product.category_name}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Sticker Live Preview Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-muted-foreground">{isAr ? 'معاينة الملصق المباشر:' : 'Live Sticker Preview:'}</span>
              <span className="font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-md text-[11px] font-bold">
                {activePreset.widthMm} × {activePreset.heightMm} mm ({quantity} {isAr ? 'نسخة' : 'copies'})
              </span>
            </div>

            <div className="p-6 bg-neutral-900/60 rounded-xl flex items-center justify-center border border-border/40 min-h-[170px]">
              <div
                className="bg-white text-black p-3 rounded shadow-lg border border-neutral-300 flex flex-col justify-between items-center text-center select-none"
                style={{
                  width: `${activePreset.widthMm * 4.2}px`,
                  minHeight: `${activePreset.heightMm * 4.2}px`,
                  maxWidth: '100%',
                }}
              >
                {/* Store Name */}
                <div className="text-[9px] font-black uppercase tracking-wider text-neutral-800 leading-tight">
                  {storeName || 'MAKERS POS'}
                </div>

                {/* Product Name */}
                <div className="text-[10px] font-bold text-neutral-950 line-clamp-1 leading-tight my-0.5 px-1">
                  {productName}
                </div>

                {/* Barcode Canvas */}
                <div className="my-1 flex flex-col items-center justify-center w-full">
                  <canvas ref={canvasRef} className="max-w-full h-auto" />
                  {barcodeError ? (
                    <span className="text-[9px] text-red-500 font-semibold">{barcodeError}</span>
                  ) : (
                    <span className="font-mono text-[9px] font-bold tracking-widest text-neutral-900 mt-0.5">
                      {rawBarcode}
                    </span>
                  )}
                </div>

                {/* SKU & Price */}
                <div className="w-full flex items-center justify-between pt-1 border-t border-neutral-300 text-[9px]">
                  <span className="text-neutral-600 font-mono text-[8px]">
                    SKU: {product.sku}
                  </span>
                  <span className="font-black text-neutral-950 font-mono text-[10px]">
                    {product.selling_price.toFixed(2)} {currencySymbol}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Dimension Presets */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground block">
              {isAr ? 'مقاس ورق الملصقات (Sticker Size):' : 'Sticker Label Size:'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_DIMENSIONS.map((preset) => {
                const isSelected = selectedPreset === preset.id
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedPreset(preset.id)}
                    className={`p-2.5 rounded-xl border text-start transition-all cursor-pointer ${
                      isSelected
                        ? 'border-primary bg-primary/10 shadow-xs'
                        : 'border-border bg-card hover:bg-muted/50'
                    }`}
                  >
                    <div className="text-xs font-bold text-foreground">
                      {isAr ? preset.nameAr : preset.nameEn}
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                      {preset.widthMm} × {preset.heightMm} mm
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Quantity Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground block">
              {isAr ? 'عدد الملصقات المطلوب طباعتها:' : 'Number of Labels to Print:'}
            </label>
            <div className="flex items-center gap-2">
              {[1, 5, 10, 20, 50].map((qty) => (
                <button
                  key={qty}
                  type="button"
                  onClick={() => setQuantity(qty)}
                  className={`flex-1 py-2 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer ${
                    quantity === qty
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                      : 'bg-muted/40 hover:bg-muted border-border text-foreground'
                  }`}
                >
                  {qty}
                </button>
              ))}
              <div className="w-20">
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full py-1.5 px-2.5 text-center rounded-xl bg-input border border-border text-xs font-mono font-bold text-foreground"
                />
              </div>
            </div>
          </div>

          {/* Success Banner */}
          {printSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{isAr ? 'تم إرسال أمر الطباعة للملصق بنجاح!' : 'Print command sent to printer successfully!'}</span>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="px-6 py-4 border-t border-border bg-card flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border bg-muted/40 hover:bg-muted text-foreground text-xs font-semibold transition-colors cursor-pointer"
          >
            {t('common.close', 'إغلاق')}
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:bg-primary/90 transition-all shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>
              {isAr ? `طباعة مباشرة (${quantity} ملصق)` : `Print Directly (${quantity} labels)`}
            </span>
          </button>
        </div>
      </div>

      {/* DEDICATED PRINTABLE CONTAINER (Only visible when browser prints) */}
      <div id="printable-barcode-labels" className="print-only hidden print:flex flex-wrap" aria-hidden="true">
        {Array.from({ length: quantity }).map((_, idx) => (
          <div
            key={idx}
            className="barcode-sticker-card bg-white text-black p-2 border border-neutral-300 flex flex-col justify-between items-center text-center"
            style={{
              width: `${activePreset.widthMm}mm`,
              height: `${activePreset.heightMm}mm`,
              boxSizing: 'border-box',
              margin: '1mm',
              pageBreakInside: 'avoid',
            }}
          >
            <div className="text-[8px] font-black uppercase tracking-wider text-neutral-800 leading-none">
              {storeName || 'MAKERS POS'}
            </div>

            <div className="text-[9px] font-bold text-neutral-950 line-clamp-1 leading-tight px-0.5">
              {productName}
            </div>

            <div className="my-0.5 flex flex-col items-center">
              {barcodeDataUrl && (
                <img
                  src={barcodeDataUrl}
                  alt={rawBarcode}
                  style={{
                    maxHeight: `${Math.max(10, activePreset.heightMm * 0.45)}mm`,
                    maxWidth: '90%',
                    objectFit: 'contain',
                    imageRendering: 'pixelated',
                  }}
                />
              )}
              <span className="font-mono text-[9px] font-black tracking-wider text-neutral-900 mt-0.5">
                {rawBarcode}
              </span>
              <span className="font-mono text-[7px] text-neutral-600">
                SKU: {product.sku}
              </span>
            </div>

            <div className="font-mono font-black text-[10px] text-neutral-950 border-t border-neutral-300 w-full pt-0.5">
              {product.selling_price.toFixed(2)} {currencySymbol}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

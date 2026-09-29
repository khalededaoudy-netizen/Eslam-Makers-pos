/**
 * MAKERS POS — Barcode Label & Sticker Generator
 * Generates standard, machine-readable printable barcode stickers for products.
 * Compatible with standard thermal label printers and sticker sheet formats.
 */

import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Scan,
  Printer,
  Search,
  Package,
  Sparkles,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Eye,
  Settings2,
  Copy,
  Layers,
} from 'lucide-react'
import bwipjs from 'bwip-js'
import { useSettingsStore } from '@/stores/settingsStore'
import { formatCurrency } from '@/lib/formatters'
import { productService, ProductListItem } from '@/services/products/productService'

export interface LabelDimensionPreset {
  id: string
  nameAr: string
  nameEn: string
  widthMm: number
  heightMm: number
}

const PRESET_DIMENSIONS: LabelDimensionPreset[] = [
  { id: '50x25', nameAr: '50 × 25 مم (قياسي إلكترونيات)', nameEn: '50 × 25 mm (Standard)', widthMm: 50, heightMm: 25 },
  { id: '40x30', nameAr: '40 × 30 مم (ملصق مضغوط)', nameEn: '40 × 30 mm (Compact)', widthMm: 40, heightMm: 30 },
  { id: '60x40', nameAr: '60 × 40 مم (ملصق عريض)', nameEn: '60 × 40 mm (Large)', widthMm: 60, heightMm: 40 },
  { id: '38x25', nameAr: '38 × 25 مم (قطع صغيرة)', nameEn: '38 × 25 mm (Small Part)', widthMm: 38, heightMm: 25 },
]

export function BarcodesPage() {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language !== 'en'
  const { storeName, currencySymbol } = useSettingsStore()

  // Product Selection State
  const [products, setProducts] = useState<ProductListItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<ProductListItem | null>(null)
  const [loadingProducts, setLoadingProducts] = useState(false)

  // Label Configuration
  const [selectedPreset, setSelectedPreset] = useState<string>('50x25')
  const [customWidth, setCustomWidth] = useState<number>(50)
  const [customHeight, setCustomHeight] = useState<number>(25)
  const [quantity, setQuantity] = useState<number>(1)

  // Custom Content Toggles
  const [showStoreName, setShowStoreName] = useState(true)
  const [showProductName, setShowProductName] = useState(true)
  const [showBarcodeText, setShowBarcodeText] = useState(true)
  const [showPrice, setShowPrice] = useState(true)
  const [showSku, setShowSku] = useState(true)

  // Barcode Overrides / Generated values
  const [activeBarcode, setActiveBarcode] = useState<string>('')
  const [barcodeType, setBarcodeType] = useState<'ean13' | 'code128'>('code128')
  const [barcodeError, setBarcodeError] = useState<string | null>(null)

  // Canvas Refs for Preview
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // 1. Initial Load of Products
  useEffect(() => {
    loadProducts()
  }, [])

  async function loadProducts(query = '') {
    setLoadingProducts(true)
    try {
      const list = await productService.getProducts({
        search: query,
        activeOnly: true,
      })
      setProducts(list)
      if (!selectedProduct && list.length > 0 && !query) {
        selectProduct(list[0])
      }
    } catch (err) {
      console.error('Failed to load products for barcode labels:', err)
    } finally {
      setLoadingProducts(false)
    }
  }

  // 2. Product Selection
  const selectProduct = (p: ProductListItem) => {
    setSelectedProduct(p)
    const code = p.primary_barcode || p.sku || ''
    setActiveBarcode(code)
    determineBarcodeType(code)
  }

  const determineBarcodeType = (code: string) => {
    const clean = code.trim()
    // Check if valid EAN-13 (12 or 13 digits)
    if (/^\d{12,13}$/.test(clean)) {
      setBarcodeType('ean13')
    } else {
      setBarcodeType('code128')
    }
  }

  // Handle Dimension Preset Change
  const handlePresetChange = (presetId: string) => {
    setSelectedPreset(presetId)
    const preset = PRESET_DIMENSIONS.find((p) => p.id === presetId)
    if (preset) {
      setCustomWidth(preset.widthMm)
      setCustomHeight(preset.heightMm)
    }
  }

  // Auto-generate a fallback barcode if product has none
  const handleAutoGenerateBarcode = () => {
    if (!selectedProduct) return
    const randomSuffix = Math.floor(100000 + Math.random() * 900000)
    const newCode = `629${randomSuffix}${selectedProduct.id.slice(0, 4).toUpperCase()}`
    setActiveBarcode(newCode)
    determineBarcodeType(newCode)
  }

  // Render Barcode via bwip-js onto single preview canvas
  useEffect(() => {
    if (!previewCanvasRef.current || !activeBarcode) return

    setBarcodeError(null)
    try {
      // Determine format
      const isEan = barcodeType === 'ean13' && /^\d{12,13}$/.test(activeBarcode.trim())
      const bcid = isEan ? 'ean13' : 'code128'

      bwipjs.toCanvas(previewCanvasRef.current, {
        bcid,
        text: activeBarcode.trim(),
        scale: 3,
        height: 12,
        includetext: false, // We render clean text underneath via HTML typography
        textxalign: 'center',
      })
    } catch (err: any) {
      console.warn('Barcode render error:', err)
      setBarcodeError(err.message || 'Invalid barcode characters')
    }
  }, [activeBarcode, barcodeType, selectedProduct])

  const handlePrint = () => {
    window.print()
  }

  const currentPreset = PRESET_DIMENSIONS.find((p) => p.id === selectedPreset)
  const effectiveWidth = currentPreset ? currentPreset.widthMm : customWidth
  const effectiveHeight = currentPreset ? currentPreset.heightMm : customHeight

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/60 shrink-0 no-print">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
            <Scan className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {isAr ? 'طباعة استيكرات وملصقات الباركود' : 'Barcode Labels & Sticker Generator'}
            </h1>
            <p className="text-xs text-muted-foreground">
              {isAr
                ? 'توليد ملصقات باركود قياسية قابلة للمسح الضوئي لمعايرة طابعات الملصقات والمخزون'
                : 'Generate scannable retail barcode stickers compatible with label printers'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            disabled={!selectedProduct || !activeBarcode}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-bold text-sm rounded-xl hover:bg-primary/90 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="w-4 h-4" />
            <span>{isAr ? `طباعة (${quantity}) ملصق` : `Print (${quantity}) Labels`}</span>
          </button>
        </div>
      </div>

      {/* Main Workspace (Split Grid) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 overflow-y-auto no-print">
        {/* Left Column: Product Selection & Configuration (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Step 1: Select Product */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Package className="w-4 h-4 text-primary" />
                {isAr ? '1. اختيار المنتج' : '1. Select Product'}
              </h2>
              <span className="text-xs text-muted-foreground">
                {products.length} {isAr ? 'منتج متاح' : 'products'}
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  loadProducts(e.target.value)
                }}
                placeholder={isAr ? 'بحث باسم المنتج أو الكود أو الباركود...' : 'Search by name, SKU or barcode...'}
                className="w-full h-10 ps-9 pe-4 rounded-xl bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Products List */}
            <div className="max-h-48 overflow-y-auto space-y-1.5 pe-1 border border-border/60 rounded-xl p-1.5 bg-muted/10">
              {loadingProducts ? (
                <p className="text-xs text-center py-4 text-muted-foreground">{isAr ? 'جاري التحميل...' : 'Loading...'}</p>
              ) : products.length === 0 ? (
                <p className="text-xs text-center py-4 text-muted-foreground">{isAr ? 'لا توجد منتجات مطابقة' : 'No products found'}</p>
              ) : (
                products.map((p) => {
                  const isSelected = selectedProduct?.id === p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectProduct(p)}
                      className={`w-full text-start p-2.5 rounded-lg text-xs transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                          : 'hover:bg-muted/80 text-foreground'
                      }`}
                    >
                      <div className="min-w-0 flex-1 pe-2">
                        <p className="truncate">{isAr ? p.name_ar : p.name_en || p.name_ar}</p>
                        <p className={`text-[10px] ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                          SKU: {p.sku} {p.primary_barcode ? `| Barcode: ${p.primary_barcode}` : ''}
                        </p>
                      </div>
                      <span className="font-mono font-bold shrink-0">
                        {formatCurrency(p.selling_price, currencySymbol)}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Step 2: Barcode Value & Type */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold flex items-center gap-2 text-foreground">
              <Scan className="w-4 h-4 text-primary" />
              {isAr ? '2. بيانات الباركود' : '2. Barcode Data'}
            </h2>

            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">
                {isAr ? 'كود الباركود للملصق' : 'Barcode Value'}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={activeBarcode}
                  onChange={(e) => {
                    setActiveBarcode(e.target.value)
                    determineBarcodeType(e.target.value)
                  }}
                  placeholder="e.g. 629104829102"
                  className="flex-1 h-10 px-3 rounded-xl bg-input border border-border text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={handleAutoGenerateBarcode}
                  title={isAr ? 'توليد كود تلقائي' : 'Auto-generate'}
                  className="px-3 h-10 bg-muted hover:bg-muted/80 border border-border rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>{isAr ? 'توليد' : 'Generate'}</span>
                </button>
              </div>
            </div>

            {/* Barcode Type & Validation */}
            <div className="flex items-center justify-between text-xs pt-1">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{isAr ? 'النوع:' : 'Type:'}</span>
                <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono font-bold uppercase text-[11px]">
                  {barcodeType}
                </span>
              </div>
              {!activeBarcode ? (
                <span className="text-amber-500 text-xs flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {isAr ? 'لا يوجد باركود محدد' : 'No barcode set'}
                </span>
              ) : barcodeError ? (
                <span className="text-destructive text-xs flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {barcodeError}
                </span>
              ) : (
                <span className="text-emerald-500 text-xs flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {isAr ? 'باركود صالح للطباعة' : 'Valid scannable code'}
                </span>
              )}
            </div>
          </div>

          {/* Step 3: Label Size & Quantity */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold flex items-center gap-2 text-foreground">
              <Sliders className="w-4 h-4 text-primary" />
              {isAr ? '3. أبعاد الملصق والكمية' : '3. Dimensions & Quantity'}
            </h2>

            {/* Presets */}
            <div>
              <label className="text-xs text-muted-foreground block mb-2">
                {isAr ? 'مقاس الملصق / الاستيكر' : 'Label Dimension Preset'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_DIMENSIONS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handlePresetChange(preset.id)}
                    className={`p-2.5 rounded-xl border text-xs text-start transition-all ${
                      selectedPreset === preset.id
                        ? 'border-primary bg-primary/10 text-foreground font-bold shadow-sm'
                        : 'border-border bg-card hover:bg-muted/40 text-muted-foreground'
                    }`}
                  >
                    <p className="font-semibold text-foreground">{preset.widthMm} × {preset.heightMm} mm</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {isAr ? preset.nameAr : preset.nameEn}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity */}
            <div>
              <label className="text-xs text-muted-foreground block mb-2">
                {isAr ? 'عدد الملصقات للطباعة' : 'Number of Labels to Print'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24 h-10 px-3 rounded-xl bg-input border border-border text-center font-bold font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="flex gap-1.5 flex-1">
                  {[1, 5, 10, 20, 50].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setQuantity(q)}
                      className={`flex-1 h-10 rounded-xl border text-xs font-semibold transition-colors ${
                        quantity === q
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted hover:bg-muted/80 border-border text-foreground'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Content Toggles */}
            <div className="pt-2 border-t border-border/80 space-y-2">
              <label className="text-xs font-semibold text-muted-foreground block">
                {isAr ? 'عناصر الملصق الظاهرة' : 'Visible Label Elements'}
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-foreground">
                  <input
                    type="checkbox"
                    checked={showStoreName}
                    onChange={(e) => setShowStoreName(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                  <span>{isAr ? 'اسم المتجر' : 'Store Name'}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-foreground">
                  <input
                    type="checkbox"
                    checked={showProductName}
                    onChange={(e) => setShowProductName(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                  <span>{isAr ? 'اسم الصنف' : 'Product Name'}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-foreground">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={(e) => setShowPrice(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                  <span>{isAr ? 'سعر البيع' : 'Retail Price'}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-foreground">
                  <input
                    type="checkbox"
                    checked={showSku}
                    onChange={(e) => setShowSku(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                  <span>{isAr ? 'كود الصنف (SKU)' : 'SKU Code'}</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Interactive Preview (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Eye className="w-4 h-4 text-primary" />
                {isAr ? 'معاينة الملصق المباشرة (1:1)' : 'Live Single Label Preview (1:1)'}
              </h2>
              <span className="text-xs px-2.5 py-1 rounded-full bg-muted font-mono font-semibold text-muted-foreground">
                {effectiveWidth} × {effectiveHeight} mm
              </span>
            </div>

            {/* Sticker Preview Box */}
            <div className="p-8 bg-neutral-900/60 rounded-xl flex items-center justify-center border border-border/40 min-h-[220px]">
              {selectedProduct ? (
                <div
                  className="bg-white text-black p-2.5 rounded shadow-lg border border-neutral-300 flex flex-col justify-between items-center text-center select-none"
                  style={{
                    width: `${effectiveWidth * 3.8}px`,
                    minHeight: `${effectiveHeight * 3.8}px`,
                    maxWidth: '100%',
                  }}
                >
                  {/* Top: Store Name */}
                  {showStoreName && (
                    <div className="text-[10px] font-black tracking-wider uppercase text-neutral-800 leading-tight">
                      {storeName || 'MAKERS POS'}
                    </div>
                  )}

                  {/* Middle: Product Name */}
                  {showProductName && (
                    <div className="text-[11px] font-bold text-neutral-950 line-clamp-2 leading-tight px-1 my-0.5">
                      {isAr ? selectedProduct.name_ar : selectedProduct.name_en || selectedProduct.name_ar}
                    </div>
                  )}

                  {/* Barcode Graphic Canvas */}
                  <div className="my-1 flex flex-col items-center justify-center w-full">
                    <canvas ref={previewCanvasRef} className="max-w-full h-auto" />
                    {showBarcodeText && activeBarcode && (
                      <span className="font-mono text-[10px] font-bold tracking-widest text-neutral-900 mt-0.5">
                        {activeBarcode}
                      </span>
                    )}
                  </div>

                  {/* Bottom: Price & SKU */}
                  <div className="w-full flex items-center justify-between pt-1 border-t border-neutral-200 text-[10px] px-1 font-sans">
                    {showSku && (
                      <span className="text-neutral-600 font-mono text-[9px]">
                        {selectedProduct.sku}
                      </span>
                    )}
                    {showPrice && (
                      <span className="font-black text-neutral-950 font-mono text-xs">
                        {selectedProduct.selling_price.toFixed(2)} {currencySymbol}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground space-y-2">
                  <Package className="w-10 h-10 mx-auto opacity-30" />
                  <p className="text-xs">{isAr ? 'يرجى اختيار منتج لعرض الملصق' : 'Please select a product'}</p>
                </div>
              )}
            </div>

            {/* Instructions / Calibration note */}
            <div className="p-3.5 bg-muted/40 rounded-xl border border-border text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <Settings2 className="w-3.5 h-3.5 text-primary" />
                {isAr ? 'ملاحظة المعايرة والطباعة:' : 'Calibration & Printer Setup:'}
              </p>
              <p className="text-[11px]">
                {isAr
                  ? 'هذا النظام يولد ملصقات باركود قياسية مستقلة بنظام Vector عالي الدقة. عند شراء طابعة الباركود لاحقاً، يتم ضبط مقاس الورق في إعدادات Windows Print Spooler دون الحاجة لأي تعديل في الكود.'
                  : 'High-density machine-readable barcode engine ready for standard label roll calibration.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DEDICATED PRINTABLE BARCODE LABELS CONTAINER (Visible ONLY during print) */}
      {/* ========================================================================= */}
      <div id="printable-barcode-labels" className="print-only">
        {selectedProduct &&
          Array.from({ length: quantity }).map((_, idx) => (
            <div
              key={idx}
              className="barcode-sticker-card bg-white text-black p-2 border border-neutral-300 flex flex-col justify-between items-center text-center"
              style={{
                width: `${effectiveWidth}mm`,
                height: `${effectiveHeight}mm`,
                boxSizing: 'border-box',
                margin: '1mm',
                pageBreakInside: 'avoid',
              }}
            >
              {/* Store Name */}
              {showStoreName && (
                <div className="text-[8px] font-black uppercase tracking-wider leading-none text-neutral-800">
                  {storeName || 'MAKERS POS'}
                </div>
              )}

              {/* Product Title */}
              {showProductName && (
                <div className="text-[9px] font-bold text-neutral-950 line-clamp-1 leading-tight px-0.5">
                  {isAr ? selectedProduct.name_ar : selectedProduct.name_en || selectedProduct.name_ar}
                </div>
              )}

              {/* Barcode Number & SKU */}
              <div className="my-0.5 flex flex-col items-center">
                {showBarcodeText && activeBarcode && (
                  <span className="font-mono text-[9px] font-black tracking-wider">
                    {activeBarcode}
                  </span>
                )}
                {showSku && (
                  <span className="font-mono text-[7px] text-neutral-600">
                    SKU: {selectedProduct.sku}
                  </span>
                )}
              </div>

              {/* Price */}
              {showPrice && (
                <div className="font-mono font-black text-[10px] text-neutral-950 border-t border-neutral-300 w-full pt-0.5">
                  {selectedProduct.selling_price.toFixed(2)} {currencySymbol}
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  )
}

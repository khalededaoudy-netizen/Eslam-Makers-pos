import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  X,
  ExternalLink,
  Edit2,
  Package,
  Layers,
  MapPin,
  FileText,
  DollarSign,
  TrendingUp,
  Cpu,
  Globe,
  Tag,
  Barcode,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Share2,
} from 'lucide-react'
import { ProductListItem } from '@/services/products/productService'
import { ProductImage } from '@/components/common/ProductImage'
import { formatCurrency } from '@/lib/formatters'
import { useSettingsStore } from '@/stores/settingsStore'
import { openUrl } from '@/lib/openUrl'

interface ProductDetailsModalProps {
  product: ProductListItem | null
  isOpen: boolean
  onClose: () => void
  onEdit?: (product: ProductListItem) => void
}

export function ProductDetailsModal({
  product,
  isOpen,
  onClose,
  onEdit,
}: ProductDetailsModalProps) {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language !== 'en'
  const { currencySymbol } = useSettingsStore()

  if (!isOpen || !product) return null

  const isLowStock = product.current_stock <= product.min_stock
  const profitMargin =
    product.selling_price > 0
      ? ((product.selling_price - product.purchase_price) / product.selling_price) * 100
      : 0
  const profitAmount = product.selling_price - product.purchase_price

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                {isAr ? 'تفاصيل المنتج' : 'Product Details'}
              </h3>
              <p className="text-[11px] text-muted-foreground font-mono">
                SKU: {product.sku}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onEdit(product)
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5 text-primary" />
                <span>{t('common.edit', 'تعديل')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Main Info Row: Image + Names + Badges */}
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            {/* Big Image View */}
            <div className="w-full sm:w-40 h-40 flex-shrink-0 rounded-2xl bg-muted/50 border border-border overflow-hidden flex items-center justify-center p-2 shadow-inner">
              <ProductImage
                src={product.image_path}
                alt={product.name_ar || product.name_en}
                className="w-full h-full object-contain rounded-xl"
                fallbackType="cpu"
                iconClassName="w-12 h-12 text-muted-foreground/30"
              />
            </div>

            {/* Names & Main Tags */}
            <div className="flex-1 min-w-0 space-y-2.5">
              <div>
                <h2 className="text-base font-bold text-foreground leading-snug">
                  {product.name_ar || product.name_en}
                </h2>
                {product.name_en && product.name_ar && (
                  <p className="text-xs text-muted-foreground font-sans mt-0.5">
                    {product.name_en}
                  </p>
                )}
              </div>

              {/* Status and Category Badges */}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                {product.category_name && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold bg-primary/10 text-primary border border-primary/20">
                    <Layers className="w-3 h-3" />
                    {product.category_name}
                  </span>
                )}
                {product.brand_name && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold bg-muted text-muted-foreground border border-border">
                    <Tag className="w-3 h-3" />
                    {product.brand_name}
                  </span>
                )}
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold ${
                    isLowStock
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  {isLowStock ? (
                    <>
                      <AlertTriangle className="w-3 h-3" />
                      {isAr ? 'مخزون منخفض' : 'Low Stock'}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      {isAr ? 'مخزون متاح' : 'In Stock'}
                    </>
                  )}
                </span>
                {product.source_type === 'MAKERS_WEBSITE' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">
                    <Globe className="w-3 h-3" />
                    MAKERS
                  </span>
                )}
              </div>

              {/* Links if available */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                {product.external_url && (
                  <button
                    type="button"
                    onClick={() => openUrl(product.external_url!)}
                    className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
                  >
                    <span>{isAr ? 'عرض في موقع ميكرز' : 'View on Store'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
                {product.datasheet_url && (
                  <button
                    type="button"
                    onClick={() => openUrl(product.datasheet_url!)}
                    className="inline-flex items-center gap-1 text-emerald-600 hover:underline font-semibold"
                  >
                    <span>{isAr ? 'فتح الداتاشيت (PDF)' : 'Datasheet PDF'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Pricing & Stock KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl bg-card border border-border space-y-1">
              <span className="text-[10px] text-muted-foreground font-semibold block">
                {isAr ? 'سعر البيع' : 'Selling Price'}
              </span>
              <p className="text-base font-bold font-mono text-foreground">
                {formatCurrency(product.selling_price, currencySymbol)}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-card border border-border space-y-1">
              <span className="text-[10px] text-muted-foreground font-semibold block">
                {isAr ? 'سعر الشراء' : 'Cost Price'}
              </span>
              <p className="text-base font-bold font-mono text-muted-foreground">
                {formatCurrency(product.purchase_price, currencySymbol)}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-card border border-border space-y-1">
              <span className="text-[10px] text-muted-foreground font-semibold block">
                {isAr ? 'هامش الربح' : 'Profit / Margin'}
              </span>
              <p className="text-base font-bold font-mono text-emerald-600">
                +{formatCurrency(profitAmount, currencySymbol)}
                <span className="text-[10px] font-normal ms-1">({profitMargin.toFixed(0)}%)</span>
              </p>
            </div>

            <div className="p-3 rounded-xl bg-card border border-border space-y-1">
              <span className="text-[10px] text-muted-foreground font-semibold block">
                {isAr ? 'المخزون الحالي' : 'Stock Level'}
              </span>
              <p
                className={`text-base font-bold font-mono ${
                  isLowStock ? 'text-amber-500' : 'text-foreground'
                }`}
              >
                {product.current_stock}
                <span className="text-[10px] text-muted-foreground font-normal ms-1">
                  ({isAr ? 'الحد الأدنى' : 'min'}: {product.min_stock})
                </span>
              </p>
            </div>
          </div>

          {/* Technical Specifications & Locations */}
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-primary" />
              <span>{isAr ? 'المواصفات ومواقع التخزين' : 'Specifications & Storage'}</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-card border border-border/70">
                <span className="text-muted-foreground">{isAr ? 'الباركود الرئيسي:' : 'Barcode:'}</span>
                <span className="font-mono font-bold text-foreground">
                  {product.primary_barcode || '—'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-card border border-border/70">
                <span className="text-muted-foreground">{isAr ? 'مكان الدرج (Location):' : 'Location:'}</span>
                <span className="font-mono font-bold text-foreground">
                  {product.drawer_location || '—'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-card border border-border/70">
                <span className="text-muted-foreground">{isAr ? 'نوع الغلاف (Package):' : 'Package:'}</span>
                <span className="font-mono font-bold text-foreground">
                  {product.footprint_package || '—'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-card border border-border/70">
                <span className="text-muted-foreground">{isAr ? 'وحدة القياس:' : 'Unit:'}</span>
                <span className="font-semibold text-foreground">
                  {product.unit_name_ar || product.unit_name_en || product.unit_symbol || 'قطعة'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-border bg-muted/20 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-bold text-xs transition-colors"
          >
            {t('common.close', 'إغلاق')}
          </button>
        </div>
      </div>
    </div>
  )
}

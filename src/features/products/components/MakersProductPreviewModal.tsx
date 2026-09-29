import React from 'react'
import { useTranslation } from 'react-i18next'
import { X, ExternalLink, Download, AlertCircle, Cpu, FileText, Tag, CheckCircle2 } from 'lucide-react'
import { MakersMappedProduct } from '@/services/makers/types'

interface MakersProductPreviewModalProps {
  product: MakersMappedProduct
  onConfirmImport: (product: MakersMappedProduct) => void
  onClose: () => void
}

export function MakersProductPreviewModal({
  product,
  onConfirmImport,
  onClose,
}: MakersProductPreviewModalProps) {
  const { t } = useTranslation()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-card w-full max-w-xl rounded-2xl shadow-2xl border border-border flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            <h3 className="text-base font-bold text-foreground">
              {t('makersImport.previewTitle')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Main info row: Image & Title */}
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <div className="w-28 h-28 flex-shrink-0 rounded-xl bg-muted/60 border border-border overflow-hidden flex items-center justify-center p-1">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-contain rounded-lg"
                  onError={(e) => {
                    // Fallback to placeholder on image error
                    e.currentTarget.style.display = 'none'
                  }}
                />
              ) : (
                <Cpu className="w-10 h-10 text-muted-foreground/40" />
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-2">
              <h4 className="text-base font-semibold text-foreground leading-snug">
                {product.name}
              </h4>

              <div className="flex flex-wrap items-center gap-2">
                {product.sku && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-muted text-foreground text-xs font-mono border border-border">
                    SKU: {product.sku}
                  </span>
                )}
                {product.categories.length > 0 && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                    {product.categories[0]}
                  </span>
                )}
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium border ${
                    product.isInStock
                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                      : 'bg-destructive/10 text-destructive border-destructive/20'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  {product.isInStock ? t('makersImport.inStock') : t('makersImport.outOfStock')}
                </span>
              </div>
            </div>
          </div>

          {/* Pricing Highlight Box */}
          <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {t('makersImport.websitePrice')}:
              </span>
              <span className="text-lg font-bold text-primary display-number">
                {product.formattedPrice}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
              ⚠️ {t('makersImport.websitePriceNotice')}
            </p>
          </div>

          {/* Technical Specifications */}
          {(product.footprintPackage || product.datasheetUrl) && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t('makersImport.specs')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {product.footprintPackage && (
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-primary" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">{t('products.footprintPackage')}</p>
                      <p className="font-mono font-medium">{product.footprintPackage}</p>
                    </div>
                  </div>
                )}
                {product.datasheetUrl && (
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-primary" />
                      <p className="font-medium truncate">{t('products.datasheetUrl')}</p>
                    </div>
                    <a
                      href={product.datasheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          {(product.shortDescription || product.description) && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t('products.description')}
              </p>
              <div className="p-3 rounded-lg bg-muted/30 border border-border text-xs text-muted-foreground max-h-32 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                {product.shortDescription || product.description}
              </div>
            </div>
          )}

          {/* External website link */}
          {product.permalink && (
            <div className="pt-1">
              <a
                href={product.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {t('makersImport.viewOnWebsite')}
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/20">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => onConfirmImport(product)}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            {t('makersImport.importProduct')}
          </button>
        </div>

      </div>
    </div>
  )
}

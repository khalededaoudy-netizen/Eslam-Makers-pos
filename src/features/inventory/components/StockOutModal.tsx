import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, ArrowUpRight, AlertTriangle, AlertCircle } from 'lucide-react'
import { inventoryService, StorageLocation } from '@/services/inventory/inventoryService'
import { useAuthStore } from '@/stores/authStore'

interface StockOutModalProps {
  product: {
    id: string
    name_ar: string
    name_en: string
    sku: string
    current_stock: number
    unit_symbol: string
  }
  onClose: () => void
  onSuccess: () => void
}

const STOCK_OUT_REASONS = [
  { value: 'damaged', labelAr: 'تالف / كسر / حرق أثناء الفحص', labelEn: 'Damaged / Burned in testing', type: 'damage' as const },
  { value: 'lost', labelAr: 'فقدان / عجز مخزني', labelEn: 'Lost / Inventory Discrepancy', type: 'manual_out' as const },
  { value: 'internal_use', labelAr: 'استخدام داخلي / معمل الصيانة', labelEn: 'Internal Lab / Store Use', type: 'manual_out' as const },
  { value: 'expired_scrap', labelAr: 'منتهي الصلاحية / خردة', labelEn: 'Scrap / Outdated', type: 'damage' as const },
  { value: 'correction', labelAr: 'تصحيح خطأ إدخال سابق', labelEn: 'Data Entry Correction', type: 'correction' as const },
  { value: 'other', labelAr: 'أخرى (حدد في الملاحظات)', labelEn: 'Other (specify in notes)', type: 'manual_out' as const },
]

export function StockOutModal({ product, onClose, onSuccess }: StockOutModalProps) {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [quantity, setQuantity] = useState('')
  const [locations, setLocations] = useState<StorageLocation[]>([])
  const [locationId, setLocationId] = useState('')
  const [selectedReasonValue, setSelectedReasonValue] = useState(STOCK_OUT_REASONS[0].value)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadLocations()
  }, [])

  async function loadLocations() {
    try {
      const locs = await inventoryService.getStorageLocations()
      setLocations(locs)
      if (locs.length > 0) {
        setLocationId(locs[0].id)
      }
    } catch (err) {
      console.error('Failed to load locations', err)
    }
  }

  const selectedReasonObj = STOCK_OUT_REASONS.find((r) => r.value === selectedReasonValue) || STOCK_OUT_REASONS[0]
  const parsedQty = parseFloat(quantity) || 0
  const stockAfter = (product.current_stock || 0) - parsedQty

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setError(t('inventory.errorValidQuantity', 'يرجى إدخال كمية صحيحة أكبر من صفر'))
      return
    }

    if (stockAfter < 0) {
      setError(t('inventory.errorInsufficientStock', `المخزون الحالي (${product.current_stock}) غير كافٍ لإخراج (${parsedQty})`))
      return
    }

    setLoading(true)
    setError('')
    try {
      await inventoryService.stockOut(
        {
          productId: product.id,
          quantity: parsedQty,
          locationId: locationId || null,
          reason: selectedReasonObj.labelAr,
          type: selectedReasonObj.type,
          notes: notes.trim() || undefined,
        },
        { id: user?.id, fullName: user?.fullName }
      )
      onSuccess()
    } catch (err: any) {
      setError(err.message || t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">{t('inventory.stockOut', 'إخراج مخزون (Stock Out)')}</h2>
              <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form id="stock-out-form" onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Product Summary */}
          <div className="p-3 rounded-xl bg-muted/40 border border-border flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{product.name_ar || product.name_en}</p>
              <p className="text-xs text-muted-foreground">{product.name_en}</p>
            </div>
            <div className="text-end">
              <p className="text-xs text-muted-foreground">{t('inventory.currentStock', 'المخزون الحالي')}</p>
              <p className="text-sm font-bold font-mono text-foreground">{product.current_stock} {product.unit_symbol}</p>
            </div>
          </div>

          {/* Quantity & Location */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                {t('inventory.quantityToRemove', 'الكمية المراد إخراجها')} <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0.001"
                max={product.current_stock > 0 ? product.current_stock : undefined}
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                className="w-full h-10 px-3 rounded-lg bg-input border border-border text-sm font-mono focus:ring-2 focus:ring-primary"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">{t('common.location', 'مكان التخزين')}</label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-input border border-border text-sm focus:ring-2 focus:ring-primary"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name_ar ? `${loc.name_ar} (${loc.name})` : loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* New Stock Preview Pill */}
          {parsedQty > 0 && (
            <div className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
              stockAfter < 0
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                : 'bg-muted/40 border-border text-foreground'
            }`}>
              <span className="text-muted-foreground">{t('inventory.stockAfterOperation', 'المخزون بعد الإخراج')}:</span>
              <span className={`font-bold font-mono text-sm ${stockAfter < 0 ? 'text-rose-500' : 'text-foreground'}`}>
                {product.current_stock} - {quantity} = {stockAfter} {product.unit_symbol}
              </span>
            </div>
          )}

          {/* Reason Dropdown */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {t('inventory.reason', 'سبب الإخراج')} <span className="text-destructive">*</span>
            </label>
            <select
              value={selectedReasonValue}
              onChange={(e) => setSelectedReasonValue(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-input border border-border text-sm focus:ring-2 focus:ring-primary"
            >
              {STOCK_OUT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.labelAr} ({r.labelEn})
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">{t('common.notes', 'ملاحظات وتفاصيل')}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. سبب التلف، اسم الفني، رقم المعمل..."
              className="w-full p-2.5 rounded-lg bg-input border border-border text-xs focus:ring-2 focus:ring-primary min-h-[60px]"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/20">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            form="stock-out-form"
            disabled={loading || parsedQty <= 0 || stockAfter < 0}
            className="flex items-center gap-2 px-5 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 transition-colors disabled:opacity-50"
          >
            <AlertTriangle className="w-4 h-4" />
            {t('inventory.confirmStockOut', 'تأكيد الإخراج')}
          </button>
        </div>
      </div>
    </div>
  )
}

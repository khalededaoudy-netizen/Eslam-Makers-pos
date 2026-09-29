import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, ArrowDownRight, CheckCircle2, AlertCircle } from 'lucide-react'
import { inventoryService, StorageLocation } from '@/services/inventory/inventoryService'
import { useAuthStore } from '@/stores/authStore'

interface StockInModalProps {
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

export function StockInModal({ product, onClose, onSuccess }: StockInModalProps) {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [quantity, setQuantity] = useState('')
  const [locations, setLocations] = useState<StorageLocation[]>([])
  const [locationId, setLocationId] = useState('')
  const [reason, setReason] = useState('')
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const qty = parseFloat(quantity)
    if (isNaN(qty) || qty <= 0) {
      setError(t('inventory.errorValidQuantity', 'يرجى إدخال كمية صحيحة أكبر من صفر'))
      return
    }

    setLoading(true)
    setError('')
    try {
      await inventoryService.stockIn(
        {
          productId: product.id,
          quantity: qty,
          locationId: locationId || null,
          reason: reason.trim() || undefined,
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

  const newStockPreview = (product.current_stock || 0) + (parseFloat(quantity) || 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
              <ArrowDownRight className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">{t('inventory.stockIn', 'إدخال مخزون (Stock In)')}</h2>
              <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form id="stock-in-form" onSubmit={handleSubmit} className="p-6 space-y-4">
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
                {t('inventory.quantityToAdd', 'الكمية الواردة')} <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0.001"
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
          {parseFloat(quantity) > 0 && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t('inventory.stockAfterOperation', 'المخزون بعد الإدخال')}:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                {product.current_stock} + {quantity} = {newStockPreview} {product.unit_symbol}
              </span>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">{t('inventory.reason', 'سبب / بيان الإدخال')}</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. استلام بضاعة، شراء مباشر، تزويد مخزن"
              className="w-full h-10 px-3 rounded-lg bg-input border border-border text-sm focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">{t('common.notes', 'ملاحظات إضافية')}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
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
            form="stock-in-form"
            disabled={loading || !parseFloat(quantity)}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            {t('inventory.confirmStockIn', 'تأكيد الإدخال')}
          </button>
        </div>
      </div>
    </div>
  )
}

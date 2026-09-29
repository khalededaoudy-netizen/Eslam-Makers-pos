import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react'
import { inventoryService, StorageLocation } from '@/services/inventory/inventoryService'
import { useAuthStore } from '@/stores/authStore'

interface StockAdjustmentModalProps {
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

export function StockAdjustmentModal({ product, onClose, onSuccess }: StockAdjustmentModalProps) {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [actualStock, setActualStock] = useState(product.current_stock.toString())
  const [locations, setLocations] = useState<StorageLocation[]>([])
  const [locationId, setLocationId] = useState('')
  const [reason, setReason] = useState('جرد دوري ومطابقة فعلية')
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

  const parsedActual = parseFloat(actualStock)
  const currentStock = product.current_stock || 0
  const delta = isNaN(parsedActual) ? 0 : parsedActual - currentStock

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isNaN(parsedActual) || parsedActual < 0) {
      setError(t('inventory.errorValidActualStock', 'يرجى إدخال رصيد فعلي صحيح أكبر من أو يساوي صفر'))
      return
    }

    if (!reason.trim()) {
      setError(t('inventory.errorReasonRequired', 'يرجى تحديد سبب التسوية'))
      return
    }

    setLoading(true)
    setError('')
    try {
      await inventoryService.adjustStock(
        {
          productId: product.id,
          actualStock: parsedActual,
          locationId: locationId || null,
          reason: reason.trim(),
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
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">{t('inventory.adjustment', 'تسوية وجرد المخزون (Reconciliation)')}</h2>
              <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form id="stock-adjust-form" onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Product Header */}
          <div className="p-3 rounded-xl bg-muted/40 border border-border flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{product.name_ar || product.name_en}</p>
              <p className="text-xs text-muted-foreground">{product.name_en}</p>
            </div>
            <div className="text-end">
              <p className="text-xs text-muted-foreground">{t('inventory.currentStock', 'المسجل بالنظام')}</p>
              <p className="text-sm font-bold font-mono text-foreground">{currentStock} {product.unit_symbol}</p>
            </div>
          </div>

          {/* Actual Stock & Location */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                {t('inventory.actualStock', 'الرصيد الفعلي بعد الجرد')} <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={actualStock}
                onChange={(e) => setActualStock(e.target.value)}
                placeholder="0"
                className="w-full h-10 px-3 rounded-lg bg-input border-2 border-primary/40 text-sm font-mono font-bold focus:ring-2 focus:ring-primary"
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

          {/* Difference Preview Box */}
          {!isNaN(parsedActual) && (
            <div className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
              delta === 0
                ? 'bg-muted/40 border-border text-muted-foreground'
                : delta > 0
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
            }`}>
              <span>{t('inventory.difference', 'فرق التسوية (Delta)')}:</span>
              <span className="font-bold font-mono text-sm">
                {delta > 0 ? `+${delta}` : delta} {product.unit_symbol}
              </span>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {t('inventory.reason', 'سبب التسوية')} <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. جرد دوري، تسوية عجز/فائض، تصحيح رصيد"
              className="w-full h-10 px-3 rounded-lg bg-input border border-border text-sm focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">{t('common.notes', 'ملاحظات')}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="تفاصيل إضافية عن عملية الجرد..."
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
            form="stock-adjust-form"
            disabled={loading || isNaN(parsedActual) || parsedActual < 0}
            className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            {t('inventory.confirmAdjustment', 'تأكيد التسوية')}
          </button>
        </div>
      </div>
    </div>
  )
}

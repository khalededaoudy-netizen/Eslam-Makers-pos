import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, ArrowRightLeft, AlertCircle, CheckCircle2 } from 'lucide-react'
import { inventoryService, StorageLocation } from '@/services/inventory/inventoryService'
import { useAuthStore } from '@/stores/authStore'

interface StockTransferModalProps {
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

export function StockTransferModal({ product, onClose, onSuccess }: StockTransferModalProps) {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [locations, setLocations] = useState<StorageLocation[]>([])
  const [productLocBalances, setProductLocBalances] = useState<Record<string, number>>({})
  const [fromLocationId, setFromLocationId] = useState('')
  const [toLocationId, setToLocationId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [locs, balances] = await Promise.all([
        inventoryService.getStorageLocations(),
        inventoryService.getProductLocations(product.id),
      ])
      setLocations(locs)

      const balMap: Record<string, number> = {}
      balances.forEach((b) => {
        balMap[b.locationId] = b.quantity
      })
      setProductLocBalances(balMap)

      if (locs.length >= 2) {
        setFromLocationId(locs[0].id)
        setToLocationId(locs[1].id)
      } else if (locs.length === 1) {
        setFromLocationId(locs[0].id)
      }
    } catch (err) {
      console.error('Failed to load transfer data', err)
    }
  }

  const parsedQty = parseFloat(quantity) || 0
  const sourceAvailable = productLocBalances[fromLocationId] ?? product.current_stock

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setError(t('inventory.errorValidQuantity', 'يرجى إدخال كمية صحيحة أكبر من صفر'))
      return
    }

    if (!fromLocationId || !toLocationId) {
      setError(t('inventory.errorSelectLocations', 'يرجى تحديد مكان الإرسال ومكان الاستلام'))
      return
    }

    if (fromLocationId === toLocationId) {
      setError(t('inventory.errorSameLocation', 'لا يمكن النقل لنفس المكان'))
      return
    }

    setLoading(true)
    setError('')
    try {
      await inventoryService.transferStock(
        {
          productId: product.id,
          fromLocationId,
          toLocationId,
          quantity: parsedQty,
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
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-500">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">{t('inventory.transferStock', 'تحويل مخزني بين الفروع والمخازن')}</h2>
              <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form id="stock-transfer-form" onSubmit={handleSubmit} className="p-6 space-y-4">
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
              <p className="text-xs text-muted-foreground">{t('inventory.totalStock', 'إجمالي المخزون')}</p>
              <p className="text-sm font-bold font-mono text-foreground">{product.current_stock} {product.unit_symbol}</p>
            </div>
          </div>

          {/* From and To Locations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                {t('inventory.fromLocation', 'من مكان')} <span className="text-destructive">*</span>
              </label>
              <select
                value={fromLocationId}
                onChange={(e) => setFromLocationId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-input border border-border text-sm focus:ring-2 focus:ring-primary"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name_ar ? `${loc.name_ar} (${loc.name})` : loc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                {t('inventory.toLocation', 'إلى مكان')} <span className="text-destructive">*</span>
              </label>
              <select
                value={toLocationId}
                onChange={(e) => setToLocationId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-input border border-border text-sm focus:ring-2 focus:ring-primary"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id} disabled={loc.id === fromLocationId}>
                    {loc.name_ar ? `${loc.name_ar} (${loc.name})` : loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quantity */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {t('inventory.transferQuantity', 'الكمية المحولة')} <span className="text-destructive">*</span>
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
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">{t('common.notes', 'ملاحظات التحويل')}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. نقل طلبية، إعادة توزيع بين المعارض..."
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
            form="stock-transfer-form"
            disabled={loading || parsedQty <= 0 || fromLocationId === toLocationId}
            className="flex items-center gap-2 px-5 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 transition-colors disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            {t('inventory.confirmTransfer', 'تأكيد التحويل')}
          </button>
        </div>
      </div>
    </div>
  )
}

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, PackageCheck, AlertCircle, Save, CheckCircle2 } from 'lucide-react'
import { purchaseService, PurchaseListItem, PurchaseItemDetail } from '@/services/purchases'
import { inventoryService, StorageLocation } from '@/services/inventory'
import { useAuthStore } from '@/stores/authStore'

interface ReceivePurchaseModalProps {
  isOpen: boolean
  onClose: () => void
  onReceived: () => void
  purchase: PurchaseListItem
  items: PurchaseItemDetail[]
}

export function ReceivePurchaseModal({
  isOpen,
  onClose,
  onReceived,
  purchase,
  items,
}: ReceivePurchaseModalProps) {
  const { t } = useTranslation()
  const { user } = useAuthStore()

  const [locations, setLocations] = useState<StorageLocation[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [receivingQuantities, setReceivingQuantities] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    inventoryService.getStorageLocations().then(locs => {
      setLocations(locs)
      if (locs.length > 0) {
        setSelectedLocationId(purchase.location_id || locs[0].id)
      }
    })

    // Pre-populate remaining quantities for receiving
    const initialQty: Record<string, number> = {}
    for (const it of items) {
      initialQty[it.id] = it.remaining_qty
    }
    setReceivingQuantities(initialQty)
    setNotes('')
    setError(null)
  }, [isOpen, purchase, items])

  if (!isOpen) return null

  const handleSetAllMax = () => {
    const maxQty: Record<string, number> = {}
    for (const it of items) {
      maxQty[it.id] = it.remaining_qty
    }
    setReceivingQuantities(maxQty)
  }

  const handleSetAllZero = () => {
    const zeroQty: Record<string, number> = {}
    for (const it of items) {
      zeroQty[it.id] = 0
    }
    setReceivingQuantities(zeroQty)
  }

  const handleQtyChange = (itemId: string, maxQty: number, val: number) => {
    const cleanVal = Math.max(0, Math.min(maxQty, val))
    setReceivingQuantities(prev => ({ ...prev, [itemId]: cleanVal }))
  }

  const totalItemsToReceive = Object.values(receivingQuantities).reduce((a, b) => a + b, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLocationId) {
      setError(t('purchases.errorLocationRequired', 'يرجى اختيار مكان التخزين للاستلام'))
      return
    }

    if (totalItemsToReceive <= 0) {
      setError(t('purchases.errorNoQuantitiesToReceive', 'يرجى إدخال كميات صالحة للاستلام أكبر من صفر'))
      return
    }

    setSaving(true)
    setError(null)

    try {
      const itemsPayload = items
        .filter(it => (receivingQuantities[it.id] || 0) > 0)
        .map(it => ({
          itemId: it.id,
          quantityToReceive: receivingQuantities[it.id] || 0,
        }))

      await purchaseService.receivePurchase({
        purchaseId: purchase.id,
        locationId: selectedLocationId,
        items: itemsPayload,
        notes: notes.trim() || undefined,
      }, user || undefined)

      onReceived()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error receiving items')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <PackageCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {t('purchases.receiveItems', 'استلام أصناف الفاتورة بالمخزون')}
              </h2>
              <p className="text-xs text-muted-foreground font-mono">
                {purchase.purchase_number} | {purchase.supplier_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center gap-2 text-rose-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5">
                {t('purchases.destinationLocation', 'مكان الاستلام والتخزين')} <span className="text-rose-400">*</span>
              </label>
              <select
                required
                value={selectedLocationId}
                onChange={e => setSelectedLocationId(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              >
                <option value="">-- اختر موقع التخزين --</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name_ar || loc.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5">
                {t('purchases.receivingNotes', 'ملاحظات الاستلام')}
              </label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="حالة الشحنة، فحص القطع، رقم الإذن..."
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs font-bold text-muted-foreground uppercase">
              الأصناف المراد استلامها:
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSetAllMax}
                className="text-xs text-primary hover:underline"
              >
                استلام كامل الكميات المتبقية
              </button>
              <span className="text-muted-foreground text-xs">|</span>
              <button
                type="button"
                onClick={handleSetAllZero}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                تصفير
              </button>
            </div>
          </div>

          {/* Items List */}
          <div className="border border-border rounded-xl overflow-hidden divide-y divide-border/50">
            {items.map(it => (
              <div key={it.id} className="p-3 bg-card flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{it.product_name_ar || it.product_name_en}</div>
                  <div className="text-xs font-mono text-muted-foreground flex items-center gap-3">
                    <span>SKU: {it.product_sku}</span>
                    <span>المطلوب: {it.quantity}</span>
                    <span className="text-emerald-400">مستلم سابقاً: {it.received_qty}</span>
                    <span className="text-amber-400 font-bold">المتبقي: {it.remaining_qty}</span>
                  </div>
                </div>

                <div className="w-32 flex items-center gap-1.5">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max={it.remaining_qty}
                    disabled={it.remaining_qty <= 0}
                    value={receivingQuantities[it.id] ?? 0}
                    onChange={e => handleQtyChange(it.id, it.remaining_qty, parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 bg-background border border-border rounded text-center font-mono text-sm font-bold text-emerald-400 focus:outline-none focus:border-primary disabled:opacity-30"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">{it.unit_symbol}</span>
                </div>
              </div>
            ))}
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/30">
          <div className="text-xs text-muted-foreground font-mono">
            إجمالي الوحدات المستلمة الآن: <span className="font-bold text-foreground text-sm">{totalItemsToReceive}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors"
            >
              {t('common.cancel', 'إلغاء')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || totalItemsToReceive <= 0}
              className="px-5 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
            >
              <PackageCheck className="w-4 h-4" />
              <span>{saving ? t('common.saving', 'جاري التوريد...') : t('purchases.confirmReceiving', 'تأكيد الاستلام بالمخزون')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

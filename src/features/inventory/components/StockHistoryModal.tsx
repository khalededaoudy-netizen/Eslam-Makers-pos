import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, History, Filter, ArrowDownRight, ArrowUpRight, RefreshCw, ArrowRightLeft } from 'lucide-react'
import { inventoryService, InventoryMovementRecord } from '@/services/inventory/inventoryService'
import { formatDate } from '@/lib/formatters'

interface StockHistoryModalProps {
  product: {
    id: string
    name_ar: string
    name_en: string
    sku: string
    current_stock: number
    unit_symbol: string
  }
  onClose: () => void
}

export function StockHistoryModal({ product, onClose }: StockHistoryModalProps) {
  const { t } = useTranslation()
  const [movements, setMovements] = useState<InventoryMovementRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedType, setSelectedType] = useState('')

  useEffect(() => {
    loadHistory()
  }, [selectedType])

  async function loadHistory() {
    setLoading(true)
    try {
      const records = await inventoryService.getMovements({
        productId: product.id,
        type: selectedType || undefined,
        limit: 100,
      })
      setMovements(records)
    } catch (err) {
      console.error('Failed to load history', err)
    } finally {
      setLoading(false)
    }
  }

  const getTypeBadge = (type: string, qty: number) => {
    switch (type) {
      case 'manual_in':
      case 'purchase':
      case 'sale_return':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <ArrowDownRight className="w-3 h-3" />
            {t(`inventory.types.${type}`, type)}
          </span>
        )
      case 'manual_out':
      case 'sale':
      case 'purchase_return':
      case 'damage':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <ArrowUpRight className="w-3 h-3" />
            {t(`inventory.types.${type}`, type)}
          </span>
        )
      case 'transfer_in':
      case 'transfer_out':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sky-500/10 text-sky-500 border border-sky-500/20">
            <ArrowRightLeft className="w-3 h-3" />
            {t(`inventory.types.${type}`, type)}
          </span>
        )
      case 'adjustment':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <RefreshCw className="w-3 h-3" />
            {t(`inventory.types.${type}`, type)}
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
            {t(`inventory.types.${type}`, type)}
          </span>
        )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-4xl rounded-2xl shadow-2xl border border-border flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {t('inventory.stockHistory', 'سجل حركات المخزون (Stock Audit Trail)')}
              </h2>
              <p className="text-xs text-muted-foreground font-mono">{product.sku} — {product.name_ar || product.name_en}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="px-6 py-3 border-b border-border flex items-center justify-between bg-muted/10">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="h-8 px-2.5 rounded-lg bg-input border border-border text-xs focus:ring-2 focus:ring-primary"
            >
              <option value="">{t('inventory.allTypes', 'كل أنواع الحركات')}</option>
              <option value="opening">{t('inventory.types.opening', 'رصيد افتتاحي')}</option>
              <option value="manual_in">{t('inventory.types.manual_in', 'إدخال مخزون')}</option>
              <option value="manual_out">{t('inventory.types.manual_out', 'إخراج مخزون')}</option>
              <option value="adjustment">{t('inventory.types.adjustment', 'تسوية جرد')}</option>
              <option value="transfer_in">{t('inventory.types.transfer_in', 'تحويل وارد')}</option>
              <option value="transfer_out">{t('inventory.types.transfer_out', 'تحويل صادر')}</option>
              <option value="purchase">{t('inventory.types.purchase', 'شراء')}</option>
              <option value="sale">{t('inventory.types.sale', 'بيع')}</option>
            </select>
          </div>
          <div className="text-xs text-muted-foreground">
            {t('inventory.currentStock', 'الرصيد الحالي')}: <span className="font-bold text-foreground font-mono">{product.current_stock} {product.unit_symbol}</span>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : movements.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-sm">
              <History className="w-10 h-10 opacity-30 mb-2" />
              <p>{t('common.noData', 'لا توجد حركات مسجلة')}</p>
            </div>
          ) : (
            <table className="w-full data-table">
              <thead>
                <tr>
                  <th className="text-start">{t('common.date', 'التاريخ والوقت')}</th>
                  <th className="text-start">{t('inventory.type', 'نوع الحركة')}</th>
                  <th className="text-end">{t('common.quantity', 'الكمية')}</th>
                  <th className="text-end">{t('inventory.before', 'قبل')}</th>
                  <th className="text-end">{t('inventory.after', 'بعد')}</th>
                  <th className="text-start">{t('common.location', 'المكان')}</th>
                  <th className="text-start">{t('inventory.reason', 'البيان / السبب')}</th>
                  <th className="text-start">{t('inventory.user', 'المستخدم')}</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                      {formatDate(m.created_at, true)}
                    </td>
                    <td>{getTypeBadge(m.type, m.quantity)}</td>
                    <td className="text-end">
                      <span className={`font-mono font-bold text-xs ${m.quantity > 0 ? 'text-emerald-500' : m.quantity < 0 ? 'text-rose-500' : 'text-foreground'}`}>
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                      </span>
                    </td>
                    <td className="text-end font-mono text-xs text-muted-foreground">{m.stock_before}</td>
                    <td className="text-end font-mono text-xs font-semibold text-foreground">{m.stock_after}</td>
                    <td className="text-xs text-muted-foreground">{m.location_name || '—'}</td>
                    <td className="text-xs text-foreground">
                      <p className="font-medium">{m.reason || '—'}</p>
                      {m.notes && <p className="text-[10px] text-muted-foreground italic">{m.notes}</p>}
                    </td>
                    <td className="text-xs text-muted-foreground whitespace-nowrap">{m.user_name || 'System'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-border bg-muted/20">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('common.close', 'إغلاق')}
          </button>
        </div>
      </div>
    </div>
  )
}

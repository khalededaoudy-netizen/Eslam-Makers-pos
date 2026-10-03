import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  X, ShoppingBag, PackageCheck, DollarSign, Calendar, MapPin,
  Truck, CheckCircle2, AlertTriangle, Clock, XCircle, RotateCcw,
  Receipt, FileText, Ban, Loader2
} from 'lucide-react'
import { purchaseService, PurchaseListItem, PurchaseItemDetail, PurchasePaymentItem } from '@/services/purchases'
import { ReceivePurchaseModal } from './ReceivePurchaseModal'
import { AddPaymentModal } from './AddPaymentModal'
import { useAuthStore, usePermission } from '@/stores/authStore'
import { formatCurrency } from '@/lib/formatters'

interface PurchaseDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  purchaseId: string | null
  onRefresh: () => void
}

export function PurchaseDetailsModal({
  isOpen,
  onClose,
  purchaseId,
  onRefresh,
}: PurchaseDetailsModalProps) {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'ar'
  const { user } = useAuthStore()
  const { can, isAdmin } = usePermission()

  const [data, setData] = useState<{
    purchase: PurchaseListItem
    items: PurchaseItemDetail[]
    payments: PurchasePaymentItem[]
  } | null>(null)
  const [loading, setLoading] = useState(true)

  // Sub-modals
  const [isReceiveOpen, setIsReceiveOpen] = useState(false)
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)

  const loadDetails = async () => {
    if (!purchaseId) return
    setLoading(true)
    try {
      const res = await purchaseService.getPurchaseById(purchaseId)
      setData(res)
    } catch (err) {
      console.error('Failed to load purchase details:', err)
    } finally {
      setLoading(false)
    }
  }

  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && purchaseId) {
      loadDetails()
    }
  }, [isOpen, purchaseId])

  if (!isOpen || !purchaseId) return null

  const handleExecuteCancel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!data) return
    if (!cancelReason.trim()) {
      setCancelError(t('purchases.cancelReasonRequired', 'يرجى إدخال سبب إلغاء الفاتورة'))
      return
    }

    setIsCancelling(true)
    setCancelError(null)
    try {
      await purchaseService.cancelPurchase(data.purchase.id, cancelReason.trim(), user || undefined)
      setIsCancelConfirmOpen(false)
      setCancelReason('')
      loadDetails()
      onRefresh()
    } catch (err: any) {
      setCancelError(err?.message || (isRtl ? 'حدث خطأ أثناء إلغاء الفاتورة' : 'Error cancelling purchase'))
    } finally {
      setIsCancelling(false)
    }
  }

  const canReceive = (isAdmin || can('receive', 'purchases')) && data?.purchase.status !== 'completed' && data?.purchase.status !== 'cancelled'
  const canPay = (isAdmin || can('pay', 'purchases')) && data?.purchase.status !== 'cancelled' && (data?.purchase.balance ?? 0) > 0
  const canCancel = (isAdmin || can('cancel', 'purchases')) && data?.purchase.status === 'draft'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">
                  {data?.purchase.purchase_number || t('purchases.detailsTitle', 'تفاصيل فاتورة الشراء')}
                </h2>
                {data && (
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    data.purchase.status === 'completed'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : data.purchase.status === 'partially_received'
                      ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                      : data.purchase.status === 'draft'
                      ? 'bg-zinc-500/15 text-zinc-400 border border-zinc-500/30'
                      : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  }`}>
                    {data.purchase.status.toUpperCase()}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {data?.purchase.supplier_name} {data?.purchase.invoice_ref && `| Ref: ${data.purchase.invoice_ref}`}
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

        {/* Content Body */}
        {loading || !data ? (
          <div className="p-12 text-center text-muted-foreground text-sm">
            {t('common.loading', 'جاري التحميل...')}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Top Info Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-muted/30 border border-border rounded-xl space-y-1">
                <span className="text-xs text-muted-foreground">إجمالي الفاتورة</span>
                <div className="text-lg font-bold font-mono text-primary">
                  {formatCurrency(data.purchase.total)}
                </div>
              </div>

              <div className="p-3 bg-muted/30 border border-border rounded-xl space-y-1">
                <span className="text-xs text-muted-foreground">المدفوع</span>
                <div className="text-lg font-bold font-mono text-emerald-400">
                  {formatCurrency(data.purchase.paid_amount)}
                </div>
              </div>

              <div className="p-3 bg-muted/30 border border-border rounded-xl space-y-1">
                <span className="text-xs text-muted-foreground">المتبقي للدفع</span>
                <div className="text-lg font-bold font-mono text-amber-400">
                  {formatCurrency(data.purchase.balance)}
                </div>
              </div>

              <div className="p-3 bg-muted/30 border border-border rounded-xl space-y-1">
                <span className="text-xs text-muted-foreground">المستودع / المكان</span>
                <div className="text-sm font-semibold truncate">
                  {data.purchase.location_name || '—'}
                </div>
              </div>
            </div>

            {/* Items Breakdown Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <span>الأصناف والكميات المستلمة</span>
                </h3>
                <span className="text-xs text-muted-foreground font-mono">
                  {data.items.length} أصناف مسجلة
                </span>
              </div>

              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm text-right">
                  <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b border-border">
                    <tr>
                      <th className="px-4 py-2.5">الصنف</th>
                      <th className="px-4 py-2.5 text-center">الكمية المطلوبة</th>
                      <th className="px-4 py-2.5 text-center">المستلم بالمخزن</th>
                      <th className="px-4 py-2.5 text-center">المتبقي</th>
                      <th className="px-4 py-2.5">سعر التكلفة</th>
                      <th className="px-4 py-2.5">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {data.items.map(it => (
                      <tr key={it.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2.5">
                          <div className="font-semibold text-foreground">{it.product_name_ar || it.product_name_en}</div>
                          <div className="text-xs font-mono text-muted-foreground">{it.product_sku}</div>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-center font-bold">
                          {it.quantity} {it.unit_symbol}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-center text-emerald-400 font-bold">
                          {it.received_qty} {it.unit_symbol}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-center">
                          {it.remaining_qty > 0 ? (
                            <span className="text-amber-400 font-bold">{it.remaining_qty} {it.unit_symbol}</span>
                          ) : (
                            <span className="text-emerald-400 text-xs">● مكتمل</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-mono font-medium">
                          {formatCurrency(it.unit_cost)}
                        </td>
                        <td className="px-4 py-2.5 font-mono font-bold">
                          {formatCurrency(it.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payments History */}
            {data.payments.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-400" />
                  <span>دفعات السداد المسجلة</span>
                </h3>
                <div className="border border-border rounded-xl overflow-hidden divide-y divide-border/50">
                  {data.payments.map(pm => (
                    <div key={pm.id} className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-muted/30">
                      <div>
                        <span className="font-bold font-mono text-emerald-400 text-sm">{formatCurrency(pm.amount)}</span>
                        <span className="text-muted-foreground mr-2">بواسطة {pm.payment_method.toUpperCase()}</span>
                        {pm.reference && <span className="text-muted-foreground">({pm.reference})</span>}
                      </div>
                      <div className="text-muted-foreground">
                        {new Date(pm.created_at).toLocaleString()} {pm.user_name && `• ${pm.user_name}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/30">
          <div className="flex items-center gap-2">
            {canCancel && (
              <button
                onClick={() => {
                  setCancelError(null)
                  setCancelReason('')
                  setIsCancelConfirmOpen(true)
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 flex items-center gap-1.5 transition-colors"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>إلغاء الفاتورة</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {canPay && (
              <button
                onClick={() => setIsPaymentOpen(true)}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 flex items-center gap-2 transition-colors"
              >
                <DollarSign className="w-4 h-4" />
                <span>سداد دفعة للمورد</span>
              </button>
            )}

            {canReceive && (
              <button
                onClick={() => setIsReceiveOpen(true)}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 flex items-center gap-2 shadow-sm transition-colors"
              >
                <PackageCheck className="w-4 h-4" />
                <span>استلام الأصناف بالمخزون</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors"
            >
              {t('common.close', 'إغلاق')}
            </button>
          </div>
        </div>
      </div>

      {/* Cancel Purchase Reason Modal */}
      {isCancelConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/25 flex items-center justify-center text-rose-500">
                  <Ban className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-foreground">
                  {t('purchases.cancelConfirmTitle', 'تأكيد إلغاء فاتورة الشراء')}
                </h3>
              </div>
              <button
                onClick={() => setIsCancelConfirmOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteCancel} className="p-6 space-y-4">
              {cancelError && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-semibold flex items-center gap-2 animate-fade-in">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{cancelError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  {t('purchases.cancelReason', 'سبب الإلغاء')} <span className="text-destructive">*</span>
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder={t('purchases.cancelReasonPlaceholder', 'يرجى كتابة سبب إلغاء الفاتورة بالتفصيل...')}
                  className="w-full h-24 p-3 rounded-xl bg-input border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  required
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCancelConfirmOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-border hover:bg-muted text-foreground transition-colors"
                >
                  {t('common.cancel', 'تراجع')}
                </button>
                <button
                  type="submit"
                  disabled={isCancelling || !cancelReason.trim()}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {isCancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                  <span>{isCancelling ? t('common.loading', 'جارٍ الإلغاء...') : t('purchases.confirmCancel', 'تأكيد الإلغاء')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sub Modals */}
      {data && isReceiveOpen && (
        <ReceivePurchaseModal
          isOpen={isReceiveOpen}
          onClose={() => setIsReceiveOpen(false)}
          onReceived={() => {
            loadDetails()
            onRefresh()
          }}
          purchase={data.purchase}
          items={data.items}
        />
      )}

      {data && isPaymentOpen && (
        <AddPaymentModal
          isOpen={isPaymentOpen}
          onClose={() => setIsPaymentOpen(false)}
          onPaymentAdded={() => {
            loadDetails()
            onRefresh()
          }}
          purchase={data.purchase}
        />
      )}
    </div>
  )
}

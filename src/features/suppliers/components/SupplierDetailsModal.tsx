import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Truck, ShoppingBag, Receipt, Calendar, MapPin, Phone, Mail, FileText, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
import { supplierService, SupplierItem } from '@/services/suppliers'
import { formatCurrency } from '@/lib/formatters'

interface SupplierDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  supplierId: string | null
}

export function SupplierDetailsModal({ isOpen, onClose, supplierId }: SupplierDetailsModalProps) {
  const { t } = useTranslation()
  const [data, setData] = useState<{
    supplier: SupplierItem
    purchases: any[]
    payments: any[]
  } | null>(null)
  const [activeTab, setActiveTab] = useState<'purchases' | 'payments'>('purchases')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isOpen || !supplierId) return
    setLoading(true)
    supplierService.getSupplierById(supplierId)
      .then(res => setData(res))
      .catch(err => console.error('Failed to load supplier details:', err))
      .finally(() => setLoading(false))
  }, [isOpen, supplierId])

  if (!isOpen || !supplierId) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Truck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {data?.supplier.name || t('suppliers.supplierDetails', 'تفاصيل حساب المورد')}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t('suppliers.accountStatement', 'كشف حساب وفواتير المشتريات والمدفوعات')}
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

        {/* Content */}
        {loading || !data ? (
          <div className="p-12 text-center text-muted-foreground text-sm">
            {t('common.loading', 'جاري التحميل...')}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-1">
                <span className="text-xs text-muted-foreground">{t('suppliers.balance', 'الرصيد المستحق للمورد')}</span>
                <div className={`text-xl font-bold font-mono ${data.supplier.balance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {formatCurrency(data.supplier.balance)}
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {data.supplier.balance > 0 ? t('suppliers.debtToSupplier', 'مطلوب سداده') : t('suppliers.balanceClear', 'الحساب خالص')}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-1">
                <span className="text-xs text-muted-foreground">{t('suppliers.phone', 'الهاتف والتواصل')}</span>
                <div className="text-sm font-semibold flex items-center gap-1.5 pt-1">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{data.supplier.phone || '—'}</span>
                </div>
                {data.supplier.whatsapp && (
                  <span className="text-xs text-emerald-400 block">واتساب: {data.supplier.whatsapp}</span>
                )}
              </div>

              <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-1">
                <span className="text-xs text-muted-foreground">{t('suppliers.email', 'البريد والعنوان')}</span>
                <div className="text-xs truncate pt-1">{data.supplier.email || '—'}</div>
                <div className="text-xs text-muted-foreground truncate">{data.supplier.address || '—'}</div>
              </div>

              <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-1">
                <span className="text-xs text-muted-foreground">{t('suppliers.taxNumber', 'الرقم الضريبي')}</span>
                <div className="text-sm font-mono pt-1">{data.supplier.tax_number || '—'}</div>
                <div className="text-xs text-muted-foreground">
                  {data.supplier.is_active ? (
                    <span className="text-emerald-400">● نشط</span>
                  ) : (
                    <span className="text-rose-400">● غير نشط</span>
                  )}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border">
              <button
                onClick={() => setActiveTab('purchases')}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'purchases'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                <span>{t('purchases.title', 'فواتير المشتريات')} ({data.purchases.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('payments')}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'payments'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Receipt className="w-4 h-4" />
                <span>{t('purchases.paymentsHistory', 'سجل المدفوعات')} ({data.payments.length})</span>
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'purchases' ? (
              data.purchases.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  {t('purchases.noPurchasesFound', 'لا توجد فواتير مشتريات مسجلة لهذا المورد')}
                </div>
              ) : (
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm text-right">
                    <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b border-border">
                      <tr>
                        <th className="px-4 py-3">رقم الفاتورة</th>
                        <th className="px-4 py-3">التاريخ</th>
                        <th className="px-4 py-3">الحالة</th>
                        <th className="px-4 py-3">الإجمالي</th>
                        <th className="px-4 py-3">المدفوع</th>
                        <th className="px-4 py-3">المتبقي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {data.purchases.map(p => (
                        <tr key={p.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 font-mono font-medium">{p.purchase_number}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {new Date(p.purchased_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              p.status === 'completed'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : p.status === 'partially_received'
                                ? 'bg-blue-500/15 text-blue-400'
                                : p.status === 'draft'
                                ? 'bg-zinc-500/15 text-zinc-400'
                                : 'bg-rose-500/15 text-rose-400'
                            }`}>
                              {p.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono font-medium">{formatCurrency(p.total)}</td>
                          <td className="px-4 py-3 font-mono text-emerald-400">{formatCurrency(p.paid_amount)}</td>
                          <td className="px-4 py-3 font-mono text-amber-400">{formatCurrency(p.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : data.payments.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                {t('purchases.noPaymentsFound', 'لا توجد دفعات مالية مسجلة')}
              </div>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm text-right">
                  <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b border-border">
                    <tr>
                      <th className="px-4 py-3">التاريخ</th>
                      <th className="px-4 py-3">الفاتورة المرتبطة</th>
                      <th className="px-4 py-3">المبلغ المسدد</th>
                      <th className="px-4 py-3">طريقة الدفع</th>
                      <th className="px-4 py-3">المرجع / ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {data.payments.map(pm => (
                      <tr key={pm.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {new Date(pm.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{pm.purchase_number || '—'}</td>
                        <td className="px-4 py-3 font-mono font-bold text-emerald-400">
                          {formatCurrency(pm.amount)}
                        </td>
                        <td className="px-4 py-3 text-xs uppercase">{pm.payment_method}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {pm.reference || pm.notes || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-border bg-muted/30">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors"
          >
            {t('common.close', 'إغلاق')}
          </button>
        </div>
      </div>
    </div>
  )
}

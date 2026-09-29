import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ShoppingBag, Plus, Search, Calendar, Filter, Eye, CheckCircle2,
  Clock, AlertCircle, DollarSign, XCircle, ArrowUpRight, PackageCheck, Ban
} from 'lucide-react'
import { purchaseService, PurchaseListItem, PurchaseOverview } from '@/services/purchases'
import { supplierService, SupplierItem } from '@/services/suppliers'
import { CreatePurchaseModal } from './components/CreatePurchaseModal'
import { PurchaseDetailsModal } from './components/PurchaseDetailsModal'
import { useAuthStore, usePermission } from '@/stores/authStore'
import { formatCurrency } from '@/lib/formatters'

export function PurchasesPage() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const { can, isAdmin } = usePermission()

  const [purchases, setPurchases] = useState<PurchaseListItem[]>([])
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([])
  const [overview, setOverview] = useState<PurchaseOverview>({
    totalPurchases: 0,
    completedCount: 0,
    partialCount: 0,
    draftCount: 0,
    totalSpend: 0,
    totalUnpaid: 0,
  })

  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [supplierFilter, setSupplierFilter] = useState<string>('')

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [list, stats, supps] = await Promise.all([
        purchaseService.getPurchases({
          search,
          status: statusFilter,
          supplierId: supplierFilter || undefined,
        }),
        purchaseService.getPurchaseOverview(),
        supplierService.getSuppliers({ activeOnly: true }),
      ])
      setPurchases(list)
      setOverview(stats)
      setSuppliers(supps)
    } catch (err) {
      console.error('Failed to load purchases:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData()
    }, 200)
    return () => clearTimeout(timer)
  }, [search, statusFilter, supplierFilter])

  const canCreate = isAdmin || can('create', 'purchases')

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            <span>مكتمل الاستلام</span>
          </span>
        )
      case 'partially_received':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            <Clock className="w-3 h-3" />
            <span>مستلم جزئياً</span>
          </span>
        )
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-500/15 text-zinc-400 border border-zinc-500/30">
            <span>مسودة (لم تستلم)</span>
          </span>
        )
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <Ban className="w-3 h-3" />
            <span>ملغاة</span>
          </span>
        )
      default:
        return <span className="text-xs">{status}</span>
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-card/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2.5">
            <ShoppingBag className="w-6 h-6 text-primary" />
            <span>{t('purchases.title', 'إدارة المشتريات والتوريدات')}</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('purchases.subtitle', 'فواتير التوريد، استلام المخزون، متابعة الدفعات، وأسعار التكلفة')}
          </p>
        </div>

        {canCreate && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 flex items-center gap-2 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{t('purchases.createPurchase', 'فاتورة شراء جديدة')}</span>
          </button>
        )}
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 p-6 pb-2">
        <div className="bg-card border border-border rounded-xl p-3.5 space-y-1 shadow-sm">
          <span className="text-xs text-muted-foreground">{t('purchases.totalInvoices', 'إجمالي الفواتير')}</span>
          <div className="text-xl font-bold font-mono">{overview.totalPurchases}</div>
        </div>

        <div className="bg-card border border-border rounded-xl p-3.5 space-y-1 shadow-sm">
          <span className="text-xs text-muted-foreground">{t('purchases.completed', 'مكتملة الاستلام')}</span>
          <div className="text-xl font-bold font-mono text-emerald-400">{overview.completedCount}</div>
        </div>

        <div className="bg-card border border-border rounded-xl p-3.5 space-y-1 shadow-sm">
          <span className="text-xs text-muted-foreground">{t('purchases.partiallyReceived', 'مستلمة جزئياً')}</span>
          <div className="text-xl font-bold font-mono text-blue-400">{overview.partialCount}</div>
        </div>

        <div className="bg-card border border-border rounded-xl p-3.5 space-y-1 shadow-sm">
          <span className="text-xs text-muted-foreground">{t('purchases.drafts', 'مسودات (Draft)')}</span>
          <div className="text-xl font-bold font-mono text-zinc-400">{overview.draftCount}</div>
        </div>

        <div className="bg-card border border-border rounded-xl p-3.5 space-y-1 shadow-sm">
          <span className="text-xs text-muted-foreground">{t('purchases.totalSpend', 'إجمالي المشتريات')}</span>
          <div className="text-lg font-bold font-mono text-primary truncate">
            {formatCurrency(overview.totalSpend)}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-3.5 space-y-1 shadow-sm">
          <span className="text-xs text-muted-foreground">{t('purchases.unpaidBalance', 'مستحقات غير مسددة')}</span>
          <div className="text-lg font-bold font-mono text-amber-400 truncate">
            {formatCurrency(overview.totalUnpaid)}
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="px-6 py-3 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="بحث برقم الفاتورة، المورد، رقم الإذن..."
              className="w-full pr-9 pl-3 py-1.5 bg-card border border-border rounded-lg text-sm focus:outline-none focus:border-primary shadow-sm"
            />
          </div>

          <select
            value={supplierFilter}
            onChange={e => setSupplierFilter(e.target.value)}
            className="w-full sm:w-48 px-3 py-1.5 bg-card border border-border rounded-lg text-sm focus:outline-none focus:border-primary shadow-sm"
          >
            <option value="">-- كل الموردين --</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-muted/40 border border-border rounded-lg text-xs font-medium w-full md:w-auto overflow-x-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-md transition-colors shrink-0 ${
              statusFilter === 'all' ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            الكل ({overview.totalPurchases})
          </button>
          <button
            onClick={() => setStatusFilter('completed')}
            className={`px-3 py-1.5 rounded-md transition-colors shrink-0 ${
              statusFilter === 'completed' ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            مكتملة ({overview.completedCount})
          </button>
          <button
            onClick={() => setStatusFilter('partially_received')}
            className={`px-3 py-1.5 rounded-md transition-colors shrink-0 ${
              statusFilter === 'partially_received' ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            جزئية ({overview.partialCount})
          </button>
          <button
            onClick={() => setStatusFilter('draft')}
            className={`px-3 py-1.5 rounded-md transition-colors shrink-0 ${
              statusFilter === 'draft' ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            مسودات ({overview.draftCount})
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="flex-1 px-6 pb-6 overflow-hidden">
        <div className="bg-card border border-border rounded-xl h-full flex flex-col shadow-sm overflow-hidden">
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="py-20 text-center text-muted-foreground text-sm">
                {t('common.loading', 'جاري التحميل...')}
              </div>
            ) : purchases.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground space-y-3">
                <ShoppingBag className="w-12 h-12 mx-auto opacity-20" />
                <p className="text-sm font-medium">{t('purchases.noPurchasesFound', 'لم يتم العثور على فواتير مشتريات')}</p>
                {canCreate && (
                  <button
                    onClick={() => setIsCreateOpen(true)}
                    className="text-xs text-primary underline"
                  >
                    {t('purchases.createFirstInvoice', 'إنشاء أول فاتورة شراء')}
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-sm text-right">
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b border-border sticky top-0 backdrop-blur-sm z-10">
                  <tr>
                    <th className="px-4 py-3.5">رقم الفاتورة</th>
                    <th className="px-4 py-3.5">المورد</th>
                    <th className="px-4 py-3.5">التاريخ</th>
                    <th className="px-4 py-3.5">حالة الاستلام</th>
                    <th className="px-4 py-3.5">المكان المستلم فيه</th>
                    <th className="px-4 py-3.5">الأصناف</th>
                    <th className="px-4 py-3.5">إجمالي الفاتورة</th>
                    <th className="px-4 py-3.5">المدفوع</th>
                    <th className="px-4 py-3.5">المتبقي</th>
                    <th className="px-4 py-3.5 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {purchases.map(p => (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-4 py-3 font-mono font-bold text-foreground">
                        {p.purchase_number}
                        {p.invoice_ref && (
                          <div className="text-xs font-normal text-muted-foreground">Ref: {p.invoice_ref}</div>
                        )}
                      </td>

                      <td className="px-4 py-3 font-semibold">
                        {p.supplier_name || '—'}
                      </td>

                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(p.purchased_at).toLocaleDateString()}
                      </td>

                      <td className="px-4 py-3">
                        {getStatusBadge(p.status)}
                      </td>

                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {p.location_name || '—'}
                      </td>

                      <td className="px-4 py-3 text-center font-mono">
                        <span className="px-2 py-0.5 bg-muted rounded text-xs">
                          {p.items_count} أصناف
                        </span>
                      </td>

                      <td className="px-4 py-3 font-mono font-bold">
                        {formatCurrency(p.total)}
                      </td>

                      <td className="px-4 py-3 font-mono text-emerald-400 font-semibold">
                        {formatCurrency(p.paid_amount)}
                      </td>

                      <td className="px-4 py-3 font-mono">
                        {p.balance > 0 ? (
                          <span className="text-amber-400 font-bold">{formatCurrency(p.balance)}</span>
                        ) : (
                          <span className="text-xs text-emerald-400">● خالص</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setSelectedPurchaseId(p.id)}
                          className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold flex items-center gap-1.5 mx-auto transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>عرض وتفاصيل</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreatePurchaseModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSaved={purchaseId => {
          loadData()
          setSelectedPurchaseId(purchaseId)
        }}
      />

      <PurchaseDetailsModal
        isOpen={!!selectedPurchaseId}
        onClose={() => setSelectedPurchaseId(null)}
        purchaseId={selectedPurchaseId}
        onRefresh={loadData}
      />
    </div>
  )
}

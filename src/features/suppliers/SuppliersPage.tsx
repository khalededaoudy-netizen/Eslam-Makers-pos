import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Truck, Plus, Search, Phone, Mail, MapPin, Edit, Trash2, Eye,
  CheckCircle2, XCircle, AlertTriangle, Users, DollarSign, ShoppingBag, ArrowUpRight
} from 'lucide-react'
import { supplierService, SupplierItem } from '@/services/suppliers'
import { SupplierModal } from './components/SupplierModal'
import { SupplierDetailsModal } from './components/SupplierDetailsModal'
import { useAuthStore, usePermission } from '@/stores/authStore'
import { formatCurrency } from '@/lib/formatters'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

export function SuppliersPage() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const { can, isAdmin } = usePermission()

  const [suppliers, setSuppliers] = useState<SupplierItem[]>([])
  const [overview, setOverview] = useState({
    totalSuppliers: 0,
    activeSuppliers: 0,
    totalPayables: 0,
    totalPurchasesCount: 0,
  })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierItem | null>(null)
  const [detailsSupplierId, setDetailsSupplierId] = useState<string | null>(null)

  // Unified Delete Confirmation State
  const [deleteSupplierTarget, setDeleteSupplierTarget] = useState<SupplierItem | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [list, stats] = await Promise.all([
        supplierService.getSuppliers({
          search,
          activeOnly: statusFilter === 'active',
        }),
        supplierService.getSupplierOverview(),
      ])
      setSuppliers(list)
      setOverview(stats)
    } catch (err) {
      console.error('Failed to load suppliers:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData()
    }, 200)
    return () => clearTimeout(timer)
  }, [search, statusFilter])

  const executeDeleteSupplier = async () => {
    if (!deleteSupplierTarget) return
    await supplierService.deleteSupplier(deleteSupplierTarget.id, user || undefined)
    setDeleteSupplierTarget(null)
    loadData()
  }

  const canCreate = isAdmin || can('create', 'suppliers')
  const canEdit = isAdmin || can('update', 'suppliers')
  const canDelete = isAdmin || can('delete', 'suppliers')

  const filteredSuppliers = suppliers.filter(s => {
    if (statusFilter === 'active') return s.is_active === 1 && !s.archived_at
    if (statusFilter === 'inactive') return s.is_active === 0 || s.archived_at
    return true
  })

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-card/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2.5">
            <Truck className="w-6 h-6 text-primary" />
            <span>{t('suppliers.title', 'إدارة الموردين والشركات')}</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('suppliers.subtitle', 'سجل الموردين، حسابات التوريد، الأرصدة المستحقة، وتاريخ المشتريات')}
          </p>
        </div>

        {canCreate && (
          <button
            onClick={() => {
              setSelectedSupplier(null)
              setIsModalOpen(true)
            }}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 flex items-center gap-2 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{t('suppliers.addSupplier', 'إضافة مورد جديد')}</span>
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 pb-2">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground font-medium">{t('suppliers.totalSuppliers', 'إجمالي الموردين')}</span>
            <div className="text-2xl font-bold">{overview.totalSuppliers}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-400" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground font-medium">{t('suppliers.activeSuppliers', 'الموردين النشطين')}</span>
            <div className="text-2xl font-bold text-emerald-400">{overview.activeSuppliers}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground font-medium">{t('suppliers.totalPayables', 'إجمالي المستحقات (ديون الموردين)')}</span>
            <div className="text-2xl font-bold font-mono text-amber-400">
              {formatCurrency(overview.totalPayables)}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-amber-400" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground font-medium">{t('suppliers.totalPurchases', 'إجمالي فواتير المشتريات')}</span>
            <div className="text-2xl font-bold font-mono">{overview.totalPurchasesCount}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-purple-400" />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('suppliers.searchPlaceholder', 'بحث باسم المورد، الهاتف، الواتساب، السجل الضريبي...')}
            className="w-full pr-9 pl-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:border-primary shadow-sm"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-muted/40 border border-border rounded-lg text-xs font-medium w-full sm:w-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              statusFilter === 'all' ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('common.all', 'الكل')} ({overview.totalSuppliers})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              statusFilter === 'active' ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('common.active', 'النشطين')} ({overview.activeSuppliers})
          </button>
          <button
            onClick={() => setStatusFilter('inactive')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              statusFilter === 'inactive' ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('common.inactive', 'غير النشطين')} ({Math.max(0, overview.totalSuppliers - overview.activeSuppliers)})
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
            ) : filteredSuppliers.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground space-y-3">
                <Truck className="w-12 h-12 mx-auto opacity-20" />
                <p className="text-sm font-medium">{t('suppliers.noSuppliersFound', 'لم يتم العثور على موردين مسجلين')}</p>
                {canCreate && (
                  <button
                    onClick={() => {
                      setSelectedSupplier(null)
                      setIsModalOpen(true)
                    }}
                    className="text-xs text-primary underline"
                  >
                    {t('suppliers.createFirstSupplier', 'إضافة أول مورد للمتجر')}
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-sm text-right">
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b border-border sticky top-0 backdrop-blur-sm z-10">
                  <tr>
                    <th className="px-4 py-3.5">المورد</th>
                    <th className="px-4 py-3.5">بيانات التواصل</th>
                    <th className="px-4 py-3.5">العنوان / الضريبي</th>
                    <th className="px-4 py-3.5">عدد الفواتير</th>
                    <th className="px-4 py-3.5">إجمالي التعامل</th>
                    <th className="px-4 py-3.5">الرصيد المستحق</th>
                    <th className="px-4 py-3.5">الحالة</th>
                    <th className="px-4 py-3.5 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredSuppliers.map(s => (
                    <tr key={s.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="font-bold text-foreground">{s.name}</div>
                        {s.notes && (
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">{s.notes}</div>
                        )}
                      </td>

                      <td className="px-4 py-3 space-y-0.5">
                        {s.phone && (
                          <div className="text-xs flex items-center gap-1">
                            <Phone className="w-3 h-3 text-muted-foreground" />
                            <span>{s.phone}</span>
                          </div>
                        )}
                        {s.whatsapp && (
                          <div className="text-[11px] text-emerald-400">واتساب: {s.whatsapp}</div>
                        )}
                        {s.email && (
                          <div className="text-[11px] text-muted-foreground truncate max-w-[150px]">{s.email}</div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-xs space-y-0.5">
                        <div className="text-muted-foreground truncate max-w-[180px]">{s.address || '—'}</div>
                        {s.tax_number && (
                          <div className="text-[11px] font-mono text-muted-foreground">ضريبي: {s.tax_number}</div>
                        )}
                      </td>

                      <td className="px-4 py-3 font-mono text-center">
                        <span className="px-2 py-0.5 bg-muted rounded text-xs font-semibold">
                          {s.purchases_count || 0}
                        </span>
                      </td>

                      <td className="px-4 py-3 font-mono font-medium">
                        {formatCurrency(s.total_spent || 0)}
                      </td>

                      <td className="px-4 py-3 font-mono font-bold">
                        <span className={s.balance > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                          {formatCurrency(s.balance)}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {s.is_active === 1 && !s.archived_at ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>نشط</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <XCircle className="w-3 h-3" />
                            <span>غير نشط</span>
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setDetailsSupplierId(s.id)}
                            title="كشف الحساب وتفاصيل المورد"
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Eye className="w-4 h-4 text-blue-400" />
                          </button>

                          {canEdit && (
                            <button
                              onClick={() => {
                                setSelectedSupplier(s)
                                setIsModalOpen(true)
                              }}
                              title="تعديل بيانات المورد"
                              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Edit className="w-4 h-4 text-amber-400" />
                            </button>
                          )}

                          {canDelete && (
                            <button
                              onClick={() => setDeleteSupplierTarget(s)}
                              title={t('common.delete', 'حذف')}
                              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-rose-400 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4 text-rose-400" />
                            </button>
                          )}
                        </div>
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
      <SupplierModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={loadData}
        supplier={selectedSupplier}
      />

      <SupplierDetailsModal
        isOpen={!!detailsSupplierId}
        onClose={() => setDetailsSupplierId(null)}
        supplierId={detailsSupplierId}
      />

      {/* Unified Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteSupplierTarget}
        onClose={() => setDeleteSupplierTarget(null)}
        onConfirm={executeDeleteSupplier}
        title={t('suppliers.confirmDeleteTitle', 'تأكيد حذف المورد')}
        description={t('suppliers.confirmDelete', 'هل تريد بالتأكيد حذف أو أرشفة هذا المورد؟')}
        itemName={deleteSupplierTarget?.name}
        confirmText={t('common.delete', 'حذف')}
      />
    </div>
  )
}

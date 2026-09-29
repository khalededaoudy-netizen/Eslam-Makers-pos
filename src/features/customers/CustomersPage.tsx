import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  Edit,
  Trash2,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  DollarSign,
  ShoppingBag,
  ArrowUpRight,
  Filter,
  RefreshCw,
  Archive,
  RotateCcw,
  Tag,
  ShieldCheck,
} from 'lucide-react'
import {
  customerService,
  Customer,
  CustomerListItem,
  CustomerType,
  CustomerOverview,
} from '@/services/customers'
import { CustomerModal } from './components/CustomerModal'
import { CustomerDetailsModal } from './components/CustomerDetailsModal'
import { useAuthStore, usePermission } from '@/stores/authStore'
import { formatCurrency, formatDate } from '@/lib/formatters'

const TYPE_CONFIG: Record<CustomerType, { ar: string; en: string; color: string }> = {
  individual: {
    ar: 'فرد',
    en: 'Individual',
    color: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  },
  student: {
    ar: 'طالب / مشاريع',
    en: 'Student',
    color: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  },
  company: {
    ar: 'شركة / ورشة',
    en: 'Company',
    color: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  },
  lab: {
    ar: 'معمل / جامعة',
    en: 'Research Lab',
    color: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  },
  vip: {
    ar: 'VIP',
    en: 'VIP',
    color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  },
}

export function CustomersPage() {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language !== 'en'
  const { user } = useAuthStore()
  const { can, isAdmin } = usePermission()

  const [customers, setCustomers] = useState<CustomerListItem[]>([])
  const [overview, setOverview] = useState<CustomerOverview>({
    totalCustomers: 0,
    activeCustomers: 0,
    archivedCustomers: 0,
    totalReceivables: 0,
    withBalanceCount: 0,
  })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('all')
  const [typeFilter, setTypeFilter] = useState<CustomerType | 'all'>('all')

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [detailsCustomerId, setDetailsCustomerId] = useState<string | null>(null)

  const canCreate = isAdmin || can('create', 'customers')
  const canEdit = isAdmin || can('update', 'customers')
  const canDelete = isAdmin || can('delete', 'customers')

  const loadData = async () => {
    setLoading(true)
    try {
      const [list, stats] = await Promise.all([
        customerService.getCustomers({
          search,
          status: statusFilter,
          customerType: typeFilter,
        }),
        customerService.getOverview(),
      ])
      setCustomers(list)
      setOverview(stats)
    } catch (err) {
      console.error('Failed to load customers:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData()
    }, 200)
    return () => clearTimeout(timer)
  }, [search, statusFilter, typeFilter])

  const handleToggleStatus = async (c: CustomerListItem) => {
    const isCurrentlyActive = c.is_active === 1 && !c.archived_at
    const confirmMsg = isCurrentlyActive
      ? t('customers.confirmArchive', 'هل تريد بالتأكيد أرشفة هذا العميل؟')
      : t('customers.confirmReactivate', 'هل تريد بالتأكيد إعادة تفعيل هذا العميل؟')

    if (window.confirm(confirmMsg)) {
      try {
        if (isCurrentlyActive) {
          await customerService.archiveCustomer(c.id, user || undefined)
        } else {
          await customerService.reactivateCustomer(c.id, user || undefined)
        }
        loadData()
      } catch (err: any) {
        alert(err.message || 'Error updating status')
      }
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-card/50 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <span>{t('customers.title', 'إدارة العملاء')}</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t(
              'customers.subtitle',
              'تسجيل حسابات العملاء، بيانات التواصل، الحدود الائتمانية والمديونيات'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData()}
            className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={t('common.refresh', 'تحديث')}
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {canCreate && (
            <button
              onClick={() => {
                setSelectedCustomer(null)
                setIsModalOpen(true)
              }}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>{t('customers.addCustomer', 'إضافة عميل جديد')}</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">
                {t('customers.totalCustomers', 'إجمالي العملاء')}
              </span>
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div className="text-2xl font-bold font-mono text-foreground">
              {overview.totalCustomers}
            </div>
            <span className="text-[11px] text-muted-foreground">
              {overview.activeCustomers} {t('common.active', 'نشط')}
            </span>
          </div>

          <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">
                {t('customers.activeCustomers', 'العملاء النشطين')}
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-500">
              {overview.activeCustomers}
            </div>
            <span className="text-[11px] text-muted-foreground">
              {overview.archivedCustomers} {t('customers.archived', 'مؤرشف')}
            </span>
          </div>

          <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">
                {t('customers.totalReceivables', 'إجمالي المديونيات المستحقة')}
              </span>
              <DollarSign className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold font-mono text-amber-500">
              {formatCurrency(overview.totalReceivables)}
            </div>
            <span className="text-[11px] text-muted-foreground">
              {t('customers.receivablesNotice', 'مستحقات آجلة على العملاء')}
            </span>
          </div>

          <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">
                {t('customers.withBalanceCount', 'عملاء عليهم مستحقات')}
              </span>
              <ShoppingBag className="w-4 h-4 text-primary" />
            </div>
            <div className="text-2xl font-bold font-mono text-foreground">
              {overview.withBalanceCount}
            </div>
            <span className="text-[11px] text-muted-foreground">
              {t('customers.withBalanceSub', 'حسابات مفتوحة للمتابعة')}
            </span>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t(
                'customers.searchPlaceholder',
                'بحث بالاسم، الهاتف، واتساب، كود العميل، العنوان...'
              )}
              className="w-full ps-9 pe-4 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Customer Type Dropdown */}
            <div className="flex items-center gap-1.5 text-xs">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value as CustomerType | 'all')}
                className="px-2.5 py-1.5 bg-background border border-input rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="all">{t('customers.allTypes', 'جميع الفئات')}</option>
                <option value="individual">{isArabic ? 'أفراد' : 'Individual'}</option>
                <option value="student">{isArabic ? 'طلاب / مشاريع' : 'Students'}</option>
                <option value="company">{isArabic ? 'شركات / ورش' : 'Companies'}</option>
                <option value="lab">{isArabic ? 'معامل / جامعات' : 'Labs'}</option>
                <option value="vip">{isArabic ? 'VIP' : 'VIP'}</option>
              </select>
            </div>

            {/* Status Tabs */}
            <div className="flex items-center p-0.5 bg-muted rounded-lg border border-border text-xs">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-background text-foreground shadow-sm font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('common.all', 'الكل')}
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  statusFilter === 'active'
                    ? 'bg-background text-foreground shadow-sm font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('common.active', 'النشط')}
              </button>
              <button
                onClick={() => setStatusFilter('archived')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  statusFilter === 'archived'
                    ? 'bg-background text-foreground shadow-sm font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('customers.archived', 'المؤرشف')}
              </button>
            </div>
          </div>
        </div>

        {/* Customer Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-start">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
                  <th className="px-4 py-3 text-start">{t('customers.customerCode', 'الكود')}</th>
                  <th className="px-4 py-3 text-start">{t('customers.name', 'اسم العميل')}</th>
                  <th className="px-4 py-3 text-start">{t('customers.type', 'التصنيف')}</th>
                  <th className="px-4 py-3 text-start">{t('customers.phone', 'الهاتف والتواصل')}</th>
                  <th className="px-4 py-3 text-start">{t('customers.creditLimit', 'الحد الائتماني')}</th>
                  <th className="px-4 py-3 text-start">{t('customers.balance', 'الرصيد / المديونية')}</th>
                  <th className="px-4 py-3 text-start">{t('common.status', 'الحالة')}</th>
                  <th className="px-4 py-3 text-end">{t('common.actions', 'الإجراءات')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                      {t('common.loading', 'جاري التحميل...')}
                    </td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                      <Users className="w-10 h-10 mx-auto mb-2 opacity-25" />
                      <p className="font-medium">
                        {search || statusFilter !== 'all' || typeFilter !== 'all'
                          ? t('customers.noCustomersFound', 'لم يتم العثور على عملاء يطابقون خيارات البحث')
                          : t('customers.noCustomers', 'لا يوجد عملاء مسجلين حتى الآن')}
                      </p>
                    </td>
                  </tr>
                ) : (
                  customers.map(c => {
                    const typeInfo = TYPE_CONFIG[c.customer_type] || TYPE_CONFIG.individual
                    const isActive = c.is_active === 1 && !c.archived_at
                    return (
                      <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">
                          {c.customer_code}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-foreground">{c.name}</div>
                          {c.address && (
                            <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {c.address}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 text-xs font-medium border rounded-md inline-block ${typeInfo.color}`}
                          >
                            {isArabic ? typeInfo.ar : typeInfo.en}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-0.5">
                            {c.phone && (
                              <div className="flex items-center gap-1.5 text-xs font-mono" dir="ltr">
                                <Phone className="w-3 h-3 text-muted-foreground" />
                                <span>{c.phone}</span>
                              </div>
                            )}
                            {c.whatsapp && (
                              <a
                                href={`https://wa.me/${c.whatsapp.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-[11px] text-emerald-500 hover:underline font-mono"
                                dir="ltr"
                              >
                                <span>{c.whatsapp}</span>
                                <ArrowUpRight className="w-2.5 h-2.5" />
                              </a>
                            )}
                            {!c.phone && !c.whatsapp && (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {formatCurrency(c.credit_limit || 0)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs font-bold">
                          <span
                            className={c.balance > 0 ? 'text-amber-500' : 'text-emerald-500'}
                          >
                            {formatCurrency(c.balance)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded-md border inline-flex items-center gap-1 ${
                              isActive
                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                : 'bg-destructive/10 text-destructive border-destructive/20'
                            }`}
                          >
                            {isActive ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" />
                                <span>{t('common.active', 'نشط')}</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3" />
                                <span>{t('customers.archived', 'مؤرشف')}</span>
                              </>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-end">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setDetailsCustomerId(c.id)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              title={t('customers.details', 'عرض التفاصيل')}
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {canEdit && (
                              <button
                                onClick={() => {
                                  setSelectedCustomer(c)
                                  setIsModalOpen(true)
                                }}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                title={t('common.edit', 'تعديل')}
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )}

                            {canDelete && (
                              <button
                                onClick={() => handleToggleStatus(c)}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  isActive
                                    ? 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                                    : 'text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10'
                                }`}
                                title={
                                  isActive
                                    ? t('customers.archive', 'أرشفة')
                                    : t('customers.reactivate', 'إعادة التفعيل')
                                }
                              >
                                {isActive ? (
                                  <Archive className="w-4 h-4" />
                                ) : (
                                  <RotateCcw className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Customer Create/Edit Modal */}
      <CustomerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={loadData}
        customer={selectedCustomer}
      />

      {/* Customer Details Modal */}
      <CustomerDetailsModal
        isOpen={!!detailsCustomerId}
        onClose={() => setDetailsCustomerId(null)}
        customerId={detailsCustomerId}
        onEdit={c => {
          setSelectedCustomer(c)
          setIsModalOpen(true)
        }}
        onStatusChanged={loadData}
      />
    </div>
  )
}

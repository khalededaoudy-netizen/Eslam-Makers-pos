import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  X,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CreditCard,
  ShoppingBag,
  Clock,
  ShieldCheck,
  FileText,
  MessageSquare,
  Edit,
  RotateCcw,
  Archive,
} from 'lucide-react'
import { customerService, Customer, CustomerType } from '@/services/customers'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { useAuthStore, usePermission } from '@/stores/authStore'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

interface CustomerDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  customerId: string | null
  onEdit?: (customer: Customer) => void
  onStatusChanged?: () => void
}

const TYPE_LABELS: Record<CustomerType, { ar: string; en: string }> = {
  individual: { ar: 'فرد / عميل عادي', en: 'Individual' },
  student: { ar: 'طالب / مشروع تخرج', en: 'Student' },
  company: { ar: 'شركة / ورشة عمل', en: 'Company / Workshop' },
  lab: { ar: 'معمل أبحاث / جامعة', en: 'Research Lab / University' },
  vip: { ar: 'عميل مميز (VIP)', en: 'VIP' },
}

export function CustomerDetailsModal({
  isOpen,
  onClose,
  customerId,
  onEdit,
  onStatusChanged,
}: CustomerDetailsModalProps) {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language !== 'en'
  const { user } = useAuthStore()
  const { can, isAdmin } = usePermission()

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  const canEdit = isAdmin || can('update', 'customers')
  const canDelete = isAdmin || can('delete', 'customers')

  const loadCustomer = async () => {
    if (!customerId) return
    setLoading(true)
    try {
      const data = await customerService.getCustomerById(customerId)
      setCustomer(data)
    } catch (err) {
      console.error('Failed to load customer details:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && customerId) {
      loadCustomer()
    }
  }, [isOpen, customerId])

  if (!isOpen || !customerId) return null

  const executeToggleArchive = async () => {
    if (!customer) return
    const isCurrentlyArchived = customer.is_active === 0 || !!customer.archived_at
    setActionLoading(true)
    try {
      if (isCurrentlyArchived) {
        await customerService.reactivateCustomer(customer.id, user || undefined)
      } else {
        await customerService.archiveCustomer(customer.id, user || undefined)
      }
      setIsConfirmOpen(false)
      await loadCustomer()
      onStatusChanged?.()
    } catch (err: any) {
      alert(err.message || 'Error updating status')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">
                  {customer?.name || t('customers.details', 'ملف العميل')}
                </h2>
                {customer?.customer_code && (
                  <span className="px-2 py-0.5 text-xs font-mono bg-primary/10 text-primary border border-primary/20 rounded-md">
                    {customer.customer_code}
                  </span>
                )}
                {customer && (
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-md ${
                      customer.is_active === 1 && !customer.archived_at
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                        : 'bg-destructive/10 text-destructive border border-destructive/20'
                    }`}
                  >
                    {customer.is_active === 1 && !customer.archived_at
                      ? t('common.active', 'نشط')
                      : t('customers.archived', 'مؤرشف')}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {customer?.customer_type
                  ? isArabic
                    ? TYPE_LABELS[customer.customer_type]?.ar
                    : TYPE_LABELS[customer.customer_type]?.en
                  : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {customer && canEdit && onEdit && (
              <button
                onClick={() => {
                  onClose()
                  onEdit(customer)
                }}
                className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors flex items-center gap-1.5"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>{t('common.edit', 'تعديل')}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        {loading || !customer ? (
          <div className="p-12 text-center text-muted-foreground text-sm">
            {t('common.loading', 'جاري التحميل...')}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-1">
                <span className="text-xs text-muted-foreground">
                  {t('customers.balance', 'الرصيد / المديونية')}
                </span>
                <div
                  className={`text-xl font-bold font-mono ${
                    customer.balance > 0 ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {formatCurrency(customer.balance)}
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {customer.balance > 0
                    ? t('customers.hasReceivables', 'مستحق على العميل')
                    : t('customers.balanceClear', 'الحساب خالص / لا توجد مديونية')}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-1">
                <span className="text-xs text-muted-foreground">
                  {t('customers.creditLimit', 'الحد الائتماني المسموح')}
                </span>
                <div className="text-xl font-bold font-mono text-foreground">
                  {formatCurrency(customer.credit_limit || 0)}
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {customer.credit_limit > 0
                    ? t('customers.creditLimitActive', 'مفعل للمبيعات الآجلة')
                    : t('customers.noCreditLimit', 'بيع نقدي فقط')}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-1">
                <span className="text-xs text-muted-foreground">
                  {t('customers.type', 'نوع العميل والتصنيف')}
                </span>
                <div className="text-base font-bold text-foreground pt-1">
                  {isArabic
                    ? TYPE_LABELS[customer.customer_type]?.ar || customer.customer_type
                    : TYPE_LABELS[customer.customer_type]?.en || customer.customer_type}
                </div>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                  <span>{customer.customer_code}</span>
                </span>
              </div>
            </div>

            {/* Contact Details Grid */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">
                {t('customers.contactInformation', 'بيانات الاتصال والتواصل')}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs text-muted-foreground block">
                      {t('customers.phone', 'رقم الهاتف الأساسي')}
                    </span>
                    <span className="font-mono" dir="ltr">
                      {customer.phone || '—'}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs text-muted-foreground block">
                      {t('customers.phone2', 'هاتف إضافي')}
                    </span>
                    <span className="font-mono" dir="ltr">
                      {customer.phone2 || '—'}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MessageSquare className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs text-muted-foreground block">
                      {t('customers.whatsapp', 'واتساب')}
                    </span>
                    {customer.whatsapp ? (
                      <a
                        href={`https://wa.me/${customer.whatsapp.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-emerald-500 hover:underline"
                        dir="ltr"
                      >
                        {customer.whatsapp} ↗
                      </a>
                    ) : (
                      '—'
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs text-muted-foreground block">
                      {t('customers.email', 'البريد الإلكتروني')}
                    </span>
                    <span dir="ltr">{customer.email || '—'}</span>
                  </div>
                </div>

                <div className="sm:col-span-2 flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs text-muted-foreground block">
                      {t('customers.address', 'العنوان')}
                    </span>
                    <span>{customer.address || '—'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes Section */}
            {customer.notes && (
              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  <span>{t('common.notes', 'ملاحظات')}</span>
                </div>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {customer.notes}
                </p>
              </div>
            )}

            {/* Sales & POS Activity Preview (Prepared for POS Phase 08) */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">
                    {t('customers.purchaseHistory', 'سجل المبيعات والمعاملات')}
                  </h3>
                </div>
                <span className="text-xs text-muted-foreground">
                  {t('customers.posReady', 'جاهز للربط مع نقطة البيع POS')}
                </span>
              </div>

              <div className="p-6 text-center text-muted-foreground text-xs space-y-1">
                <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-25" />
                <p>{t('customers.noSalesYet', 'لا توجد فواتير مبيعات مسجلة لهذا العميل حتى الآن.')}</p>
                <p className="text-[11px] opacity-75">
                  {t(
                    'customers.posPhaseNotice',
                    'سيتم تسجيل وتحديث الفواتير تلقائياً فور إجراء المبيعات من شاشة الكاشير.'
                  )}
                </p>
              </div>
            </div>

            {/* Timestamps & Archive Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-border text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {t('customers.created', 'تاريخ الإضافة')}: {formatDate(customer.created_at)}
                </span>
                {customer.archived_at && (
                  <span className="text-destructive flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {t('customers.archivedAt', 'مؤرشف في')}: {formatDate(customer.archived_at)}
                  </span>
                )}
              </div>

              {canDelete && (
                <button
                  onClick={() => setIsConfirmOpen(true)}
                  disabled={actionLoading}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    customer.is_active === 1 && !customer.archived_at
                      ? 'text-destructive hover:bg-destructive/10 border border-destructive/20'
                      : 'text-emerald-500 hover:bg-emerald-500/10 border border-emerald-500/20'
                  }`}
                >
                  {customer.is_active === 1 && !customer.archived_at ? (
                    <>
                      <Archive className="w-3.5 h-3.5" />
                      <span>{t('customers.archive', 'أرشفة العميل')}</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{t('customers.reactivate', 'إعادة التفعيل')}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Unified Confirm Dialog */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={executeToggleArchive}
        variant={customer?.is_active === 1 && !customer?.archived_at ? 'danger' : 'info'}
        title={
          customer?.is_active === 1 && !customer?.archived_at
            ? t('customers.confirmArchiveTitle', 'تأكيد أرشفة العميل')
            : t('customers.confirmReactivateTitle', 'تأكيد إعادة تفعيل العميل')
        }
        description={
          customer?.is_active === 1 && !customer?.archived_at
            ? t('customers.confirmArchive', 'هل تريد بالتأكيد أرشفة هذا العميل؟ لن يظهر في القوائم النشطة ونقطة البيع.')
            : t('customers.confirmReactivate', 'هل تريد بالتأكيد إعادة تفعيل هذا العميل؟')
        }
        itemName={customer?.name}
        confirmText={
          customer?.is_active === 1 && !customer?.archived_at
            ? t('customers.archive', 'أرشفة')
            : t('customers.reactivate', 'إعادة تفعيل')
        }
        warningMessage={
          customer?.is_active === 1 && !customer?.archived_at
            ? undefined
            : null as any
        }
      />
    </div>
  )
}

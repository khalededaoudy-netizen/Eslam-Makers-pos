import React, { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  X,
  FolderOpen,
  Play,
  Trash2,
  Clock,
  User,
  ShoppingBag,
  Search,
  Phone,
  FileText,
  UserCheck,
  Printer,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { HeldCart } from '../types'
import { formatCurrency, formatDate, formatRelativeTime } from '@/lib/formatters'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

interface HeldCartsModalProps {
  isOpen: boolean
  onClose: () => void
  heldCarts: HeldCart[]
  onResumeCart: (heldCart: HeldCart) => void
  onDeleteCart: (heldCartId: string) => void
  onEditCustomer?: (heldCart: HeldCart) => void
  onPrintPreview?: (heldCart: HeldCart) => void
}

type TimeFilter = 'all' | 'today' | 'week'

export function HeldCartsModal({
  isOpen,
  onClose,
  heldCarts,
  onResumeCart,
  onDeleteCart,
  onEditCustomer,
  onPrintPreview,
}: HeldCartsModalProps) {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language !== 'en'

  const [searchQuery, setSearchQuery] = useState('')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all')
  const [deleteCartId, setDeleteCartId] = useState<string | null>(null)
  const [expandedCartId, setExpandedCartId] = useState<string | null>(null)

  // Filter calculations
  const filteredCarts = useMemo(() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000

    return heldCarts.filter(cart => {
      // 1. Time Filter
      const cartTime = new Date(cart.held_at).getTime()
      if (timeFilter === 'today' && cartTime < todayStart) return false
      if (timeFilter === 'week' && cartTime < weekStart) return false

      // 2. Search Query
      if (!searchQuery.trim()) return true
      const q = searchQuery.trim().toLowerCase()

      const matchName = cart.customer_name?.toLowerCase().includes(q)
      const matchPhone = cart.customer_phone?.toLowerCase().includes(q)
      const matchCashier = cart.cashier_name?.toLowerCase().includes(q)
      const matchNotes = cart.notes?.toLowerCase().includes(q)

      // Search in items
      const matchItems = cart.items?.some(it =>
        it.productName?.toLowerCase().includes(q) ||
        it.productNameAr?.toLowerCase().includes(q) ||
        it.sku?.toLowerCase().includes(q)
      )

      return matchName || matchPhone || matchCashier || matchNotes || matchItems
    })
  }, [heldCarts, searchQuery, timeFilter])

  // Counts for tabs
  const counts = useMemo(() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000

    let todayCount = 0
    let weekCount = 0

    heldCarts.forEach(c => {
      const time = new Date(c.held_at).getTime()
      if (time >= todayStart) todayCount++
      if (time >= weekStart) weekCount++
    })

    return {
      all: heldCarts.length,
      today: todayCount,
      week: weekCount,
    }
  }, [heldCarts])

  if (!isOpen) return null

  const handleDelete = () => {
    if (deleteCartId) {
      onDeleteCart(deleteCartId)
      setDeleteCartId(null)
    }
  }

  const activeDeleteCart = heldCarts.find(c => c.id === deleteCartId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 animate-fade-in">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground">
                  {t('pos.heldCarts', 'الفواتير المعلقة المحفوظة')}
                </h3>
                <span className="text-xs font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
                  {heldCarts.length}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('pos.heldCartsSubtitle', 'استرجاع الفواتير المؤجلة مع التحقق التلقائي من المخزون وتعديل العميل')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Search & Time Filters */}
        <div className="p-3 sm:px-6 sm:py-3.5 border-b border-border bg-card/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute start-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('pos.searchHeldCarts', 'بحث بالعميل، الهاتف، الأصناف، أو الكاشير...')}
              className="w-full h-9 ps-9 pe-8 text-xs rounded-xl bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute end-2.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Time Filter Tabs */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setTimeFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                timeFilter === 'all'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{t('common.all', 'الكل')}</span>
              <span className="ms-1 text-[11px] opacity-70 font-mono">({counts.all})</span>
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('today')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                timeFilter === 'today'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{t('pos.today', 'اليوم')}</span>
              <span className="ms-1 text-[11px] opacity-70 font-mono">({counts.today})</span>
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('week')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                timeFilter === 'week'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{t('pos.thisWeek', 'هذا الأسبوع')}</span>
              <span className="ms-1 text-[11px] opacity-70 font-mono">({counts.week})</span>
            </button>
          </div>
        </div>

        {/* List of Held Carts */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {heldCarts.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground space-y-2">
              <ShoppingBag className="w-12 h-12 mx-auto opacity-20" />
              <p className="text-sm font-semibold">{t('pos.noHeldCarts', 'لا توجد فواتير معلقة حالياً')}</p>
              <p className="text-xs opacity-75">
                {t('pos.heldCartsHelp', 'يمكنك تعليق أي فاتورة مفتوحة أثناء البيع للرجوع إليها لاحقاً.')}
              </p>
            </div>
          ) : filteredCarts.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground space-y-2">
              <Search className="w-10 h-10 mx-auto opacity-25" />
              <p className="text-sm font-semibold">{t('pos.noMatchingHeldCarts', 'لا توجد فواتير معلقة مطابقة لبحثك')}</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setTimeFilter('all')
                }}
                className="text-xs text-primary hover:underline cursor-pointer"
              >
                {t('common.resetFilters', 'إعادة ضبط الفلاتر')}
              </button>
            </div>
          ) : (
            filteredCarts.map(cart => {
              const isExpanded = expandedCartId === cart.id
              const hasCustomer = !!cart.customer_name || !!cart.customer_phone
              const itemsList = cart.items || []

              return (
                <div
                  key={cart.id}
                  className="bg-card border border-border rounded-xl p-4 transition-all hover:border-primary/40 hover:shadow-sm space-y-3"
                >
                  {/* Card Header: Customer & Total */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    {/* Customer Info */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {hasCustomer ? (
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <User className="w-4 h-4" />
                          </span>
                          <div>
                            <div className="text-sm font-bold text-foreground">
                              {cart.customer_name || t('pos.unnamedCustomer', 'عميل غير مسمى')}
                            </div>
                            {cart.customer_phone && (
                              <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-1" dir="ltr">
                                <Phone className="w-3 h-3 text-muted-foreground" />
                                <span>{cart.customer_phone}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-lg">
                          <User className="w-3.5 h-3.5 opacity-60" />
                          <span>{t('pos.anonymousCustomer', 'عميل نقدي (غير محدد)')}</span>
                        </div>
                      )}
                    </div>

                    {/* Total & Item Count */}
                    <div className="flex items-center gap-2.5 self-start sm:self-auto">
                      <span className="text-xs bg-muted px-2.5 py-1 rounded-lg text-muted-foreground font-semibold flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5" />
                        <span>{itemsList.length} صنف</span>
                      </span>
                      <span className="font-mono font-bold text-base text-primary">
                        {formatCurrency(cart.total)}
                      </span>
                    </div>
                  </div>

                  {/* Metadata Row: Relative Time + Cashier + Notes */}
                  <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span
                        className="flex items-center gap-1.5 font-medium text-foreground/80"
                        title={formatDate(cart.held_at, true)}
                      >
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        <span>{formatRelativeTime(cart.held_at, isArabic)}</span>
                        <span className="text-[11px] text-muted-foreground/60 font-normal">
                          ({formatDate(cart.held_at, true)})
                        </span>
                      </span>

                      {cart.cashier_name && (
                        <span className="bg-muted/40 px-2 py-0.5 rounded text-[11px]">
                          كاشير: <span className="font-semibold text-foreground/80">{cart.cashier_name}</span>
                        </span>
                      )}
                    </div>

                    {/* Expand/Collapse Items Toggle */}
                    {itemsList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setExpandedCartId(isExpanded ? null : cart.id)}
                        className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <span>{isExpanded ? t('common.hideItems', 'إخفاء الأصناف') : t('common.showItems', 'عرض الأصناف')}</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}
                  </div>

                  {/* Notes Callout if present */}
                  {cart.notes && (
                    <div className="bg-muted/40 border border-border/80 rounded-lg p-2.5 text-xs text-foreground/90 flex items-start gap-2">
                      <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-muted-foreground">{t('pos.notes', 'ملاحظات')}: </span>
                        <span>{cart.notes}</span>
                      </div>
                    </div>
                  )}

                  {/* Expanded Items Preview */}
                  {isExpanded && itemsList.length > 0 && (
                    <div className="bg-muted/20 border border-border rounded-lg p-3 space-y-1.5 animate-fade-in">
                      <div className="text-[11px] font-bold text-muted-foreground mb-1">
                        {t('pos.itemsInCart', 'قائمة الأصناف المعلقة')}:
                      </div>
                      <div className="divide-y divide-border/40 text-xs">
                        {itemsList.map((item, idx) => (
                          <div key={item.id || idx} className="py-1.5 flex items-center justify-between">
                            <div className="truncate pe-2">
                              <span className="font-semibold text-foreground">
                                {item.productNameAr || item.productName}
                              </span>
                              {item.sku && (
                                <span className="text-[11px] text-muted-foreground font-mono ms-1.5">
                                  ({item.sku})
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 font-mono shrink-0">
                              <span className="text-muted-foreground">
                                {item.quantity} × {formatCurrency(item.unitPrice)}
                              </span>
                              <span className="font-bold text-foreground">
                                {formatCurrency(item.subtotal)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Card Actions Bar */}
                  <div className="pt-2 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Edit Customer Button */}
                      {onEditCustomer && (
                        <button
                          type="button"
                          onClick={() => onEditCustomer(cart)}
                          className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                          title={t('pos.editCustomer', 'تعديل بيانات العميل والملاحظات')}
                        >
                          <UserCheck className="w-3.5 h-3.5 text-primary" />
                          <span>{t('pos.editCustomer', 'تعديل العميل')}</span>
                        </button>
                      )}

                      {/* Print Preview Button */}
                      {onPrintPreview && (
                        <button
                          type="button"
                          onClick={() => onPrintPreview(cart)}
                          className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                          title={t('pos.printPreview', 'معاينة وطباعة مسودة الفاتورة')}
                        >
                          <Printer className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>{t('common.print', 'طباعة')}</span>
                        </button>
                      )}

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => setDeleteCartId(cart.id)}
                        className="px-2.5 py-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer text-xs flex items-center gap-1"
                        title={t('common.delete', 'حذف الفاتورة')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{t('common.delete', 'حذف')}</span>
                      </button>
                    </div>

                    {/* Resume Cart (Primary Action) */}
                    <button
                      type="button"
                      onClick={() => onResumeCart(cart)}
                      className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>{t('pos.resume', 'استئناف الفاتورة')}</span>
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Unified Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteCartId}
        onClose={() => setDeleteCartId(null)}
        onConfirm={handleDelete}
        title={t('pos.confirmDeleteHeldTitle', 'تأكيد حذف الفاتورة المعلقة')}
        description={t('pos.confirmDeleteHeld', 'هل تريد بالتأكيد حذف هذه الفاتورة المعلقة؟')}
        itemName={activeDeleteCart?.customer_name ? `فاتورة عميل: ${activeDeleteCart.customer_name}` : undefined}
        itemCount={activeDeleteCart?.items?.length}
        confirmText={t('common.delete', 'حذف')}
      />
    </div>
  )
}

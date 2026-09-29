/**
 * MAKERS POS — Expenses Page
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  TrendingDown,
  Plus,
  Tag,
  Search,
  Filter,
  DollarSign,
  CreditCard,
  Calendar,
  Eye,
  Printer,
  RotateCcw,
  Loader2,
  AlertCircle,
  RefreshCw,
  Building2,
  User,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { expenseService } from './expenseService'
import { Expense, ExpenseCategory, ExpenseSummary, ExpenseFilter } from './types'
import { PaymentMethodType } from '@/features/payments/types'
import { ExpenseModal } from './components/ExpenseModal'
import { ExpenseCategoryModal } from './components/ExpenseCategoryModal'
import { ExpenseDetailsModal } from './components/ExpenseDetailsModal'
import { ExpenseVoucherModal } from './components/ExpenseVoucherModal'
import { cashRegisterService } from '@/features/cash-register/cashRegisterService'
import { Shift } from '@/features/cash-register/types'

export function ExpensesPage() {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'ar'
  const user = useAuthStore(s => s.user)
  const currencySymbol = useSettingsStore(s => s.currencySymbol) || 'EGP'

  // State
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [activeShift, setActiveShift] = useState<Shift | null>(null)
  const [summary, setSummary] = useState<ExpenseSummary>({
    totalExpenses: 0,
    cashExpenses: 0,
    nonCashExpenses: 0,
    todayExpenses: 0,
    currentShiftExpenses: 0,
    expenseCount: 0,
  })
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType | 'all'>('all')
  const [selectedStatus, setSelectedStatus] = useState<'completed' | 'cancelled' | 'all'>('all')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20

  // Modals state
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false)
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [selectedExpenseForDetails, setSelectedExpenseForDetails] = useState<Expense | null>(null)
  const [voucherExpenseId, setVoucherExpenseId] = useState<string | null>(null)

  const formatCurrency = (val: number) => {
    return `${val.toLocaleString(isRtl ? 'ar-EG' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${currencySymbol}`
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      let shiftId: string | undefined = undefined
      if (user) {
        const shift = await cashRegisterService.getActiveShift(user.id)
        setActiveShift(shift)
        shiftId = shift?.id
      }

      const [cats, sum] = await Promise.all([
        expenseService.getExpenseCategories(false),
        expenseService.getExpenseSummary(shiftId),
      ])
      setCategories(cats)
      setSummary(sum)

      const filter: ExpenseFilter = {
        search: searchTerm.trim() || undefined,
        categoryId: selectedCategory || undefined,
        paymentMethod: selectedMethod,
        status: selectedStatus,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(`${endDate}T23:59:59.999Z`).toISOString() : undefined,
        page: currentPage,
        limit: pageSize,
      }

      const res = await expenseService.getExpenses(filter)
      setExpenses(res.expenses)
      setTotalCount(res.total)
    } catch (err: any) {
      console.error('Failed to load expenses data:', err)
      setErrorMessage(err?.message || 'Failed to load expenses')
    } finally {
      setLoading(false)
    }
  }, [user, searchTerm, selectedCategory, selectedMethod, selectedStatus, startDate, endDate, currentPage])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleOpenCreate = () => {
    setExpenseToEdit(null)
    setIsExpenseModalOpen(true)
  }

  const handleOpenEdit = (exp: Expense) => {
    setExpenseToEdit(exp)
    setSelectedExpenseForDetails(null)
    setIsExpenseModalOpen(true)
  }

  const handleExpenseSaved = () => {
    loadData()
  }

  const handleExpenseCancelled = (updated: Expense) => {
    setSelectedExpenseForDetails(updated)
    loadData()
  }

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'cash':
        return isRtl ? 'نقداً' : 'Cash'
      case 'card':
        return isRtl ? 'بطاقة بنكية' : 'Card'
      case 'instapay':
        return isRtl ? 'إنستاباي' : 'InstaPay'
      case 'vodafone_cash':
        return isRtl ? 'فودافون كاش' : 'Vodafone Cash'
      case 'bank_transfer':
        return isRtl ? 'تحويل بنكي' : 'Bank Transfer'
      default:
        return method
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize) || 1

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background text-foreground">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/40">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-500/10 text-rose-500 rounded-xl">
              <TrendingDown className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {t('expenses.title')}
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{t('expenses.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsCategoryModalOpen(true)}
            className="px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-xs font-semibold hover:bg-muted/80 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Tag className="w-4 h-4 text-primary" />
            <span>{t('expenses.manageCategories')}</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-md hover:bg-primary/90 transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>{t('expenses.addExpense')}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {errorMessage && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-2xl text-xs flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Top KPI Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="p-4 rounded-2xl border border-border bg-card shadow-sm space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">{t('expenses.totalExpenses')}</span>
              <DollarSign className="w-4 h-4 text-primary" />
            </div>
            <p className="text-xl font-black text-foreground">
              {formatCurrency(summary.totalExpenses)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {summary.expenseCount} {isRtl ? 'مصروف مسجل' : 'records'}
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-border bg-card shadow-sm space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">{t('expenses.cashExpenses')}</span>
              <DollarSign className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-xl font-black text-amber-600 dark:text-amber-400">
              {formatCurrency(summary.cashExpenses)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {isRtl ? 'مخصومة من الخزينة' : 'Deducted from drawer'}
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-border bg-card shadow-sm space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">{t('expenses.nonCashExpenses')}</span>
              <CreditCard className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-xl font-black text-blue-600 dark:text-blue-400">
              {formatCurrency(summary.nonCashExpenses)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {isRtl ? 'بطاقات / إلكتروني' : 'Card / Digital'}
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-border bg-card shadow-sm space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">{t('expenses.todayExpenses')}</span>
              <Calendar className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
              {formatCurrency(summary.todayExpenses)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {isRtl ? 'إجمالي اليوم' : "Today's Total"}
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-border bg-card shadow-sm space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">{t('expenses.currentShiftExpenses')}</span>
              <TrendingDown className="w-4 h-4 text-rose-500" />
            </div>
            <p className="text-xl font-black text-rose-600 dark:text-rose-400">
              {formatCurrency(summary.currentShiftExpenses)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {activeShift ? (isRtl ? 'الوردية الحالية' : 'Active Shift') : (isRtl ? 'لا توجد وردية' : 'No active shift')}
            </p>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 rounded-2xl border border-border bg-card shadow-sm space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Search */}
            <div className="lg:col-span-2 relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1)
                }}
                placeholder={t('expenses.searchPlaceholder')}
                className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {/* Category Filter */}
            <div>
              <select
                value={selectedCategory}
                onChange={e => {
                  setSelectedCategory(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">{t('expenses.allCategories')}</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {isRtl ? cat.nameAr : cat.nameEn || cat.nameAr}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Method Filter */}
            <div>
              <select
                value={selectedMethod}
                onChange={e => {
                  setSelectedMethod(e.target.value as any)
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="all">{t('expenses.allMethods')}</option>
                <option value="cash">{isRtl ? 'نقداً (الخزينة)' : 'Cash'}</option>
                <option value="card">{isRtl ? 'بطاقة بنكية' : 'Card'}</option>
                <option value="instapay">InstaPay</option>
                <option value="vodafone_cash">Vodafone Cash</option>
                <option value="bank_transfer">{isRtl ? 'تحويل بنكي' : 'Bank Transfer'}</option>
                <option value="other">{isRtl ? 'أخرى' : 'Other'}</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={selectedStatus}
                onChange={e => {
                  setSelectedStatus(e.target.value as any)
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="all">{t('expenses.allStatuses')}</option>
                <option value="completed">{t('expenses.statusCompleted')}</option>
                <option value="cancelled">{t('expenses.statusCancelled')}</option>
              </select>
            </div>

            {/* Date Range Start */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={e => {
                  setStartDate(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <button
                type="button"
                onClick={loadData}
                className="p-2 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                title={t('common.refresh')}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Expenses Table */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold">
                  <th className="px-4 py-3 text-right">{t('expenses.expenseNumber')}</th>
                  <th className="px-4 py-3 text-right">{t('expenses.date')}</th>
                  <th className="px-4 py-3 text-right">{t('expenses.category')}</th>
                  <th className="px-4 py-3 text-right">{t('expenses.description')}</th>
                  <th className="px-4 py-3 text-right">{t('expenses.supplier')}</th>
                  <th className="px-4 py-3 text-right">{t('expenses.paymentMethod')}</th>
                  <th className="px-4 py-3 text-right">{t('expenses.amount')}</th>
                  <th className="px-4 py-3 text-right">{t('expenses.status')}</th>
                  <th className="px-4 py-3 text-center">{t('expenses.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        <span>{t('common.loading')}...</span>
                      </div>
                    </td>
                  </tr>
                ) : expenses.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <TrendingDown className="w-8 h-8 opacity-20" />
                        <p>{t('expenses.noExpensesFound')}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  expenses.map(exp => (
                    <tr
                      key={exp.id}
                      className="hover:bg-muted/30 transition-colors group cursor-pointer"
                      onClick={() => setSelectedExpenseForDetails(exp)}
                    >
                      <td className="px-4 py-3 font-bold text-foreground">
                        {exp.expenseNumber}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {new Date(exp.expenseDate).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        <span className="px-2 py-0.5 rounded-md bg-muted text-[11px]">
                          {isRtl
                            ? exp.categoryNameAr || exp.categoryName || 'عام'
                            : exp.categoryNameEn || exp.categoryName || 'General'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground font-medium max-w-xs truncate">
                        {exp.description}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {exp.supplierName || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            exp.affectsCash
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                              : 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/30'
                          }`}
                        >
                          {getMethodLabel(exp.paymentMethod)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-black text-rose-600 dark:text-rose-400 whitespace-nowrap">
                        {formatCurrency(exp.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            exp.status === 'cancelled'
                              ? 'border-rose-500/30 bg-rose-500/10 text-rose-600'
                              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
                          }`}
                        >
                          {exp.status === 'cancelled'
                            ? t('expenses.statusCancelled')
                            : t('expenses.statusCompleted')}
                        </span>
                      </td>
                      <td
                        className="px-4 py-3 text-center"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedExpenseForDetails(exp)}
                            className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title={t('expenses.viewDetails')}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setVoucherExpenseId(exp.id)}
                            className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            title={t('expenses.printVoucher')}
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-muted/20">
              <div>
                <span>
                  {isRtl ? 'عرض' : 'Showing'} {expenses.length} {isRtl ? 'من أصل' : 'of'}{' '}
                  {totalCount} {isRtl ? 'مصروف' : 'expenses'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="font-semibold text-foreground">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <ExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        onSuccess={handleExpenseSaved}
        onOpenCategories={() => {
          setIsExpenseModalOpen(false)
          setIsCategoryModalOpen(true)
        }}
        expenseToEdit={expenseToEdit}
      />

      <ExpenseCategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onCategoriesChanged={loadData}
      />

      <ExpenseDetailsModal
        expense={selectedExpenseForDetails}
        isOpen={Boolean(selectedExpenseForDetails)}
        onClose={() => setSelectedExpenseForDetails(null)}
        onPrintVoucher={id => {
          setVoucherExpenseId(id)
        }}
        onEditExpense={handleOpenEdit}
        onExpenseCancelled={handleExpenseCancelled}
      />

      <ExpenseVoucherModal
        expenseId={voucherExpenseId}
        isOpen={Boolean(voucherExpenseId)}
        onClose={() => setVoucherExpenseId(null)}
      />
    </div>
  )
}

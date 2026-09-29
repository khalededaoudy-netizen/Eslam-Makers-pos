/**
 * MAKERS POS — Expense Details Modal
 */

import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  X,
  TrendingDown,
  Printer,
  Calendar,
  CreditCard,
  Building2,
  Tag,
  User,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  XCircle,
  FileText,
  DollarSign,
  Loader2,
  Edit2,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { expenseService } from '../expenseService'
import { Expense } from '../types'

interface ExpenseDetailsModalProps {
  expense: Expense | null
  isOpen: boolean
  onClose: () => void
  onPrintVoucher: (expenseId: string) => void
  onEditExpense?: (expense: Expense) => void
  onExpenseCancelled: (updatedExpense: Expense) => void
}

export function ExpenseDetailsModal({
  expense,
  isOpen,
  onClose,
  onPrintVoucher,
  onEditExpense,
  onExpenseCancelled,
}: ExpenseDetailsModalProps) {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'ar'
  const user = useAuthStore(s => s.user)
  const currencySymbol = useSettingsStore(s => s.currencySymbol) || 'EGP'

  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (!isOpen || !expense) return null

  const formatCurrency = (val: number) => {
    return `${val.toLocaleString(isRtl ? 'ar-EG' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${currencySymbol}`
  }

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    if (!cancelReason.trim()) {
      setErrorMessage(t('expenses.errorCancelReasonRequired'))
      return
    }

    setCancelling(true)
    setErrorMessage(null)

    try {
      const updated = await expenseService.cancelExpense(expense.id, cancelReason.trim(), {
        id: user.id,
        fullName: user.fullName || user.username,
        username: user.username,
      })
      setIsCancelConfirmOpen(false)
      onExpenseCancelled(updated)
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to cancel expense')
    } finally {
      setCancelling(false)
    }
  }

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'cash':
        return isRtl ? 'نقداً (الخزينة)' : 'Cash (Drawer)'
      case 'card':
        return isRtl ? 'بطاقة بنكية' : 'Card'
      case 'instapay':
        return isRtl ? 'إنستاباي (InstaPay)' : 'InstaPay'
      case 'vodafone_cash':
        return isRtl ? 'فودافون كاش' : 'Vodafone Cash'
      case 'bank_transfer':
        return isRtl ? 'تحويل بنكي' : 'Bank Transfer'
      default:
        return method
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                expense.status === 'cancelled'
                  ? 'bg-rose-500/10 text-rose-500'
                  : 'bg-emerald-500/10 text-emerald-500'
              }`}
            >
              <TrendingDown className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-foreground">{expense.expenseNumber}</h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                    expense.status === 'cancelled'
                      ? 'border-rose-500/30 bg-rose-500/10 text-rose-600'
                      : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
                  }`}
                >
                  {expense.status === 'cancelled'
                    ? t('expenses.statusCancelled')
                    : t('expenses.statusCompleted')}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(expense.expenseDate).toLocaleString(isRtl ? 'ar-EG' : 'en-US')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Cancellation Form if toggled */}
          {isCancelConfirmOpen ? (
            <form
              onSubmit={handleCancelSubmit}
              className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 space-y-3"
            >
              <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
                <RotateCcw className="w-4 h-4" />
                <span>{t('expenses.cancelExpense')}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t('expenses.cancelConfirm')}</p>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  {t('expenses.cancelReason')} *
                </label>
                <textarea
                  rows={2}
                  required
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  placeholder={t('expenses.cancelReasonPlaceholder')}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/40 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCancelConfirmOpen(false)}
                  disabled={cancelling}
                  className="px-4 py-1.5 rounded-xl border border-border text-xs font-medium hover:bg-muted/80"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={cancelling}
                  className="px-4 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold shadow-sm hover:bg-rose-700 flex items-center gap-1.5"
                >
                  {cancelling && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{t('expenses.cancelExpense')}</span>
                </button>
              </div>
            </form>
          ) : null}

          {/* Amount Card */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-rose-500/10 to-amber-500/10 border border-rose-500/20 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-semibold">{t('expenses.amount')}</p>
              <p className="text-2xl font-black text-rose-600 dark:text-rose-400">
                {formatCurrency(expense.amount)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground font-semibold">
                {t('expenses.paymentMethod')}
              </p>
              <p className="text-sm font-bold text-foreground">
                {getMethodLabel(expense.paymentMethod)}
              </p>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl border border-border bg-background/50 space-y-1">
              <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                <Tag className="w-3.5 h-3.5 text-primary" />
                {t('expenses.category')}
              </span>
              <p className="font-bold text-foreground text-sm">
                {isRtl
                  ? expense.categoryNameAr || expense.categoryName || 'عام'
                  : expense.categoryNameEn || expense.categoryName || 'General'}
              </p>
            </div>

            <div className="p-3 rounded-xl border border-border bg-background/50 space-y-1">
              <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                <FileText className="w-3.5 h-3.5 text-primary" />
                {t('expenses.description')}
              </span>
              <p className="font-bold text-foreground text-sm">{expense.description}</p>
            </div>

            {expense.supplierName && (
              <div className="p-3 rounded-xl border border-border bg-background/50 space-y-1">
                <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                  <Building2 className="w-3.5 h-3.5 text-primary" />
                  {t('expenses.supplier')}
                </span>
                <p className="font-bold text-foreground text-sm">{expense.supplierName}</p>
              </div>
            )}

            {expense.reference && (
              <div className="p-3 rounded-xl border border-border bg-background/50 space-y-1">
                <span className="text-muted-foreground font-medium">{t('expenses.reference')}</span>
                <p className="font-bold text-foreground text-sm">{expense.reference}</p>
              </div>
            )}

            <div className="p-3 rounded-xl border border-border bg-background/50 space-y-1">
              <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                <User className="w-3.5 h-3.5 text-primary" />
                {t('expenses.recordedBy')}
              </span>
              <p className="font-bold text-foreground text-sm">{expense.userName || 'Admin'}</p>
            </div>

            {expense.registerName && (
              <div className="p-3 rounded-xl border border-border bg-background/50 space-y-1">
                <span className="text-muted-foreground font-medium">{t('expenses.register')}</span>
                <p className="font-bold text-foreground text-sm">{expense.registerName}</p>
              </div>
            )}
          </div>

          {/* Cash Drawer Impact Indicator */}
          <div
            className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
              expense.affectsCash
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
                : 'bg-muted/40 border-border text-muted-foreground'
            }`}
          >
            {expense.affectsCash ? (
              <DollarSign className="w-4 h-4 text-amber-500 shrink-0" />
            ) : (
              <CreditCard className="w-4 h-4 shrink-0" />
            )}
            <div>
              <p className="font-bold">{t('expenses.cashLedgerImpact')}</p>
              <p className="text-[11px] opacity-90">
                {expense.affectsCash
                  ? expense.status === 'cancelled'
                    ? 'تم خصم المبلغ سابقاً وتم إنشاء حركة استرداد بالكامل عند الإلغاء.'
                    : t('expenses.cashDeducted')
                  : t('expenses.cashNotDeducted')}
              </p>
            </div>
          </div>

          {/* Notes */}
          {expense.notes && (
            <div className="p-3 rounded-xl border border-border bg-muted/20 text-xs">
              <span className="text-muted-foreground font-semibold block mb-1">
                {t('expenses.notes')}
              </span>
              <p className="text-foreground whitespace-pre-wrap">{expense.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPrintVoucher(expense.id)}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:bg-primary/90 flex items-center gap-1.5 transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>{t('expenses.printVoucher')}</span>
            </button>

            {expense.status === 'completed' && onEditExpense && (
              <button
                type="button"
                onClick={() => onEditExpense(expense)}
                className="px-4 py-2 rounded-xl border border-border bg-background text-foreground text-xs font-semibold hover:bg-muted transition-colors flex items-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{t('expenses.editExpense')}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {expense.status === 'completed' && !isCancelConfirmOpen && (
              <button
                type="button"
                onClick={() => setIsCancelConfirmOpen(true)}
                className="px-4 py-2 rounded-xl border border-rose-500/40 text-rose-600 hover:bg-rose-500/10 text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t('expenses.cancelExpense')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-muted text-foreground text-xs font-semibold hover:bg-muted/80 transition-colors"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

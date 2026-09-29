/**
 * MAKERS POS — Create / Edit Expense Modal
 */

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  X,
  TrendingDown,
  DollarSign,
  Tag,
  CreditCard,
  FileText,
  Building2,
  Calendar,
  AlertCircle,
  Plus,
  Loader2,
  Info,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { expenseService } from '../expenseService'
import { Expense, ExpenseCategory, CreateExpenseInput, UpdateExpenseInput } from '../types'
import { PaymentMethodType } from '@/features/payments/types'
import { supplierService, SupplierItem } from '@/services/suppliers/supplierService'
import { cashRegisterService } from '@/features/cash-register/cashRegisterService'
import { Shift } from '@/features/cash-register/types'

interface ExpenseModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (expense: Expense) => void
  onOpenCategories: () => void
  expenseToEdit?: Expense | null
}

const PAYMENT_METHODS: Array<{ id: PaymentMethodType; labelAr: string; labelEn: string; isCash: boolean }> = [
  { id: 'cash', labelAr: 'نقداً (من الخزينة)', labelEn: 'Cash (Drawer)', isCash: true },
  { id: 'card', labelAr: 'بطاقة بنكية', labelEn: 'Credit/Debit Card', isCash: false },
  { id: 'instapay', labelAr: 'إنستاباي (InstaPay)', labelEn: 'InstaPay', isCash: false },
  { id: 'vodafone_cash', labelAr: 'فودافون كاش', labelEn: 'Vodafone Cash', isCash: false },
  { id: 'bank_transfer', labelAr: 'تحويل بنكي', labelEn: 'Bank Transfer', isCash: false },
  { id: 'other', labelAr: 'أخرى', labelEn: 'Other', isCash: false },
]

export function ExpenseModal({
  isOpen,
  onClose,
  onSuccess,
  onOpenCategories,
  expenseToEdit,
}: ExpenseModalProps) {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'ar'
  const user = useAuthStore(s => s.user)
  const currencySymbol = useSettingsStore(s => s.currencySymbol) || 'EGP'

  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([])
  const [activeShift, setActiveShift] = useState<Shift | null>(null)
  const [loadingInitial, setLoadingInitial] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Form fields
  const [amount, setAmount] = useState<string>('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('cash')
  const [description, setDescription] = useState<string>('')
  const [reference, setReference] = useState<string>('')
  const [supplierId, setSupplierId] = useState<string>('')
  const [expenseDate, setExpenseDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  )
  const [notes, setNotes] = useState<string>('')

  const isEditing = Boolean(expenseToEdit)

  useEffect(() => {
    if (!isOpen) return

    setErrorMessage(null)
    setSubmitting(false)

    const loadData = async () => {
      setLoadingInitial(true)
      try {
        const [cats, supps] = await Promise.all([
          expenseService.getExpenseCategories(false),
          supplierService.getSuppliers({ limit: 100 }),
        ])
        setCategories(cats)
        setSuppliers(supps)

        if (user) {
          const shift = await cashRegisterService.getActiveShift(user.id)
          setActiveShift(shift)
        }

        if (expenseToEdit) {
          setAmount(String(expenseToEdit.amount))
          setCategoryId(expenseToEdit.categoryId || '')
          setPaymentMethod(expenseToEdit.paymentMethod)
          setDescription(expenseToEdit.description)
          setReference(expenseToEdit.reference || '')
          setSupplierId(expenseToEdit.supplierId || '')
          setExpenseDate(
            expenseToEdit.expenseDate
              ? expenseToEdit.expenseDate.slice(0, 10)
              : new Date().toISOString().slice(0, 10)
          )
          setNotes(expenseToEdit.notes || '')
        } else {
          setAmount('')
          setCategoryId(cats.length > 0 ? cats[0].id : '')
          setPaymentMethod('cash')
          setDescription('')
          setReference('')
          setSupplierId('')
          setExpenseDate(new Date().toISOString().slice(0, 10))
          setNotes('')
        }
      } catch (err: any) {
        console.error('Failed to load initial expense modal data:', err)
        setErrorMessage(err?.message || 'Error loading data')
      } finally {
        setLoadingInitial(false)
      }
    }

    loadData()
  }, [isOpen, expenseToEdit, user])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMessage(t('expenses.errorAmountInvalid'))
      return
    }

    if (!description.trim()) {
      setErrorMessage(t('expenses.errorDescriptionRequired'))
      return
    }

    if (paymentMethod === 'cash' && !activeShift && !isEditing) {
      setErrorMessage(t('expenses.errorShiftRequiredForCash'))
      return
    }

    setSubmitting(true)
    setErrorMessage(null)

    try {
      if (isEditing && expenseToEdit) {
        const updateInput: UpdateExpenseInput = {
          description: description.trim(),
          categoryId: categoryId || undefined,
          supplierId: supplierId || undefined,
          reference: reference.trim() || undefined,
          notes: notes.trim() || undefined,
        }
        const updated = await expenseService.updateExpense(
          expenseToEdit.id,
          updateInput,
          {
            id: user.id,
            fullName: user.fullName || user.username,
            username: user.username,
          }
        )
        onSuccess(updated)
      } else {
        const createInput: CreateExpenseInput = {
          amount: numAmount,
          description: description.trim(),
          paymentMethod,
          categoryId: categoryId || undefined,
          supplierId: supplierId || undefined,
          reference: reference.trim() || undefined,
          notes: notes.trim() || undefined,
          expenseDate: new Date(expenseDate).toISOString(),
          shiftId: activeShift?.id,
          registerId: activeShift?.register_id,
        }
        const created = await expenseService.createExpense(createInput, {
          id: user.id,
          fullName: user.fullName || user.username,
          username: user.username,
        })
        onSuccess(created)
      }
      onClose()
    } catch (err: any) {
      console.error('Expense submit error:', err)
      setErrorMessage(err?.message || 'Failed to save expense')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/10 text-rose-500 rounded-xl">
              <TrendingDown className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {isEditing ? t('expenses.editExpense') : t('expenses.addExpense')}
              </h2>
              <p className="text-xs text-muted-foreground">{t('expenses.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content / Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {errorMessage && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-xl text-sm flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Amount & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                {t('expenses.amount')} ({currencySymbol}) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  disabled={isEditing}
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-xl text-foreground font-bold text-lg focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all disabled:opacity-60 disabled:bg-muted/40"
                />
                <DollarSign className="w-4 h-4 text-muted-foreground absolute left-3 top-3.5" />
              </div>
              {isEditing && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  * {t('expenses.cashLedgerImpact')}: المبلغ المالي ثابت بعد الحفظ
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                {t('expenses.date')} *
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  disabled={isEditing}
                  value={expenseDate}
                  onChange={e => setExpenseDate(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all disabled:opacity-60"
                />
                <Calendar className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
              </div>
            </div>
          </div>

          {/* Category */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                {t('expenses.category')}
              </label>
              <button
                type="button"
                onClick={onOpenCategories}
                className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('expenses.manageCategories')}</span>
              </button>
            </div>
            <div className="relative">
              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all appearance-none"
              >
                <option value="">{isRtl ? '-- اختر الفئة --' : '-- Select Category --'}</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {isRtl ? cat.nameAr : cat.nameEn || cat.nameAr}
                  </option>
                ))}
              </select>
              <Tag className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              {t('expenses.description')} *
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={isRtl ? 'مثال: فاتورة الكهرباء لشهر سبتمبر' : 'e.g. Electricity bill for September'}
                className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
              />
              <FileText className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              {t('expenses.paymentMethod')} *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PAYMENT_METHODS.map(method => (
                <button
                  key={method.id}
                  type="button"
                  disabled={isEditing}
                  onClick={() => setPaymentMethod(method.id)}
                  className={`p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center justify-center gap-1 transition-all ${
                    paymentMethod === method.id
                      ? 'border-primary bg-primary/10 text-primary shadow-sm'
                      : 'border-border bg-background hover:bg-muted/50 text-foreground'
                  } ${isEditing ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>{isRtl ? method.labelAr : method.labelEn}</span>
                </button>
              ))}
            </div>

            {/* Cash Drawer Alert */}
            {paymentMethod === 'cash' && (
              <div className="mt-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">{t('expenses.cashLedgerImpact')}</p>
                  <p className="mt-0.5 opacity-90">
                    {activeShift
                      ? t('expenses.cashDeducted')
                      : t('expenses.errorShiftRequiredForCash')}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Supplier Link & Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                {t('expenses.supplier')}
              </label>
              <div className="relative">
                <select
                  value={supplierId}
                  onChange={e => setSupplierId(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all appearance-none"
                >
                  <option value="">{isRtl ? '-- بدون مورد --' : '-- No Supplier --'}</option>
                  {suppliers.map(supp => (
                    <option key={supp.id} value={supp.id}>
                      {supp.name}
                    </option>
                  ))}
                </select>
                <Building2 className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                {t('expenses.reference')}
              </label>
              <input
                type="text"
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder={isRtl ? 'رقم الإيصال أو الفاتورة' : 'Receipt / Invoice #'}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              {t('expenses.notes')}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={isRtl ? 'أي ملاحظات إضافية...' : 'Any extra details...'}
              className="w-full px-4 py-2 bg-background border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all resize-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl border border-border text-foreground font-medium text-sm hover:bg-muted/80 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || loadingInitial}
            className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-md hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{isEditing ? t('common.save') : t('expenses.addExpense')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

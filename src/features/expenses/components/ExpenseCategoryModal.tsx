/**
 * MAKERS POS — Expense Categories Management Modal
 */

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  X,
  Tag,
  Plus,
  Edit2,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Search,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { expenseService } from '../expenseService'
import { ExpenseCategory, CreateExpenseCategoryInput, UpdateExpenseCategoryInput } from '../types'

interface ExpenseCategoryModalProps {
  isOpen: boolean
  onClose: () => void
  onCategoriesChanged: () => void
}

export function ExpenseCategoryModal({
  isOpen,
  onClose,
  onCategoriesChanged,
}: ExpenseCategoryModalProps) {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'ar'
  const user = useAuthStore(s => s.user)

  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Sub-form state (Add or Edit)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null)
  const [nameAr, setNameAr] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadCategories = async () => {
    setLoading(true)
    try {
      const list = await expenseService.getExpenseCategories(true)
      setCategories(list)
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load categories')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null)
      setSuccessMessage(null)
      setIsFormOpen(false)
      setEditingCategory(null)
      loadCategories()
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleOpenAdd = () => {
    setEditingCategory(null)
    setNameAr('')
    setNameEn('')
    setIsFormOpen(true)
    setErrorMessage(null)
  }

  const handleOpenEdit = (cat: ExpenseCategory) => {
    setEditingCategory(cat)
    setNameAr(cat.nameAr)
    setNameEn(cat.nameEn)
    setIsFormOpen(true)
    setErrorMessage(null)
  }

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    if (!nameAr.trim()) {
      setErrorMessage(t('expenses.errorCategoryRequired'))
      return
    }

    setSubmitting(true)
    setErrorMessage(null)

    try {
      if (editingCategory) {
        const updateInput: UpdateExpenseCategoryInput = {
          nameAr: nameAr.trim(),
          nameEn: nameEn.trim() || nameAr.trim(),
        }
        await expenseService.updateExpenseCategory(editingCategory.id, updateInput, {
          id: user.id,
          fullName: user.fullName || user.username,
          username: user.username,
        })
        setSuccessMessage(t('expenses.successCategoryEdit'))
      } else {
        const createInput: CreateExpenseCategoryInput = {
          nameAr: nameAr.trim(),
          nameEn: nameEn.trim() || nameAr.trim(),
        }
        await expenseService.createExpenseCategory(createInput, {
          id: user.id,
          fullName: user.fullName || user.username,
          username: user.username,
        })
        setSuccessMessage(t('expenses.successCategoryAdd'))
      }

      setIsFormOpen(false)
      await loadCategories()
      onCategoriesChanged()
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save category')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (cat: ExpenseCategory) => {
    if (!user) return
    try {
      await expenseService.toggleExpenseCategoryActive(cat.id, !cat.isActive, {
        id: user.id,
        fullName: user.fullName || user.username,
        username: user.username,
      })
      await loadCategories()
      onCategoriesChanged()
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to toggle category state')
    }
  }

  const filteredCategories = categories.filter(c => {
    const term = searchTerm.toLowerCase()
    return (
      c.nameAr.toLowerCase().includes(term) ||
      c.nameEn.toLowerCase().includes(term) ||
      (c.name && c.name.toLowerCase().includes(term))
    )
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">{t('expenses.manageCategories')}</h2>
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Sub-form (Create / Edit Category) */}
          {isFormOpen ? (
            <form
              onSubmit={handleSaveCategory}
              className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3.5"
            >
              <h3 className="text-sm font-bold text-foreground">
                {editingCategory ? t('expenses.editCategory') : t('expenses.addCategory')}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    {t('expenses.categoryNameAr')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={nameAr}
                    onChange={e => setNameAr(e.target.value)}
                    placeholder="مثال: صيانة"
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    {t('expenses.categoryNameEn')}
                  </label>
                  <input
                    type="text"
                    value={nameEn}
                    onChange={e => setNameEn(e.target.value)}
                    placeholder="e.g. Maintenance"
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-xl border border-border text-xs font-medium hover:bg-muted/80"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:bg-primary/90 flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{t('common.save')}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder={t('expenses.searchPlaceholder')}
                  className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <button
                type="button"
                onClick={handleOpenAdd}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:bg-primary/90 flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>{t('expenses.addCategory')}</span>
              </button>
            </div>
          )}

          {/* List of categories */}
          <div className="space-y-2 max-h-[340px] overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center text-muted-foreground flex items-center justify-center gap-2 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>{t('common.loading')}...</span>
              </div>
            ) : filteredCategories.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-xs">
                {t('expenses.noCategoriesFound')}
              </div>
            ) : (
              filteredCategories.map(cat => (
                <div
                  key={cat.id}
                  className="p-3 rounded-xl border border-border bg-background/50 hover:bg-muted/30 transition-all flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        cat.isActive ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                    />
                    <div>
                      <p className="text-xs font-bold text-foreground">
                        {isRtl ? cat.nameAr : cat.nameEn || cat.nameAr}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {isRtl ? cat.nameEn : cat.nameAr}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(cat)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition-all ${
                        cat.isActive
                          ? 'border-emerald-500/30 text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20'
                          : 'border-muted-foreground/30 text-muted-foreground bg-muted/40 hover:bg-muted/60'
                      }`}
                    >
                      {cat.isActive ? t('expenses.isActive') : t('expenses.inactive')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(cat)}
                      className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-muted/20 flex items-center justify-end">
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
  )
}

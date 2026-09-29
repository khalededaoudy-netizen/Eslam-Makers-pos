import React, { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Folder,
  Edit2,
  Trash2,
  DownloadCloud,
  CheckCircle2,
  Search,
  AlertCircle,
  Tag,
  ShieldCheck,
  Package,
  Layers,
  Sparkles,
  X,
} from 'lucide-react'
import { productService, CategoryItem } from '@/services/products/productService'
import {
  makersCategoryService,
  CategoryWithCount,
  ImportPreviewResult,
  ImportExecutionResult,
} from '@/services/categories/makersCategoryService'
import { MAKERS_MASTER_CATEGORIES } from '@/services/categories/makersCategories'
import { useAuthStore, usePermission } from '@/stores/authStore'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

export const MAKERS_STANDARD_CATEGORIES = MAKERS_MASTER_CATEGORIES

export function CategoriesPage() {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'ar' || i18n.dir?.() === 'rtl'
  const { user } = useAuthStore()
  const { can, isAdmin } = usePermission()
  const canManage = isAdmin || can('create', 'products') || can('update', 'products')

  const [categories, setCategories] = useState<CategoryWithCount[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isEditing, setIsEditing] = useState<string | null>(null)
  const [form, setForm] = useState({ name_ar: '', name_en: '', parent_id: '', icon: 'folder', color: '#3b82f6' })
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')

  // Import Modal & Preview State
  const [showImportModal, setShowImportModal] = useState(false)
  const [importPreview, setImportPreview] = useState<ImportPreviewResult | null>(null)
  const [isAnalyzingImport, setIsAnalyzingImport] = useState(false)
  const [isExecutingImport, setIsExecutingImport] = useState(false)
  const [lastImportResult, setLastImportResult] = useState<ImportExecutionResult | null>(null)

  // Unified Delete Confirmation State
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<CategoryWithCount | null>(null)

  useEffect(() => {
    loadCategories()
  }, [])

  async function loadCategories() {
    try {
      const cats = await makersCategoryService.getCategoriesWithCounts()
      setCategories(cats)
    } catch (err) {
      console.error('Failed to load categories with counts, falling back to base list:', err)
      const baseCats = await productService.getCategories()
      setCategories(baseCats.map(c => ({ ...c, product_count: 0 } as CategoryWithCount)))
    }
  }

  async function executeDeleteCategory() {
    if (!deleteCategoryTarget) return
    if (deleteCategoryTarget.product_count > 0) {
      throw new Error(
        isRtl
          ? `لا يمكن حذف هذا التصنيف لأنه يحتوي على (${deleteCategoryTarget.product_count}) منتج مرتبط. يرجى نقل أو حذف المنتجات أولاً.`
          : `Cannot delete this category because it contains (${deleteCategoryTarget.product_count}) linked products. Please move or delete the products first.`
      )
    }
    await productService.deleteCategory(deleteCategoryTarget.id, {
      id: user?.id,
      fullName: user?.fullName,
    })
    setDeleteCategoryTarget(null)
    setFeedback(isRtl ? 'تم حذف التصنيف بنجاح' : 'Category deleted successfully')
    await loadCategories()
  }

  // Open Preview Modal
  async function handleOpenImportPreview() {
    setError('')
    setFeedback('')
    setIsAnalyzingImport(true)
    setShowImportModal(true)
    try {
      const preview = await makersCategoryService.previewImport()
      setImportPreview(preview)
    } catch (err: any) {
      setError(err.message || 'فشل تحليل استيراد تصنيفات ميكرز')
      setShowImportModal(false)
    } finally {
      setIsAnalyzingImport(false)
    }
  }
  const handleImportMakersCategories = handleOpenImportPreview

  // Execute Import
  async function handleConfirmImport() {
    setIsExecutingImport(true)
    setError('')
    try {
      const result = await makersCategoryService.importMakersCategories(undefined, {
        id: user?.id,
        fullName: user?.fullName,
      })
      setLastImportResult(result)
      setShowImportModal(false)
      setFeedback(
        `تم اكتمال الاستيراد بنجاح: تم معالجة ${result.total} تصنيف (${result.created} جديد، ${result.alreadyExisted} موجود مسبقاً، ${result.duplicatesPrevented === 0 ? '0' : '0'} تكرار).`
      )
      await loadCategories()
    } catch (err: any) {
      setError(err.message || 'فشل تنفيذ استيراد تصنيفات ميكرز')
    } finally {
      setIsExecutingImport(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name_ar && !form.name_en) return

    setLoading(true)
    setError('')
    try {
      if (isEditing) {
        await productService.updateCategory(
          isEditing,
          {
            nameAr: form.name_ar,
            nameEn: form.name_en,
            parentId: form.parent_id || null,
            icon: form.icon,
            color: form.color,
          },
          { id: user?.id, fullName: user?.fullName }
        )
      } else {
        await productService.createCategory(
          {
            nameAr: form.name_ar,
            nameEn: form.name_en,
            parentId: form.parent_id || null,
            icon: form.icon,
            color: form.color,
          },
          { id: user?.id, fullName: user?.fullName }
        )
      }
      setForm({ name_ar: '', name_en: '', parent_id: '', icon: 'folder', color: '#3b82f6' })
      setIsEditing(null)
      await loadCategories()
    } catch (err: any) {
      setError(err.message || 'Error saving category')
    } finally {
      setLoading(false)
    }
  }

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories
    const q = searchQuery.toLowerCase().trim()
    return categories.filter(
      c =>
        c.name_ar.toLowerCase().includes(q) ||
        (c.name_en && c.name_en.toLowerCase().includes(q)) ||
        (c.description && c.description.toLowerCase().includes(q))
    )
  }, [categories, searchQuery])

  const totalProductsInCategories = useMemo(() => {
    return categories.reduce((sum, c) => sum + (c.product_count || 0), 0)
  }, [categories])

  return (
    <div className="flex-1 flex flex-col p-6 max-w-6xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20 shadow-inner">
            <Folder className="w-7 h-7 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight">{t('products.categories')}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                {categories.length} تصنيف
              </span>
            </div>
            <p className="text-muted-foreground text-sm">{t('products.manageCategories')}</p>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-import-makers-categories"
              onClick={handleOpenImportPreview}
              disabled={isAnalyzingImport || isExecutingImport}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <DownloadCloud className={`w-4 h-4 ${isAnalyzingImport ? 'animate-bounce' : ''}`} />
              <span>استيراد تصنيفات MAKERS الرسمية</span>
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border p-4 rounded-2xl shadow-xs flex items-center gap-3">
          <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">إجمالي التصنيفات</div>
            <div className="text-xl font-bold text-foreground">{categories.length}</div>
          </div>
        </div>

        <div className="bg-card border border-border p-4 rounded-2xl shadow-xs flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">تصنيفات ميكرز الأساسية</div>
            <div className="text-xl font-bold text-foreground">35 فئة رئيسية</div>
          </div>
        </div>

        <div className="bg-card border border-border p-4 rounded-2xl shadow-xs flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">المنتجات المصنفة</div>
            <div className="text-xl font-bold text-foreground">{totalProductsInCategories} منتج</div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {feedback && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-sm flex items-center justify-between gap-3 shadow-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span className="font-semibold">{feedback}</span>
          </div>
          <button onClick={() => setFeedback('')} className="p-1 hover:bg-emerald-500/20 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-center justify-between gap-3 shadow-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
          <button onClick={() => setError('')} className="p-1 hover:bg-destructive/20 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Panel */}
        {canManage && (
          <div className="lg:col-span-1">
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs sticky top-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-base flex items-center gap-2">
                  <Tag className="w-4 h-4 text-primary" />
                  <span>{isEditing ? t('common.edit') : t('common.add')}</span>
                </h2>
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(null)
                      setForm({ name_ar: '', name_en: '', parent_id: '', icon: 'folder', color: '#3b82f6' })
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {t('common.cancel')}
                  </button>
                )}
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">{t('categories.nameAr')} *</label>
                  <input
                    type="text"
                    required
                    value={form.name_ar}
                    onChange={e => setForm({ ...form, name_ar: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl bg-input border border-border focus:ring-2 focus:ring-primary text-sm font-medium transition-all"
                    placeholder="مثال: لوحات أردوينو والتطوير"
                    dir="rtl"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">{t('categories.nameEn')} *</label>
                  <input
                    type="text"
                    required
                    value={form.name_en}
                    onChange={e => setForm({ ...form, name_en: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl bg-input border border-border focus:ring-2 focus:ring-primary text-sm font-medium transition-all"
                    placeholder="e.g. Arduino & Development Boards"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">لون التمييز (Color Accent)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.color}
                      onChange={e => setForm({ ...form, color: e.target.value })}
                      className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      value={form.color}
                      onChange={e => setForm({ ...form, color: e.target.value })}
                      className="flex-1 h-10 px-3 rounded-xl bg-input border border-border text-xs font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-all shadow-sm active:scale-98 cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'جاري الحفظ...' : t('common.save')}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Categories Table & Search */}
        <div className={canManage ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden flex flex-col">
            {/* Search Bar */}
            <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between gap-4">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  id="category-search-input"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="ابحث بالاسم العربي أو الإنجليزي..."
                  className="w-full h-10 pr-9 pl-3 rounded-xl bg-background border border-border text-sm focus:ring-2 focus:ring-primary transition-all"
                />
              </div>
              <div className="text-xs text-muted-foreground font-semibold shrink-0">
                {filteredCategories.length} من {categories.length}
              </div>
            </div>

            {/* List */}
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto divide-y divide-border">
              {filteredCategories.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <Folder className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">لا توجد تصنيفات مطابقة للبحث</p>
                </div>
              ) : (
                <table className="w-full border-collapse">
                  <thead className="bg-muted/40 text-xs font-bold text-muted-foreground sticky top-0 backdrop-blur-xs z-10">
                    <tr>
                      <th className="text-start p-3.5">التصنيف (عربي / English)</th>
                      <th className="text-center p-3.5">المنتجات</th>
                      <th className="text-center p-3.5">الحالة</th>
                      {canManage && <th className="text-center p-3.5">الإجراءات</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-sm">
                    {filteredCategories.map(c => {
                      const isMakersOfficial = c.description?.includes('MAKERS') || (c.sort_order && c.sort_order > 0)
                      return (
                        <tr key={c.id} className="hover:bg-muted/30 transition-colors group">
                          <td className="p-3.5">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                                style={{ backgroundColor: c.color || '#3b82f6' }}
                              />
                              <div>
                                <div className="font-bold text-foreground flex items-center gap-2">
                                  <span>{c.name_ar}</span>
                                  {isMakersOfficial && (
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-blue-500/10 text-blue-500 border border-blue-500/20">
                                      MAKERS
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground font-mono mt-0.5" dir="ltr">
                                  {c.name_en}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="p-3.5 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                                (c.product_count || 0) > 0
                                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {c.product_count || 0}
                            </span>
                          </td>

                          <td className="p-3.5 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                c.is_active
                                  ? 'bg-emerald-500/10 text-emerald-500'
                                  : 'bg-destructive/10 text-destructive'
                              }`}
                            >
                              {c.is_active ? 'نشط' : 'معطل'}
                            </span>
                          </td>

                          {canManage && (
                            <td className="p-3.5 text-center">
                              <div className="flex items-center justify-center gap-1.5 opacity-80 group-hover:opacity-100">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsEditing(c.id)
                                    setForm({
                                      name_ar: c.name_ar,
                                      name_en: c.name_en || '',
                                      parent_id: c.parent_id || '',
                                      icon: c.icon || 'folder',
                                      color: c.color || '#3b82f6',
                                    })
                                  }}
                                  className="p-1.5 text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors cursor-pointer"
                                  title={t('common.edit')}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteCategoryTarget(c)}
                                  className="p-1.5 text-destructive hover:bg-destructive/10 bg-muted rounded-lg transition-colors cursor-pointer"
                                  title={t('common.delete')}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Import Preview Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">استيراد ومزامنة تصنيفات MAKERS الرسمية</h3>
                  <p className="text-xs text-muted-foreground">35 تصنيفاً رئيسياً معتمداً للمحل</p>
                </div>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-2 text-muted-foreground hover:text-foreground rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {isAnalyzingImport ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  <DownloadCloud className="w-8 h-8 mx-auto mb-2 animate-bounce text-primary" />
                  جاري فحص قاعدة البيانات ومقارنة التصنيفات...
                </div>
              ) : importPreview ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 bg-muted/40 rounded-2xl border border-border">
                      <div className="text-xs text-muted-foreground font-semibold">الإجمالي الرسمي</div>
                      <div className="text-2xl font-black text-foreground">{importPreview.total}</div>
                    </div>
                    <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                      <div className="text-xs text-emerald-500 font-semibold">جديد للإضافة</div>
                      <div className="text-2xl font-black text-emerald-500">{importPreview.toCreate}</div>
                    </div>
                    <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                      <div className="text-xs text-blue-500 font-semibold">موجود مسبقاً</div>
                      <div className="text-2xl font-black text-blue-500">{importPreview.alreadyExists}</div>
                    </div>
                  </div>

                  <div className="p-4 bg-muted/30 rounded-2xl text-xs space-y-2 text-muted-foreground">
                    <div className="flex items-center justify-between font-medium">
                      <span>الحماية من التكرار (Duplicates Prevented):</span>
                      <span className="font-bold text-foreground">{importPreview.duplicatesPrevented}</span>
                    </div>
                    <div className="flex items-center justify-between font-medium">
                      <span>نوع العملية:</span>
                      <span className="font-bold text-emerald-500">Atomic Safe Idempotent Sync</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="p-4 bg-muted/30 border-t border-border flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                disabled={isExecutingImport}
                className="px-4 py-2.5 rounded-xl border border-border hover:bg-muted text-xs font-bold transition-all cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                id="btn-confirm-import-makers"
                onClick={handleConfirmImport}
                disabled={isExecutingImport || isAnalyzingImport}
                className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isExecutingImport ? 'جاري الاستيراد...' : 'بدء الاستيراد الفعلي'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unified Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteCategoryTarget}
        onClose={() => setDeleteCategoryTarget(null)}
        onConfirm={executeDeleteCategory}
        title={isRtl ? 'تأكيد حذف التصنيف' : 'Confirm Category Deletion'}
        itemName={deleteCategoryTarget ? (isRtl ? deleteCategoryTarget.name_ar : deleteCategoryTarget.name_en) : ''}
        confirmText={t('common.delete', 'حذف')}
        warningMessage={
          deleteCategoryTarget && deleteCategoryTarget.product_count > 0
            ? (isRtl ? `تنبيه: هذا التصنيف يحتوي على ${deleteCategoryTarget.product_count} منتج مرتبط.` : `Warning: This category contains ${deleteCategoryTarget.product_count} linked products.`)
            : undefined
        }
      />
    </div>
  )
}

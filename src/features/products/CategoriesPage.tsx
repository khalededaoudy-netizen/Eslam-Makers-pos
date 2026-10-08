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
import { MAKERS_MASTER_CATEGORIES, normalizeCategoryName } from '@/services/categories/makersCategories'
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
  const [filterType, setFilterType] = useState<'all' | 'makers' | 'custom'>('all')
  const [productStats, setProductStats] = useState({ total: 0, withCategory: 0 })
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
      const [cats, pStats] = await Promise.all([
        makersCategoryService.getCategoriesWithCounts(),
        makersCategoryService.getProductsStats().catch(() => ({ total: 0, withCategory: 0 })),
      ])
      setCategories(cats)
      setProductStats(pStats)
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

  const makersNameEnSet = useMemo(() => {
    return new Set(MAKERS_MASTER_CATEGORIES.map(m => normalizeCategoryName(m.name_en)))
  }, [])

  const isCategoryMakers = (c: { name_en?: string | null }) => {
    return c.name_en ? makersNameEnSet.has(normalizeCategoryName(c.name_en)) : false
  }

  // Safety guard: detect if user enters a category that already exists in MAKERS list
  const matchingMakersCategory = useMemo(() => {
    const normEn = normalizeCategoryName(form.name_en)
    const normAr = normalizeCategoryName(form.name_ar)
    if (!normEn && !normAr) return null
    return (
      MAKERS_MASTER_CATEGORIES.find(m => {
        return (
          (normEn && normalizeCategoryName(m.name_en) === normEn) ||
          (normAr && normalizeCategoryName(m.name_ar) === normAr)
        )
      }) || null
    )
  }, [form.name_en, form.name_ar])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name_ar && !form.name_en) return

    // Safety guard against duplicate manual creation of MAKERS categories
    if (!isEditing && matchingMakersCategory) {
      setError(
        isRtl
          ? 'هذا التصنيف موجود ضمن تصنيفات MAKERS — استخدمها بدلاً من إنشاء واحد جديد'
          : 'This category exists in MAKERS list — use the existing one instead of creating a new one'
      )
      return
    }

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

  const activeCategoriesCount = useMemo(() => {
    return categories.filter(c => c.is_active === 1).length
  }, [categories])

  const makersCategoriesCount = useMemo(() => {
    return categories.filter(c => isCategoryMakers(c)).length
  }, [categories, makersNameEnSet])

  const customCategoriesCount = useMemo(() => {
    return categories.filter(c => !isCategoryMakers(c)).length
  }, [categories, makersNameEnSet])

  const productsWithCategoryCount = useMemo(() => {
    return productStats.withCategory || categories.reduce((sum, c) => sum + (c.product_count || 0), 0)
  }, [productStats.withCategory, categories])

  const totalProductsCount = productStats.total

  const filteredCategories = useMemo(() => {
    let result = categories

    if (filterType === 'makers') {
      result = result.filter(c => isCategoryMakers(c))
    } else if (filterType === 'custom') {
      result = result.filter(c => !isCategoryMakers(c))
    }

    if (!searchQuery.trim()) return result
    const q = searchQuery.toLowerCase().trim()
    return result.filter(
      c =>
        c.name_ar.toLowerCase().includes(q) ||
        (c.name_en && c.name_en.toLowerCase().includes(q)) ||
        (c.description && c.description.toLowerCase().includes(q))
    )
  }, [categories, filterType, searchQuery, makersNameEnSet])

  async function handleQuickImportAll() {
    setIsExecutingImport(true)
    setError('')
    try {
      const result = await makersCategoryService.importMakersCategories(undefined, {
        id: user?.id,
        fullName: user?.fullName,
      })
      setLastImportResult(result)
      setFeedback(
        isRtl
          ? `تم اكتمال الاستيراد بنجاح: تم إضافة ${result.created} تصنيف جاهز من MAKERS!`
          : `Import completed: successfully added ${result.created} MAKERS categories!`
      )
      await loadCategories()
    } catch (err: any) {
      setError(err?.message || (isRtl ? 'فشل استيراد تصنيفات ميكرز' : 'Failed to import categories'))
    } finally {
      setIsExecutingImport(false)
    }
  }

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

      {/* Quick Start Banner when DB is Empty */}
      {categories.length === 0 && (
        <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-500/10 via-primary/10 to-indigo-500/10 border-2 border-primary/30 shadow-md flex flex-col sm:flex-row items-center justify-between gap-5 animate-fade-in">
          <div className="space-y-1.5 text-center sm:text-start">
            <div className="flex items-center justify-center sm:justify-start gap-2 text-primary font-bold text-base">
              <span className="text-xl">🎯</span>
              <span>{isRtl ? 'ابدأ بسرعة' : 'Quick Start'}</span>
            </div>
            <p className="text-sm font-bold text-foreground">
              {isRtl ? 'عندك 35 تصنيف جاهز من MAKERS' : 'You have 35 ready-made categories from MAKERS'}
            </p>
            <p className="text-xs text-muted-foreground">
              {isRtl ? 'اضغط الزر لإضافتها دفعة واحدة' : 'Click the button to import all of them in one click'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleQuickImportAll}
            disabled={isExecutingImport || isAnalyzingImport}
            className="px-5 py-3 rounded-xl bg-primary text-primary-foreground text-xs sm:text-sm font-bold shadow-lg hover:bg-primary/90 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
          >
            <DownloadCloud className={`w-4 h-4 ${isExecutingImport ? 'animate-bounce' : ''}`} />
            <span>{isRtl ? 'استيراد الـ 35 تصنيف الآن' : 'Import All 35 Categories Now'}</span>
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1 — التصنيفات المتوفرة */}
        <div className="bg-card border border-border p-4 rounded-2xl shadow-xs flex items-center gap-3">
          <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">
              {isRtl ? 'التصنيفات المتوفرة' : 'Available Categories'}
            </div>
            <div className="text-xl font-bold text-foreground">{activeCategoriesCount}</div>
            <div className="text-[10px] text-muted-foreground">
              {isRtl ? 'من قائمة MAKERS الرسمية' : 'From official MAKERS list'}
            </div>
          </div>
        </div>

        {/* Card 2 — تصنيفات مخصصة */}
        <div className="bg-card border border-border p-4 rounded-2xl shadow-xs flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">
              {isRtl ? 'تصنيفات مخصصة' : 'Custom Categories'}
            </div>
            <div className="text-xl font-bold text-foreground flex items-center gap-1.5">
              <span>{customCategoriesCount}</span>
              {customCategoriesCount === 0 && (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              )}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {isRtl ? 'مضافة يدوياً' : 'Manually added'}
            </div>
          </div>
        </div>

        {/* Card 3 — المنتجات المصنفة */}
        <div className="bg-card border border-border p-4 rounded-2xl shadow-xs flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">
              {isRtl ? 'المنتجات المصنفة' : 'Categorized Products'}
            </div>
            <div className="text-xl font-bold text-foreground">
              {productsWithCategoryCount} {isRtl ? 'منتج' : 'products'}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {isRtl ? `من إجمالي ${totalProductsCount} منتج` : `From total ${totalProductsCount} products`}
            </div>
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

                {/* Safety Guard: Duplicate warning if name matches MAKERS official catalog */}
                {matchingMakersCategory && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs space-y-2 animate-fade-in">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-bold leading-snug">
                          {isRtl
                            ? 'هذا التصنيف موجود ضمن تصنيفات MAKERS — استخدمها بدلاً من إنشاء واحد جديد'
                            : 'This category exists in MAKERS list — use the existing one instead of creating a new one'}
                        </p>
                        <p className="text-[11px] opacity-80 font-mono">
                          {matchingMakersCategory.name_en} ({matchingMakersCategory.name_ar})
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery(matchingMakersCategory.name_en)
                        setFilterType('all')
                      }}
                      className="text-[11px] font-bold text-amber-900 dark:text-amber-200 underline hover:no-underline cursor-pointer"
                    >
                      {isRtl ? '🔍 الانتقال إلى التصنيف في الجدول' : '🔍 Find in categories table'}
                    </button>
                  </div>
                )}

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
            {/* Search Bar & Filter Controls */}
            <div className="p-4 border-b border-border bg-muted/20 flex flex-col md:flex-row md:items-center justify-between gap-3">
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

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border self-start md:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    filterType === 'all'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  الكل ({categories.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('makers')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    filterType === 'makers'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  MAKERS ({makersCategoriesCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('custom')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    filterType === 'custom'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  تصنيفات مخصصة ({customCategoriesCount})
                </button>
              </div>

              <div className="text-xs text-muted-foreground font-semibold shrink-0 hidden lg:block">
                {filteredCategories.length} من {categories.length}
              </div>
            </div>

            {/* List */}
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto divide-y divide-border">
              {filteredCategories.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <Folder className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">
                    {filterType === 'custom'
                      ? (isRtl ? 'لا توجد تصنيفات مخصصة — جميع التصنيفات الحالية تتبع قائمة MAKERS الرسمية' : 'No custom categories — all current categories follow official MAKERS list')
                      : (isRtl ? 'لا توجد تصنيفات مطابقة للبحث' : 'No categories matching search')}
                  </p>
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
                      const isMakersOfficial = isCategoryMakers(c)
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
                                  {isMakersOfficial ? (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-500/10 text-blue-500 border border-blue-500/20">
                                      MAKERS
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                      {isRtl ? 'مخصص' : 'Custom'}
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

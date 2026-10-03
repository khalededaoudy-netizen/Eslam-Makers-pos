import React, { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Tag, Edit2, Trash2, Search, X, Plus, SlidersHorizontal } from 'lucide-react'
import { productService, AttributeDefItem } from '@/services/products/productService'
import { useAuthStore, usePermission } from '@/stores/authStore'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

export function AttributesPage() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const { can, isAdmin } = usePermission()
  const canManage = isAdmin || can('create', 'products') || can('update', 'products')

  const [attributes, setAttributes] = useState<AttributeDefItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isEditing, setIsEditing] = useState<string | null>(null)
  const [form, setForm] = useState({ name_ar: '', name_en: '', unit: '', data_type: 'text' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Unified Delete Confirmation State
  const [deleteAttrTarget, setDeleteAttrTarget] = useState<AttributeDefItem | null>(null)

  useEffect(() => { loadAttributes() }, [])

  async function loadAttributes() {
    try {
      const attrs = await productService.getAttributeDefs()
      setAttributes(attrs)
    } catch (err: any) {
      console.error('Failed to load attribute defs:', err)
    }
  }

  async function executeDeleteAttr() {
    if (!deleteAttrTarget) return
    await productService.deleteAttributeDef(deleteAttrTarget.id, { id: user?.id, fullName: user?.fullName })
    setDeleteAttrTarget(null)
    await loadAttributes()
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name_ar && !form.name_en) return
    
    setLoading(true)
    setError('')
    try {
      if (isEditing) {
        await productService.updateAttributeDef(isEditing, {
          nameAr: form.name_ar,
          nameEn: form.name_en,
          unit: form.unit || null,
          dataType: form.data_type,
        }, { id: user?.id, fullName: user?.fullName })
      } else {
        await productService.createAttributeDef({
          nameAr: form.name_ar,
          nameEn: form.name_en,
          unit: form.unit || null,
          dataType: form.data_type,
        }, { id: user?.id, fullName: user?.fullName })
      }
      setForm({ name_ar: '', name_en: '', unit: '', data_type: 'text' })
      setIsEditing(null)
      await loadAttributes()
    } catch (err: any) {
      setError(err.message || 'Error saving attribute')
    } finally {
      setLoading(false)
    }
  }

  const filteredAttributes = useMemo(() => {
    if (!searchQuery.trim()) return attributes
    const q = searchQuery.toLowerCase().trim()
    return attributes.filter(a => 
      (a.name_ar && a.name_ar.toLowerCase().includes(q)) ||
      (a.name_en && a.name_en.toLowerCase().includes(q)) ||
      (a.unit && a.unit.toLowerCase().includes(q))
    )
  }, [attributes, searchQuery])

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden p-6 max-w-5xl mx-auto w-full">
      {/* Fixed Page Header */}
      <div className="flex items-center justify-between gap-3 mb-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20 shadow-xs">
            <Tag className="w-6 h-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{t('products.attributes')}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                {attributes.length}
              </span>
            </div>
            <p className="text-muted-foreground text-sm">{t('products.manageAttributes')}</p>
          </div>
        </div>
      </div>

      {/* Main Content Layout — Flex/Grid container with constrained height */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden">
        {/* Form (Fixed card on left) */}
        {canManage && (
          <div className="md:col-span-1 shrink-0 flex flex-col">
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs flex flex-col">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
                {isEditing ? <Edit2 className="w-4 h-4 text-primary" /> : <Plus className="w-4 h-4 text-primary" />}
                <h2 className="font-bold text-foreground text-sm">{isEditing ? t('common.edit') : t('common.add')}</h2>
              </div>
              
              {error && (
                <div className="p-3 mb-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
                  {error}
                </div>
              )}
              
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">{t('products.nameAr')} *</label>
                  <input
                    type="text"
                    required
                    value={form.name_ar}
                    onChange={e => setForm({ ...form, name_ar: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl bg-input border border-border focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition-all"
                    dir="rtl"
                    placeholder="مثال: المقاومة"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">{t('products.nameEn')}</label>
                  <input
                    type="text"
                    value={form.name_en}
                    onChange={e => setForm({ ...form, name_en: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl bg-input border border-border focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition-all"
                    dir="ltr"
                    placeholder="e.g. Resistance"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">{t('common.unit', 'الوحدة')} (اختياري)</label>
                  <input
                    type="text"
                    value={form.unit}
                    onChange={e => setForm({ ...form, unit: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl bg-input border border-border focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition-all"
                    placeholder="e.g. Ω, V, A, µF"
                    dir="ltr"
                  />
                </div>
                
                <div className="pt-2 space-y-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-10 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-all shadow-xs disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>{t('common.save')}</span>
                  </button>
                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(null)
                        setForm({ name_ar: '', name_en: '', unit: '', data_type: 'text' })
                        setError('')
                      }}
                      className="w-full h-10 bg-muted text-muted-foreground rounded-xl text-sm font-semibold hover:bg-muted/80 transition-all cursor-pointer"
                    >
                      {t('common.cancel')}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Properties List Container — Takes remaining width & height, scrolls internally */}
        <div className={`${canManage ? 'md:col-span-2' : 'md:col-span-3'} flex flex-col min-h-0 h-full overflow-hidden`}>
          <div className="bg-card border border-border rounded-2xl flex flex-col flex-1 min-h-0 overflow-hidden shadow-xs">
            {/* Toolbar / Search Bar inside the properties card */}
            <div className="p-3.5 border-b border-border bg-muted/20 flex items-center justify-between gap-3 shrink-0">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={t('common.search', 'بحث...')}
                  className="w-full h-9 ps-9 pe-8 rounded-lg bg-input border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute end-2.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="text-xs text-muted-foreground font-medium shrink-0">
                {filteredAttributes.length} {t('common.items', 'عنصر')}
              </div>
            </div>

            {/* Scrollable Properties Table with independent vertical scrolling */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <table className="w-full text-start">
                <thead className="bg-muted/70 sticky top-0 z-10 backdrop-blur-xs border-b border-border">
                  <tr>
                    <th className="text-start p-3.5 font-bold text-muted-foreground text-xs">{t('products.nameAr')}</th>
                    <th className="text-start p-3.5 font-bold text-muted-foreground text-xs">{t('products.nameEn')}</th>
                    <th className="text-start p-3.5 font-bold text-muted-foreground text-xs">{t('common.unit', 'الوحدة')}</th>
                    <th className="text-center p-3.5 font-bold text-muted-foreground text-xs w-24">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredAttributes.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-12 text-center text-muted-foreground text-sm">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <SlidersHorizontal className="w-8 h-8 opacity-25" />
                          <p>{t('common.noData')}</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredAttributes.map(a => (
                      <tr key={a.id} className="hover:bg-muted/25 transition-colors group">
                        <td className="p-3.5 text-sm font-semibold text-foreground">{a.name_ar}</td>
                        <td className="p-3.5 text-sm text-muted-foreground">{a.name_en || '—'}</td>
                        <td className="p-3.5 text-sm font-mono text-primary font-medium">{a.unit || '—'}</td>
                        <td className="p-3.5">
                          <div className="flex items-center justify-center gap-1.5">
                            {canManage && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsEditing(a.id)
                                    setForm({ name_ar: a.name_ar, name_en: a.name_en || '', unit: a.unit || '', data_type: a.data_type || 'text' })
                                    setError('')
                                  }}
                                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                                  title={t('common.edit')}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteAttrTarget(a)}
                                  className="p-1.5 text-destructive/80 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                                  title={t('common.delete')}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Unified Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteAttrTarget}
        onClose={() => setDeleteAttrTarget(null)}
        onConfirm={executeDeleteAttr}
        title={t('attributes.confirmDelete', 'تأكيد حذف الخاصية')}
        itemName={deleteAttrTarget?.name_ar || deleteAttrTarget?.name_en}
        confirmText={t('common.delete', 'حذف')}
      />
    </div>
  )
}

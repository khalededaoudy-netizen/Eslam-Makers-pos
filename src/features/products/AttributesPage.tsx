import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Tag, Edit2, Trash2 } from 'lucide-react'
import { productService, AttributeDefItem } from '@/services/products/productService'
import { useAuthStore, usePermission } from '@/stores/authStore'

export function AttributesPage() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const { can, isAdmin } = usePermission()
  const canManage = isAdmin || can('create', 'products') || can('update', 'products')

  const [attributes, setAttributes] = useState<AttributeDefItem[]>([])
  const [isEditing, setIsEditing] = useState<string | null>(null)
  const [form, setForm] = useState({ name_ar: '', name_en: '', unit: '', data_type: 'text' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadAttributes() }, [])

  async function loadAttributes() {
    try {
      const attrs = await productService.getAttributeDefs()
      setAttributes(attrs)
    } catch (err: any) {
      console.error('Failed to load attribute defs:', err)
    }
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

  return (
    <div className="flex-1 flex flex-col p-6 max-w-4xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-primary/10 rounded-xl">
          <Tag className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t('products.attributes')}</h1>
          <p className="text-muted-foreground text-sm">{t('products.manageAttributes')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Form */}
        {canManage && (
          <div className="md:col-span-1">
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="font-semibold mb-4">{isEditing ? t('common.edit') : t('common.add')}</h2>
              {error && (
                <div className="p-3 mb-3 rounded-lg bg-destructive/10 text-destructive text-xs">
                  {error}
                </div>
              )}
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t('products.nameAr')} *</label>
                  <input
                    type="text"
                    required
                    value={form.name_ar}
                    onChange={e => setForm({ ...form, name_ar: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg bg-input border border-border focus:ring-2 focus:ring-primary text-sm"
                    dir="rtl"
                    placeholder="مثال: المقاومة"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t('products.nameEn')}</label>
                  <input
                    type="text"
                    value={form.name_en}
                    onChange={e => setForm({ ...form, name_en: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg bg-input border border-border focus:ring-2 focus:ring-primary text-sm"
                    dir="ltr"
                    placeholder="e.g. Resistance"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t('common.unit', 'الوحدة')} (اختياري)</label>
                  <input
                    type="text"
                    value={form.unit}
                    onChange={e => setForm({ ...form, unit: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg bg-input border border-border focus:ring-2 focus:ring-primary text-sm"
                    placeholder="e.g. Ω, V, A, µF"
                    dir="ltr"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {t('common.save')}
                </button>
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(null)
                      setForm({ name_ar: '', name_en: '', unit: '', data_type: 'text' })
                      setError('')
                    }}
                    className="w-full h-10 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                )}
              </form>
            </div>
          </div>
        )}

        {/* List */}
        <div className={canManage ? 'md:col-span-2' : 'md:col-span-3'}>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/30">
                <tr>
                  <th className="text-start p-4 font-medium text-muted-foreground text-sm">{t('products.nameAr')}</th>
                  <th className="text-start p-4 font-medium text-muted-foreground text-sm">{t('products.nameEn')}</th>
                  <th className="text-start p-4 font-medium text-muted-foreground text-sm">{t('common.unit', 'الوحدة')}</th>
                  <th className="text-center p-4 font-medium text-muted-foreground text-sm">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {attributes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-muted-foreground text-sm">
                      {t('common.noData')}
                    </td>
                  </tr>
                ) : (
                  attributes.map(a => (
                    <tr key={a.id} className="hover:bg-muted/20">
                      <td className="p-4 text-sm font-medium">{a.name_ar}</td>
                      <td className="p-4 text-sm text-muted-foreground">{a.name_en || '—'}</td>
                      <td className="p-4 text-sm font-mono text-primary">{a.unit || '—'}</td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          {canManage && (
                            <>
                              <button
                                onClick={() => {
                                  setIsEditing(a.id)
                                  setForm({ name_ar: a.name_ar, name_en: a.name_en || '', unit: a.unit || '', data_type: a.data_type || 'text' })
                                  setError('')
                                }}
                                className="p-1.5 text-muted-foreground hover:text-foreground bg-muted rounded-lg transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={async () => {
                                  if (window.confirm(t('common.confirm'))) {
                                    await productService.deleteAttributeDef(a.id, { id: user?.id, fullName: user?.fullName })
                                    loadAttributes()
                                  }
                                }}
                                className="p-1.5 text-destructive hover:bg-destructive/10 bg-muted rounded-lg transition-colors"
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
  )
}

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Scale, Edit2, Trash2 } from 'lucide-react'
import { productService, UnitItem } from '@/services/products/productService'
import { useAuthStore, usePermission } from '@/stores/authStore'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

export function UnitsPage() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const { can, isAdmin } = usePermission()
  const canManage = isAdmin || can('create', 'products') || can('update', 'products')

  const [units, setUnits] = useState<UnitItem[]>([])
  const [isEditing, setIsEditing] = useState<string | null>(null)
  const [form, setForm] = useState({ name_ar: '', name_en: '', symbol: '', allow_decimal: false })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Unified Delete Confirmation State
  const [deleteUnitTarget, setDeleteUnitTarget] = useState<UnitItem | null>(null)

  useEffect(() => { loadUnits() }, [])

  async function loadUnits() {
    try {
      const u = await productService.getUnits()
      setUnits(u)
    } catch (err) {
      console.error('Failed to load units:', err)
    }
  }

  async function executeDeleteUnit() {
    if (!deleteUnitTarget) return
    await productService.deleteUnit(deleteUnitTarget.id, { id: user?.id, fullName: user?.fullName })
    setDeleteUnitTarget(null)
    await loadUnits()
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name_ar || !form.symbol) return
    
    setLoading(true)
    setError('')
    try {
      if (isEditing) {
        await productService.updateUnit(isEditing, {
          nameAr: form.name_ar,
          nameEn: form.name_en,
          symbol: form.symbol,
          allowDecimal: form.allow_decimal,
        }, { id: user?.id, fullName: user?.fullName })
      } else {
        await productService.createUnit({
          nameAr: form.name_ar,
          nameEn: form.name_en,
          symbol: form.symbol,
          allowDecimal: form.allow_decimal,
        }, { id: user?.id, fullName: user?.fullName })
      }
      setForm({ name_ar: '', name_en: '', symbol: '', allow_decimal: false })
      setIsEditing(null)
      await loadUnits()
    } catch (err: any) {
      setError(err.message || 'Error saving unit')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col p-6 max-w-4xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-primary/10 rounded-xl">
          <Scale className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t('products.units')}</h1>
          <p className="text-muted-foreground text-sm">{t('products.manageUnits')}</p>
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
                  <label className="text-sm font-medium">{t('units.nameAr')} *</label>
                  <input
                    type="text"
                    required
                    value={form.name_ar}
                    onChange={e => setForm({ ...form, name_ar: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg bg-input border border-border focus:ring-2 focus:ring-primary text-sm"
                    dir="rtl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t('units.nameEn')}</label>
                  <input
                    type="text"
                    value={form.name_en}
                    onChange={e => setForm({ ...form, name_en: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg bg-input border border-border focus:ring-2 focus:ring-primary text-sm"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t('common.symbol')} *</label>
                  <input
                    type="text"
                    required
                    value={form.symbol}
                    onChange={e => setForm({ ...form, symbol: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg bg-input border border-border focus:ring-2 focus:ring-primary text-sm font-mono"
                    placeholder="e.g. pcs, m, kg"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer pt-2">
                  <input
                    type="checkbox"
                    checked={form.allow_decimal}
                    onChange={e => setForm({ ...form, allow_decimal: e.target.checked })}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm">{t('products.allowDecimal')}</span>
                </label>
                
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
                      setForm({ name_ar: '', name_en: '', symbol: '', allow_decimal: false })
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
                  <th className="text-start p-4 font-medium text-muted-foreground text-sm">{t('units.nameAr')}</th>
                  <th className="text-start p-4 font-medium text-muted-foreground text-sm">{t('common.symbol')}</th>
                  <th className="text-center p-4 font-medium text-muted-foreground text-sm">{t('products.allowDecimal')}</th>
                  <th className="text-center p-4 font-medium text-muted-foreground text-sm">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {units.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-muted-foreground text-sm">
                      {t('common.noData')}
                    </td>
                  </tr>
                ) : (
                  units.map(u => (
                    <tr key={u.id} className="hover:bg-muted/20">
                      <td className="p-4 text-sm font-medium">{u.name_ar}</td>
                      <td className="p-4 text-sm font-mono text-primary font-bold">{u.symbol}</td>
                      <td className="p-4 text-center text-sm">
                        {u.allow_decimal ? <span className="text-emerald-500">✓</span> : <span className="text-muted-foreground">✕</span>}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          {canManage && (
                            <>
                              <button
                                onClick={() => {
                                  setIsEditing(u.id)
                                  setForm({
                                    name_ar: u.name_ar,
                                    name_en: u.name_en || '',
                                    symbol: u.symbol,
                                    allow_decimal: Boolean(u.allow_decimal),
                                  })
                                  setError('')
                                }}
                                className="p-1.5 text-muted-foreground hover:text-foreground bg-muted rounded-lg transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeleteUnitTarget(u)}
                                className="p-1.5 text-destructive hover:bg-destructive/10 bg-muted rounded-lg transition-colors cursor-pointer"
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

      {/* Unified Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteUnitTarget}
        onClose={() => setDeleteUnitTarget(null)}
        onConfirm={executeDeleteUnit}
        title={t('units.confirmDelete', 'تأكيد حذف الوحدة')}
        itemName={deleteUnitTarget?.name_ar || deleteUnitTarget?.name_en || deleteUnitTarget?.symbol}
        confirmText={t('common.delete', 'حذف')}
      />
    </div>
  )
}

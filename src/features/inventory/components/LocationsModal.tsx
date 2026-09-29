import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, MapPin, Plus, Edit2, Trash2, CheckCircle2, AlertCircle } from 'lucide-react'
import { inventoryService, StorageLocation } from '@/services/inventory/inventoryService'
import { useAuthStore } from '@/stores/authStore'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

interface LocationsModalProps {
  onClose: () => void
  onUpdated?: () => void
}

export function LocationsModal({ onClose, onUpdated }: LocationsModalProps) {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [locations, setLocations] = useState<StorageLocation[]>([])
  const [isEditing, setIsEditing] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', name_ar: '', code: '', description: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [deleteLocTarget, setDeleteLocTarget] = useState<StorageLocation | null>(null)

  useEffect(() => {
    loadLocations()
  }, [])

  async function loadLocations() {
    try {
      const list = await inventoryService.getStorageLocations()
      setLocations(list)
    } catch (err) {
      console.error('Failed to load locations', err)
    }
  }

  async function executeDeleteLocation() {
    if (!deleteLocTarget) return
    await inventoryService.deleteStorageLocation(deleteLocTarget.id, { id: user?.id, fullName: user?.fullName })
    setDeleteLocTarget(null)
    loadLocations()
    onUpdated?.()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return

    setLoading(true)
    setError('')
    try {
      if (isEditing) {
        await inventoryService.updateStorageLocation(
          isEditing,
          {
            name: form.name.trim(),
            nameAr: form.name_ar.trim() || undefined,
            code: form.code.trim() || undefined,
            description: form.description.trim() || undefined,
          },
          { id: user?.id, fullName: user?.fullName }
        )
      } else {
        await inventoryService.createStorageLocation(
          {
            name: form.name.trim(),
            nameAr: form.name_ar.trim() || undefined,
            code: form.code.trim() || undefined,
            description: form.description.trim() || undefined,
          },
          { id: user?.id, fullName: user?.fullName }
        )
      }
      setForm({ name: '', name_ar: '', code: '', description: '' })
      setIsEditing(null)
      await loadLocations()
      onUpdated?.()
    } catch (err: any) {
      setError(err.message || t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-3xl rounded-2xl shadow-2xl border border-border flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {t('inventory.manageLocations', 'إدارة أماكن التخزين والفروع (Storage Locations)')}
              </h2>
              <p className="text-xs text-muted-foreground">{t('inventory.locationsSubtitle', 'المعارض، المخازن، الرفوف والأدراج')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Form */}
          <div className="md:col-span-1">
            <div className="p-4 rounded-xl bg-card border border-border space-y-4">
              <h3 className="font-semibold text-sm">
                {isEditing ? t('common.edit', 'تعديل') : t('inventory.addLocation', 'إضافة مكان تخزين')}
              </h3>

              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">{t('common.nameEn', 'الاسم بالإنجليزية')} *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Main Store, Shelf A"
                    className="w-full h-9 px-3 rounded-lg bg-input border border-border text-xs focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium">{t('common.nameAr', 'الاسم بالعربية')}</label>
                  <input
                    type="text"
                    value={form.name_ar}
                    onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
                    placeholder="e.g. المعرض الرئيسي، رف أ"
                    className="w-full h-9 px-3 rounded-lg bg-input border border-border text-xs focus:ring-2 focus:ring-primary"
                    dir="rtl"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium">{t('common.code', 'كود المكان')}</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="e.g. MAIN, WH1, SH-A"
                    className="w-full h-9 px-3 rounded-lg bg-input border border-border text-xs font-mono focus:ring-2 focus:ring-primary uppercase"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium">{t('common.description', 'الوصف')}</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="وصف مختصر..."
                    className="w-full p-2 rounded-lg bg-input border border-border text-xs focus:ring-2 focus:ring-primary min-h-[50px]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-9 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {t('common.save', 'حفظ')}
                </button>

                {isEditing && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(null)
                      setForm({ name: '', name_ar: '', code: '', description: '' })
                      setError('')
                    }}
                    className="w-full h-9 bg-muted text-muted-foreground rounded-lg text-xs font-medium hover:bg-muted/80 transition-colors"
                  >
                    {t('common.cancel', 'إلغاء')}
                  </button>
                )}
              </form>
            </div>
          </div>

          {/* List */}
          <div className="md:col-span-2">
            <div className="rounded-xl border border-border overflow-hidden bg-card">
              <table className="w-full">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="text-start p-3 text-xs font-medium text-muted-foreground">{t('common.name', 'المكان')}</th>
                    <th className="text-start p-3 text-xs font-medium text-muted-foreground">{t('common.code', 'الكود')}</th>
                    <th className="text-start p-3 text-xs font-medium text-muted-foreground">{t('common.description', 'الوصف')}</th>
                    <th className="text-center p-3 text-xs font-medium text-muted-foreground">{t('common.actions', 'إجراءات')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {locations.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-xs text-muted-foreground">
                        {t('common.noData', 'لا توجد أماكن تخزين مسجلة')}
                      </td>
                    </tr>
                  ) : (
                    locations.map((loc) => (
                      <tr key={loc.id} className="hover:bg-muted/20">
                        <td className="p-3 text-xs font-medium">
                          <p className="text-foreground">{loc.name_ar || loc.name}</p>
                          {loc.name_ar && <p className="text-[10px] text-muted-foreground">{loc.name}</p>}
                        </td>
                        <td className="p-3 text-xs font-mono text-primary font-bold">{loc.code || '—'}</td>
                        <td className="p-3 text-xs text-muted-foreground">{loc.description || '—'}</td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => {
                                setIsEditing(loc.id)
                                setForm({
                                  name: loc.name,
                                  name_ar: loc.name_ar || '',
                                  code: loc.code || '',
                                  description: loc.description || '',
                                })
                                setError('')
                              }}
                              className="p-1.5 text-muted-foreground hover:text-foreground bg-muted rounded-lg transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteLocTarget(loc)}
                              className="p-1.5 text-destructive hover:bg-destructive/10 bg-muted rounded-lg transition-colors cursor-pointer"
                              title={t('common.delete', 'حذف')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-border bg-muted/20">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('common.close', 'إغلاق')}
          </button>
        </div>
      </div>

      {/* Unified Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteLocTarget}
        onClose={() => setDeleteLocTarget(null)}
        onConfirm={executeDeleteLocation}
        title={t('inventory.confirmDeleteLocation', 'تأكيد حذف موقع التخزين')}
        itemName={deleteLocTarget?.name_ar || deleteLocTarget?.name}
        confirmText={t('common.delete', 'حذف')}
      />
    </div>
  )
}

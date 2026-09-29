import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Award, Edit2, Trash2, DownloadCloud, CheckCircle2 } from 'lucide-react'
import { productService, BrandItem } from '@/services/products/productService'
import { useAuthStore, usePermission } from '@/stores/authStore'

const MAKERS_STANDARD_BRANDS = [
  'Arduino',
  'Raspberry Pi',
  'Espressif Systems',
  'STMicroelectronics',
  'Texas Instruments',
  'Adafruit',
  'SparkFun',
  'Pololu',
  'DFRobot',
  'Seeed Studio',
  'Waveshare',
  'Microchip',
  'Atmel',
  'Analog Devices',
  'Bosch Sensortec',
  'Infineon',
  'NXP Semiconductors',
  'Mean Well',
  'SanDisk',
  'Kingston',
]

export function BrandsPage() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const { can, isAdmin } = usePermission()
  const canManage = isAdmin || can('create', 'products') || can('update', 'products')

  const [brands, setBrands] = useState<BrandItem[]>([])
  const [isEditing, setIsEditing] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [isImportingMakers, setIsImportingMakers] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    loadBrands()
  }, [])

  async function loadBrands() {
    try {
      const items = await productService.getBrands()
      setBrands(items)
    } catch (err: any) {
      console.error('Failed to load brands:', err)
    }
  }

  async function handleImportMakersBrands() {
    setIsImportingMakers(true)
    setFeedback('')
    setError('')
    try {
      let count = 0
      for (const b of MAKERS_STANDARD_BRANDS) {
        await productService.findOrCreateBrand(b)
        count++
      }
      setFeedback(`تم استيراد ومزامنة (${count}) علامة تجارية وماركة قياسية من كتالوج ميكرز بنجاح.`)
      await loadBrands()
    } catch (err: any) {
      setError(err.message || 'فشل استيراد ماركات ميكرز')
    } finally {
      setIsImportingMakers(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    setError('')
    try {
      if (isEditing) {
        await productService.updateBrand(isEditing, name.trim(), { id: user?.id, fullName: user?.fullName })
      } else {
        await productService.createBrand(name.trim(), { id: user?.id, fullName: user?.fullName })
      }
      setName('')
      setIsEditing(null)
      await loadBrands()
    } catch (err: any) {
      setError(err.message || 'Error saving brand')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col p-6 max-w-4xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-xl">
            <Award className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t('brands.title', 'الماركات والعلامات التجارية')}</h1>
            <p className="text-muted-foreground text-sm">{t('brands.subtitle', 'إدارة العلامات التجارية للقطع والمكونات')}</p>
          </div>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={handleImportMakersBrands}
            disabled={isImportingMakers}
            className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            <DownloadCloud className={`w-4 h-4 text-primary ${isImportingMakers ? 'animate-bounce' : ''}`} />
            <span>{isImportingMakers ? 'جاري الاستيراد...' : 'استيراد ماركات ميكرز الرسمية'}</span>
          </button>
        )}
      </div>

      {feedback && (
        <div className="p-3 mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

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
                  <label className="text-sm font-medium">{t('brands.name', 'اسم الماركة / الشركة')} *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-input border border-border focus:ring-2 focus:ring-primary text-sm"
                    placeholder="e.g. Texas Instruments, STMicroelectronics, Arduino"
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
                      setName('')
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
                  <th className="text-start p-4 font-medium text-muted-foreground text-sm">{t('brands.name', 'اسم الماركة')}</th>
                  <th className="text-center p-4 font-medium text-muted-foreground text-sm">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {brands.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="p-8 text-center text-muted-foreground text-sm">
                      {t('common.noData')}
                    </td>
                  </tr>
                ) : (
                  brands.map((b) => (
                    <tr key={b.id} className="hover:bg-muted/20">
                      <td className="p-4 text-sm font-medium">{b.name}</td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          {canManage && (
                            <>
                              <button
                                onClick={() => {
                                  setIsEditing(b.id)
                                  setName(b.name)
                                  setError('')
                                }}
                                className="p-1.5 text-muted-foreground hover:text-foreground bg-muted rounded-lg transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={async () => {
                                  if (window.confirm(t('common.confirm'))) {
                                    await productService.deleteBrand(b.id, { id: user?.id, fullName: user?.fullName })
                                    loadBrands()
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

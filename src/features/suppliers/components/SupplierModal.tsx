import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Truck, Save, AlertCircle } from 'lucide-react'
import { supplierService, SupplierItem, CreateSupplierInput, UpdateSupplierInput } from '@/services/suppliers'
import { useAuthStore } from '@/stores/authStore'

interface SupplierModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  supplier?: SupplierItem | null
}

export function SupplierModal({ isOpen, onClose, onSaved, supplier }: SupplierModalProps) {
  const { t } = useTranslation()
  const { user } = useAuthStore()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [phone2, setPhone2] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [taxNumber, setTaxNumber] = useState('')
  const [openingBalance, setOpeningBalance] = useState('')
  const [notes, setNotes] = useState('')
  const [isActive, setIsActive] = useState(true)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (supplier) {
      setName(supplier.name || '')
      setPhone(supplier.phone || '')
      setPhone2(supplier.phone2 || '')
      setWhatsapp(supplier.whatsapp || '')
      setEmail(supplier.email || '')
      setAddress(supplier.address || '')
      setTaxNumber(supplier.tax_number || '')
      setOpeningBalance('')
      setNotes(supplier.notes || '')
      setIsActive(supplier.is_active === 1)
    } else {
      setName('')
      setPhone('')
      setPhone2('')
      setWhatsapp('')
      setEmail('')
      setAddress('')
      setTaxNumber('')
      setOpeningBalance('0')
      setNotes('')
      setIsActive(true)
    }
    setError(null)
  }, [supplier, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError(t('suppliers.errorNameRequired', 'اسم المورد مطلوب'))
      return
    }

    setSaving(true)
    setError(null)

    try {
      if (supplier) {
        const updateInput: UpdateSupplierInput = {
          name: name.trim(),
          phone: phone.trim() || null,
          phone2: phone2.trim() || null,
          whatsapp: whatsapp.trim() || null,
          email: email.trim() || null,
          address: address.trim() || null,
          taxNumber: taxNumber.trim() || null,
          notes: notes.trim() || null,
          isActive,
        }
        await supplierService.updateSupplier(supplier.id, updateInput, user || undefined)
      } else {
        const createInput: CreateSupplierInput = {
          name: name.trim(),
          phone: phone.trim() || null,
          phone2: phone2.trim() || null,
          whatsapp: whatsapp.trim() || null,
          email: email.trim() || null,
          address: address.trim() || null,
          taxNumber: taxNumber.trim() || null,
          openingBalance: parseFloat(openingBalance) || 0,
          notes: notes.trim() || null,
          isActive,
        }
        await supplierService.createSupplier(createInput, user || undefined)
      }
      onSaved()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error saving supplier')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Truck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {supplier ? t('suppliers.editSupplier', 'تعديل بيانات المورد') : t('suppliers.addSupplier', 'إضافة مورد جديد')}
              </h2>
              <p className="text-xs text-muted-foreground">
                {supplier ? supplier.name : t('suppliers.modalSubtitle', 'تسجيل مورد جديد وبيانات الاتصال والتعامل')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center gap-2 text-rose-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold mb-1.5">
              {t('suppliers.name', 'اسم المورد / الشركة')} <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Al-Rowad Electronics / الفا إلكترونيكس"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5">
                {t('suppliers.phone', 'رقم الهاتف الأساسي')}
              </label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="010XXXXXXXX"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">
                {t('suppliers.whatsapp', 'رقم الواتساب')}
              </label>
              <input
                type="text"
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5">
                {t('suppliers.phone2', 'هاتف إضافي')}
              </label>
              <input
                type="text"
                value={phone2}
                onChange={e => setPhone2(e.target.value)}
                placeholder="هاتف أرضي أو بديل"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">
                {t('suppliers.email', 'البريد الإلكتروني')}
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="supplier@example.com"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5">
                {t('suppliers.taxNumber', 'الرقم الضريبي / السجل')}
              </label>
              <input
                type="text"
                value={taxNumber}
                onChange={e => setTaxNumber(e.target.value)}
                placeholder="123-456-789"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              />
            </div>
            {!supplier && (
              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  {t('suppliers.openingBalance', 'الرصيد الافتتاحي المستحق')}
                </label>
                <input
                  type="number"
                  step="any"
                  value={openingBalance}
                  onChange={e => setOpeningBalance(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary font-mono"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5">
              {t('suppliers.address', 'العنوان والمقر')}
            </label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="القاهرة - باب اللوق - عمارة الفلكي"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5">
              {t('suppliers.notes', 'ملاحظات إضافية')}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="شروط التوريد، مواعيد التسليم، الحساب البنكي..."
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="supplierActive"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary h-4 w-4"
            />
            <label htmlFor="supplierActive" className="text-sm font-medium cursor-pointer">
              {t('suppliers.activeStatus', 'مورد نشط (متاح لإنشاء فواتير شراء)')}
            </label>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/30">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors"
          >
            {t('common.cancel', 'إلغاء')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? t('common.saving', 'جاري الحفظ...') : t('common.save', 'حفظ البيانات')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

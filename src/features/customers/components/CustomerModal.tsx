import React, { useState, useEffect, useTransition } from 'react'
import { useTranslation } from 'react-i18next'
import { X, User, Save, AlertTriangle, Phone, Mail, MapPin, Tag, ShieldAlert } from 'lucide-react'
import {
  customerService,
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput,
  CustomerType,
  DuplicateCustomerMatch,
} from '@/services/customers'
import { useAuthStore } from '@/stores/authStore'

interface CustomerModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  customer?: Customer | null
}

const CUSTOMER_TYPES: Array<{ value: CustomerType; labelAr: string; labelEn: string }> = [
  { value: 'individual', labelAr: 'فرد / عميل عادي', labelEn: 'Individual' },
  { value: 'student', labelAr: 'طالب / مشروع تخرج', labelEn: 'Student' },
  { value: 'company', labelAr: 'شركة / ورشة عمل', labelEn: 'Company / Workshop' },
  { value: 'lab', labelAr: 'معمل أبحاث / جامعة', labelEn: 'Research Lab / University' },
  { value: 'vip', labelAr: 'عميل مميز (VIP)', labelEn: 'VIP Customer' },
]

export function CustomerModal({ isOpen, onClose, onSaved, customer }: CustomerModalProps) {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language !== 'en'
  const { user } = useAuthStore()

  const [name, setName] = useState('')
  const [customerCode, setCustomerCode] = useState('')
  const [phone, setPhone] = useState('')
  const [phone2, setPhone2] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [customerType, setCustomerType] = useState<CustomerType>('individual')
  const [creditLimit, setCreditLimit] = useState('')
  const [notes, setNotes] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateCustomerMatch | null>(null)
  const [ignoreDuplicateWarning, setIgnoreDuplicateWarning] = useState(false)

  // Initialize form state on open / edit
  useEffect(() => {
    if (customer) {
      setName(customer.name || '')
      setCustomerCode(customer.customer_code || '')
      setPhone(customer.phone || '')
      setPhone2(customer.phone2 || '')
      setWhatsapp(customer.whatsapp || '')
      setEmail(customer.email || '')
      setAddress(customer.address || '')
      setCustomerType(customer.customer_type || 'individual')
      setCreditLimit(customer.credit_limit ? String(customer.credit_limit) : '0')
      setNotes(customer.notes || '')
    } else {
      setName('')
      setCustomerCode('')
      setPhone('')
      setPhone2('')
      setWhatsapp('')
      setEmail('')
      setAddress('')
      setCustomerType('individual')
      setCreditLimit('0')
      setNotes('')
      // Pre-fetch next sequential customer code for display
      customerService.generateNextCustomerCode().then(code => {
        setCustomerCode(code)
      }).catch(console.error)
    }
    setError(null)
    setDuplicateWarning(null)
    setIgnoreDuplicateWarning(false)
  }, [customer, isOpen])

  // Duplicate detection debouncer
  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(async () => {
      if (phone.trim() || whatsapp.trim() || email.trim()) {
        try {
          const match = await customerService.checkDuplicate({
            phone: phone.trim() || null,
            whatsapp: whatsapp.trim() || null,
            email: email.trim() || null,
            customerCode: customerCode.trim() || null,
            excludeId: customer?.id,
          })
          if (match.isDuplicate) {
            setDuplicateWarning(match)
          } else {
            setDuplicateWarning(null)
          }
        } catch (err) {
          console.error('Duplicate check error:', err)
        }
      } else {
        setDuplicateWarning(null)
      }
    }, 350)

    return () => clearTimeout(timer)
  }, [phone, whatsapp, email, customerCode, customer, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError(t('customers.errorNameRequired', 'اسم العميل مطلوب'))
      return
    }

    // If duplicate found and not explicitly ignored
    if (duplicateWarning?.isDuplicate && !ignoreDuplicateWarning) {
      setError(
        isArabic
          ? `تنبيه تكرار: يوجد عميل مسجل بنفس ${
              duplicateWarning.matchedField === 'phone'
                ? 'رقم الهاتف'
                : duplicateWarning.matchedField === 'whatsapp'
                ? 'رقم الواتساب'
                : duplicateWarning.matchedField === 'email'
                ? 'البريد الإلكتروني'
                : 'كود العميل'
            } (${duplicateWarning.matchedCustomer?.name} - ${duplicateWarning.matchedCustomer?.customer_code}). يمكنك المتابعة إذا كان هذا مقصوداً.`
          : `Duplicate Warning: Customer with matching ${duplicateWarning.matchedField} exists (${duplicateWarning.matchedCustomer?.name} - ${duplicateWarning.matchedCustomer?.customer_code}).`
      )
      return
    }

    setSaving(true)
    setError(null)

    try {
      if (customer) {
        const updateInput: UpdateCustomerInput = {
          name: name.trim(),
          phone: phone.trim() || null,
          phone2: phone2.trim() || null,
          whatsapp: whatsapp.trim() || null,
          email: email.trim() || null,
          address: address.trim() || null,
          customer_type: customerType,
          credit_limit: parseFloat(creditLimit) || 0,
          notes: notes.trim() || null,
        }
        await customerService.updateCustomer(customer.id, updateInput, user || undefined)
      } else {
        const createInput: CreateCustomerInput = {
          customer_code: customerCode.trim() || undefined,
          name: name.trim(),
          phone: phone.trim() || null,
          phone2: phone2.trim() || null,
          whatsapp: whatsapp.trim() || null,
          email: email.trim() || null,
          address: address.trim() || null,
          customer_type: customerType,
          credit_limit: parseFloat(creditLimit) || 0,
          notes: notes.trim() || null,
        }
        await customerService.createCustomer(createInput, user || undefined)
      }
      onSaved()
      onClose()
    } catch (err: any) {
      setError(err.message || t('common.error', 'حدث خطأ أثناء حفظ البيانات'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {customer ? t('customers.editCustomer', 'تعديل بيانات العميل') : t('customers.addCustomer', 'إضافة عميل جديد')}
              </h2>
              <p className="text-xs text-muted-foreground">
                {customer ? customer.customer_code : t('customers.modalSubtitle', 'تسجيل ملف العميل، بيانات التواصل والحد الائتماني')}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="flex-1">
                <span>{error}</span>
                {duplicateWarning?.isDuplicate && !ignoreDuplicateWarning && (
                  <button
                    type="button"
                    onClick={() => {
                      setIgnoreDuplicateWarning(true)
                      setError(null)
                    }}
                    className="block mt-2 text-xs underline font-semibold hover:opacity-80"
                  >
                    {isArabic ? 'تخطي التحذير والمتابعة بالحفظ' : 'Ignore warning and proceed'}
                  </button>
                )}
              </div>
            </div>
          )}

          {duplicateWarning?.isDuplicate && !error && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>
                  {isArabic
                    ? `تنبيه: متطابق مع (${duplicateWarning.matchedCustomer?.name} - ${duplicateWarning.matchedCustomer?.customer_code})`
                    : `Match with (${duplicateWarning.matchedCustomer?.name} - ${duplicateWarning.matchedCustomer?.customer_code})`}
                </span>
              </div>
              <span className="text-[11px] font-mono bg-amber-500/20 px-1.5 py-0.5 rounded">
                {duplicateWarning.matchedField?.toUpperCase()}
              </span>
            </div>
          )}

          {/* Row 1: Name & Customer Code */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                {t('customers.name', 'اسم العميل')} <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t('customers.namePlaceholder', 'مثال: م. أحمد مصطفى / شركة إلكترونيات النصر')}
                className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                {t('customers.customerCode', 'كود العميل')}
              </label>
              <input
                type="text"
                value={customerCode}
                onChange={e => setCustomerCode(e.target.value)}
                placeholder="CUS-000001"
                disabled={!!customer}
                className="w-full px-3 py-2 bg-muted/40 border border-input rounded-lg text-sm font-mono text-muted-foreground focus:outline-none"
              />
            </div>
          </div>

          {/* Row 2: Customer Type & Credit Limit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                {t('customers.type', 'تصنيف العميل')}
              </label>
              <select
                value={customerType}
                onChange={e => setCustomerType(e.target.value as CustomerType)}
                className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {CUSTOMER_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {isArabic ? type.labelAr : type.labelEn}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                {t('customers.creditLimit', 'الحد الائتماني (ج.م)')}
              </label>
              <input
                type="number"
                min="0"
                step="50"
                value={creditLimit}
                onChange={e => setCreditLimit(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
              />
            </div>
          </div>

          {/* Row 3: Phones & WhatsApp */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{t('customers.phone', 'رقم الهاتف الأساسي')}</span>
              </label>
              <input
                type="tel"
                dir="ltr"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="01xxxxxxxxx"
                className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{t('customers.phone2', 'هاتف إضافي')}</span>
              </label>
              <input
                type="tel"
                dir="ltr"
                value={phone2}
                onChange={e => setPhone2(e.target.value)}
                placeholder="01xxxxxxxxx"
                className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1 text-emerald-500">
                <Phone className="w-3.5 h-3.5 text-emerald-500" />
                <span>{t('customers.whatsapp', 'واتساب')}</span>
              </label>
              <input
                type="tel"
                dir="ltr"
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value)}
                placeholder="01xxxxxxxxx"
                className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          {/* Row 4: Email & Address */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{t('customers.email', 'البريد الإلكتروني')}</span>
              </label>
              <input
                type="email"
                dir="ltr"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="customer@example.com"
                className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{t('customers.address', 'العنوان / المدينة')}</span>
              </label>
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder={t('customers.addressPlaceholder', 'مثال: القاهرة، مدينة نصر')}
                className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          {/* Row 5: Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {t('common.notes', 'ملاحظات')}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={t('customers.notesPlaceholder', 'أي تفاصيل إضافية عن العميل، خصومات خاصة، مشاريع سابقة...')}
              className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
            >
              {t('common.cancel', 'إلغاء')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? t('common.loading', 'جاري الحفظ...') : t('common.save', 'حفظ العميل')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

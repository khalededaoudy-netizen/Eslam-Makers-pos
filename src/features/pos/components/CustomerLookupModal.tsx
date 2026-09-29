/**
 * MAKERS POS — Customer Lookup & Fast Registration Modal
 * Opens before checkout/payment to identify returning customers by phone
 * or register new customers in 1 click without leaving the POS screen.
 */

import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Phone,
  User,
  UserPlus,
  CheckCircle2,
  X,
  Search,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Wallet,
  AlertCircle,
  Plus,
  UserCheck,
} from 'lucide-react'
import { customerService, Customer } from '@/services/customers'
import { CustomerSummary } from '@/stores/cartStore'
import { formatCurrency } from '@/lib/formatters'
import { useSettingsStore } from '@/stores/settingsStore'
import { useAuthStore } from '@/stores/authStore'

interface CustomerLookupModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirmCustomer: (customer: CustomerSummary | null) => void
  initialCustomer?: CustomerSummary | null
  mode?: 'checkout' | 'select'
}

export function CustomerLookupModal({
  isOpen,
  onClose,
  onConfirmCustomer,
  initialCustomer,
  mode = 'checkout',
}: CustomerLookupModalProps) {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language !== 'en'
  const { currencySymbol } = useSettingsStore()
  const { user } = useAuthStore()

  const phoneInputRef = useRef<HTMLInputElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // State
  const [phone, setPhone] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  // New Customer Form State
  const [newName, setNewName] = useState('')
  const [newPhone2, setNewPhone2] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Reset and initialize when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialCustomer?.phone) {
        setPhone(initialCustomer.phone)
      } else {
        setPhone('')
      }
      setSearchResults([])
      setSelectedCustomer(null)
      setNewName('')
      setNewPhone2('')
      setNewNotes('')
      setErrorMsg(null)
      setIsSaving(false)

      setTimeout(() => {
        phoneInputRef.current?.focus()
        phoneInputRef.current?.select()
      }, 100)
    }
  }, [isOpen, initialCustomer])

  // Debounced search by phone
  useEffect(() => {
    if (!isOpen) return

    const trimmed = phone.trim()
    if (!trimmed || trimmed.length < 3) {
      setSearchResults([])
      setSelectedCustomer(null)
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await customerService.searchByPhone(trimmed)
        setSearchResults(results)

        // Exact match auto-select
        const exactMatch = results.find(
          c => c.phone === trimmed || c.phone2 === trimmed || c.whatsapp === trimmed
        )
        if (exactMatch) {
          setSelectedCustomer(exactMatch)
        } else if (results.length === 1) {
          setSelectedCustomer(results[0])
        } else {
          setSelectedCustomer(null)
        }
      } catch (err: any) {
        console.error('Customer lookup error:', err)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [phone, isOpen])

  if (!isOpen) return null

  // Handlers
  const handleSelectAndProceed = (customer: Customer) => {
    onConfirmCustomer({
      id: customer.id,
      name: customer.name,
      customerCode: customer.customer_code,
      phone: customer.phone,
    })
  }

  const handleSkip = () => {
    onConfirmCustomer(null)
  }

  const handleSaveNewCustomer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmedName = newName.trim()
    if (!trimmedName) {
      setErrorMsg(t('customers.nameRequired', 'يرجى إدخال اسم العميل'))
      nameInputRef.current?.focus()
      return
    }

    setIsSaving(true)
    setErrorMsg(null)

    try {
      const created = await customerService.findOrCreateByPhone(
        {
          phone: phone.trim(),
          name: trimmedName,
          phone2: newPhone2.trim() || undefined,
          notes: newNotes.trim() || undefined,
        },
        user ? { id: user.id, fullName: user.fullName, role: user.roleName } : undefined
      )

      handleSelectAndProceed(created)
    } catch (err: any) {
      console.error('Failed to create customer:', err)
      setErrorMsg(err.message || t('common.systemError', 'حدث خطأ أثناء حفظ بيانات العميل'))
      setIsSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'Enter') {
      if (selectedCustomer) {
        e.preventDefault()
        handleSelectAndProceed(selectedCustomer)
      } else if (phone.trim().length >= 3 && searchResults.length === 0 && newName.trim()) {
        e.preventDefault()
        handleSaveNewCustomer()
      }
    }
  }

  const hasPhoneInput = phone.trim().length >= 3
  const isNotFound = hasPhoneInput && !isSearching && searchResults.length === 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in select-none"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                {t('pos.customerLookupTitle', 'بيانات العميل')}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t('pos.customerLookupSubtitle', 'البحث برقم الهاتف أو تسجيل عميل جديد قبل إتمام الفاتورة')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Phone Input Box */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-primary" />
              <span>{t('customers.phone', 'رقم الموبايل')}</span>
            </label>
            <div className="relative">
              <input
                ref={phoneInputRef}
                type="text"
                inputMode="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value)
                  setErrorMsg(null)
                }}
                placeholder={t('pos.enterPhonePlaceholder', 'أدخل رقم الموبايل (مثال: 01012345678)...')}
                className="w-full h-12 ps-10 pe-10 rounded-xl bg-input border border-border text-foreground font-mono text-base font-bold placeholder:text-muted-foreground placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
              />
              <Phone className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              {isSearching ? (
                <Loader2 className="absolute end-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
              ) : phone ? (
                <button
                  type="button"
                  onClick={() => {
                    setPhone('')
                    setSearchResults([])
                    setSelectedCustomer(null)
                    phoneInputRef.current?.focus()
                  }}
                  className="absolute end-3.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>
          </div>

          {/* State 1: Matching Customer Found */}
          {searchResults.length > 0 && (
            <div className="space-y-3 animate-fade-in">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>{t('pos.customerFound', 'تم العثور على بيانات العميل')}</span>
                {searchResults.length > 1 && (
                  <span className="text-[11px] font-normal">({searchResults.length} نتائج)</span>
                )}
              </p>

              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {searchResults.map((c) => {
                  const isSelected = selectedCustomer?.id === c.id
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCustomer(c)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'border-emerald-500/50 bg-emerald-500/10 shadow-sm ring-1 ring-emerald-500/30'
                          : 'border-border bg-card hover:bg-muted/40'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-foreground truncate">{c.name}</h4>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                            {c.customer_code}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono mt-1">
                          <span>{c.phone}</span>
                          {c.balance > 0 && (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold">
                              {t('customers.balance', 'الرصيد')}: {formatCurrency(c.balance, currencySymbol)}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSelectAndProceed(c)
                        }}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 transition-all shadow-sm active:scale-95"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{t('pos.useCustomer', 'استخدام هذا العميل')}</span>
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* State 2: Customer Not Found -> Quick Add Form */}
          {isNotFound && (
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-4 animate-fade-in">
              <div className="flex items-center gap-2 text-primary font-bold text-xs">
                <UserPlus className="w-4 h-4" />
                <span>{t('pos.newCustomerPrompt', 'رقم غير مسجل — تسجيل عميل جديد')}</span>
              </div>

              {errorMsg && (
                <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    {t('customers.name', 'اسم العميل')} <span className="text-destructive">*</span>
                  </label>
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={newName}
                    onChange={(e) => {
                      setNewName(e.target.value)
                      setErrorMsg(null)
                    }}
                    placeholder={t('customers.namePlaceholder', 'أدخل اسم العميل...')}
                    className="w-full h-10 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                      {t('customers.phone2', 'هاتف إضافي (اختياري)')}
                    </label>
                    <input
                      type="text"
                      inputMode="tel"
                      value={newPhone2}
                      onChange={(e) => setNewPhone2(e.target.value)}
                      placeholder="01xxxxxxxxx"
                      className="w-full h-9 px-3 rounded-lg bg-input border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                      {t('customers.notes', 'ملاحظات (اختياري)')}
                    </label>
                    <input
                      type="text"
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                      placeholder={t('customers.notesPlaceholder', 'أي تفاصيل إضافية...')}
                      className="w-full h-9 px-3 rounded-lg bg-input border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isSaving || !newName.trim()}
                  onClick={() => handleSaveNewCustomer()}
                  className="w-full h-10 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-md disabled:opacity-50 active:scale-95"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span>
                    {mode === 'checkout'
                      ? t('pos.saveAndContinue', 'حفظ ومتابعة إلى الدفع')
                      : t('pos.saveAndSelect', 'حفظ واختيار العميل')}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Initial Helper / Selected customer reminder */}
          {!hasPhoneInput && (
            <div className="p-4 rounded-xl border border-border/60 bg-muted/20 text-center space-y-1 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">
                {t('pos.lookupHint', 'اكتب رقم الموبايل للبحث الفوري أو تسجيل عميل جديد')}
              </p>
              <p className="text-[11px]">
                {t('pos.skipHint', 'أو اضغط "تخطي" لإجراء بيع نقدي مباشر بدون تسجيل عميل')}
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground font-semibold text-xs transition-colors"
          >
            {t('common.cancel', 'إلغاء')}
          </button>

          <button
            type="button"
            onClick={handleSkip}
            className="px-5 py-2.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground font-bold text-xs flex items-center gap-2 transition-all shadow-sm active:scale-95"
          >
            <span>
              {mode === 'checkout'
                ? t('pos.skipWalkIn', 'تخطي (بيع بدون عميل)')
                : t('pos.clearWalkIn', 'تحديد كعميل عابر / نقدي')}
            </span>
            {isAr ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  )
}

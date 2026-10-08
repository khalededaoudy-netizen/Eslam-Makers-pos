/**
 * MAKERS POS — Hold Cart Prompt Modal
 * Prompts for optional customer information (name, phone) and notes when holding an active cart.
 */

import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FolderOpen,
  User,
  Phone,
  FileText,
  X,
  Search,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import { customerService, Customer } from '@/services/customers'
import { formatCurrency } from '@/lib/formatters'

export interface HoldCartPromptResult {
  customerName?: string | null
  customerPhone?: string | null
  customerId?: string | null
  notes?: string | null
}

interface HoldCartPromptModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (data: HoldCartPromptResult) => void
  initialCustomerName?: string | null
  initialCustomerPhone?: string | null
  initialCustomerId?: string | null
  initialNotes?: string | null
  itemsCount: number
  totalAmount: number
  currencySymbol?: string
}

export function HoldCartPromptModal({
  isOpen,
  onClose,
  onConfirm,
  initialCustomerName = '',
  initialCustomerPhone = '',
  initialCustomerId = null,
  initialNotes = '',
  itemsCount,
  totalAmount,
  currencySymbol = 'ج.م',
}: HoldCartPromptModalProps) {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language !== 'en'

  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')

  // Customer search suggestions
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Customer[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)

  const nameInputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setCustomerName(initialCustomerName || '')
      setCustomerPhone(initialCustomerPhone || '')
      setCustomerId(initialCustomerId || null)
      setNotes(initialNotes || '')
      setSearchQuery('')
      setSearchResults([])
      setShowSuggestions(false)

      setTimeout(() => {
        if (!initialCustomerName && !initialCustomerPhone) {
          nameInputRef.current?.focus()
        }
      }, 100)
    }
  }, [isOpen, initialCustomerName, initialCustomerPhone, initialCustomerId, initialNotes])

  // Live customer search
  useEffect(() => {
    if (!isOpen || !searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const list = await customerService.getCustomers({
          search: searchQuery.trim(),
          limit: 5,
          status: 'active',
        })
        setSearchResults(list)
        setShowSuggestions(true)
      } catch (err) {
        console.error('Customer lookup error:', err)
      } finally {
        setIsSearching(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [searchQuery, isOpen])

  if (!isOpen) return null

  const handleSelectCustomer = (c: Customer) => {
    setCustomerId(c.id)
    setCustomerName(c.name)
    setCustomerPhone(c.phone || c.phone2 || c.whatsapp || '')
    setShowSuggestions(false)
    setSearchQuery('')
  }

  const handleClearSelectedCustomer = () => {
    setCustomerId(null)
    setCustomerName('')
    setCustomerPhone('')
  }

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    onConfirm({
      customerName: customerName.trim() || null,
      customerPhone: customerPhone.trim() || null,
      customerId: customerId || null,
      notes: notes.trim() || null,
    })
  }

  const handleHoldWithoutCustomer = () => {
    onConfirm({
      customerName: null,
      customerPhone: null,
      customerId: null,
      notes: notes.trim() || null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                {t('pos.holdCartTitle', 'تعليق الفاتورة (حفظ مؤقت)')}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t('pos.holdCartSubtitle', 'إضافة بيانات العميل اختيارية لتسهيل العثور على الفاتورة لاحقاً')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Invoice Summary Pill */}
        <div className="px-6 py-3 bg-primary/5 border-b border-primary/10 flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2 text-foreground">
            <span className="text-muted-foreground">{t('pos.cartItems', 'محتويات الفاتورة')}:</span>
            <span className="font-bold bg-card border border-border px-2 py-0.5 rounded-md">
              {itemsCount} {isArabic ? 'أصناف' : 'items'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{t('pos.cartTotal', 'الإجمالي')}:</span>
            <span className="font-mono font-bold text-primary text-sm">
              {formatCurrency(totalAmount, currencySymbol)}
            </span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Quick Search Existing Customers */}
          <div className="relative">
            <label className="flex items-center justify-between text-xs font-semibold text-muted-foreground mb-1.5">
              <span className="flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5" />
                <span>{t('pos.searchExistingCustomer', 'بحث عن عميل مسجل (اختياري)')}</span>
              </span>
              {customerId && (
                <button
                  type="button"
                  onClick={handleClearSelectedCustomer}
                  className="text-[11px] text-destructive hover:underline cursor-pointer"
                >
                  {t('common.clear', 'إلغاء التحديد')}
                </button>
              )}
            </label>
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (searchResults.length > 0) setShowSuggestions(true)
                }}
                placeholder={t('pos.searchCustomerPlaceholder', 'ابحث بالاسم أو رقم الهاتف...')}
                className="w-full h-10 px-3.5 text-xs rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              {isSearching && (
                <div className="absolute end-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Suggestions Dropdown */}
            {showSuggestions && searchResults.length > 0 && (
              <div className="absolute z-20 start-0 end-0 mt-1.5 bg-card border border-border rounded-xl shadow-xl overflow-hidden divide-y divide-border/60 max-h-48 overflow-y-auto">
                {searchResults.map((cust) => (
                  <button
                    key={cust.id}
                    type="button"
                    onClick={() => handleSelectCustomer(cust)}
                    className="w-full px-3.5 py-2.5 text-start hover:bg-primary/10 transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-primary" />
                        <span>{cust.name}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {cust.phone || cust.phone2 || cust.customer_code || '—'}
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                      {t('pos.select', 'اختيار')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Customer Name Input */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-1.5">
              <User className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{t('pos.customerName', 'اسم العميل')}</span>
              <span className="text-[11px] text-muted-foreground font-normal">
                ({t('common.optional', 'اختياري')})
              </span>
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={t('pos.customerNamePlaceholder', 'مثال: محمد أحمد')}
              className="w-full h-10 px-3.5 text-xs rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Customer Phone Input */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-1.5">
              <Phone className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{t('pos.customerPhone', 'رقم الهاتف')}</span>
              <span className="text-[11px] text-muted-foreground font-normal">
                ({t('common.optional', 'اختياري')})
              </span>
            </label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="01xxxxxxxxx"
              dir="ltr"
              className="w-full h-10 px-3.5 text-xs rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-start font-mono"
            />
          </div>

          {/* Notes Input */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-1.5">
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{t('pos.notes', 'ملاحظات')}</span>
              <span className="text-[11px] text-muted-foreground font-normal">
                ({t('common.optional', 'اختياري')})
              </span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('pos.notesPlaceholder', 'مثال: العميل راجع بعد نصف ساعة، أو سيحضر بطاقة الدفع...')}
              className="w-full p-3 text-xs rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
            <button
              type="submit"
              className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <FolderOpen className="w-4 h-4" />
              <span>{t('pos.confirmHoldCart', 'تعليق الفاتورة')}</span>
            </button>

            {!customerName.trim() && !customerPhone.trim() && (
              <button
                type="button"
                onClick={handleHoldWithoutCustomer}
                className="h-10 px-3 rounded-xl border border-border bg-muted/60 text-foreground font-semibold text-xs hover:bg-muted transition-colors cursor-pointer"
                title={t('pos.holdAnonymousHelp', 'تعليق فوري بدون تسجيل اسم العميل')}
              >
                <span>{t('pos.holdAnonymous', 'تعليق سريع (بدون عميل)')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-xl border border-border text-muted-foreground font-semibold text-xs hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            >
              {t('common.cancel', 'إلغاء')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

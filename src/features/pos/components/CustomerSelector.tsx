/**
 * MAKERS POS — Enhanced Customer Selector & Quick Customer Creator
 * Supports fast customer search, real-time phone auto-lookup with credit balance display,
 * duplicate warnings, and instant in-POS customer creation without leaving the screen.
 */

import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  User,
  Search,
  X,
  Check,
  Phone,
  DollarSign,
  Plus,
  UserPlus,
  AlertCircle,
  CreditCard,
  CheckCircle2,
  Loader2,
  Users,
} from 'lucide-react'
import { customerService, CustomerListItem, CreateCustomerInput } from '@/services/customers'
import { CustomerSummary } from '@/stores/cartStore'
import { formatCurrency } from '@/lib/formatters'
import { useSettingsStore } from '@/stores/settingsStore'
import { useAuthStore } from '@/stores/authStore'

interface CustomerSelectorProps {
  selectedCustomer: CustomerSummary | null
  onSelectCustomer: (customer: CustomerSummary | null) => void
  onOpenLookup?: () => void
}

export function CustomerSelector({
  selectedCustomer,
  onSelectCustomer,
  onOpenLookup,
}: CustomerSelectorProps) {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language !== 'en'
  const { currencySymbol } = useSettingsStore()
  const { user } = useAuthStore()

  const [isOpen, setIsOpen] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [customers, setCustomers] = useState<CustomerListItem[]>([])
  const [loading, setLoading] = useState(false)

  // Real-time Phone Lookup State
  const [phoneLookupResult, setPhoneLookupResult] = useState<CustomerListItem[] | null>(null)

  // Quick Customer Creation Form State
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [creatingCustomer, setCreatingCustomer] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Live Customer Search & Phone Auto-Lookup
  useEffect(() => {
    if (!isOpen) return

    const trimmed = search.trim()
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const list = await customerService.getCustomers({
          search: trimmed,
          status: 'active',
          limit: 20,
        })
        setCustomers(list)

        // Check if search query looks like a mobile phone number (digits only, >= 6 digits)
        if (/^\d{6,}$/.test(trimmed)) {
          const matchedByPhone = list.filter((c) => c.phone && c.phone.includes(trimmed))
          if (matchedByPhone.length > 0) {
            setPhoneLookupResult(matchedByPhone)
          } else {
            setPhoneLookupResult(null)
          }
        } else {
          setPhoneLookupResult(null)
        }
      } catch (err) {
        console.error('Failed to load customers for POS:', err)
      } finally {
        setLoading(false)
      }
    }, 180)

    return () => clearTimeout(timer)
  }, [search, isOpen])

  const handleSelect = (c: CustomerListItem) => {
    onSelectCustomer({
      id: c.id,
      name: c.name,
      customerCode: c.customer_code,
      phone: c.phone,
    })
    setIsOpen(false)
    setSearch('')
    setPhoneLookupResult(null)
  }

  const handleClear = () => {
    onSelectCustomer(null)
  }

  // Quick Customer Create Handler
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) {
      setCreateError(isAr ? 'اسم العميل مطلوب' : 'Customer name is required')
      return
    }

    setCreatingCustomer(true)
    setCreateError(null)
    try {
      const created = await customerService.createCustomer(
        {
          name: newName.trim(),
          phone: newPhone.trim() || undefined,
          email: newEmail.trim() || undefined,
          address: newAddress.trim() || undefined,
          notes: newNotes.trim() || undefined,
        },
        { id: user?.id || 'admin', fullName: user?.fullName || 'Cashier' }
      )

      // Auto-select newly created customer directly in cart
      onSelectCustomer({
        id: created.id,
        name: created.name,
        customerCode: created.customer_code,
        phone: created.phone,
      })

      // Reset form and close dialogs
      setIsCreateOpen(false)
      setIsOpen(false)
      setNewName('')
      setNewPhone('')
      setNewEmail('')
      setNewAddress('')
      setNewNotes('')
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create customer')
    } finally {
      setCreatingCustomer(false)
    }
  }

  return (
    <div className="relative">
      {/* Selector Trigger Card */}
      <div className="p-3 bg-card border border-border rounded-xl flex items-center justify-between gap-2 shadow-sm">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
              {t('pos.customer', 'العميل')}
            </div>
            {selectedCustomer ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-xs text-foreground truncate">
                  {selectedCustomer.name}
                </span>
                {selectedCustomer.customerCode && (
                  <span className="text-[10px] font-mono bg-primary/15 text-primary px-1 py-0.2 rounded">
                    {selectedCustomer.customerCode}
                  </span>
                )}
                {selectedCustomer.phone && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    ({selectedCustomer.phone})
                  </span>
                )}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground font-medium">
                {t('pos.walkIn', 'عميل عابر / نقدي')}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {selectedCustomer && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title={t('common.cancel', 'إلغاء اختيار العميل')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (onOpenLookup) {
                onOpenLookup()
              } else {
                setIsOpen(true)
              }
            }}
            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors border border-border"
          >
            {selectedCustomer ? t('common.edit', 'تغيير') : t('pos.selectCustomer', 'اختيار عميل')}
          </button>
        </div>
      </div>

      {/* Main Customer Search & Selection Modal */}
      {isOpen && !isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[82vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/40 shrink-0">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  {t('pos.selectCustomer', 'اختيار عميل الفاتورة')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false)
                  setPhoneLookupResult(null)
                }}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input & Quick Add Action */}
            <div className="p-3 border-b border-border space-y-2 bg-muted/10 shrink-0">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('customers.searchPlaceholder', 'بحث بالاسم، رقم الموبايل، كود العميل...')}
                    className="w-full ps-9 pe-4 py-2 bg-input border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    autoFocus
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setNewPhone(/^\d+$/.test(search.trim()) ? search.trim() : '')
                    setIsCreateOpen(true)
                  }}
                  className="flex items-center gap-1 px-3 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:bg-primary/90 transition-all shrink-0 shadow-sm"
                  title={isAr ? 'إضافة عميل جديد فوراً' : 'Quick add customer'}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{isAr ? '+ عميل جديد' : '+ New Customer'}</span>
                </button>
              </div>
            </div>

            {/* Real-time Phone Lookup Highlight Card */}
            {phoneLookupResult && phoneLookupResult.length > 0 && (
              <div className="px-3 py-2 bg-primary/10 border-b border-primary/20 shrink-0">
                <div className="text-[11px] font-bold text-primary mb-1.5 flex items-center justify-between">
                  <span>{isAr ? 'تم العثور على عميل مسجل بهذا الرقم:' : 'Customer found matching phone:'}</span>
                  {phoneLookupResult.length > 1 && (
                    <span className="text-amber-500 font-normal">
                      {isAr ? `(يوجد ${phoneLookupResult.length} عملاء بنفس الرقم)` : `(${phoneLookupResult.length} duplicates)`}
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  {phoneLookupResult.map((match) => (
                    <div
                      key={match.id}
                      className="p-2 bg-card rounded-lg border border-primary/30 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-bold text-foreground">{match.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {match.phone} {match.customer_code ? `| Code: ${match.customer_code}` : ''}
                        </p>
                        <p className="text-[10px] font-semibold text-emerald-600 mt-0.5">
                          {isAr ? 'الرصيد المستحق / الآجل: ' : 'Balance: '}
                          <span className="font-mono font-bold">{formatCurrency(match.balance ?? (match as any).current_balance ?? 0, currencySymbol)}</span>
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelect(match)}
                        className="px-3 py-1.5 bg-primary text-primary-foreground font-bold text-xs rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
                      >
                        {isAr ? 'اختيار العميل' : 'Select Customer'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Customers List */}
            <div className="flex-1 overflow-y-auto p-2 divide-y divide-border/60">
              {/* Option 1: Walk-In / Cash Customer */}
              <button
                type="button"
                onClick={() => {
                  onSelectCustomer(null)
                  setIsOpen(false)
                }}
                className="w-full text-start p-2.5 rounded-xl hover:bg-muted/60 transition-colors flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{t('pos.walkIn', 'عميل عابر / نقدي')}</p>
                    <p className="text-[10px] text-muted-foreground">{isAr ? 'بدون تسجيل حساب أو رصيد آجل' : 'Standard Cash Customer'}</p>
                  </div>
                </div>
                {!selectedCustomer && <Check className="w-4 h-4 text-primary" />}
              </button>

              {loading ? (
                <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span>{isAr ? 'جاري البحث...' : 'Searching...'}</span>
                </div>
              ) : customers.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground space-y-2">
                  <p>{isAr ? 'لا توجد نتائج مطابقة للبحث' : 'No matching customers found'}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setNewName(search)
                      setIsCreateOpen(true)
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg font-semibold hover:bg-primary/20 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isAr ? `إضافة "${search}" كعميل جديد` : `Add "${search}" as new customer`}</span>
                  </button>
                </div>
              ) : (
                customers.map((c) => {
                  const isSelected = selectedCustomer?.id === c.id
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelect(c)}
                      className={`w-full text-start p-2.5 rounded-xl transition-colors flex items-center justify-between text-xs ${
                        isSelected ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-muted/60 text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                          <User className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{c.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {c.phone || (isAr ? 'لا يوجد هاتف' : 'No Phone')}
                            {c.customer_code ? ` | ${c.customer_code}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="text-end shrink-0 ps-2">
                        {Boolean(c.balance || (c as any).current_balance) && (
                          <p className="text-[10px] font-mono font-bold text-amber-600">
                            {formatCurrency(c.balance ?? (c as any).current_balance ?? 0, currencySymbol)}
                          </p>
                        )}
                        {isSelected && <Check className="w-4 h-4 text-primary ms-auto" />}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Customer Creation Modal (In-POS) */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-muted/40">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  {isAr ? 'إضافة عميل جديد وسريع' : 'Quick Add Customer'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="p-5 space-y-3.5 text-xs">
              {createError && (
                <div className="p-2.5 bg-destructive/10 text-destructive border border-destructive/20 rounded-xl text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <div>
                <label className="text-muted-foreground block mb-1 font-semibold">
                  {isAr ? 'اسم العميل *' : 'Customer Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={isAr ? 'مثال: م. أحمد سامي' : 'e.g. John Doe'}
                  className="w-full h-9 px-3 rounded-xl bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-muted-foreground block mb-1 font-semibold">
                  {isAr ? 'رقم الموبايل / الهاتف' : 'Phone / Mobile'}
                </label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="010xxxxxxxx"
                  className="w-full h-9 px-3 rounded-xl bg-input border border-border font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="text-muted-foreground block mb-1">
                  {isAr ? 'البريد الإلكتروني (اختياري)' : 'Email (Optional)'}
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="customer@example.com"
                  className="w-full h-9 px-3 rounded-xl bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="text-muted-foreground block mb-1">
                  {isAr ? 'العنوان / ملاحظات' : 'Address / Notes'}
                </label>
                <input
                  type="text"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder={isAr ? 'العنوان أو الشركة...' : 'Address or notes...'}
                  className="w-full h-9 px-3 rounded-xl bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold"
                >
                  {t('common.cancel', 'إلغاء')}
                </button>
                <button
                  type="submit"
                  disabled={creatingCustomer}
                  className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {creatingCustomer ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{isAr ? 'جاري الحفظ...' : 'Saving...'}</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{isAr ? 'حفظ واختيار العميل' : 'Save & Select'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

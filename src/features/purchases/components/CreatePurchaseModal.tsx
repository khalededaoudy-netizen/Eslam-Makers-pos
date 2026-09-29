import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, ShoppingBag, Plus, Trash2, Search, AlertCircle, Save, CheckCircle2, ArrowRight } from 'lucide-react'
import { purchaseService, CreatePurchaseInput, PurchaseItemInput } from '@/services/purchases'
import { supplierService, SupplierItem } from '@/services/suppliers'
import { inventoryService, StorageLocation } from '@/services/inventory'
import { productService, ProductListItem } from '@/services/products/productService'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency } from '@/lib/formatters'

interface CreatePurchaseModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: (purchaseId: string) => void
}

interface DraftItem {
  productId: string
  productName: string
  productSku: string
  unitSymbol: string
  quantity: number
  unitCost: number
  subtotal: number
}

export function CreatePurchaseModal({ isOpen, onClose, onSaved }: CreatePurchaseModalProps) {
  const { t } = useTranslation()
  const { user } = useAuthStore()

  const [suppliers, setSuppliers] = useState<SupplierItem[]>([])
  const [locations, setLocations] = useState<StorageLocation[]>([])
  const [allProducts, setAllProducts] = useState<ProductListItem[]>([])

  // Form Header State
  const [supplierId, setSupplierId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [invoiceRef, setInvoiceRef] = useState('')
  const [purchasedAt, setPurchasedAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [discountAmount, setDiscountAmount] = useState('0')
  const [taxAmount, setTaxAmount] = useState('0')

  // Items State
  const [items, setItems] = useState<DraftItem[]>([])

  // Product Search for adding items
  const [productSearch, setProductSearch] = useState('')
  const [searchResults, setSearchResults] = useState<ProductListItem[]>([])
  const [isSearchingProducts, setIsSearchingProducts] = useState(false)

  // Options State
  const [receiveImmediately, setReceiveImmediately] = useState(false)
  const [initialPayment, setInitialPayment] = useState('0')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    // Load suppliers, storage locations, and active products
    supplierService.getSuppliers({ activeOnly: true }).then(setSuppliers)
    inventoryService.getStorageLocations().then(locs => {
      setLocations(locs)
      if (locs.length > 0) setLocationId(locs[0].id)
    })
    productService.getProducts({ activeOnly: true, limit: 500 }).then(setAllProducts)

    // Reset Form
    setSupplierId('')
    setInvoiceRef('')
    setPurchasedAt(new Date().toISOString().slice(0, 10))
    setNotes('')
    setDiscountAmount('0')
    setTaxAmount('0')
    setItems([])
    setReceiveImmediately(false)
    setInitialPayment('0')
    setError(null)
  }, [isOpen])

  // Search products when typing in quick search
  useEffect(() => {
    if (productSearch.trim().length >= 2) {
      const q = productSearch.toLowerCase().trim()
      const filtered = allProducts.filter(p =>
        p.name_ar.toLowerCase().includes(q) ||
        p.name_en.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.primary_barcode && p.primary_barcode.toLowerCase().includes(q))
      ).slice(0, 10)
      setSearchResults(filtered)
    } else {
      setSearchResults([])
    }
  }, [productSearch, allProducts])

  if (!isOpen) return null

  const handleAddProductToDraft = (product: ProductListItem) => {
    // Check if already in items
    const existingIndex = items.findIndex(it => it.productId === product.id)
    if (existingIndex >= 0) {
      // Increment quantity
      const updated = [...items]
      updated[existingIndex].quantity += 1
      updated[existingIndex].subtotal = updated[existingIndex].quantity * updated[existingIndex].unitCost
      setItems(updated)
    } else {
      const unitCost = Number(product.purchase_price) || 0
      setItems(prev => [
        ...prev,
        {
          productId: product.id,
          productName: product.name_ar || product.name_en,
          productSku: product.sku,
          unitSymbol: product.unit_symbol || 'pcs',
          quantity: 1,
          unitCost,
          subtotal: unitCost,
        }
      ])
    }
    setProductSearch('')
    setSearchResults([])
  }

  const handleUpdateItem = (index: number, field: 'quantity' | 'unitCost', value: number) => {
    const updated = [...items]
    const item = { ...updated[index] }
    if (field === 'quantity') item.quantity = Math.max(0.001, value)
    if (field === 'unitCost') item.unitCost = Math.max(0, value)
    item.subtotal = item.quantity * item.unitCost
    updated[index] = item
    setItems(updated)
  }

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  // Calculate Totals
  const subtotal = items.reduce((acc, it) => acc + it.subtotal, 0)
  const discount = Math.max(0, parseFloat(discountAmount) || 0)
  const tax = Math.max(0, parseFloat(taxAmount) || 0)
  const grandTotal = Math.max(0, subtotal - discount + tax)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supplierId) {
      setError(t('purchases.errorSupplierRequired', 'يرجى اختيار المورد أولاً'))
      return
    }

    if (items.length === 0) {
      setError(t('purchases.errorItemsRequired', 'يجب إضافة صنف واحد على الأقل لفاتورة الشراء'))
      return
    }

    if (receiveImmediately && !locationId) {
      setError(t('purchases.errorLocationRequired', 'يرجى تحديد مكان التخزين للاستلام الفوري'))
      return
    }

    setSaving(true)
    setError(null)

    try {
      const payload: CreatePurchaseInput = {
        supplierId,
        locationId: locationId || null,
        invoiceRef: invoiceRef.trim() || null,
        purchasedAt,
        discountAmount: discount,
        taxAmount: tax,
        notes: notes.trim() || null,
        receiveImmediately,
        initialPayment: parseFloat(initialPayment) || 0,
        initialPaymentMethod: paymentMethod,
        items: items.map(it => ({
          productId: it.productId,
          quantity: it.quantity,
          unitCost: it.unitCost,
        })),
      }

      const res = await purchaseService.createPurchase(payload, user || undefined)
      onSaved(res.purchaseId)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error creating purchase invoice')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {t('purchases.createPurchase', 'فاتورة شراء جديدة (توريد مخزني)')}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t('purchases.createSubtitle', 'إدخال مشتريات من مورد محلي أو خارجي وتحديث الأرصدة والتكلفة')}
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center gap-2 text-rose-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Invoice Header Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-muted/20 border border-border">
            <div>
              <label className="block text-xs font-semibold mb-1.5">
                {t('purchases.supplier', 'المورد')} <span className="text-rose-400">*</span>
              </label>
              <select
                required
                value={supplierId}
                onChange={e => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              >
                <option value="">{t('purchases.selectSupplier', '-- اختر المورد --')}</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name} (رصيد: {s.balance} ج.م)</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5">
                {t('purchases.location', 'مكان الاستلام والتخزين')}
              </label>
              <select
                value={locationId}
                onChange={e => setLocationId(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              >
                <option value="">{t('purchases.selectLocation', '-- اختر المستودع / المكان --')}</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name_ar || loc.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5">
                {t('purchases.invoiceRef', 'رقم فاتورة المورد (Ref)')}
              </label>
              <input
                type="text"
                value={invoiceRef}
                onChange={e => setInvoiceRef(e.target.value)}
                placeholder="INV-SUPP-9921"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5">
                {t('purchases.purchaseDate', 'تاريخ الفاتورة')}
              </label>
              <input
                type="date"
                value={purchasedAt}
                onChange={e => setPurchasedAt(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary font-mono"
              />
            </div>
          </div>

          {/* Product Quick Search Bar */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold">
              {t('purchases.searchProductsToAdd', 'إضافة أصناف للفاتورة (بحث بالاسم، الكود SKU، أو الباركود)')}
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                placeholder="ابحث عن صنف لإضافته مباشرة للفاتورة..."
                className="w-full pr-9 pl-3 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary shadow-sm"
              />

              {/* Autocomplete Dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-20 overflow-hidden divide-y divide-border/50 max-h-60 overflow-y-auto">
                  {searchResults.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleAddProductToDraft(p)}
                      className="w-full px-4 py-2.5 text-right hover:bg-muted/50 flex items-center justify-between text-sm transition-colors"
                    >
                      <div>
                        <div className="font-semibold text-foreground">{p.name_ar || p.name_en}</div>
                        <div className="text-xs text-muted-foreground font-mono">SKU: {p.sku} | Barcode: {p.primary_barcode || '—'}</div>
                      </div>
                      <div className="text-left font-mono">
                        <span className="text-xs text-muted-foreground block">سعر التكلفة:</span>
                        <span className="font-bold text-primary">{formatCurrency(p.purchase_price)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm text-right">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b border-border">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">الصنف / الكود</th>
                  <th className="px-4 py-3 w-28">الكمية المطلوبة</th>
                  <th className="px-4 py-3 w-32">سعر الشراء (للوحدة)</th>
                  <th className="px-4 py-3 w-32">الإجمالي</th>
                  <th className="px-4 py-3 w-12 text-center">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground text-sm">
                      لم تتم إضافة أي أصناف بعد. ابحث بالأعلى لإضافة منتجات إلى الفاتورة.
                    </td>
                  </tr>
                ) : (
                  items.map((it, idx) => (
                    <tr key={it.productId} className="hover:bg-muted/30">
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{idx + 1}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-bold text-foreground">{it.productName}</div>
                        <div className="text-xs font-mono text-muted-foreground">{it.productSku}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="number"
                          step="any"
                          min="0.001"
                          value={it.quantity}
                          onChange={e => handleUpdateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 bg-background border border-border rounded text-center font-mono text-sm focus:outline-none focus:border-primary"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={it.unitCost}
                          onChange={e => handleUpdateItem(idx, 'unitCost', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 bg-background border border-border rounded text-center font-mono text-sm focus:outline-none focus:border-primary text-primary font-bold"
                        />
                      </td>
                      <td className="px-4 py-2.5 font-mono font-bold">
                        {formatCurrency(it.subtotal)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 rounded text-muted-foreground hover:text-rose-400 hover:bg-muted transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Grid: Options & Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Options & Immediate Receiving */}
            <div className="space-y-4 p-4 rounded-xl bg-muted/20 border border-border">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <span>خيارات الاستلام والسداد</span>
              </h3>

              <div className="p-3 bg-background border border-border rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="receiveImmediately"
                    checked={receiveImmediately}
                    onChange={e => setReceiveImmediately(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                  />
                  <label htmlFor="receiveImmediately" className="text-sm font-semibold cursor-pointer">
                    {t('purchases.receiveImmediately', 'استلام الأصناف بالمخزون فوراً (Direct Stock In)')}
                  </label>
                </div>
                <p className="text-xs text-muted-foreground pr-6">
                  عند التفعيل، سيتم تحديث رصيد المخزون في المكان المحدد مباشرة وتسجيل حركة الشراء فور الحفظ.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    {t('purchases.initialPayment', 'دفعة مسددة فورية')}
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max={grandTotal}
                    value={initialPayment}
                    onChange={e => setInitialPayment(e.target.value)}
                    className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-sm font-mono focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    {t('purchases.paymentMethod', 'طريقة الدفع')}
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
                  >
                    <option value="cash">نقداً (Cash)</option>
                    <option value="card">بطاقة (Card)</option>
                    <option value="transfer">تحويل بنكي (Transfer)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  {t('purchases.notes', 'ملاحظات الفاتورة')}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="شروط السداد، رقم الشحنة، تفاصيل إضافية..."
                  className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Calculations & Totals */}
            <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-3 flex flex-col justify-between">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('purchases.subtotal', 'المجموع الفرعي')}:</span>
                  <span className="font-mono font-bold">{formatCurrency(subtotal)}</span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t('purchases.discount', 'الخصم المكتسب')}:</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={discountAmount}
                    onChange={e => setDiscountAmount(e.target.value)}
                    className="w-28 px-2 py-1 bg-background border border-border rounded text-right font-mono text-sm focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t('purchases.tax', 'الضريبة / الرسوم')}:</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={taxAmount}
                    onChange={e => setTaxAmount(e.target.value)}
                    className="w-28 px-2 py-1 bg-background border border-border rounded text-right font-mono text-sm focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="border-t border-border pt-2 flex items-center justify-between text-base">
                  <span className="font-bold">{t('purchases.grandTotal', 'إجمالي الفاتورة')}:</span>
                  <span className="font-mono font-extrabold text-xl text-primary">{formatCurrency(grandTotal)}</span>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-muted-foreground">{t('purchases.paidAmount', 'المدفوع حالياً')}:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {formatCurrency(parseFloat(initialPayment) || 0)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{t('purchases.remainingBalance', 'المتبقي كدين للمورد')}:</span>
                  <span className="font-mono font-bold text-amber-400">
                    {formatCurrency(Math.max(0, grandTotal - (parseFloat(initialPayment) || 0)))}
                  </span>
                </div>
              </div>
            </div>
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
            disabled={saving || items.length === 0}
            className="px-5 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? t('common.saving', 'جاري الحفظ والتسجيل...') : t('purchases.saveInvoice', 'حفظ وإصدار الفاتورة')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * MAKERS POS — Redesigned High-Velocity POS Register
 * Features Category Navigation tabs, responsive live Product Grid, 1-click cart operations,
 * barcode scanner auto-add, instant customer lookup/creation, and split payment checkout.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  X,
  User,
  AlertTriangle,
  Clock,
  RotateCcw,
  CheckCircle2,
  FolderOpen,
  Keyboard,
  Store,
  Layers,
  ShieldAlert,
  Package,
  Scan,
  Grid,
  Tag,
  Loader2,
} from 'lucide-react'
import { useCartStore, CustomerSummary } from '@/stores/cartStore'
import { useAuthStore, usePermission } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { posService } from './posService'
import { PosProduct, PosCartSummary, HeldCart, PosShiftInfo } from './types'
import { productService, CategoryItem } from '@/services/products/productService'
import { BarcodeInput } from './components/BarcodeInput'
import { Cart } from './components/Cart'
import { CustomerSelector } from './components/CustomerSelector'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { CartSummary } from './components/CartSummary'
import { HeldCartsModal } from './components/HeldCartsModal'
import { CheckoutModal } from '@/features/sales/components/CheckoutModal'
import { ReceiptModal } from '@/features/sales/components/ReceiptModal'
import { salesService } from '@/features/sales/salesService'
import { ReceiptData, CreateSalePaymentInput } from '@/features/sales/types'
import { formatCurrency } from '@/lib/formatters'

export function PosPage() {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language !== 'en'
  const { user } = useAuthStore()
  const { can, isAdmin } = usePermission()
  const { taxEnabled, taxRate, currencySymbol } = useSettingsStore()

  const cart = useCartStore()

  // POS State
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [gridProducts, setGridProducts] = useState<PosProduct[]>([])
  const [loadingGrid, setLoadingGrid] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [shiftInfo, setShiftInfo] = useState<PosShiftInfo>({ isOpen: true })
  const [checkingShift, setCheckingShift] = useState(true)

  // Held Carts & Checkout
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([])
  const [isHeldModalOpen, setIsHeldModalOpen] = useState(false)
  const [stockNotice, setStockNotice] = useState<string | null>(null)
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false)
  const [activeReceipt, setActiveReceipt] = useState<ReceiptData | null>(null)
  const [receiptModalOpen, setReceiptModalOpen] = useState(false)
  const [resumeConfirmTarget, setResumeConfirmTarget] = useState<HeldCart | null>(null)

  const searchInputRef = useRef<HTMLInputElement>(null)

  // RBAC Permissions
  const canAccess = isAdmin || can('access', 'pos')
  const canDiscount = isAdmin || can('discount', 'pos')
  const canHold = isAdmin || can('hold', 'pos')

  // Sync tax config with cartStore
  useEffect(() => {
    cart.setTaxConfig(taxEnabled, taxRate)
  }, [taxEnabled, taxRate])

  // Check active shift & load held carts on mount
  const refreshShiftAndHeld = useCallback(async () => {
    try {
      const shift = await posService.getActiveShift(user?.id)
      setShiftInfo(shift)
      const list = await posService.getHeldCarts()
      setHeldCarts(list)
    } catch (err) {
      console.error('POS initialization error:', err)
    } finally {
      setCheckingShift(false)
    }
  }, [user?.id])

  // Load Categories
  useEffect(() => {
    async function loadCategories() {
      try {
        const cats = await productService.getCategories()
        setCategories(cats)
      } catch (err) {
        console.error('Failed to load categories for POS:', err)
      }
    }
    loadCategories()
    refreshShiftAndHeld()
  }, [refreshShiftAndHeld])

  // Load Products for Grid (Filtered by Category or Search Query)
  const loadGridProducts = useCallback(async (catId?: string, query?: string) => {
    setLoadingGrid(true)
    try {
      if (query && query.trim().length >= 2) {
        const results = await posService.searchProducts(query.trim(), 40)
        setGridProducts(results)
      } else {
        const results = await posService.getProductsByCategory(catId || undefined, 60)
        setGridProducts(results)
      }
    } catch (err) {
      console.error('Failed to load products for POS grid:', err)
    } finally {
      setLoadingGrid(false)
    }
  }, [])

  useEffect(() => {
    loadGridProducts(selectedCategory, searchQuery)
  }, [selectedCategory, searchQuery, loadGridProducts])

  // Keyboard Shortcuts (F2 -> Focus Search, Escape -> Clear Search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
      if (e.key === 'Escape') {
        if (searchQuery) {
          setSearchQuery('')
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [searchQuery])

  // Add Product to Cart Handler
  const handleAddProduct = useCallback(
    (product: PosProduct, qty = 1) => {
      const result = cart.addItem({
        productId: product.id,
        productName: product.name_en,
        productNameAr: product.name_ar,
        sku: product.sku,
        barcode: product.barcode,
        unitSymbol: product.unit_symbol,
        allowDecimal: Boolean(product.allow_decimal),
        quantity: qty,
        unitPrice: product.selling_price,
        costPrice: product.purchase_price,
        discountAmount: 0,
        discountPct: 0,
        stock: product.current_stock,
      })

      if (!result.success && result.error) {
        setStockNotice(result.error)
        setTimeout(() => setStockNotice(null), 4000)
      }
    },
    [cart]
  )

  // Quantity change handler with stock check
  const handleUpdateQuantity = useCallback(
    (id: string, qty: number) => {
      const result = cart.updateQuantity(id, qty)
      if (!result.success && result.error) {
        setStockNotice(result.error)
        setTimeout(() => setStockNotice(null), 4000)
      }
    },
    [cart]
  )

  // Hold Cart Handler
  const handleHoldCart = async () => {
    if (cart.items.length === 0) return
    if (!user) return

    try {
      const summary = posService.calculateTotals(
        cart.items,
        cart.discountAmount,
        cart.taxEnabled,
        cart.taxRate
      )

      await posService.holdCart(
        {
          cashierId: user.id,
          cashierName: user.fullName,
          customerId: cart.customerId,
          customerName: cart.customerName,
          items: cart.items,
          subtotal: summary.subtotal,
          discountAmount: summary.cartDiscountAmount,
          taxAmount: summary.taxAmount,
          total: summary.total,
          notes: cart.notes,
        },
        user
      )

      cart.clearCart()
      await refreshShiftAndHeld()
      alert(t('pos.cartHeldSuccess', 'تم تعليق الفاتورة وحفظها بنجاح'))
    } catch (err: any) {
      alert(err.message || 'Error holding cart')
    }
  }

  // Resume Cart Execution
  const executeResumeCart = async (heldCart: HeldCart) => {
    try {
      const res = await posService.resumeHeldCart(heldCart.id, user || undefined)
      cart.setItems(res.items)
      cart.setCartDiscount(
        heldCart.subtotal > 0 ? (heldCart.discount_amount / heldCart.subtotal) * 100 : 0,
        heldCart.discount_amount
      )
      if (heldCart.customer_id && heldCart.customer_name) {
        cart.setCustomer({
          id: heldCart.customer_id,
          name: heldCart.customer_name,
        })
      } else {
        cart.setCustomer(null)
      }
      if (heldCart.notes) cart.setNotes(heldCart.notes)

      setIsHeldModalOpen(false)
      setResumeConfirmTarget(null)
      await refreshShiftAndHeld()

      if (res.stockWarnings.length > 0) {
        setStockNotice(res.stockWarnings.join(' — '))
      }
    } catch (err: any) {
      alert(err.message || 'Error resuming cart')
    }
  }

  // Resume Cart Handler
  const handleResumeCart = async (heldCart: HeldCart) => {
    if (cart.items.length > 0) {
      setResumeConfirmTarget(heldCart)
      return
    }
    await executeResumeCart(heldCart)
  }

  // Delete Held Cart Handler
  const handleDeleteHeldCart = async (heldCartId: string) => {
    try {
      await posService.deleteHeldCart(heldCartId, user || undefined)
      await refreshShiftAndHeld()
    } catch (err: any) {
      alert(err.message || 'Error deleting held cart')
    }
  }

  // Complete Sale & Checkout Handler
  const handleConfirmSale = async (payments: CreateSalePaymentInput[], notes?: string) => {
    if (!user) {
      throw new Error(t('rbac.noPermission', 'يجب تسجيل الدخول لإتمام عملية البيع'))
    }

    if (!shiftInfo.isOpen || !shiftInfo.shiftId) {
      throw new Error(t('pos.noShiftWarning', 'لا توجد وردية مفتوحة حالياً. يرجى فتح وردية لبدء تسجيل المبيعات.'))
    }

    const res = await salesService.createSale(
      {
        shiftId: shiftInfo.shiftId,
        registerId: shiftInfo.registerId || undefined,
        customerId: cart.customerId || undefined,
        items: cart.items.map((it) => ({
          productId: it.productId,
          productName: it.productName || it.productNameAr,
          productSku: it.sku,
          barcode: it.barcode || undefined,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          costPrice: it.costPrice,
          discountPct: it.discountPct,
          discountAmount: it.discountAmount,
        })),
        discountPct: cart.discountPct,
        discountAmount: cart.discountAmount,
        taxRate: cart.taxEnabled ? cart.taxRate : 0,
        payments,
        notes: notes || cart.notes || undefined,
      },
      {
        id: user.id,
        fullName: user.fullName,
        role: user.roleName,
      }
    )

    setActiveReceipt(res.receipt)
    setReceiptModalOpen(true)
    setCheckoutModalOpen(false)
    cart.clearCart()
    loadGridProducts(selectedCategory, searchQuery)
  }

  const totals = posService.calculateTotals(
    cart.items,
    cart.discountAmount,
    cart.taxEnabled,
    cart.taxRate
  )

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden select-none">
      {/* Top Notification Alerts */}
      {stockNotice && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-6 py-2 text-amber-600 dark:text-amber-400 text-xs font-semibold flex items-center justify-between shrink-0 animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{stockNotice}</span>
          </div>
          <button onClick={() => setStockNotice(null)} className="p-0.5 hover:bg-amber-500/20 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {!checkingShift && !shiftInfo.isOpen && (
        <div className="bg-destructive/15 border-b border-destructive/30 px-6 py-2 text-destructive text-xs font-bold flex items-center gap-2 shrink-0">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{t('pos.noShiftWarning', 'تنبيه: لا توجد وردية مفتوحة للكاشير. افتح وردية من قسم الخزينة لتسجيل المبيعات.')}</span>
        </div>
      )}

      {/* Main Responsive Grid Layout (Products Grid + Cart) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Left Column: Category Bar + Product Search + Interactive Product Grid (7 cols) */}
        <div className="lg:col-span-7 flex flex-col border-e border-border overflow-hidden bg-card/20">
          {/* Top Search & Barcode Scan Bar */}
          <div className="p-4 border-b border-border bg-card/60 flex items-center gap-3 shrink-0">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('pos.searchProducts', 'بحث عن صنف بالاسم، الكود، الباركود (F2)...')}
                className="w-full h-11 ps-9 pe-9 rounded-xl bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute end-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Barcode Scanner Auto-Add Input */}
            <div className="w-48 shrink-0">
              <BarcodeInput onProductFound={handleAddProduct} />
            </div>

            {/* Held Carts Badge */}
            {canHold && (
              <button
                type="button"
                onClick={() => setIsHeldModalOpen(true)}
                className="relative h-11 px-3.5 rounded-xl border border-border bg-muted hover:bg-muted/80 text-foreground flex items-center gap-1.5 text-xs font-semibold shrink-0 transition-colors"
                title={t('pos.heldCarts', 'الفواتير المعلقة')}
              >
                <FolderOpen className="w-4 h-4 text-primary" />
                <span className="hidden sm:inline">{isArabic ? 'المعلقة' : 'Held'}</span>
                {heldCarts.length > 0 && (
                  <span className="absolute -top-1.5 -end-1.5 w-5 h-5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                    {heldCarts.length}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Horizontal Category Navigation Bar */}
          <div className="px-4 py-2.5 border-b border-border bg-muted/20 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-none">
            {/* All Products Tab */}
            <button
              type="button"
              onClick={() => setSelectedCategory('')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                selectedCategory === ''
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-card border border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {isArabic ? 'جميع الأصناف' : 'All Items'}
            </button>

            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs shrink-0 transition-all font-semibold ${
                    isSelected
                      ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                      : 'bg-card border border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {isArabic ? cat.name_ar : cat.name_en || cat.name_ar}
                </button>
              )
            })}
          </div>

          {/* Products Grid Area */}
          <div className="flex-1 p-4 overflow-y-auto">
            {loadingGrid ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : gridProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground space-y-2">
                <Package className="w-12 h-12 opacity-30" />
                <p className="text-sm font-semibold">{isArabic ? 'لا توجد منتجات في هذا التصنيف' : 'No products found'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {gridProducts.map((product) => {
                  const isLowStock = product.current_stock <= 5
                  const isOutOfStock = product.current_stock <= 0
                  return (
                    <button
                      key={product.id}
                      type="button"
                      disabled={isOutOfStock}
                      onClick={() => handleAddProduct(product)}
                      className={`p-3 bg-card border border-border rounded-xl text-start flex flex-col justify-between transition-all hover:border-primary/50 hover:shadow-md active:scale-[0.98] ${
                        isOutOfStock ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[10px] font-mono text-muted-foreground truncate">
                            {product.sku}
                          </span>
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full font-bold ${
                              isOutOfStock
                                ? 'bg-destructive/15 text-destructive'
                                : isLowStock
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                : 'bg-emerald-500/10 text-emerald-600'
                            }`}
                          >
                            {isOutOfStock ? (isArabic ? 'نفذ' : '0') : `${product.current_stock} ${product.unit_symbol || ''}`}
                          </span>
                        </div>

                        <h4 className="font-bold text-xs text-foreground line-clamp-2 leading-tight">
                          {isArabic ? product.name_ar : product.name_en || product.name_ar}
                        </h4>
                      </div>

                      <div className="mt-3 pt-2 border-t border-border/60 flex items-center justify-between">
                        <span className="text-xs font-mono font-black text-foreground">
                          {formatCurrency(product.selling_price, currencySymbol)}
                        </span>
                        <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                          <Plus className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Active Cart, Customer Selector, Payment & Checkout (5 cols) */}
        <div className="lg:col-span-5 flex flex-col h-full bg-card overflow-hidden">
          {/* Customer Selection & Quick Add */}
          <div className="p-3 border-b border-border shrink-0">
            <CustomerSelector
              selectedCustomer={
                cart.customerId && cart.customerName
                  ? { id: cart.customerId, name: cart.customerName }
                  : null
              }
              onSelectCustomer={(c) => cart.setCustomer(c)}
            />
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto">
            <Cart
              items={cart.items}
              onUpdateQuantity={handleUpdateQuantity}
              onRemoveItem={cart.removeItem}
              onUpdateDiscount={(id, pct, amt) => cart.updateDiscount(id, pct, amt)}
              onClearCart={cart.clearCart}
              canDiscount={canDiscount}
            />
          </div>

          {/* Cart Summary & Checkout Footer */}
          <div className="p-4 border-t border-border bg-muted/20 shrink-0 space-y-3">
            <CartSummary
              summary={totals}
              canDiscount={canDiscount}
              canHold={canHold}
              heldCartsCount={heldCarts.length}
              onSetDiscount={(pct, amt) => cart.setCartDiscount(pct, amt)}
              onHoldCart={handleHoldCart}
              onOpenHeldCarts={() => setIsHeldModalOpen(true)}
              onPrepareCheckout={() => setCheckoutModalOpen(true)}
            />

            <div className="flex gap-2">
              {canHold && (
                <button
                  type="button"
                  disabled={cart.items.length === 0}
                  onClick={handleHoldCart}
                  className="flex-1 h-11 rounded-xl border border-border bg-muted hover:bg-muted/80 text-foreground font-bold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <FolderOpen className="w-4 h-4 text-primary" />
                  <span>{t('pos.holdCart', 'تعليق الفاتورة')}</span>
                </button>
              )}

              <button
                type="button"
                disabled={cart.items.length === 0 || !shiftInfo.isOpen}
                onClick={() => setCheckoutModalOpen(true)}
                className="flex-[2] h-11 rounded-xl bg-primary text-primary-foreground font-black text-sm hover:bg-primary/90 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>{t('pos.checkout', 'الدفع والتحصيل')} ({formatCurrency(totals.total, currencySymbol)})</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Held Carts Modal */}
      {isHeldModalOpen && (
        <HeldCartsModal
          isOpen={isHeldModalOpen}
          heldCarts={heldCarts}
          onClose={() => setIsHeldModalOpen(false)}
          onResumeCart={handleResumeCart}
          onDeleteCart={handleDeleteHeldCart}
        />
      )}

      {/* Checkout Modal */}
      {checkoutModalOpen && (
        <CheckoutModal
          isOpen={checkoutModalOpen}
          totalDue={totals.total}
          customerName={cart.customerName || undefined}
          itemsCount={cart.items.length}
          onClose={() => setCheckoutModalOpen(false)}
          onConfirmSale={handleConfirmSale}
        />
      )}

      {/* Thermal Receipt Print Modal */}
      {receiptModalOpen && activeReceipt && (
        <ReceiptModal
          isOpen={receiptModalOpen}
          receipt={activeReceipt}
          onClose={() => {
            setReceiptModalOpen(false)
            setActiveReceipt(null)
          }}
          onNewSale={() => {
            setReceiptModalOpen(false)
            setActiveReceipt(null)
            cart.clearCart()
          }}
        />
      )}

      {/* Unified Overwrite Cart Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!resumeConfirmTarget}
        onClose={() => setResumeConfirmTarget(null)}
        onConfirm={async () => {
          if (resumeConfirmTarget) {
            await executeResumeCart(resumeConfirmTarget)
          }
        }}
        variant="warning"
        title={t('pos.confirmOverwriteTitle', 'استبدال السلة الحالية')}
        description={t('pos.confirmOverwriteActiveCart', 'توجد أصناف في السلة الحالية. هل تريد استبدالها بالفاتورة المعلقة؟')}
        confirmText={t('common.confirm', 'استبدال')}
      />
    </div>
  )
}

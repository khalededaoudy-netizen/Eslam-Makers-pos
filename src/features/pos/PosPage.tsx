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
  TrendingUp,
  Sparkles,
  Award,
} from 'lucide-react'
import { useCartStore, CustomerSummary } from '@/stores/cartStore'
import { useAuthStore, usePermission } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { posService } from './posService'
import { PosProduct, PosCartSummary, HeldCart, PosShiftInfo } from './types'
import { productService, CategoryItem } from '@/services/products/productService'
import { ProductImage } from '@/components/common/ProductImage'
import { BarcodeInput } from './components/BarcodeInput'
import { Cart } from './components/Cart'
import { CustomerSelector } from './components/CustomerSelector'
import { CustomerLookupModal } from './components/CustomerLookupModal'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { CartSummary } from './components/CartSummary'
import { HeldCartsModal } from './components/HeldCartsModal'
import { CheckoutModal } from '@/features/sales/components/CheckoutModal'
import { ReceiptModal } from '@/features/sales/components/ReceiptModal'
import { salesService } from '@/features/sales/salesService'
import { ReceiptData, CreateSalePaymentInput } from '@/features/sales/types'
import { formatCurrency } from '@/lib/formatters'
import { openCashDrawerDirect } from '@/services/printer/directPrint'

export function PosPage() {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language !== 'en'
  const { user } = useAuthStore()
  const { can, isAdmin } = usePermission()
  const { taxEnabled, taxRate, currencySymbol, autoOpenDrawer, defaultPrinter } = useSettingsStore()

  const cart = useCartStore()

  // POS State
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [gridProducts, setGridProducts] = useState<PosProduct[]>([])
  const [loadingGrid, setLoadingGrid] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [shiftInfo, setShiftInfo] = useState<PosShiftInfo>({ isOpen: true })
  const [checkingShift, setCheckingShift] = useState(true)

  // Held Carts, Customer Lookup & Checkout
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([])
  const [isHeldModalOpen, setIsHeldModalOpen] = useState(false)
  const [stockNotice, setStockNotice] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null)
  const [customerLookupOpen, setCustomerLookupOpen] = useState(false)
  const [lookupMode, setLookupMode] = useState<'checkout' | 'select'>('checkout')
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false)
  const [activeReceipt, setActiveReceipt] = useState<ReceiptData | null>(null)
  const [receiptModalOpen, setReceiptModalOpen] = useState(false)
  const [resumeConfirmTarget, setResumeConfirmTarget] = useState<HeldCart | null>(null)

  // Auto-dismiss feedback banner after 4s
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [feedback])

  const searchInputRef = useRef<HTMLInputElement>(null)
  const isConfirmingSaleRef = useRef(false)

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
      } else if (catId === 'most_requested') {
        const results = await posService.getMostRequested(60)
        setGridProducts(results)
      } else if (catId === 'best_sellers') {
        const results = await posService.getBestSellers(60)
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

  // Keyboard Shortcuts: F2 (Focus Search), F3 (Hold Cart), F4 (Checkout), Escape (Close Modal / Clear Search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape: Close active modals or clear search
      if (e.key === 'Escape') {
        if (customerLookupOpen) {
          setCustomerLookupOpen(false)
          return
        }
        if (checkoutModalOpen) {
          setCheckoutModalOpen(false)
          return
        }
        if (isHeldModalOpen) {
          setIsHeldModalOpen(false)
          return
        }
        if (receiptModalOpen) {
          setReceiptModalOpen(false)
          return
        }
        if (searchQuery) {
          setSearchQuery('')
          return
        }
      }

      // F2: Focus and select search input
      if (e.key === 'F2') {
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      }

      // F3: Hold active cart
      if (e.key === 'F3') {
        e.preventDefault()
        if (canHold && cart.items.length > 0) {
          handleHoldCart()
        }
      }

      // F4: Open checkout
      if (e.key === 'F4') {
        e.preventDefault()
        if (cart.items.length > 0 && shiftInfo.isOpen) {
          handleOpenCheckout()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    searchQuery,
    canHold,
    cart.items.length,
    shiftInfo.isOpen,
    customerLookupOpen,
    checkoutModalOpen,
    isHeldModalOpen,
    receiptModalOpen,
  ])

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
        cart.taxRate,
        cart.discountType
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
          discountPct: summary.cartDiscountPct,
          discountType: cart.discountType,
          taxAmount: summary.taxAmount,
          total: summary.total,
          notes: cart.notes,
        },
        user
      )

      cart.clearCart()
      await refreshShiftAndHeld()
      setFeedback({
        type: 'success',
        message: t('pos.cartHeldSuccess', 'تم تعليق الفاتورة وحفظها بنجاح'),
      })
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || (isArabic ? 'حدث خطأ أثناء تعليق الفاتورة' : 'Error holding cart'),
      })
    }
  }

  // Resume Cart Execution
  const executeResumeCart = async (heldCart: HeldCart) => {
    try {
      const res = await posService.resumeHeldCart(heldCart.id, user || undefined)
      cart.setItems(res.items)
      const restoredDiscountPct = heldCart.discount_pct !== undefined
        ? heldCart.discount_pct
        : (heldCart.subtotal > 0 ? (heldCart.discount_amount / heldCart.subtotal) * 100 : 0)
      const restoredDiscountType = heldCart.discount_type || (restoredDiscountPct > 0 ? 'pct' : 'fixed')

      cart.setCartDiscount(
        restoredDiscountPct,
        heldCart.discount_amount,
        restoredDiscountType
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
      setFeedback({
        type: 'error',
        message: err?.message || (isArabic ? 'حدث خطأ أثناء استرجاع الفاتورة' : 'Error resuming cart'),
      })
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
      setFeedback({
        type: 'success',
        message: isArabic ? 'تم حذف الفاتورة المعلقة بنجاح' : 'Held cart deleted successfully',
      })
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || (isArabic ? 'حدث خطأ أثناء حذف الفاتورة المعلقة' : 'Error deleting held cart'),
      })
    }
  }

  // Customer Lookup & Checkout Open Handlers
  const handleOpenCheckout = () => {
    if (cart.items.length === 0 || !shiftInfo.isOpen) return
    setLookupMode('checkout')
    setCustomerLookupOpen(true)
  }

  const handleOpenCustomerSelect = () => {
    setLookupMode('select')
    setCustomerLookupOpen(true)
  }

  const handleConfirmCustomerLookup = (customer: CustomerSummary | null) => {
    cart.setCustomer(customer)
    setCustomerLookupOpen(false)
    if (lookupMode === 'checkout') {
      setCheckoutModalOpen(true)
    }
  }

  // Complete Sale & Checkout Handler
  const handleConfirmSale = async (payments: CreateSalePaymentInput[], notes?: string) => {
    if (isConfirmingSaleRef.current) {
      console.warn('[POS] Sale confirmation already in progress, ignoring duplicate call')
      return
    }
    isConfirmingSaleRef.current = true

    try {
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
          discountType: cart.discountType,
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

      // Auto-open cash drawer if sale contains cash and autoOpenDrawer setting is enabled
      const hasCash = payments.some((p) => p.method === 'cash')
      if (hasCash && autoOpenDrawer) {
        openCashDrawerDirect(defaultPrinter).catch((err) => {
          console.warn('[POS] Auto cash drawer open warning:', err)
        })
      }

      setActiveReceipt(res.receipt)
      setReceiptModalOpen(true)
      setCheckoutModalOpen(false)
      cart.clearCart()
      loadGridProducts(selectedCategory, searchQuery)
    } finally {
      isConfirmingSaleRef.current = false
    }
  }

  const totals = posService.calculateTotals(
    cart.items,
    cart.discountAmount,
    cart.taxEnabled,
    cart.taxRate,
    cart.discountType
  )

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden select-none">
      {/* Top Notification Alerts */}
      {feedback && (
        <div
          className={`border-b px-6 py-2 text-xs font-semibold flex items-center justify-between shrink-0 animate-fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : feedback.type === 'warning'
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400'
              : 'bg-destructive/15 border-destructive/30 text-destructive'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="p-0.5 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

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
        {/* Products & Categories Section (7 cols in desktop grid) */}
        <div className="lg:col-span-7 flex flex-row border-e border-border overflow-hidden bg-card/20">
          {/* 1. Vertical Categories Sidebar (Anchored on the RIGHT in RTL) */}
          <div className="w-40 sm:w-44 lg:w-48 xl:w-52 shrink-0 border-e border-border bg-card/50 flex flex-col overflow-hidden">
            {/* Sidebar Header */}
            <div className="p-3 border-b border-border bg-muted/40 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Layers className="w-3.5 h-3.5 text-primary" />
                <span>{isArabic ? 'التصنيفات' : 'Categories'}</span>
              </div>
              <span className="text-[10px] font-mono font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                {categories.length + 3}
              </span>
            </div>

            {/* Scrollable Categories List */}
            <div className="flex-1 p-2 space-y-1.5 overflow-y-auto scrollbar-thin">
              {/* All Items Button */}
              <button
                type="button"
                onClick={() => setSelectedCategory('')}
                className={`w-full p-2.5 rounded-xl text-xs font-bold text-start flex items-center gap-2.5 transition-all ${
                  selectedCategory === ''
                    ? 'bg-primary text-primary-foreground shadow-sm ring-1 ring-primary'
                    : 'bg-card border border-border/80 text-foreground hover:bg-muted/80 hover:border-border'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    selectedCategory === ''
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <Grid className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate">{isArabic ? 'كل الأصناف' : 'All Items'}</div>
                </div>
              </button>

              {/* Most Requested (الأكثر طلباً) */}
              <button
                type="button"
                onClick={() => setSelectedCategory('most_requested')}
                className={`w-full p-2.5 rounded-xl text-xs font-semibold text-start flex items-center gap-2.5 transition-all ${
                  selectedCategory === 'most_requested'
                    ? 'bg-primary text-primary-foreground font-bold shadow-sm ring-1 ring-primary'
                    : 'bg-card border border-border/80 text-foreground hover:bg-muted/80 hover:border-border'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    selectedCategory === 'most_requested'
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-amber-500'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate">{isArabic ? 'الأكثر طلباً' : 'Most Requested'}</div>
                </div>
              </button>

              {/* Best Selling (الأكثر مبيعاً) */}
              <button
                type="button"
                onClick={() => setSelectedCategory('best_sellers')}
                className={`w-full p-2.5 rounded-xl text-xs font-semibold text-start flex items-center gap-2.5 transition-all ${
                  selectedCategory === 'best_sellers'
                    ? 'bg-primary text-primary-foreground font-bold shadow-sm ring-1 ring-primary'
                    : 'bg-card border border-border/80 text-foreground hover:bg-muted/80 hover:border-border'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    selectedCategory === 'best_sellers'
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-emerald-500'
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate">{isArabic ? 'الأكثر مبيعاً' : 'Best Selling'}</div>
                </div>
              </button>

              {/* Product Categories */}
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat.id
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`w-full p-2.5 rounded-xl text-xs font-semibold text-start flex items-center gap-2.5 transition-all ${
                      isSelected
                        ? 'bg-primary text-primary-foreground font-bold shadow-sm ring-1 ring-primary'
                        : 'bg-card border border-border/80 text-foreground hover:bg-muted/80 hover:border-border'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-primary-foreground/20 text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <Tag className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate">
                        {isArabic ? cat.name_ar : cat.name_en || cat.name_ar}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 2. Main Products Content (Search + Product Grid) */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {/* Top Search & Barcode Scan Bar */}
            <div className="p-3.5 border-b border-border bg-card/60 flex items-center gap-3 shrink-0">
              {/* Search Input */}
              <div className="relative flex-1">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('pos.searchProducts', 'بحث عن صنف بالاسم، الكود، الباركود (F2)...')}
                  className="w-full h-10 ps-9 pe-16 rounded-xl bg-input border border-border text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="absolute end-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="p-1 text-muted-foreground hover:text-foreground rounded"
                      title="Clear (Esc)"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-bold text-muted-foreground bg-muted border border-border rounded shadow-xs select-none">
                    F2
                  </kbd>
                </div>
              </div>

              {/* Barcode Scanner Auto-Add Input */}
              <div className="w-40 sm:w-44 shrink-0">
                <BarcodeInput onProductFound={handleAddProduct} />
              </div>

              {/* Held Carts Badge */}
              {canHold && (
                <button
                  type="button"
                  onClick={() => setIsHeldModalOpen(true)}
                  className="relative h-10 px-3 rounded-xl border border-border bg-muted hover:bg-muted/80 text-foreground flex items-center gap-1.5 text-xs font-semibold shrink-0 transition-colors"
                  title={t('pos.heldCarts', 'الفواتير المعلقة')}
                >
                  <FolderOpen className="w-4 h-4 text-primary" />
                  <span className="hidden xl:inline">{isArabic ? 'المعلقة' : 'Held'}</span>
                  {heldCarts.length > 0 && (
                    <span className="absolute -top-1.5 -end-1.5 w-5 h-5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                      {heldCarts.length}
                    </span>
                  )}
                </button>
              )}
            </div>

            {/* Products Grid Area */}
            <div className="flex-1 p-3 sm:p-4 overflow-y-auto">
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
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5 sm:gap-3">
                {gridProducts.map((product) => {
                  const minStock = product.min_stock ?? 0
                  const isOutOfStock = product.current_stock <= 0
                  const isLowStock = !isOutOfStock && product.current_stock <= minStock

                  return (
                    <button
                      key={product.id}
                      type="button"
                      disabled={isOutOfStock}
                      onClick={() => handleAddProduct(product)}
                      className={`group p-2.5 bg-card border border-border rounded-2xl text-start flex flex-col justify-between transition-all hover:border-primary/50 hover:shadow-md active:scale-[0.98] relative overflow-hidden ${
                        isOutOfStock ? 'opacity-50 cursor-not-allowed bg-muted/30' : ''
                      }`}
                    >
                      {/* Top Product Image with absolute stock badge */}
                      <div className="relative w-full h-24 rounded-xl bg-muted/50 border border-border/60 flex items-center justify-center overflow-hidden mb-2 p-1">
                        <ProductImage
                          src={product.image_path}
                          alt={product.name_en || product.name_ar}
                          fallbackType="package"
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
                          iconClassName="w-8 h-8 opacity-25 text-muted-foreground"
                        />

                        {/* Stock badge top-end */}
                        <span
                          className={`absolute top-1.5 end-1.5 text-[9px] font-mono px-1.5 py-0.5 rounded-full font-bold shadow-sm backdrop-blur-md ${
                            isOutOfStock
                              ? 'bg-destructive text-destructive-foreground'
                              : isLowStock
                              ? 'bg-amber-500 text-amber-950 font-black'
                              : 'bg-emerald-600 text-white'
                          }`}
                        >
                          {isOutOfStock ? (isArabic ? 'نفذ' : '0') : `${product.current_stock} ${product.unit_symbol || ''}`}
                        </span>
                      </div>

                      {/* Product Identity */}
                      <div className="flex-1 flex flex-col justify-between">
                        <div className="mb-1">
                          <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground mb-0.5">
                            <span className="truncate max-w-[90px]">{product.sku}</span>
                            {product.drawer_location && (
                              <span className="text-[9px] bg-muted px-1 rounded truncate max-w-[50px]">
                                {product.drawer_location}
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-xs text-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                            {isArabic ? product.name_ar : product.name_en || product.name_ar}
                          </h4>
                        </div>

                        {/* Bottom Price & Add Button */}
                        <div className="mt-2 pt-2 border-t border-border/60 flex items-center justify-between">
                          <span className="text-xs font-mono font-black text-foreground">
                            {formatCurrency(product.selling_price, currencySymbol)}
                          </span>
                          <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground flex items-center justify-center transition-colors">
                            <Plus className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          </div>
        </div>

        {/* Right Column: Active Cart, Customer Selector, Payment & Checkout (5 cols) */}
        <div className="lg:col-span-5 flex flex-col h-full bg-card overflow-hidden">
          {/* Customer Selection & Quick Add */}
          <div className="p-3 border-b border-border shrink-0">
            <CustomerSelector
              selectedCustomer={
                cart.customerId && cart.customerName
                  ? { id: cart.customerId, name: cart.customerName, phone: cart.customer?.phone, customerCode: cart.customer?.customerCode }
                  : null
              }
              onSelectCustomer={(c) => cart.setCustomer(c)}
              onOpenLookup={handleOpenCustomerSelect}
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
              onSetDiscount={(pct, amt, type) => cart.setCartDiscount(pct, amt, type)}
              onOpenHeldCarts={() => setIsHeldModalOpen(true)}
            />

            <div className="flex gap-2">
              {canHold && (
                <button
                  type="button"
                  disabled={cart.items.length === 0}
                  onClick={handleHoldCart}
                  className="flex-1 h-11 rounded-xl border border-border bg-muted hover:bg-muted/80 text-foreground font-bold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  title="Shortcut: F3"
                >
                  <FolderOpen className="w-4 h-4 text-primary" />
                  <span>{t('pos.holdCart', 'تعليق الفاتورة')}</span>
                  <kbd className="hidden sm:inline-block px-1.5 py-0.2 text-[9px] font-mono bg-card border border-border rounded text-muted-foreground">
                    F3
                  </kbd>
                </button>
              )}

              <button
                type="button"
                disabled={cart.items.length === 0 || !shiftInfo.isOpen}
                onClick={handleOpenCheckout}
                className="flex-[2] h-11 rounded-xl bg-primary text-primary-foreground font-black text-sm hover:bg-primary/90 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                title="Shortcut: F4"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>{t('pos.checkout', 'الدفع والتحصيل')} ({formatCurrency(totals.total, currencySymbol)})</span>
                <kbd className="hidden sm:inline-block px-1.5 py-0.2 text-[9px] font-mono bg-black/20 text-white rounded">
                  F4
                </kbd>
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

      {/* Customer Lookup Modal */}
      {customerLookupOpen && (
        <CustomerLookupModal
          isOpen={customerLookupOpen}
          mode={lookupMode}
          initialCustomer={
            cart.customerId && cart.customerName
              ? {
                  id: cart.customerId,
                  name: cart.customerName,
                  phone: cart.customer?.phone,
                  customerCode: cart.customer?.customerCode,
                }
              : null
          }
          onClose={() => setCustomerLookupOpen(false)}
          onConfirmCustomer={handleConfirmCustomerLookup}
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

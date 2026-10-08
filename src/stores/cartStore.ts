/**
 * MAKERS POS — Cart Store (POS Core)
 * Centralized state for the active cashier cart, tax calculations, customer attachment, and stock validation.
 */

import { create } from 'zustand'

export interface CartItem {
  id: string          // unique cart line id
  productId: string
  productName: string
  productNameAr: string
  sku: string
  barcode?: string | null
  unitSymbol: string
  allowDecimal: boolean
  quantity: number
  unitPrice: number
  costPrice: number
  discountAmount: number
  discountPct: number
  subtotal: number
  profit: number
  stock: number
}

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other'

export interface PaymentEntry {
  method: PaymentMethod
  amount: number
  reference?: string
}

export interface CustomerSummary {
  id: string
  name: string
  customerCode?: string | null
  phone?: string | null
  balance?: number
  creditLimit?: number
}

export type DiscountType = 'pct' | 'fixed'

interface CartState {
  items: CartItem[]
  customer: CustomerSummary | null
  customerId: string | null
  customerName: string | null
  discountAmount: number
  discountPct: number
  discountType: DiscountType
  taxEnabled: boolean
  taxRate: number
  notes: string
  payments: PaymentEntry[]

  // Computed
  itemsCount: number
  totalQuantity: number
  subtotal: number
  taxableAmount: number
  taxAmount: number
  total: number
  totalPaid: number
  change: number

  // Actions
  addItem: (item: Omit<CartItem, 'id' | 'subtotal' | 'profit'>) => { success: boolean; error?: string }
  removeItem: (id: string) => void
  updateQuantity: (id: string, qty: number) => { success: boolean; error?: string }
  updateDiscount: (id: string, pct: number, amount: number) => void
  setCustomer: (customer: CustomerSummary | null) => void
  setCartDiscount: (pct: number, amount: number, type?: DiscountType) => void
  setTaxConfig: (enabled: boolean, rate: number) => void
  setNotes: (notes: string) => void
  setItems: (items: CartItem[]) => void
  addPayment: (payment: PaymentEntry) => void
  removePayment: (index: number) => void
  clearCart: () => void
  clearPayments: () => void
}

function calcItemSubtotal(item: Omit<CartItem, 'id' | 'subtotal' | 'profit'>): { subtotal: number; profit: number } {
  const cleanQty = Math.max(0, item.quantity)
  const lineSubtotal = cleanQty * item.unitPrice
  const cleanDiscount = Math.min(lineSubtotal, Math.max(0, item.discountAmount || 0))
  const subtotal = Math.max(0, lineSubtotal - cleanDiscount)
  const profit = (item.unitPrice - item.costPrice) * cleanQty - cleanDiscount
  return { subtotal, profit }
}

function recalculateCartDiscount(
  items: CartItem[],
  discountPct: number,
  discountAmount: number,
  discountType: DiscountType
): { discountPct: number; discountAmount: number } {
  const currentSubtotal = items.reduce((sum, i) => sum + i.subtotal, 0)
  if (currentSubtotal <= 0) {
    return { discountPct: 0, discountAmount: 0 }
  }
  if (discountType === 'pct') {
    const cleanPct = Math.min(100, Math.max(0, Number(discountPct) || 0))
    const cleanAmt = Number(((currentSubtotal * cleanPct) / 100).toFixed(2))
    return { discountPct: cleanPct, discountAmount: cleanAmt }
  } else {
    const cleanAmt = Math.min(currentSubtotal, Math.max(0, Number(discountAmount) || 0))
    const cleanPct = currentSubtotal > 0 ? Number(((cleanAmt / currentSubtotal) * 100).toFixed(2)) : 0
    return { discountPct: cleanPct, discountAmount: cleanAmt }
  }
}

export const useCartStore = create<CartState>()((set, get) => ({
  items: [],
  customer: null,
  customerId: null,
  customerName: null,
  discountAmount: 0,
  discountPct: 0,
  discountType: 'fixed',
  taxEnabled: false,
  taxRate: 0,
  notes: '',
  payments: [],

  get itemsCount() {
    return get().items.length
  },

  get totalQuantity() {
    return get().items.reduce((sum, i) => sum + i.quantity, 0)
  },

  get subtotal() {
    return get().items.reduce((sum, i) => sum + i.subtotal, 0)
  },

  get taxableAmount() {
    const sub = get().subtotal
    const discount = Math.min(sub, Math.max(0, get().discountAmount))
    return Math.max(0, sub - discount)
  },

  get taxAmount() {
    const state = get()
    if (!state.taxEnabled || state.taxRate <= 0) return 0
    return state.taxableAmount * (state.taxRate / 100)
  },

  get total() {
    const state = get()
    return Math.max(0, state.taxableAmount + state.taxAmount)
  },

  get totalPaid() {
    return get().payments.reduce((sum, p) => sum + p.amount, 0)
  },

  get change() {
    const state = get()
    const total = state.total
    return Math.max(0, state.totalPaid - total)
  },

  addItem: (newItem) => {
    let result = { success: true } as { success: boolean; error?: string }

    set((state) => {
      // Validate decimal
      if (!newItem.allowDecimal && !Number.isInteger(newItem.quantity)) {
        result = { success: false, error: 'هذا الصنف لا يقبل كميات كسرية' }
        return state
      }

      if (newItem.quantity <= 0) {
        result = { success: false, error: 'الكمية يجب أن تكون أكبر من الصفر' }
        return state
      }

      const existing = state.items.find(i => i.productId === newItem.productId)
      const currentQtyInCart = existing ? existing.quantity : 0
      const requestedQty = currentQtyInCart + newItem.quantity

      // Stock validation
      if (requestedQty > newItem.stock) {
        result = {
          success: false,
          error: `الكمية المطلوبة (${requestedQty}) تتجاوز المخزون المتاح (${newItem.stock})`,
        }
        return state
      }

      let updatedItems: CartItem[] = []
      if (existing) {
        updatedItems = state.items.map(i => {
          if (i.productId !== newItem.productId) return i
          const qty = i.quantity + newItem.quantity
          const { subtotal, profit } = calcItemSubtotal({ ...i, quantity: qty })
          return { ...i, quantity: qty, stock: newItem.stock, subtotal, profit }
        })
      } else {
        const { subtotal, profit } = calcItemSubtotal(newItem)
        updatedItems = [...state.items, {
          ...newItem,
          id: crypto.randomUUID(),
          subtotal,
          profit,
        }]
      }

      const { discountPct, discountAmount } = recalculateCartDiscount(
        updatedItems,
        state.discountPct,
        state.discountAmount,
        state.discountType
      )

      return {
        items: updatedItems,
        discountPct,
        discountAmount,
      }
    })

    return result
  },

  removeItem: (id) =>
    set(state => {
      const updatedItems = state.items.filter(i => i.id !== id)
      const { discountPct, discountAmount } = recalculateCartDiscount(
        updatedItems,
        state.discountPct,
        state.discountAmount,
        state.discountType
      )
      return {
        items: updatedItems,
        discountPct,
        discountAmount,
      }
    }),

  updateQuantity: (id, qty) => {
    let result = { success: true } as { success: boolean; error?: string }

    set((state) => {
      const item = state.items.find(i => i.id === id)
      if (!item) return state

      if (qty <= 0) {
        result = { success: false, error: 'الكمية يجب أن تكون أكبر من الصفر' }
        return state
      }

      if (!item.allowDecimal && !Number.isInteger(qty)) {
        result = { success: false, error: 'هذا الصنف لا يقبل كميات كسرية' }
        return state
      }

      if (qty > item.stock) {
        result = {
          success: false,
          error: `الكمية المطلوبة (${qty}) تتجاوز المخزون المتاح (${item.stock})`,
        }
        return state
      }

      const updatedItems = state.items.map(i => {
        if (i.id !== id) return i
        const { subtotal, profit } = calcItemSubtotal({ ...i, quantity: qty })
        return { ...i, quantity: qty, subtotal, profit }
      })

      const { discountPct, discountAmount } = recalculateCartDiscount(
        updatedItems,
        state.discountPct,
        state.discountAmount,
        state.discountType
      )

      return {
        items: updatedItems,
        discountPct,
        discountAmount,
      }
    })

    return result
  },

  updateDiscount: (id, pct, amount) =>
    set(state => {
      const updatedItems = state.items.map(i => {
        if (i.id !== id) return i
        const discountAmount = amount || (i.quantity * i.unitPrice * pct / 100)
        const { subtotal, profit } = calcItemSubtotal({ ...i, discountPct: pct, discountAmount })
        return { ...i, discountPct: pct, discountAmount, subtotal, profit }
      })

      const { discountPct, discountAmount } = recalculateCartDiscount(
        updatedItems,
        state.discountPct,
        state.discountAmount,
        state.discountType
      )

      return {
        items: updatedItems,
        discountPct,
        discountAmount,
      }
    }),

  setCustomer: (customer) => set({
    customer,
    customerId: customer ? customer.id : null,
    customerName: customer ? customer.name : null,
  }),

  setCartDiscount: (pct, amount, type = 'fixed') => {
    set((state) => {
      const currentSubtotal = state.items.reduce((sum, i) => sum + i.subtotal, 0)
      const cleanType: DiscountType = type === 'pct' ? 'pct' : 'fixed'
      let cleanPct = 0
      let cleanAmt = 0

      if (cleanType === 'pct') {
        cleanPct = Math.min(100, Math.max(0, Number(pct) || 0))
        cleanAmt = Number(((currentSubtotal * cleanPct) / 100).toFixed(2))
      } else {
        cleanAmt = Math.min(currentSubtotal, Math.max(0, Number(amount) || 0))
        cleanPct = currentSubtotal > 0 ? Number(((cleanAmt / currentSubtotal) * 100).toFixed(2)) : 0
      }

      return {
        discountType: cleanType,
        discountPct: cleanPct,
        discountAmount: cleanAmt,
      }
    })
  },

  setTaxConfig: (enabled, rate) => set({ taxEnabled: enabled, taxRate: rate }),

  setNotes: (notes) => set({ notes }),

  setItems: (items) => set(state => {
    const { discountPct, discountAmount } = recalculateCartDiscount(
      items,
      state.discountPct,
      state.discountAmount,
      state.discountType
    )
    return {
      items,
      discountPct,
      discountAmount,
    }
  }),

  addPayment: (payment) =>
    set(state => ({ payments: [...state.payments, payment] })),

  removePayment: (index) =>
    set(state => ({ payments: state.payments.filter((_, i) => i !== index) })),

  clearCart: () => set({
    items: [],
    customer: null,
    customerId: null,
    customerName: null,
    discountAmount: 0,
    discountPct: 0,
    discountType: 'fixed',
    notes: '',
    payments: [],
  }),

  clearPayments: () => set({ payments: [] }),
}))


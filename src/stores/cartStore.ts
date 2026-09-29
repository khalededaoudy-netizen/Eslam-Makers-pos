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
}

interface CartState {
  items: CartItem[]
  customer: CustomerSummary | null
  customerId: string | null
  customerName: string | null
  discountAmount: number
  discountPct: number
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
  setCartDiscount: (pct: number, amount: number) => void
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

export const useCartStore = create<CartState>()((set, get) => ({
  items: [],
  customer: null,
  customerId: null,
  customerName: null,
  discountAmount: 0,
  discountPct: 0,
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
    return state.taxableAmount + state.taxAmount
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

      if (existing) {
        return {
          items: state.items.map(i => {
            if (i.productId !== newItem.productId) return i
            const qty = i.quantity + newItem.quantity
            const { subtotal, profit } = calcItemSubtotal({ ...i, quantity: qty })
            return { ...i, quantity: qty, stock: newItem.stock, subtotal, profit }
          })
        }
      }

      const { subtotal, profit } = calcItemSubtotal(newItem)
      return {
        items: [...state.items, {
          ...newItem,
          id: crypto.randomUUID(),
          subtotal,
          profit,
        }]
      }
    })

    return result
  },

  removeItem: (id) =>
    set(state => ({ items: state.items.filter(i => i.id !== id) })),

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

      const { subtotal, profit } = calcItemSubtotal({ ...item, quantity: qty })
      return {
        items: state.items.map(i => (i.id === id ? { ...i, quantity: qty, subtotal, profit } : i))
      }
    })

    return result
  },

  updateDiscount: (id, pct, amount) =>
    set(state => ({
      items: state.items.map(i => {
        if (i.id !== id) return i
        const discountAmount = amount || (i.quantity * i.unitPrice * pct / 100)
        const { subtotal, profit } = calcItemSubtotal({ ...i, discountPct: pct, discountAmount })
        return { ...i, discountPct: pct, discountAmount, subtotal, profit }
      })
    })),

  setCustomer: (customer) => set({
    customer,
    customerId: customer ? customer.id : null,
    customerName: customer ? customer.name : null,
  }),

  setCartDiscount: (pct, amount) => set({ discountPct: pct, discountAmount: amount }),

  setTaxConfig: (enabled, rate) => set({ taxEnabled: enabled, taxRate: rate }),

  setNotes: (notes) => set({ notes }),

  setItems: (items) => set({ items }),

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
    notes: '',
    payments: [],
  }),

  clearPayments: () => set({ payments: [] }),
}))

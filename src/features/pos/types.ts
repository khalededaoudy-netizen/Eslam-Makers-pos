/**
 * MAKERS POS — POS Core Types & Interfaces
 */

export interface PosProduct {
  id: string
  name_ar: string
  name_en: string
  sku: string
  selling_price: number
  purchase_price: number
  current_stock: number
  min_stock?: number
  image_path?: string | null
  unit_symbol: string
  allow_decimal: number
  barcode?: string | null
  drawer_location?: string | null
  category_name?: string | null
  total_sold?: number
}


export interface PosCartItem {
  id: string
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

export interface PosCartSummary {
  itemsCount: number
  totalQuantity: number
  subtotal: number
  cartDiscountPct: number
  cartDiscountAmount: number
  cartDiscountType?: 'pct' | 'fixed'
  taxableAmount: number
  taxRate: number
  taxAmount: number
  total: number
}

export interface HeldCart {
  id: string
  cashier_id: string
  cashier_name: string | null
  customer_id: string | null
  customer_name: string | null
  cart_data: string
  subtotal: number
  discount_amount: number
  discount_pct?: number
  discount_type?: 'pct' | 'fixed'
  tax_amount: number
  total: number
  notes: string | null
  held_at: string
  created_at: string
  items?: PosCartItem[]
}

export interface CreateHeldCartInput {
  cashierId: string
  cashierName?: string | null
  customerId?: string | null
  customerName?: string | null
  items: PosCartItem[]
  subtotal: number
  discountAmount: number
  discountPct?: number
  discountType?: 'pct' | 'fixed'
  taxAmount: number
  total: number
  notes?: string | null
}

export interface PosShiftInfo {
  isOpen: boolean
  shiftId?: string | null
  registerId?: string | null
  openedAt?: string | null
  openingBalance?: number
}

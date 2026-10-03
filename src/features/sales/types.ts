/**
 * MAKERS POS — Sales & Receipts Types & Interfaces
 */

import { PaymentMethodType } from '@/features/payments/types'

export type SaleStatus = 'completed' | 'voided'

export interface SaleItem {
  id: string
  sale_id: string
  product_id: string
  product_name: string
  product_sku: string
  barcode?: string | null
  quantity: number
  unit_price: number
  cost_price: number
  discount_amount: number
  discount_pct: number
  subtotal: number
  profit: number
}

export interface SalePayment {
  id: string
  sale_id: string
  shift_id: string
  register_id: string
  user_id: string
  customer_id?: string | null
  method: PaymentMethodType
  amount: number
  reference?: string | null
  notes?: string | null
  created_at: string
}

export interface Sale {
  id: string
  invoice_number: string
  shift_id: string
  register_id?: string | null
  cashier_id: string
  cashier_name?: string
  customer_id?: string | null
  customer_name?: string
  customer_phone?: string
  customer_code?: string
  status: SaleStatus
  subtotal: number
  discount_amount: number
  discount_pct: number
  discount_type?: 'pct' | 'fixed'
  tax_amount: number
  total: number
  paid_amount: number
  change_amount: number
  notes?: string | null
  created_at: string
  updated_at: string
  items?: SaleItem[]
  payments?: SalePayment[]
}

export interface CreateSaleItemInput {
  productId: string
  productName: string
  productSku: string
  barcode?: string
  quantity: number
  unitPrice: number
  costPrice?: number
  discountPct?: number
  discountAmount?: number
}

export interface CreateSalePaymentInput {
  method: PaymentMethodType
  amount: number
  receivedAmount?: number
  changeAmount?: number
  reference?: string
  notes?: string
}

export interface CreateSaleInput {
  shiftId: string
  registerId?: string
  customerId?: string | null
  items: CreateSaleItemInput[]
  discountPct?: number
  discountAmount?: number
  discountType?: 'pct' | 'fixed'
  taxRate?: number
  payments: CreateSalePaymentInput[]
  notes?: string
  heldCartId?: string
  idempotencyKey?: string
}

export interface ReceiptItem {
  name: string
  sku: string
  barcode?: string | null
  quantity: number
  unitPrice: number
  discountAmount: number
  subtotal: number
}

export interface ReceiptPaymentMethod {
  method: PaymentMethodType
  labelAr: string
  labelEn: string
  amount: number
  receivedAmount?: number
  changeAmount?: number
  reference?: string | null
}

export interface ReceiptData {
  storeName: string
  storeSubtitle?: string
  storePhone?: string
  storeAddress?: string
  receiptHeader?: string
  receiptFooter?: string
  invoiceNumber: string
  date: string
  cashierName: string
  customerName?: string
  customerCode?: string
  customerPhone?: string
  items: ReceiptItem[]
  itemsCount: number
  totalQuantity: number
  subtotal: number
  discountAmount: number
  taxAmount: number
  taxRate: number
  total: number
  paidAmount: number
  changeAmount: number
  payments: ReceiptPaymentMethod[]
  notes?: string
}

export interface SalesFilter {
  search?: string
  customerId?: string
  cashierId?: string
  status?: SaleStatus
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
}

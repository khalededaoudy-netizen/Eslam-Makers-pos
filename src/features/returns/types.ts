/**
 * MAKERS POS — Returns & Refunds Types
 */

import { PaymentMethodType } from '@/features/payments/types'

export type ReturnCondition = 'resellable' | 'damaged' | 'defective'
export type ReturnStatus = 'completed' | 'cancelled'

export interface ReturnItem {
  id: string
  returnId: string
  saleItemId: string
  productId: string
  productName: string
  productSku: string
  barcode?: string | null
  quantity: number
  unitPrice: number
  discountAmount: number
  taxAmount: number
  lineTotal: number
  condition: ReturnCondition
  reason?: string | null
  createdAt?: string
}

export interface ReturnPayment {
  id: string
  returnId: string
  shiftId?: string | null
  registerId?: string | null
  userId?: string | null
  customerId?: string | null
  method: PaymentMethodType
  amount: number
  reference?: string | null
  notes?: string | null
  createdAt?: string
}

export interface Return {
  id: string
  returnNumber: string
  saleId: string
  saleInvoiceNumber?: string
  customerId?: string | null
  customerName?: string | null
  customerCode?: string | null
  customerPhone?: string | null
  userId: string
  userName?: string | null
  shiftId?: string | null
  registerId?: string | null
  registerName?: string | null
  subtotal: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
  refundAmount: number
  refundMethod?: PaymentMethodType
  status: ReturnStatus
  reason?: string | null
  notes?: string | null
  createdAt: string
  updatedAt?: string
  items?: ReturnItem[]
  payments?: ReturnPayment[]
}

export interface CreateReturnItemInput {
  saleItemId: string
  productId: string
  quantity: number
  condition: ReturnCondition
  reason?: string
}

export interface CreateReturnPaymentInput {
  method: PaymentMethodType
  amount: number
  reference?: string
  notes?: string
}

export interface CreateReturnInput {
  saleId: string
  items: CreateReturnItemInput[]
  payments: CreateReturnPaymentInput[]
  shiftId: string
  registerId?: string
  reason?: string
  notes?: string
  idempotencyKey?: string
}

export interface SaleReturnableItem {
  saleItemId: string
  productId: string
  productName: string
  productSku: string
  barcode?: string | null
  unitPrice: number
  costPrice: number
  soldQuantity: number
  previouslyReturnedQuantity: number
  remainingReturnableQuantity: number
  originalDiscountAmount: number
  originalDiscountPct: number
  originalSubtotal: number
  originalProfit: number
  // Proportional unit economics
  unitDiscountShare: number
  unitTaxShare: number
  unitRefundAmount: number
}

export interface SaleReturnEligibility {
  saleId: string
  invoiceNumber: string
  saleDate: string
  status: string
  customerId?: string | null
  customerName?: string | null
  customerCode?: string | null
  customerPhone?: string | null
  cashierId: string
  cashierName?: string | null
  originalSubtotal: number
  originalDiscountAmount: number
  originalTaxAmount: number
  originalTotal: number
  originalPaidAmount: number
  originalPayments: Array<{
    method: PaymentMethodType
    amount: number
    reference?: string | null
  }>
  totalPreviouslyRefunded: number
  remainingRefundableAmount: number
  items: SaleReturnableItem[]
  isFullyReturned: boolean
}

export interface ReturnReceiptItem {
  productId: string
  productName: string
  sku: string
  quantity: number
  unitPrice: number
  discount: number
  tax: number
  lineTotal: number
  condition: ReturnCondition
}

export interface ReturnReceiptData {
  storeName: string
  storeSubtitle?: string
  storePhone?: string
  storeAddress?: string
  receiptHeader?: string
  receiptFooter?: string
  returnNumber: string
  originalSaleNumber: string
  saleDate?: string
  createdAt: string
  cashierName: string
  registerName?: string
  customerName?: string
  customerCode?: string
  customerPhone?: string
  items: ReturnReceiptItem[]
  subtotal: number
  discountAmount: number
  taxAmount: number
  refundTotal: number
  refundMethods: Array<{
    method: PaymentMethodType
    amount: number
    reference?: string
  }>
  reason?: string
  notes?: string
}

export interface ReturnFilter {
  search?: string
  status?: ReturnStatus
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
}

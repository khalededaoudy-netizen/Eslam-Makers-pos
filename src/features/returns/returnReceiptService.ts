/**
 * MAKERS POS — Return Receipt Service
 * Decoupled builder for return receipt structured data models using live store settings.
 */

import { getDb } from '@/services/db/database'
import { Return, ReturnReceiptData } from './types'

class ReturnReceiptService {
  /**
   * Build structured return receipt data from a completed Return entity
   */
  async buildReceiptData(returnData: Return): Promise<ReturnReceiptData> {
    const db = getDb()

    // Fetch store branding settings
    const settingsRows = await db.select<Array<{ key: string; value: string }>>(
      `SELECT key, value FROM settings WHERE key IN (
        'store_name', 'store_subtitle', 'store_phone', 'store_address',
        'receipt_header', 'receipt_footer'
      )`
    )

    const settingsMap = new Map<string, string>()
    for (const r of settingsRows) {
      settingsMap.set(r.key, r.value)
    }

    const storeName = settingsMap.get('store_name') || 'MAKERS POS'
    const storeSubtitle = settingsMap.get('store_subtitle') || 'Electronics Components & Makers Store'
    const storePhone = settingsMap.get('store_phone') || ''
    const storeAddress = settingsMap.get('store_address') || ''
    const receiptHeader = settingsMap.get('receipt_header') || 'إشعار مرتجع مبيعات / Sales Return'
    const receiptFooter = settingsMap.get('receipt_footer') || 'شكراً لتعاملكم مع ميكرز'

    // Format items
    const items = (returnData.items || []).map((i) => ({
      productId: i.productId,
      productName: i.productName,
      sku: i.productSku,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discount: i.discountAmount,
      tax: i.taxAmount,
      lineTotal: i.lineTotal,
      condition: i.condition,
    }))

    // Format refund methods
    const refundMethods = (returnData.payments || []).map((p) => ({
      method: p.method,
      amount: p.amount,
      reference: p.reference || undefined,
    }))

    return {
      storeName,
      storeSubtitle,
      storePhone,
      storeAddress,
      receiptHeader,
      receiptFooter,
      returnNumber: returnData.returnNumber,
      originalSaleNumber: returnData.saleInvoiceNumber || 'N/A',
      createdAt: returnData.createdAt,
      cashierName: returnData.userName || 'Cashier',
      registerName: returnData.registerName || undefined,
      customerName: returnData.customerName || undefined,
      customerPhone: returnData.customerPhone || undefined,
      items,
      subtotal: returnData.subtotal,
      discountAmount: returnData.discountAmount,
      taxAmount: returnData.taxAmount,
      refundTotal: returnData.refundAmount,
      refundMethods,
      reason: returnData.reason || undefined,
      notes: returnData.notes || undefined,
    }
  }
}

export const returnReceiptService = new ReturnReceiptService()

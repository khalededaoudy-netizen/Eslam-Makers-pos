/**
 * MAKERS POS — Receipt Service
 * Prepares structured receipt data models from Settings, Sales, and Line Items.
 * Decoupled from hardware printing drivers.
 */

import { getDb } from '@/services/db/database'
import { Sale, ReceiptData, ReceiptItem, ReceiptPaymentMethod } from './types'
import { PAYMENT_METHODS, PaymentMethodType } from '@/features/payments/types'

class ReceiptService {
  /**
   * Fetch store profile settings for receipts
   */
  async getReceiptSettings(): Promise<{
    storeName: string
    storeSubtitle: string
    storePhone: string
    storeAddress: string
    receiptHeader: string
    receiptFooter: string
    taxEnabled: boolean
    taxRate: number
  }> {
    const db = getDb()
    const rows = await db.select<Array<{ key: string; value: string }>>(
      "SELECT key, value FROM settings WHERE key IN ('store_name', 'store_subtitle', 'store_phone', 'store_address', 'receipt_header', 'receipt_footer', 'tax_enabled', 'tax_rate')"
    )

    const map: Record<string, string> = {}
    for (const r of rows) {
      map[r.key] = r.value
    }

    return {
      storeName: map['store_name'] || 'MAKERS POS',
      storeSubtitle: map['store_subtitle'] || 'Electronics Components & Makers Store',
      storePhone: map['store_phone'] || '',
      storeAddress: map['store_address'] || '',
      receiptHeader: map['receipt_header'] || 'أهلاً بكم في متجر المبدعين',
      receiptFooter: map['receipt_footer'] || 'شكراً لزيارتكم! تطبق الشروط والأحكام على المرتجعات خلال ١٤ يوم',
      taxEnabled: map['tax_enabled'] === '1' || map['tax_enabled'] === 'true',
      taxRate: parseFloat(map['tax_rate'] || '0') || 0,
    }
  }

  /**
   * Build complete ReceiptData model from Sale object
   */
  async buildReceiptData(sale: Sale): Promise<ReceiptData> {
    const settings = await this.getReceiptSettings()

    const receiptItems: ReceiptItem[] = (sale.items || []).map(item => ({
      name: item.product_name,
      sku: item.product_sku,
      barcode: item.barcode || null,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      discountAmount: item.discount_amount,
      subtotal: item.subtotal,
    }))

    const totalQty = receiptItems.reduce((acc, it) => acc + it.quantity, 0)

    const receiptPayments: ReceiptPaymentMethod[] = (sale.payments || []).map(p => {
      const meta = PAYMENT_METHODS[p.method as PaymentMethodType] || {
        nameAr: p.method,
        nameEn: p.method,
      }
      return {
        method: p.method as PaymentMethodType,
        labelAr: meta.nameAr,
        labelEn: meta.nameEn,
        amount: p.amount,
        reference: p.reference || null,
      }
    })

    return {
      storeName: settings.storeName,
      storeSubtitle: settings.storeSubtitle,
      storePhone: settings.storePhone,
      storeAddress: settings.storeAddress,
      receiptHeader: settings.receiptHeader,
      receiptFooter: settings.receiptFooter,
      invoiceNumber: sale.invoice_number,
      date: sale.created_at,
      cashierName: sale.cashier_name || 'Cashier',
      customerName: sale.customer_name || undefined,
      customerCode: sale.customer_code || undefined,
      customerPhone: sale.customer_phone || undefined,
      items: receiptItems,
      itemsCount: receiptItems.length,
      totalQuantity: totalQty,
      subtotal: sale.subtotal,
      discountAmount: sale.discount_amount,
      taxAmount: sale.tax_amount,
      taxRate: (Number(sale.subtotal) - Number(sale.discount_amount || 0)) > 0
        ? ((Number(sale.tax_amount) || 0) / (Number(sale.subtotal) - Number(sale.discount_amount || 0))) * 100
        : 0,
      total: sale.total,
      paidAmount: sale.paid_amount,
      changeAmount: sale.change_amount,
      payments: receiptPayments,
      notes: sale.notes || undefined,
    }
  }
}

export const receiptService = new ReceiptService()

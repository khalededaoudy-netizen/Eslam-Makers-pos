/**
 * Shared formatting utilities for MAKERS POS
 */

/** Format a number as currency */
export function formatCurrency(amount: number, symbol = 'ج.م', decimals = 2): string {
  return `${amount.toFixed(decimals)} ${symbol}`
}

/** Format ISO date string */
export function formatDate(isoString: string, withTime = false): string {
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return '—'

  const datePart = date.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  if (!withTime) return datePart

  const timePart = date.toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })

  return `${datePart} ${timePart}`
}

/** Generate invoice number */
export function generateInvoiceNumber(prefix: string, lastNumber: number): string {
  const padded = String(lastNumber + 1).padStart(6, '0')
  const date = new Date()
  const year = date.getFullYear().toString().slice(-2)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${prefix}-${year}${month}-${padded}`
}

/** Generate a simple SKU from product name */
export function generateSKU(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .split(/\s+/)
    .map(w => w.slice(0, 4))
    .slice(0, 4)
    .join('-')
}

/** Generate internal barcode value */
export function generateBarcodeValue(sku: string): string {
  const timestamp = Date.now().toString().slice(-6)
  const skuPart = sku.replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase()
  return `MKR${skuPart}${timestamp}`
}

/** Format a number with appropriate decimals */
export function formatQuantity(qty: number, allowDecimal: boolean): string {
  if (allowDecimal) return qty.toFixed(2)
  return qty.toFixed(0)
}

/** Get today's date as YYYY-MM-DD */
export function today(): string {
  return new Date().toISOString().split('T')[0]
}

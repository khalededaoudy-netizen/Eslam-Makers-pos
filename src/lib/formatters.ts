/**
 * Shared formatting utilities for MAKERS POS
 */

/** Format a number as currency */
export function formatCurrency(amount: number, symbol = 'ج.م', decimals = 2): string {
  return `${amount.toFixed(decimals)} ${symbol}`
}

/** Format ISO date string using Western/English digits (DD/MM/YYYY) */
export function formatDate(isoString: string, withTime = false): string {
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return '—'

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const datePart = `${day}/${month}/${year}`

  if (!withTime) return datePart

  let hours = date.getHours()
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const ampm = hours >= 12 ? 'م' : 'ص'
  hours = hours % 12
  hours = hours ? hours : 12
  const formattedHours = String(hours).padStart(2, '0')
  const timePart = `${formattedHours}:${minutes} ${ampm}`

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

/** Format ISO date string into human-readable relative time (e.g. "منذ ساعتين", "قبل 15 دقيقة") */
export function formatRelativeTime(isoString: string, isArabic = true): string {
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return '—'

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.max(0, Math.floor(diffMs / 1000))
  const diffMin = Math.floor(diffSec / 60)
  const diffHours = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (isArabic) {
    if (diffMin < 1) return 'منذ لحظات'
    if (diffMin === 1) return 'منذ دقيقة'
    if (diffMin === 2) return 'منذ دقيقتين'
    if (diffMin < 11) return `منذ ${diffMin} دقائق`
    if (diffMin < 60) return `منذ ${diffMin} دقيقة`

    if (diffHours === 1) return 'منذ ساعة'
    if (diffHours === 2) return 'منذ ساعتين'
    if (diffHours < 11) return `منذ ${diffHours} ساعات`
    if (diffHours < 24) return `منذ ${diffHours} ساعة`

    if (diffDays === 1) return 'منذ يوم'
    if (diffDays === 2) return 'منذ يومين'
    if (diffDays < 11) return `منذ ${diffDays} أيام`
    if (diffDays < 30) return `منذ ${diffDays} يوماً`

    return formatDate(isoString, true)
  }

  // English fallback
  if (diffMin < 1) return 'Just now'
  if (diffMin === 1) return '1 minute ago'
  if (diffMin < 60) return `${diffMin} minutes ago`
  if (diffHours === 1) return '1 hour ago'
  if (diffHours < 24) return `${diffHours} hours ago`
  if (diffDays === 1) return '1 day ago'
  if (diffDays < 30) return `${diffDays} days ago`

  return formatDate(isoString, true)
}

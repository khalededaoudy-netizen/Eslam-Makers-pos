/**
 * MAKERS POS — WhatsApp Receipt Sharing Service
 * Enables sharing thermal receipt images directly to customer WhatsApp chats.
 * Supports image rasterization via html2canvas, clipboard copying, local temp saving, and wa.me deep links.
 */

import html2canvas from 'html2canvas'

export interface WhatsAppShareOptions {
  phone?: string
  customerName?: string
  invoiceNumber: string
  total: number
  storeName?: string
}

export interface WhatsAppShareResult {
  success: boolean
  imageDataUrl: string
  blob: Blob
  filePath?: string
  copiedToClipboard: boolean
  whatsAppUrl: string
}

/**
 * Normalizes customer phone number for WhatsApp wa.me links.
 * Handles Egyptian mobile numbers (010, 011, 012, 015) by adding Egypt country code 20.
 */
export function normalizePhone(phone: string): string {
  if (!phone) return ''
  // Remove all non-digit characters except leading plus if any
  let clean = phone.replace(/[\s\-\(\)\.]/g, '')

  // Remove leading plus
  clean = clean.replace(/^\+/, '')

  // If local Egyptian number starting with 0 (e.g., 010..., 011..., 012..., 015...), prepend 20
  if (clean.startsWith('0')) {
    clean = '20' + clean.slice(1)
  }

  return clean
}

/**
 * Formats standard bilingual receipt text message for WhatsApp
 */
export function buildWhatsAppMessage(options: {
  invoiceNumber: string
  total: number
  storeName?: string
}): string {
  const store = options.storeName || 'MAKERS'
  const text = 
`فاتورة رقم: #${options.invoiceNumber}
الإجمالي: ${options.total.toFixed(2)} ج.م
شكراً لتعاملكم معنا - ${store}`

  return encodeURIComponent(text)
}

/**
 * Builds the WhatsApp wa.me URL
 */
export function getWhatsAppUrl(phone?: string, messageText?: string): string {
  const query = messageText ? `?text=${messageText}` : ''
  if (phone && phone.trim()) {
    const cleanPhone = normalizePhone(phone)
    return `https://wa.me/${cleanPhone}${query}`
  }
  return `https://wa.me/${query}`
}

/**
 * Renders receipt HTML element to clean white high-resolution canvas
 */
export async function renderReceiptElementToCanvas(
  receiptElement: HTMLElement
): Promise<HTMLCanvasElement> {
  return await html2canvas(receiptElement, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    allowTaint: true,
    logging: false,
    scrollX: 0,
    scrollY: 0,
  })
}

/**
 * Converts a Canvas to a PNG Blob
 */
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Failed to convert canvas to blob'))
    }, 'image/png')
  })
}

/**
 * Copies a PNG Blob to the system clipboard
 */
export async function copyBlobToClipboard(blob: Blob): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.ClipboardItem) {
      const item = new ClipboardItem({ 'image/png': blob })
      await navigator.clipboard.write([item])
      return true
    }
  } catch (err) {
    console.warn('[WhatsApp] Clipboard image copy failed:', err)
  }
  return false
}

/**
 * Saves base64 PNG to temporary system file via Tauri backend
 */
export async function saveTempImageFile(
  imageDataUrl: string,
  invoiceNumber: string
): Promise<string | undefined> {
  try {
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      const { invoke } = await import('@tauri-apps/api/core')
      const base64 = imageDataUrl.includes(',') ? imageDataUrl.split(',')[1] : imageDataUrl
      const filename = `receipt_${invoiceNumber}_${Date.now()}.png`
      const savedPath = await invoke<string>('save_temp_image', {
        base64,
        filename,
      })
      return savedPath
    }
  } catch (err) {
    console.warn('[WhatsApp] Failed to save temp image in Tauri:', err)
  }
  return undefined
}

/**
 * Opens external URL in default desktop browser via Tauri shell plugin or fallback
 */
export async function openExternalUrl(url: string): Promise<void> {
  try {
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      const { open } = await import('@tauri-apps/plugin-shell')
      await open(url)
      return
    }
  } catch (err) {
    console.warn('[WhatsApp] plugin-shell open failed, attempting invoke fallback:', err)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('open_external_url', { url })
      return
    } catch (e) {
      console.warn('[WhatsApp] invoke fallback also failed:', e)
    }
  }

  // Web browser fallback
  window.open(url, '_blank', 'noopener,noreferrer')
}

/**
 * Master function to capture receipt, save temp image, copy to clipboard,
 * and launch WhatsApp chat or Web.
 */
export async function shareReceiptViaWhatsApp(
  receiptElement: HTMLElement,
  options: WhatsAppShareOptions
): Promise<WhatsAppShareResult> {
  // 1. Generate image canvas from receipt
  const canvas = await renderReceiptElementToCanvas(receiptElement)
  const imageDataUrl = canvas.toDataURL('image/png')
  const blob = await canvasToBlob(canvas)

  // 2. Save temp file via Tauri command
  const filePath = await saveTempImageFile(imageDataUrl, options.invoiceNumber)

  // 3. Copy image to clipboard so user can immediately paste (Ctrl+V) into WhatsApp chat
  const copiedToClipboard = await copyBlobToClipboard(blob)

  // 4. Build message and URL
  const messageText = buildWhatsAppMessage(options)
  const whatsAppUrl = getWhatsAppUrl(options.phone, messageText)

  // 5. Open in default browser
  await openExternalUrl(whatsAppUrl)

  return {
    success: true,
    imageDataUrl,
    blob,
    filePath,
    copiedToClipboard,
    whatsAppUrl,
  }
}

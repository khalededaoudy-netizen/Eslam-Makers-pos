/**
 * MAKERS POS — Direct Printing Service
 * Native silent printing without browser print preview dialog.
 * Uses isolated DOM cloning outside of any modal to guarantee 100% full-height thermal receipt capture.
 */

import html2canvas from 'html2canvas'
import { useSettingsStore, PaperWidth } from '@/stores/settingsStore'
import { formatDate } from '@/lib/formatters'

export interface PrintResult {
  success: boolean
  message?: string
}

export const PRINTER_DOTS: Record<PaperWidth, number> = {
  '80mm': 576, // 80mm thermal paper standard printable width (576 dots @ 203 DPI = 72mm)
  '58mm': 384, // 58mm thermal paper standard printable width (384 dots @ 203 DPI = 48mm)
}

export const PAPER_WIDTH_PX: Record<PaperWidth, number> = {
  '80mm': 275,
  '58mm': 185,
}

export const CUTTER_CLEARANCE_PX = 40

// Concurrency mutex lock to strictly serialize consecutive print jobs
let printQueueLock = Promise.resolve()

export async function queuePrintJob<T>(job: () => Promise<T>): Promise<T> {
  const next = printQueueLock.then(
    () => job(),
    () => job()
  )
  printQueueLock = next.then(
    () => {},
    () => {}
  )
  return next
}

/**
 * Lists all installed Windows printers via Tauri backend.
 */
export async function getAvailablePrinters(): Promise<string[]> {
  try {
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      const { invoke } = await import('@tauri-apps/api/core')
      const list = await invoke<string[]>('list_printers')
      return list || []
    }
  } catch (err) {
    console.warn('[directPrint] Failed to list printers from Tauri backend:', err)
  }
  return ['Default']
}

/**
 * Gets the Windows system default printer name.
 */
export async function getSystemDefaultPrinter(): Promise<string> {
  try {
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      const { invoke } = await import('@tauri-apps/api/core')
      const def = await invoke<string>('get_default_printer')
      return def || 'Default'
    }
  } catch (err) {
    console.warn('[directPrint] Failed to get default printer:', err)
  }
  return 'Default'
}

/**
 * Unified thermal canvas capture function.
 * Clones the given HTML or element into an isolated off-screen container at exact paper width,
 * waits for all fonts and images to finish loading and decoding, measures exact scrollHeight,
 * and rasterizes to a high-contrast canvas with scale 2.
 */
export async function captureReceiptToCanvas(
  elementOrHtml?: HTMLElement | string | null,
  paperWidth: PaperWidth = '80mm'
): Promise<HTMLCanvasElement> {
  let contentHtml = ''

  if (typeof elementOrHtml === 'string') {
    contentHtml = elementOrHtml
  } else {
    const receipt = elementOrHtml || document.getElementById('printable-receipt')
    if (!receipt) throw new Error('Receipt element not found')
    contentHtml = receipt.innerHTML
  }

  const widthPx = PAPER_WIDTH_PX[paperWidth] || PAPER_WIDTH_PX['80mm']

  // Create isolated off-screen capture container attached directly to document.body
  // Using left: 0, top: 0, direction: ltr on host prevents RTL negative coordinate bugs in html2canvas
  const container = document.createElement('div')
  container.id = '__receipt_direct_capture_container__'
  container.style.cssText = `
    position: fixed !important;
    left: 0 !important;
    top: 0 !important;
    right: auto !important;
    bottom: auto !important;
    width: ${widthPx}px !important;
    min-width: ${widthPx}px !important;
    max-width: ${widthPx}px !important;
    height: auto !important;
    min-height: auto !important;
    max-height: none !important;
    box-sizing: border-box !important;
    background: #ffffff !important;
    color: #000000 !important;
    margin: 0 !important;
    padding: 6px 6px ${CUTTER_CLEARANCE_PX}px 6px !important;
    direction: ltr !important;
    text-align: center !important;
    font-family: 'Cairo', 'Noto Sans Arabic', Arial, sans-serif !important;
    font-size: 11.5px !important;
    line-height: 1.35 !important;
    overflow: visible !important;
    transform: none !important;
    visibility: visible !important;
    opacity: 1 !important;
    z-index: -9999 !important;
    pointer-events: none !important;
  `

  const receiptWrapper = document.createElement('div')
  receiptWrapper.id = 'printable-receipt'
  receiptWrapper.className = 'printable-receipt'
  receiptWrapper.style.cssText = `
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    direction: rtl !important;
    text-align: center !important;
    box-sizing: border-box !important;
  `
  receiptWrapper.innerHTML = contentHtml
  container.appendChild(receiptWrapper)

  // Clean and constrain all nested tables and images inside the isolated container
  container.querySelectorAll('table').forEach((t) => {
    t.style.width = '100%'
    t.style.maxWidth = '100%'
    t.style.tableLayout = 'fixed'
    t.style.borderCollapse = 'collapse'
    t.style.boxSizing = 'border-box'
    t.style.margin = '0 auto'
  })

  container.querySelectorAll('img').forEach((img) => {
    img.style.maxWidth = '35mm'
    img.style.height = 'auto'
    img.style.display = 'block'
    img.style.margin = '0 auto 6px auto'
  })

  // Remove any leftover spacer elements
  container.querySelectorAll('.r-feed, [style*="30mm"]').forEach((el) => {
    el.remove()
  })

  document.body.appendChild(container)

  // STEP 1: Wait for web fonts to load
  if (document.fonts) {
    await document.fonts.ready
  }

  // STEP 2: Wait for all images inside container to finish loading and decoding
  const images = Array.from(container.querySelectorAll('img'))
  await Promise.all(
    images.map(async (img) => {
      if (img.complete && img.naturalHeight !== 0) {
        if (img.decode) {
          try {
            await img.decode()
          } catch {}
        }
        return
      }
      await new Promise<void>((resolve) => {
        img.onload = () => resolve()
        img.onerror = () => resolve()
      })
    })
  )

  // STEP 3: Stabilization delay for layout computation
  await new Promise((r) => setTimeout(r, 200))

  // STEP 4: Measure full unclipped receipt dimensions dynamically
  const fullWidth = widthPx
  const fullHeight = Math.max(Math.ceil(container.scrollHeight), 100)
  console.log(
    `[directPrint] Captured Receipt: ${fullWidth}x${fullHeight}px (scrollWidth: ${container.scrollWidth}px, clientWidth: ${container.clientWidth}px, images: ${images.length})`
  )

  // STEP 5: Capture using html2canvas with exact 0 offsets
  let canvas: HTMLCanvasElement
  try {
    canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
      allowTaint: true,
      width: fullWidth,
      height: fullHeight,
      windowWidth: fullWidth,
      windowHeight: fullHeight,
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
    })
  } finally {
    try {
      if (container.parentNode) {
        document.body.removeChild(container)
      }
    } catch {}
  }

  console.log(`[directPrint] Rendered Canvas: ${canvas.width}x${canvas.height}px`)
  return canvas
}

/**
 * Converts a rasterized canvas to an ESC/POS binary byte stream using GS v 0 raster bit image commands.
 * Scaled to exact thermal printer dot matrix (576 dots for 80mm / 384 dots for 58mm).
 */
export function convertCanvasToEscPos(
  canvas: HTMLCanvasElement,
  paperWidth: PaperWidth = '80mm',
  kickDrawer: boolean = false
): Uint8Array {
  const targetDots = PRINTER_DOTS[paperWidth] || PRINTER_DOTS['80mm']
  const bytesPerRow = targetDots / 8 // 576 / 8 = 72 bytes; 384 / 8 = 48 bytes

  // Compute scaled height preserving aspect ratio
  const targetHeight = Math.max(1, Math.round((canvas.height / canvas.width) * targetDots))

  // Render to exact dot-grid canvas
  const dotCanvas = document.createElement('canvas')
  dotCanvas.width = targetDots
  dotCanvas.height = targetHeight
  const ctx = dotCanvas.getContext('2d', { willReadFrequently: true })!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, targetDots, targetHeight)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(canvas, 0, 0, targetDots, targetHeight)

  const imgData = ctx.getImageData(0, 0, targetDots, targetHeight)
  const pixels = imgData.data

  const chunks: number[] = []

  // Optional: kick drawer pulse before print job
  if (kickDrawer) {
    chunks.push(0x1B, 0x70, 0x00, 0x19, 0xFA, 0x1B, 0x70, 0x01, 0x19, 0xFA)
  }

  // 1. Initialize printer
  chunks.push(0x1B, 0x40) // ESC @
  // 2. Explicitly set Left Margin to 0 dots (GS L 0 0)
  chunks.push(0x1D, 0x4C, 0x00, 0x00) // GS L 0 0
  // 3. Explicitly set Printable Area Width to exact dots (GS W)
  const wL = targetDots & 0xFF
  const wH = (targetDots >> 8) & 0xFF
  chunks.push(0x1D, 0x57, wL, wH) // GS W wL wH (576 = 0x40 0x02)
  // 4. Set default line spacing
  chunks.push(0x1B, 0x32) // ESC 2
  // 5. Set left alignment
  chunks.push(0x1B, 0x61, 0x00) // ESC a 0

  // 6. Rasterize in safe bands of at most 128 rows per GS v 0 command
  const MAX_BAND_HEIGHT = 128
  const THRESHOLD = 185

  for (let y = 0; y < targetHeight; y += MAX_BAND_HEIGHT) {
    const bandHeight = Math.min(MAX_BAND_HEIGHT, targetHeight - y)
    const xL = bytesPerRow & 0xFF
    const xH = (bytesPerRow >> 8) & 0xFF
    const yL = bandHeight & 0xFF
    const yH = (bandHeight >> 8) & 0xFF

    // GS v 0 0 xL xH yL yH
    chunks.push(0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH)

    for (let r = 0; r < bandHeight; r++) {
      const row = y + r
      for (let bIdx = 0; bIdx < bytesPerRow; bIdx++) {
        let byteVal = 0
        for (let bit = 0; bit < 8; bit++) {
          const px = bIdx * 8 + bit
          const idx = (row * targetDots + px) * 4
          const a = pixels[idx + 3]
          let isBlack = false
          if (a > 50) {
            const lum = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2]
            if (lum < THRESHOLD) {
              isBlack = true
            }
          }
          if (isBlack) {
            byteVal |= (1 << (7 - bit))
          }
        }
        chunks.push(byteVal)
      }
    }
  }

  // 5. Feed 3 lines to clear cutter line & perform partial cut
  chunks.push(0x1B, 0x64, 0x03) // ESC d 3 (feed 3 lines)
  chunks.push(0x1D, 0x56, 0x42, 0x00) // GS V 66 0 (feed to cut position and partial cut)

  return new Uint8Array(chunks)
}

/**
 * Chunked Base64 encoding for large binary byte arrays without stack overflow.
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  const len = bytes.byteLength
  const chunkSize = 8192
  for (let i = 0; i < len; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, sub as unknown as number[])
  }
  return btoa(binary)
}

/**
 * Renders an HTML receipt container to a high-contrast bitmap and prints directly to the selected thermal printer via RAW ESC/POS.
 */
export async function printReceiptDirect(
  elementOrHtml: HTMLElement | string | null,
  printerName?: string,
  paperWidth?: PaperWidth,
  kickDrawer: boolean = false
): Promise<PrintResult> {
  return queuePrintJob(async () => {
    const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
    const activePaperWidth = paperWidth || useSettingsStore.getState().receiptPaperWidth || '80mm'

    if (isTauri) {
      try {
        const canvas = await captureReceiptToCanvas(elementOrHtml, activePaperWidth)
        console.log(`[directPrint] DOM Canvas: ${canvas.width}x${canvas.height}px`)

        const rawBytes = convertCanvasToEscPos(canvas, activePaperWidth, kickDrawer)
        const bytesBase64 = uint8ArrayToBase64(rawBytes)

        console.log(
          `[directPrint] Generated ESC/POS stream: ${rawBytes.length} bytes (dots: ${PRINTER_DOTS[activePaperWidth]}, kickDrawer: ${kickDrawer})`
        )

        const { invoke } = await import('@tauri-apps/api/core')
        const msg = await invoke<string>('print_receipt_raw', {
          bytesBase64,
          printerName: printerName && printerName !== 'Default' ? printerName : null,
        })

        return { success: true, message: msg || 'تم إرسال الفاتورة للطابعة بنجاح' }
      } catch (err: any) {
        console.error('[directPrint] RAW Direct print failed:', err)
        return {
          success: false,
          message: err?.message || 'فشل في إرسال أمر الطباعة المباشرة',
        }
      }
    } else {
      window.print()
      return { success: true, message: 'تم فتح نافذة الطباعة' }
    }
  })
}

/**
 * Prints a direct test ticket to verify printer communication via RAW ESC/POS.
 */
export async function printTestReceiptDirect(
  printerName?: string,
  paperWidth?: PaperWidth
): Promise<PrintResult> {
  const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
  if (!isTauri) {
    return { success: false, message: 'الطباعة المباشرة تتطلب تطبيق سطح المكتب (Tauri)' }
  }

  const activePaperWidth = paperWidth || useSettingsStore.getState().receiptPaperWidth || '80mm'

  const testHtml = `
    <div style="font-size: 16px; font-weight: bold; margin-bottom: 2px;">MAKERS ELECTRONICS</div>
    <div style="font-size: 13px; margin-bottom: 4px;">مايكرز للإلكترونيات</div>
    <div style="font-size: 10px; color: #333; line-height: 1.4; margin-bottom: 6px;">
      <div>العاشر من رمضان - الموقف الجديد - مول City A</div>
      <div dir="ltr" style="font-weight: 500; white-space: nowrap; text-align: center;">01002126625 &nbsp;-&nbsp; 01505988928</div>
    </div>
    <div style="border-top: 1px solid #000; margin: 8px 0;"></div>
    <div style="font-size: 14px; font-weight: bold; margin: 6px 0;">اختبار الطباعة المباشرة (RAW ESC/POS)</div>
    <div style="font-size: 11px; margin-bottom: 4px;">Direct Thermal RAW Print: OK</div>
    <div style="font-size: 11px; margin-bottom: 4px;">الطابعة: ${printerName || 'XP-80C (Default)'}</div>
    <div style="font-size: 11px; margin-bottom: 4px;">عرض الورق: ${activePaperWidth} (${PRINTER_DOTS[activePaperWidth]} dots)</div>
    <div style="font-size: 10px; color: #333; margin-top: 6px;">${formatDate(new Date().toISOString(), true)}</div>
    <div style="border-top: 1px solid #000; margin: 8px 0;"></div>
    <div style="font-size: 11px; font-weight: bold;">تم الاختبار بنجاح</div>
  `

  return printReceiptDirect(testHtml, printerName, activePaperWidth)
}

export async function openCashDrawerDirect(printerName?: string): Promise<PrintResult> {
  const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
  if (!isTauri) {
    console.warn('[openCashDrawerDirect] Not running in Tauri environment')
    return { success: false, message: 'فتح الدرج متاح فقط عبر تطبيق سطح المكتب' }
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke<string>('open_cash_drawer', {
      printerName: printerName && printerName !== 'Default' ? printerName : null,
    })
    return { success: true, message: 'تم فتح الدرج النقدي بنجاح' }
  } catch (err: any) {
    console.error('[openCashDrawerDirect] Failed to kick cash drawer:', err)
    return { success: false, message: err?.message || 'فشل في إرسال إشارة فتح الدرج النقدي' }
  }
}



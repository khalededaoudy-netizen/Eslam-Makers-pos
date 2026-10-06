/**
 * MAKERS POS — Hardware Abstraction Layer
 * Unified hardware interactions routing to directPrint and Tauri native commands.
 */

import {
  getAvailablePrinters,
  openCashDrawerDirect,
  printReceiptDirect,
} from '@/services/printer/directPrint'

export interface PrinterConfig {
  port: string
  width: 58 | 80  // mm
  encoding: string
}

export interface ReceiptData {
  storeName: string
  storeSubtitle: string
  storePhone?: string
  invoiceNumber: string
  cashierName: string
  customerName?: string
  date: string
  time: string
  items: ReceiptItem[]
  subtotal: number
  discountAmount: number
  total: number
  payments: { method: string; amount: number }[]
  paidAmount: number
  changeAmount: number
  notes?: string
  footer?: string
}

export interface ReceiptItem {
  name: string
  qty: number
  unit: string
  unitPrice: number
  subtotal: number
}

export interface LabelConfig {
  width: number     // mm
  height: number    // mm
  showLogo: boolean
  showName: boolean
  showSku: boolean
  showPrice: boolean
  showBarcode: boolean
  copies: number
  barcodeType: 'code128' | 'ean13'
}

// ─── Printer Service ─────────────────────────────────────────────────────────

class PrinterService {
  private config: PrinterConfig = { port: '', width: 80, encoding: 'cp864' }

  configure(config: Partial<PrinterConfig>) {
    this.config = { ...this.config, ...config }
  }

  async printReceipt(elementOrHtml?: HTMLElement | string | null): Promise<boolean> {
    try {
      const printer = this.config.port || 'Default'
      const paperWidth = this.config.width === 58 ? '58mm' : '80mm'
      const res = await printReceiptDirect(elementOrHtml ?? null, printer, paperWidth)
      return res.success
    } catch (err) {
      console.error('[PrinterService] Error printing receipt:', err)
      return false
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const printers = await getAvailablePrinters()
      return printers.length > 0
    } catch {
      return false
    }
  }

  async getStatus(): Promise<'ready' | 'offline' | 'error'> {
    const ok = await this.testConnection()
    return ok ? 'ready' : 'offline'
  }
}

// ─── Cash Drawer Service ─────────────────────────────────────────────────────

class CashDrawerService {
  async open(printerName?: string): Promise<boolean> {
    try {
      const res = await openCashDrawerDirect(printerName)
      return res.success
    } catch (err) {
      console.error('[CashDrawerService] Error kicking drawer:', err)
      return false
    }
  }

  async test(printerName?: string): Promise<boolean> {
    return this.open(printerName)
  }
}

// ─── Scanner Service ─────────────────────────────────────────────────────────

class BarcodeScannerService {
  private callbacks: ((barcode: string) => void)[] = []
  private buffer = ''
  private timer: ReturnType<typeof setTimeout> | null = null
  private config = { prefix: '', suffix: '', timeout: 100 }

  configure(config: Partial<typeof this.config>) {
    this.config = { ...this.config, ...config }
  }

  onScan(callback: (barcode: string) => void) {
    this.callbacks.push(callback)
    return () => {
      this.callbacks = this.callbacks.filter(c => c !== callback)
    }
  }

  /** Process a keystroke from the HID scanner */
  processKey(key: string): void {
    if (key === 'Enter') {
      if (this.buffer.length >= 4) {
        this.emit(this.buffer)
      }
      this.buffer = ''
      if (this.timer) clearTimeout(this.timer)
      return
    }

    if (key.length === 1) {
      this.buffer += key
      if (this.timer) clearTimeout(this.timer)
      this.timer = setTimeout(() => { this.buffer = '' }, this.config.timeout)
    }
  }

  private emit(barcode: string) {
    for (const cb of this.callbacks) {
      cb(barcode)
    }
  }
}

// ─── Label Printer Service ────────────────────────────────────────────────────

class LabelPrinterService {
  async printLabel(data: {
    productName: string
    sku: string
    barcode: string
    price: number
    currencySymbol: string
  }, _config: LabelConfig): Promise<boolean> {
    try {
      if (typeof window !== 'undefined') {
        window.print()
        return true
      }
      console.log('[MockLabelPrinter] Label:', data)
      return true
    } catch (err) {
      console.error('[LabelPrinterService] Error:', err)
      return false
    }
  }
}

// ─── Hardware Manager (singleton) ────────────────────────────────────────────

class HardwareManager {
  readonly printer = new PrinterService()
  readonly cashDrawer = new CashDrawerService()
  readonly scanner = new BarcodeScannerService()
  readonly labelPrinter = new LabelPrinterService()
}

export const hardware = new HardwareManager()

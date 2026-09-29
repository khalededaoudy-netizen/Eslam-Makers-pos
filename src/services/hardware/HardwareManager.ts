/**
 * MAKERS POS — Hardware Abstraction Layer
 * All hardware interactions go through this service layer.
 * Real implementations are in Tauri Rust commands.
 * MockImplementation is used when hardware is unavailable.
 */

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
  private available = false

  configure(config: Partial<PrinterConfig>) {
    this.config = { ...this.config, ...config }
  }

  async printReceipt(data: ReceiptData): Promise<boolean> {
    try {
      if (typeof window !== 'undefined' && '__TAURI__' in window) {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('print_receipt', { data, config: this.config })
        return true
      }
      // Mock: log to console in dev
      console.log('[MockPrinter] Receipt:', data)
      return true
    } catch (err) {
      console.error('[PrinterService] Error:', err)
      return false
    }
  }

  async printTestReceipt(): Promise<boolean> {
    return this.printReceipt({
      storeName: 'MAKERS',
      storeSubtitle: 'Electronics Components & Makers Store',
      invoiceNumber: 'TEST-000001',
      cashierName: 'Test Cashier',
      date: new Date().toLocaleDateString('ar-EG'),
      time: new Date().toLocaleTimeString('ar-EG'),
      items: [
        { name: 'Resistor 1KΩ 1/4W', qty: 10, unit: 'pcs', unitPrice: 0.75, subtotal: 7.50 },
        { name: 'LED Red 5mm', qty: 5, unit: 'pcs', unitPrice: 1.5, subtotal: 7.50 },
      ],
      subtotal: 15,
      discountAmount: 0,
      total: 15,
      payments: [{ method: 'cash', amount: 20 }],
      paidAmount: 20,
      changeAmount: 5,
      footer: 'شكراً لتسوقكم مع MAKERS',
    })
  }

  async testConnection(): Promise<boolean> {
    try {
      if (typeof window !== 'undefined' && '__TAURI__' in window) {
        const { invoke } = await import('@tauri-apps/api/core')
        return await invoke<boolean>('test_printer')
      }
      console.log('[MockPrinter] Test connection: OK')
      return true
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
  async open(): Promise<boolean> {
    try {
      if (typeof window !== 'undefined' && '__TAURI__' in window) {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('open_cash_drawer')
        return true
      }
      console.log('[MockCashDrawer] Drawer opened')
      return true
    } catch (err) {
      console.error('[CashDrawerService] Error:', err)
      return false
    }
  }

  async test(): Promise<boolean> {
    return this.open()
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
  }, config: LabelConfig): Promise<boolean> {
    try {
      if (typeof window !== 'undefined' && '__TAURI__' in window) {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('print_barcode_label', { data, config })
        return true
      }
      console.log('[MockLabelPrinter] Label:', data, config)
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

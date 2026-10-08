/**
 * MAKERS POS — Customer Debt Management Service
 * Handles customer credit tracking, debt overview KPIs, chronological statements,
 * atomic debt payment processing, aging buckets, and payment vouchers.
 */

import { v4 as uuidv4 } from 'uuid'
import { getDb, withTransaction } from '@/services/db/database'
import { auditService } from '@/services/audit/auditService'
import { Customer } from './types'
import { UserContext } from './customerService'

export type DebtPaymentMethod = 'cash' | 'instapay' | 'wallet'

export interface RecordCustomerPaymentInput {
  customerId: string
  amount: number
  method: DebtPaymentMethod
  reference?: string
  notes?: string
  paymentDate?: string
  shiftId?: string | null
  registerId?: string | null
}

export interface DebtorCustomerListItem extends Customer {
  last_payment_date: string | null
  last_sale_date: string | null
  days_overdue: number
  aging_bucket: 'current' | '30+' | '60+' | '90+'
}

export interface DebtOverviewKPIs {
  totalOwed: number
  debtorsCount: number
  avgDebt: number
  overdue30Amount: number
  overdue30Count: number
  overdue60Amount: number
  overdue60Count: number
  overdue90Amount: number
  overdue90Count: number
  currentAmount: number
  currentCount: number
}

export interface StatementEntry {
  id: string
  date: string
  type: 'sale' | 'payment' | 'return' | 'opening_balance'
  referenceNumber: string
  description: string
  notes?: string | null
  debit: number
  credit: number
  runningBalance: number
  paymentMethod?: string
}

export interface CustomerStatement {
  customer: Customer
  entries: StatementEntry[]
  totalDebit: number
  totalCredit: number
  currentBalance: number
  generatedAt: string
}

export interface AgingBucketReport {
  bucket: '0-30' | '31-60' | '61-90' | '90+'
  bucketLabelAr: string
  bucketLabelEn: string
  customersCount: number
  totalAmount: number
  percentage: number
}

export interface DebtAgingReport {
  buckets: AgingBucketReport[]
  totalDebt: number
  totalDebtors: number
  debtors: DebtorCustomerListItem[]
}

export interface PaymentVoucherData {
  voucherNumber: string
  paymentId: string
  date: string
  customerName: string
  customerCode: string
  customerPhone?: string | null
  amount: number
  amountWordsAr: string
  paymentMethod: DebtPaymentMethod
  reference?: string | null
  notes?: string | null
  previousBalance: number
  remainingBalance: number
  cashierName?: string
}

class CustomerDebtService {
  /**
   * Calculate Days Difference between a past ISO date and now
   */
  private calculateDaysSince(pastDateStr: string | null): number {
    if (!pastDateStr) return 0
    const then = new Date(pastDateStr).getTime()
    const now = Date.now()
    const diffMs = now - then
    if (diffMs <= 0) return 0
    return Math.floor(diffMs / (1000 * 60 * 60 * 24))
  }

  /**
   * Determine bucket based on days overdue
   */
  private getAgingBucket(days: number): 'current' | '30+' | '60+' | '90+' {
    if (days > 90) return '90+'
    if (days > 60) return '60+'
    if (days > 30) return '30+'
    return 'current'
  }

  /**
   * Convert Arabic number into words for payment vouchers
   */
  formatAmountInWordsAr(amount: number): string {
    const units = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة']
    const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر']
    const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون']
    const hundreds = ['', 'مائة', 'مئتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة']

    const integerPart = Math.floor(amount)
    const piastres = Math.round((amount - integerPart) * 100)

    if (integerPart === 0 && piastres === 0) return 'صفر جنيه مصري فقط لا غير'

    function convertGroup(n: number): string {
      let res = ''
      const h = Math.floor(n / 100)
      const remainder = n % 100
      const t = Math.floor(remainder / 10)
      const u = remainder % 10

      if (h > 0) {
        res += hundreds[h]
      }

      if (remainder > 0) {
        if (res) res += ' و'
        if (remainder < 11) {
          res += units[remainder]
        } else if (remainder < 20) {
          res += teens[remainder - 10]
        } else {
          if (u > 0) {
            res += units[u] + ' و'
          }
          res += tens[t]
        }
      }
      return res
    }

    let words = ''
    const thousands = Math.floor(integerPart / 1000)
    const remThousand = integerPart % 1000

    if (thousands > 0) {
      if (thousands === 1) words += 'ألف'
      else if (thousands === 2) words += 'ألفان'
      else if (thousands >= 3 && thousands <= 10) words += `${convertGroup(thousands)} آلاف`
      else words += `${convertGroup(thousands)} ألف`
    }

    if (remThousand > 0) {
      if (words) words += ' و'
      words += convertGroup(remThousand)
    }

    words += ' جنيه مصري'

    if (piastres > 0) {
      words += ` و${convertGroup(piastres)} قرش`
    }

    return `فقط ${words} لا غير`
  }

  /**
   * Get overall customer debt KPIs
   */
  async getDebtOverview(): Promise<DebtOverviewKPIs> {
    const db = getDb()

    // Fetch all customers with positive balance along with their latest activity
    const debtors = await db.select<Array<{
      id: string
      balance: number
      last_payment: string | null
      last_sale: string | null
      created_at: string
    }>>(`
      SELECT
        c.id,
        c.balance,
        c.created_at,
        (SELECT MAX(p.created_at) FROM payments p WHERE p.customer_id = c.id) as last_payment,
        (SELECT MAX(s.created_at) FROM sales s WHERE s.customer_id = c.id) as last_sale
      FROM customers c
      WHERE c.balance > 0 AND (c.is_active = 1 OR c.archived_at IS NULL)
    `)

    let totalOwed = 0
    let overdue30Amount = 0
    let overdue30Count = 0
    let overdue60Amount = 0
    let overdue60Count = 0
    let overdue90Amount = 0
    let overdue90Count = 0
    let currentAmount = 0
    let currentCount = 0

    for (const d of debtors) {
      const bal = Number(d.balance) || 0
      totalOwed += bal

      // Reference date: latest payment, fallback to latest sale, fallback to account creation
      const refDate = d.last_payment || d.last_sale || d.created_at
      const days = this.calculateDaysSince(refDate)

      if (days > 90) {
        overdue90Amount += bal
        overdue90Count += 1
      } else if (days > 60) {
        overdue60Amount += bal
        overdue60Count += 1
      } else if (days > 30) {
        overdue30Amount += bal
        overdue30Count += 1
      } else {
        currentAmount += bal
        currentCount += 1
      }
    }

    const debtorsCount = debtors.length
    const avgDebt = debtorsCount > 0 ? Number((totalOwed / debtorsCount).toFixed(2)) : 0

    return {
      totalOwed: Number(totalOwed.toFixed(2)),
      debtorsCount,
      avgDebt,
      overdue30Amount: Number(overdue30Amount.toFixed(2)),
      overdue30Count,
      overdue60Amount: Number(overdue60Amount.toFixed(2)),
      overdue60Count,
      overdue90Amount: Number(overdue90Amount.toFixed(2)),
      overdue90Count,
      currentAmount: Number(currentAmount.toFixed(2)),
      currentCount,
    }
  }

  /**
   * Get filterable and sortable list of customers with balance > 0
   */
  async getDebtors(params?: {
    search?: string
    filter?: 'all' | 'overdue30' | 'overdue60' | 'overdue90' | 'current'
    sortBy?: 'balance_desc' | 'balance_asc' | 'days_desc' | 'name_asc'
  }): Promise<DebtorCustomerListItem[]> {
    const db = getDb()

    let query = `
      SELECT
        c.*,
        (SELECT MAX(p.created_at) FROM payments p WHERE p.customer_id = c.id) as last_payment_date,
        (SELECT MAX(s.created_at) FROM sales s WHERE s.customer_id = c.id) as last_sale_date
      FROM customers c
      WHERE c.balance > 0
    `
    const sqlParams: unknown[] = []

    if (params?.search && params.search.trim()) {
      const q = `%${params.search.trim()}%`
      query += ` AND (c.name LIKE ? OR c.customer_code LIKE ? OR c.phone LIKE ? OR c.whatsapp LIKE ?)`
      sqlParams.push(q, q, q, q)
    }

    const rows = await db.select<Array<Customer & { last_payment_date: string | null; last_sale_date: string | null }>>(
      query,
      sqlParams
    )

    let items: DebtorCustomerListItem[] = rows.map(r => {
      const refDate = r.last_payment_date || r.last_sale_date || r.created_at
      const days = this.calculateDaysSince(refDate)
      const bucket = this.getAgingBucket(days)
      return {
        ...r,
        balance: Number(r.balance) || 0,
        credit_limit: Number(r.credit_limit) || 0,
        days_overdue: days,
        aging_bucket: bucket,
      }
    })

    // Filter by bucket if specified
    if (params?.filter && params.filter !== 'all') {
      if (params.filter === 'overdue30') {
        items = items.filter(i => i.days_overdue > 30)
      } else if (params.filter === 'overdue60') {
        items = items.filter(i => i.days_overdue > 60)
      } else if (params.filter === 'overdue90') {
        items = items.filter(i => i.days_overdue > 90)
      } else if (params.filter === 'current') {
        items = items.filter(i => i.days_overdue <= 30)
      }
    }

    // Sort items
    const sortBy = params?.sortBy || 'balance_desc'
    items.sort((a, b) => {
      if (sortBy === 'balance_desc') return b.balance - a.balance
      if (sortBy === 'balance_asc') return a.balance - b.balance
      if (sortBy === 'days_desc') return b.days_overdue - a.days_overdue
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name, 'ar')
      return 0
    })

    return items
  }

  /**
   * Get Chronological Customer Account Statement (كشف حساب العميل)
   */
  async getCustomerStatement(customerId: string): Promise<CustomerStatement> {
    const db = getDb()

    const custRows = await db.select<Customer[]>('SELECT * FROM customers WHERE id = ? LIMIT 1', [customerId])
    if (!custRows || custRows.length === 0) {
      throw new Error('Customer not found')
    }
    const customer = custRows[0]

    // 1. Fetch Sales
    const sales = await db.select<Array<{
      id: string
      invoice_number: string
      total: number
      paid_amount: number
      status: string
      created_at: string
      notes: string | null
    }>>(`
      SELECT id, invoice_number, total, paid_amount, status, created_at, notes
      FROM sales
      WHERE customer_id = ? AND status != 'cancelled'
      ORDER BY created_at ASC
    `, [customerId])

    // 2. Fetch Payments (Both POS payments and debt payments)
    const payments = await db.select<Array<{
      id: string
      sale_id: string | null
      amount: number
      method: string
      reference: string | null
      notes: string | null
      created_at: string
    }>>(`
      SELECT id, sale_id, amount, method, reference, notes, created_at
      FROM payments
      WHERE customer_id = ?
      ORDER BY created_at ASC
    `, [customerId])

    // 3. Fetch Returns
    const returns = await db.select<Array<{
      id: string
      return_number: string
      refund_amount: number
      status: string
      created_at: string
      notes: string | null
    }>>(`
      SELECT id, return_number, refund_amount, status, created_at, notes
      FROM returns
      WHERE customer_id = ? AND status = 'completed'
      ORDER BY created_at ASC
    `, [customerId])

    // Map each event into an intermediate transaction
    interface RawEvent {
      id: string
      date: string
      type: 'sale' | 'payment' | 'return'
      referenceNumber: string
      description: string
      notes?: string | null
      debit: number
      credit: number
      method?: string
    }

    const events: RawEvent[] = []

    for (const s of sales) {
      events.push({
        id: s.id,
        date: s.created_at,
        type: 'sale',
        referenceNumber: s.invoice_number,
        description: `فاتورة مبيعات (${s.invoice_number})`,
        notes: s.notes,
        debit: Number(s.total) || 0,
        credit: 0,
      })
    }

    for (const p of payments) {
      const isPosPayment = !!p.sale_id
      const methodLabel = p.method === 'cash' ? 'نقدي' : p.method === 'instapay' ? 'انستاباي' : 'محفظة إلكترونية'
      const desc = isPosPayment
        ? `سداد فاتورة (${methodLabel})`
        : `سداد مديونية (${methodLabel})`

      events.push({
        id: p.id,
        date: p.created_at,
        type: 'payment',
        referenceNumber: p.reference ? `Ref: ${p.reference}` : p.id.slice(0, 8),
        description: desc,
        notes: p.notes,
        debit: 0,
        credit: Number(p.amount) || 0,
        method: p.method,
      })
    }

    for (const r of returns) {
      events.push({
        id: r.id,
        date: r.created_at,
        type: 'return',
        referenceNumber: r.return_number,
        description: `مرتجع مبيعات (${r.return_number})`,
        notes: r.notes,
        debit: 0,
        credit: Number(r.refund_amount) || 0,
      })
    }

    // Sort chronologically ascending to calculate running balance accurately
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Check if there is an unexplained difference between ledger sum and customer balance
    let ledgerDebit = 0
    let ledgerCredit = 0
    for (const ev of events) {
      ledgerDebit += ev.debit
      ledgerCredit += ev.credit
    }

    const expectedCurrentBalance = Number(customer.balance) || 0
    const calculatedBalance = ledgerDebit - ledgerCredit
    const openingDifference = Number((expectedCurrentBalance - calculatedBalance).toFixed(2))

    const entries: StatementEntry[] = []
    let running = 0

    // If an initial balance existed before ledger tracking, add opening balance row
    if (openingDifference > 0) {
      running += openingDifference
      entries.push({
        id: 'opening-balance',
        date: customer.created_at,
        type: 'opening_balance',
        referenceNumber: 'OPEN-BAL',
        description: 'رصيد افتتاحي سابق / تسوية رصيد',
        debit: openingDifference,
        credit: 0,
        runningBalance: Number(running.toFixed(2)),
      })
      ledgerDebit += openingDifference
    }

    for (const ev of events) {
      running += ev.debit - ev.credit
      entries.push({
        id: ev.id,
        date: ev.date,
        type: ev.type,
        referenceNumber: ev.referenceNumber,
        description: ev.description,
        notes: ev.notes,
        debit: ev.debit,
        credit: ev.credit,
        runningBalance: Number(running.toFixed(2)),
        paymentMethod: ev.method,
      })
    }

    return {
      customer,
      // Present statement with newest entries first for intuitive user reading
      entries: [...entries].reverse(),
      totalDebit: Number(ledgerDebit.toFixed(2)),
      totalCredit: Number(ledgerCredit.toFixed(2)),
      currentBalance: expectedCurrentBalance,
      generatedAt: new Date().toISOString(),
    }
  }

  /**
   * Record Customer Debt Settlement Payment (Atomic SQLite Transaction)
   */
  async recordCustomerPayment(
    input: RecordCustomerPaymentInput,
    user?: UserContext
  ): Promise<PaymentVoucherData> {
    const db = getDb()

    if (!input.customerId) {
      throw new Error('Customer ID is required')
    }
    const amount = Number(input.amount)
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Payment amount must be greater than zero')
    }
    if (!['cash', 'instapay', 'wallet'].includes(input.method)) {
      throw new Error('Invalid payment method. Allowed: cash, instapay, wallet')
    }
    if (['instapay', 'wallet'].includes(input.method) && !input.reference?.trim()) {
      throw new Error('Phone reference is required for InstaPay and Wallet payments')
    }

    const custRows = await db.select<Customer[]>('SELECT * FROM customers WHERE id = ? LIMIT 1', [input.customerId])
    if (!custRows || custRows.length === 0) {
      throw new Error('Customer not found')
    }
    const customer = custRows[0]
    const previousBalance = Number(customer.balance) || 0
    const remainingBalance = Number((previousBalance - amount).toFixed(2))

    // Determine active register and shift if available
    let shiftId = input.shiftId || null
    let registerId = input.registerId || null

    if (!shiftId || !registerId) {
      const openShifts = await db.select<Array<{ id: string; register_id: string }>>(
        "SELECT id, register_id FROM shifts WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1"
      )
      if (openShifts.length > 0) {
        shiftId = shiftId || openShifts[0].id
        registerId = registerId || openShifts[0].register_id
      }
    }

    if (!registerId) {
      const regRows = await db.select<Array<{ id: string }>>('SELECT id FROM cash_registers WHERE is_active = 1 LIMIT 1')
      if (regRows.length > 0) {
        registerId = regRows[0].id
      }
    }

    const paymentId = uuidv4()
    const paymentTimestamp = input.paymentDate || new Date().toISOString()
    const voucherNumber = `REC-${Date.now().toString().slice(-6)}`

    // Execute Atomic SQLite Transaction
    await withTransaction(async (d) => {
      // 1. Insert into payments
      await d.execute(`
        INSERT INTO payments (
          id, sale_id, shift_id, register_id, user_id, customer_id,
          method, amount, reference, notes, created_at
        ) VALUES (
          ?, NULL, ?, ?, ?, ?,
          ?, ?, ?, ?, ?
        )
      `, [
        paymentId,
        shiftId,
        registerId,
        user?.id || null,
        customer.id,
        input.method,
        amount,
        input.reference?.trim() || null,
        input.notes?.trim() || null,
        paymentTimestamp,
      ])

      // 2. Atomically update customer balance
      await d.execute(`
        UPDATE customers
        SET balance = balance - ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE id = ?
      `, [amount, customer.id])

      // 3. If Cash payment, record in cash drawer movements
      if (input.method === 'cash' && registerId && shiftId) {
        const cashMovId = uuidv4()
        await d.execute(`
          INSERT INTO cash_movements (
            id, register_id, shift_id, user_id, amount,
            type, direction, payment_method, reason, reference_id, reference_type, notes, created_at
          ) VALUES (
            ?, ?, ?, ?, ?,
            'customer_payment', 'in', 'cash', ?, ?, 'customer_payment', ?, ?
          )
        `, [
          cashMovId,
          registerId,
          shiftId,
          user?.id || null,
          amount,
          `سداد مديونية عميل: ${customer.name} (${customer.customer_code})`,
          paymentId,
          input.notes?.trim() || null,
          paymentTimestamp,
        ])
      }
    })

    // 4. Audit Log
    await auditService.log({
      userId: user?.id,
      userFullName: user?.fullName,
      action: 'customer_payment',
      resource: 'customers',
      resourceId: customer.id,
      details: {
        paymentId,
        voucherNumber,
        customerCode: customer.customer_code,
        customerName: customer.name,
        amount,
        method: input.method,
        reference: input.reference,
        previousBalance,
        remainingBalance,
      },
    })

    return {
      voucherNumber,
      paymentId,
      date: paymentTimestamp,
      customerName: customer.name,
      customerCode: customer.customer_code,
      customerPhone: customer.phone,
      amount,
      amountWordsAr: this.formatAmountInWordsAr(amount),
      paymentMethod: input.method,
      reference: input.reference || null,
      notes: input.notes || null,
      previousBalance,
      remainingBalance,
      cashierName: user?.fullName,
    }
  }

  /**
   * Get Debt Aging Report (تقرير أعمار الديون)
   */
  async getAgingReport(): Promise<DebtAgingReport> {
    const debtors = await this.getDebtors({ filter: 'all', sortBy: 'days_desc' })

    let sum0to30 = 0
    let count0to30 = 0
    let sum31to60 = 0
    let count31to60 = 0
    let sum61to90 = 0
    let count61to90 = 0
    let sum90plus = 0
    let count90plus = 0

    let totalDebt = 0

    for (const d of debtors) {
      totalDebt += d.balance
      if (d.days_overdue > 90) {
        sum90plus += d.balance
        count90plus++
      } else if (d.days_overdue > 60) {
        sum61to90 += d.balance
        count61to90++
      } else if (d.days_overdue > 30) {
        sum31to60 += d.balance
        count31to60++
      } else {
        sum0to30 += d.balance
        count0to30++
      }
    }

    const calcPct = (amt: number) => (totalDebt > 0 ? Number(((amt / totalDebt) * 100).toFixed(1)) : 0)

    const buckets: AgingBucketReport[] = [
      {
        bucket: '0-30',
        bucketLabelAr: 'حالي (0 - 30 يوم)',
        bucketLabelEn: 'Current (0-30 days)',
        customersCount: count0to30,
        totalAmount: Number(sum0to30.toFixed(2)),
        percentage: calcPct(sum0to30),
      },
      {
        bucket: '31-60',
        bucketLabelAr: 'متأخر (31 - 60 يوم)',
        bucketLabelEn: 'Overdue (31-60 days)',
        customersCount: count31to60,
        totalAmount: Number(sum31to60.toFixed(2)),
        percentage: calcPct(sum31to60),
      },
      {
        bucket: '61-90',
        bucketLabelAr: 'متأخر (61 - 90 يوم)',
        bucketLabelEn: 'Overdue (61-90 days)',
        customersCount: count61to90,
        totalAmount: Number(sum61to90.toFixed(2)),
        percentage: calcPct(sum61to90),
      },
      {
        bucket: '90+',
        bucketLabelAr: 'متعثر (أكثر من 90 يوم)',
        bucketLabelEn: 'Overdue (90+ days)',
        customersCount: count90plus,
        totalAmount: Number(sum90plus.toFixed(2)),
        percentage: calcPct(sum90plus),
      },
    ]

    return {
      buckets,
      totalDebt: Number(totalDebt.toFixed(2)),
      totalDebtors: debtors.length,
      debtors,
    }
  }
}

export const customerDebtService = new CustomerDebtService()

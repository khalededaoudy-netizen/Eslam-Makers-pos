/**
 * MAKERS POS — Payment Service
 * Centralized payment processor for Cash, Card, InstaPay, Vodafone Cash, Bank Transfers, and Split Payments.
 */

import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/services/db/database'
import { withTransaction } from '@/services/db/transaction'
import { auditService } from '@/services/audit/auditService'
import {
  PaymentRecord,
  CreatePaymentInput,
  SplitPaymentInput,
  PAYMENT_METHODS,
  PaymentMethodType,
} from './types'

export interface UserContext {
  id: string
  fullName?: string
  role?: string
}

class PaymentService {
  /**
   * Validate payment input rules
   */
  private validatePaymentInput(input: CreatePaymentInput) {
    if (isNaN(input.amount) || input.amount <= 0) {
      throw new Error('Payment amount must be greater than zero')
    }

    if (!PAYMENT_METHODS[input.method]) {
      throw new Error(`Invalid payment method: ${input.method}`)
    }

    if (!input.shiftId) {
      throw new Error('Active shift ID is required for recording payment')
    }
  }

  /**
   * Create a single payment record attached to an active shift
   */
  async createPayment(
    input: CreatePaymentInput,
    user?: UserContext
  ): Promise<PaymentRecord> {
    this.validatePaymentInput(input)

    const db = getDb()

    // Ensure shift is active & open
    const shiftRows = await db.select<Array<{ id: string; status: string; register_id: string }>>(
      'SELECT id, status, register_id FROM shifts WHERE id = ? LIMIT 1',
      [input.shiftId]
    )

    if (!shiftRows || shiftRows.length === 0) {
      throw new Error('Shift not found')
    }

    if (shiftRows[0].status !== 'open') {
      throw new Error('Cannot record payments against a closed shift')
    }

    const registerId = input.registerId || shiftRows[0].register_id
    const paymentId = uuidv4()
    const userId = user?.id || input.userId

    await withTransaction(async (d) => {
      // 1. Insert Payment Record
      await d.execute(`
        INSERT INTO payments (
          id, sale_id, shift_id, register_id, user_id, customer_id,
          method, amount, reference, notes, created_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        )
      `, [
        paymentId,
        input.saleId || null,
        input.shiftId,
        registerId,
        userId,
        input.customerId || null,
        input.method,
        input.amount,
        input.reference || null,
        input.notes || null,
      ])

      // 2. If Cash: Record in cash_movements ledger to update physical drawer cash
      if (input.method === 'cash') {
        const movementId = uuidv4()
        await d.execute(`
          INSERT INTO cash_movements (
            id, register_id, shift_id, user_id, amount,
            type, direction, reason, reference_id, reference_type, notes, created_at
          ) VALUES (
            ?, ?, ?, ?, ?,
            'sale_cash', 'in', 'مبيعات نقدية POS', ?, 'payment', ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
          )
        `, [
          movementId,
          registerId,
          input.shiftId,
          userId,
          input.amount,
          paymentId,
          input.notes || null,
        ])
      }
    })

    // Audit log
    await auditService.log({
      userId,
      userFullName: user?.fullName || 'Cashier',
      action: 'create_payment',
      resource: 'payments',
      resourceId: paymentId,
      details: {
        shiftId: input.shiftId,
        method: input.method,
        amount: input.amount,
        saleId: input.saleId,
      },
    })

    const rows = await db.select<PaymentRecord[]>('SELECT * FROM payments WHERE id = ?', [paymentId])
    return rows[0]
  }

  /**
   * Process Split Payments (Multiple payment methods for one transaction)
   */
  async createSplitPayment(
    input: SplitPaymentInput,
    user?: UserContext
  ): Promise<PaymentRecord[]> {
    if (!input.payments || input.payments.length === 0) {
      throw new Error('Split payment must contain at least one payment item')
    }

    const createdRecords: PaymentRecord[] = []
    for (const p of input.payments) {
      const rec = await this.createPayment({
        saleId: input.saleId,
        shiftId: input.shiftId,
        registerId: input.registerId,
        userId: input.userId,
        customerId: input.customerId,
        method: p.method,
        amount: p.amount,
        reference: p.reference,
        notes: p.notes,
      }, user)
      createdRecords.push(rec)
    }

    return createdRecords
  }

  /**
   * Get all payments recorded for a shift
   */
  async getPaymentsForShift(shiftId: string): Promise<PaymentRecord[]> {
    const db = getDb()
    return db.select<PaymentRecord[]>(
      'SELECT * FROM payments WHERE shift_id = ? ORDER BY created_at DESC',
      [shiftId]
    )
  }

  /**
   * Query payments history with filters
   */
  async getPaymentsHistory(options?: {
    shiftId?: string
    method?: PaymentMethodType
    limit?: number
  }): Promise<PaymentRecord[]> {
    const db = getDb()
    const conditions: string[] = []
    const params: unknown[] = []

    if (options?.shiftId) {
      conditions.push('shift_id = ?')
      params.push(options.shiftId)
    }

    if (options?.method) {
      conditions.push('method = ?')
      params.push(options.method)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const limit = options?.limit ?? 100

    return db.select<PaymentRecord[]>(
      `SELECT * FROM payments ${whereClause} ORDER BY created_at DESC LIMIT ?`,
      [...params, limit]
    )
  }
}

export const paymentService = new PaymentService()

/**
 * MAKERS POS — Cash Register & Shift Service
 * Authoritative financial source of truth for Cash Registers, Shift Sessions, Cash Movements Ledger, and Reconciliation.
 */

import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/services/db/database'
import { auditService } from '@/services/audit/auditService'
import {
  CashRegister,
  Shift,
  CashMovement,
  ShiftReconciliation,
  OpenShiftInput,
  CloseShiftInput,
  CreateCashMovementInput,
} from './types'
import { PaymentMethodType } from '@/features/payments/types'

export interface UserContext {
  id: string
  fullName?: string
  role?: string
}

class CashRegisterService {
  /**
   * Get all active cash registers
   */
  async getCashRegisters(): Promise<CashRegister[]> {
    const db = getDb()
    return db.select<CashRegister[]>('SELECT * FROM cash_registers WHERE is_active = 1 ORDER BY created_at ASC')
  }

  /**
   * Get currently active open shift for a user or register
   */
  async getActiveShift(userId?: string, registerId?: string): Promise<Shift | null> {
    const db = getDb()
    const conditions = ["s.status = 'open'"]
    const params: unknown[] = []

    if (userId) {
      conditions.push('s.user_id = ?')
      params.push(userId)
    }

    if (registerId) {
      conditions.push('s.register_id = ?')
      params.push(registerId)
    }

    const query = `
      SELECT s.*, cr.name as register_name, u.full_name as user_full_name
      FROM shifts s
      LEFT JOIN cash_registers cr ON cr.id = s.register_id
      LEFT JOIN users u ON u.id = s.user_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY s.opened_at DESC
      LIMIT 1
    `

    const rows = await db.select<Shift[]>(query, params)
    if (rows && rows.length > 0) return rows[0]

    // If querying without specific filters, return the latest global open shift
    if (!userId && !registerId) {
      const allOpen = await db.select<Shift[]>(`
        SELECT s.*, cr.name as register_name, u.full_name as user_full_name
        FROM shifts s
        LEFT JOIN cash_registers cr ON cr.id = s.register_id
        LEFT JOIN users u ON u.id = s.user_id
        WHERE s.status = 'open'
        ORDER BY s.opened_at DESC
        LIMIT 1
      `)
      return allOpen && allOpen.length > 0 ? allOpen[0] : null
    }

    return null
  }

  /**
   * Open a new shift session
   */
  async openShift(input: OpenShiftInput, user: UserContext): Promise<Shift> {
    const db = getDb()
    const openingBalance = Number(input.openingBalance)
    if (isNaN(openingBalance) || openingBalance < 0) {
      throw new Error('Opening balance must be a non-negative number')
    }

    // Rule 1: One active shift per user
    const userOpenShifts = await db.select<Array<{ id: string }>>(
      "SELECT id FROM shifts WHERE user_id = ? AND status = 'open' LIMIT 1",
      [user.id]
    )
    if (userOpenShifts && userOpenShifts.length > 0) {
      throw new Error('User already has an open shift in progress')
    }

    // Rule 2: One active shift per register
    const regOpenShifts = await db.select<Array<{ id: string }>>(
      "SELECT id FROM shifts WHERE register_id = ? AND status = 'open' LIMIT 1",
      [input.registerId]
    )
    if (regOpenShifts && regOpenShifts.length > 0) {
      throw new Error('Selected cash register already has an active open shift')
    }

    const shiftId = uuidv4()
    const movementId = uuidv4()

    // Atomic transaction: create shift + record opening cash movement
    await db.execute('BEGIN TRANSACTION')
    try {
      await db.execute(`
        INSERT INTO shifts (
          id, register_id, user_id, status, opening_balance,
          cash_sales, cash_refunds, cash_expenses, cash_withdrawals, cash_deposits,
          notes, opened_at, created_at, updated_at
        ) VALUES (
          ?, ?, ?, 'open', ?,
          0, 0, 0, 0, 0,
          ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
          strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        )
      `, [shiftId, input.registerId, user.id, openingBalance, input.notes || null])

      // Record opening cash movement in ledger
      await db.execute(`
        INSERT INTO cash_movements (
          id, register_id, shift_id, user_id, amount,
          type, direction, reason, notes, created_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          'opening', 'in', 'رصيد افتتاح الوردية', ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        )
      `, [movementId, input.registerId, shiftId, user.id, openingBalance, input.notes || null])

      await db.execute('COMMIT')
    } catch (err) {
      await db.execute('ROLLBACK')
      throw err
    }

    // Audit trail
    await auditService.log({
      userId: user.id,
      userFullName: user.fullName || 'Cashier',
      action: 'open_shift',
      resource: 'shifts',
      resourceId: shiftId,
      details: {
        registerId: input.registerId,
        openingBalance,
      },
    })

    const created = await this.getActiveShift(user.id)
    return created!
  }

  /**
   * Record manual Cash In / Cash Out movement in the ledger
   */
  async recordCashMovement(
    input: CreateCashMovementInput,
    user: UserContext
  ): Promise<CashMovement> {
    const db = getDb()
    const amount = Number(input.amount)
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Cash movement amount must be greater than zero')
    }

    const trimmedReason = input.reason?.trim()
    if (!trimmedReason) {
      throw new Error('A valid reason is required for cash movements')
    }

    // Ensure shift is currently open
    const shiftRows = await db.select<Array<{ id: string; status: string; register_id: string }>>(
      'SELECT id, status, register_id FROM shifts WHERE id = ? LIMIT 1',
      [input.shiftId]
    )
    if (!shiftRows || shiftRows.length === 0) {
      throw new Error('Shift not found')
    }
    if (shiftRows[0].status !== 'open') {
      throw new Error('Cannot record cash movement on a closed shift')
    }

    const movementId = uuidv4()
    const registerId = input.registerId || shiftRows[0].register_id

    await db.execute('BEGIN TRANSACTION')
    try {
      await db.execute(`
        INSERT INTO cash_movements (
          id, register_id, shift_id, user_id, amount,
          type, direction, reason, notes, created_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        )
      `, [
        movementId,
        registerId,
        input.shiftId,
        user.id,
        amount,
        input.type,
        input.direction,
        trimmedReason,
        input.notes || null,
      ])

      // Update shift summary counters
      if (input.direction === 'in') {
        await db.execute(
          'UPDATE shifts SET cash_deposits = cash_deposits + ?, updated_at = strftime("%Y-%m-%dT%H:%M:%SZ", "now") WHERE id = ?',
          [amount, input.shiftId]
        )
      } else {
        await db.execute(
          'UPDATE shifts SET cash_withdrawals = cash_withdrawals + ?, updated_at = strftime("%Y-%m-%dT%H:%M:%SZ", "now") WHERE id = ?',
          [amount, input.shiftId]
        )
      }

      await db.execute('COMMIT')
    } catch (err) {
      await db.execute('ROLLBACK')
      throw err
    }

    // Audit trail
    await auditService.log({
      userId: user.id,
      userFullName: user.fullName || 'Cashier',
      action: input.direction === 'in' ? 'cash_in' : 'cash_out',
      resource: 'cash_movements',
      resourceId: movementId,
      details: {
        shiftId: input.shiftId,
        amount,
        type: input.type,
        reason: trimmedReason,
      },
    })

    const rows = await db.select<CashMovement[]>('SELECT * FROM cash_movements WHERE id = ?', [movementId])
    return rows[0]
  }

  /**
   * Calculate Authoritative Shift Reconciliation & Financial Summary
   */
  async getShiftReconciliation(shiftId: string): Promise<ShiftReconciliation> {
    const db = getDb()
    const shiftRows = await db.select<Shift[]>('SELECT * FROM shifts WHERE id = ? LIMIT 1', [shiftId])
    if (!shiftRows || shiftRows.length === 0) {
      throw new Error('Shift not found')
    }
    const shift = shiftRows[0]

    // 1. Aggregate cash movements in ledger
    const movementRows = await db.select<Array<{ type: string; direction: string; total: number }>>(`
      SELECT type, direction, SUM(amount) as total
      FROM cash_movements
      WHERE shift_id = ?
      GROUP BY type, direction
    `, [shiftId])

    let totalCashIn = 0
    let totalCashOut = 0

    for (const m of movementRows) {
      const amt = Number(m.total) || 0
      if (m.type === 'cash_in' || (m.direction === 'in' && m.type !== 'opening' && m.type !== 'sale_cash')) {
        totalCashIn += amt
      } else if (m.type === 'cash_out' || m.type === 'refund' || (m.direction === 'out' && m.type !== 'closing')) {
        totalCashOut += amt
      }
    }

    // 2. Aggregate payments by payment method for this shift
    const paymentRows = await db.select<Array<{ method: string; total: number }>>(`
      SELECT method, SUM(amount) as total
      FROM payments
      WHERE shift_id = ?
      GROUP BY method
    `, [shiftId])

    const paymentsByMethod: Record<PaymentMethodType, number> = {
      cash: 0,
      card: 0,
      instapay: 0,
      vodafone_cash: 0,
      bank_transfer: 0,
      other: 0,
    }

    let totalAllPayments = 0
    for (const p of paymentRows) {
      const amt = Number(p.total) || 0
      const method = (p.method || 'cash').toLowerCase() as PaymentMethodType
      if (paymentsByMethod[method] !== undefined) {
        paymentsByMethod[method] += amt
      } else {
        paymentsByMethod.other += amt
      }
      totalAllPayments += amt
    }

    const totalCashSales = paymentsByMethod.cash
    const totalCashRefunds = 0 // Prepared for Returns phase

    // Expected Physical Drawer Cash = Opening + Cash In + Cash Sales - Cash Out - Cash Refunds
    const openingBalance = Number(shift.opening_balance) || 0
    const rawExpectedPhysicalCash = openingBalance + totalCashIn + totalCashSales - totalCashOut - totalCashRefunds
    const expectedPhysicalCash = Number(rawExpectedPhysicalCash.toFixed(2))

    const actualCashCounted = shift.closing_balance !== null ? Number(shift.closing_balance) : null
    const difference = actualCashCounted !== null ? Number((actualCashCounted - expectedPhysicalCash).toFixed(2)) : null

    return {
      shiftId: shift.id,
      status: shift.status,
      openedAt: shift.opened_at,
      closedAt: shift.closed_at,
      openingBalance,
      totalCashIn: Number(totalCashIn.toFixed(2)),
      totalCashSales: Number(totalCashSales.toFixed(2)),
      totalCashOut: Number(totalCashOut.toFixed(2)),
      totalCashRefunds: Number(totalCashRefunds.toFixed(2)),
      expectedPhysicalCash,
      actualCashCounted,
      difference,
      paymentsByMethod,
      totalAllPayments: Number(totalAllPayments.toFixed(2)),
    }
  }

  /**
   * Close an active shift session
   */
  async closeShift(input: CloseShiftInput, user: UserContext): Promise<ShiftReconciliation> {
    const db = getDb()
    const actualCash = Number(input.actualCash)
    if (isNaN(actualCash) || actualCash < 0) {
      throw new Error('Actual cash counted must be a non-negative number')
    }

    const shiftRows = await db.select<Shift[]>('SELECT * FROM shifts WHERE id = ? LIMIT 1', [input.shiftId])
    if (!shiftRows || shiftRows.length === 0) {
      throw new Error('Shift not found')
    }
    const shift = shiftRows[0]
    if (shift.status !== 'open') {
      throw new Error('Shift is already closed')
    }

    // Calculate reconciliation
    const recon = await this.getShiftReconciliation(input.shiftId)
    const expectedCash = recon.expectedPhysicalCash
    const difference = Number((actualCash - expectedCash).toFixed(2))
    const closingMovementId = uuidv4()

    await db.execute('BEGIN TRANSACTION')
    try {
      // 1. Update shift record
      await db.execute(`
        UPDATE shifts SET
          status = 'closed',
          closing_balance = ?,
          expected_balance = ?,
          difference = ?,
          cash_sales = ?,
          notes = CASE WHEN notes IS NULL THEN ? ELSE notes || '\n' || ? END,
          closed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
          updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE id = ?
      `, [
        actualCash,
        expectedCash,
        difference,
        recon.totalCashSales,
        input.notes || '',
        input.notes || '',
        input.shiftId,
      ])

      // 2. Record closing snapshot in cash movements ledger
      await db.execute(`
        INSERT INTO cash_movements (
          id, register_id, shift_id, user_id, amount,
          type, direction, reason, notes, created_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          'closing', 'out', 'إغلاق الوردية وتوريد النقدية', ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        )
      `, [
        closingMovementId,
        shift.register_id,
        shift.id,
        user.id,
        actualCash,
        input.notes || null,
      ])

      await db.execute('COMMIT')
    } catch (err) {
      await db.execute('ROLLBACK')
      throw err
    }

    // Audit trail
    await auditService.log({
      userId: user.id,
      userFullName: user.fullName || 'Cashier',
      action: 'close_shift',
      resource: 'shifts',
      resourceId: input.shiftId,
      details: {
        expectedCash,
        actualCash,
        difference,
      },
    })

    return this.getShiftReconciliation(input.shiftId)
  }

  /**
   * Get Cash Movements history ledger
   */
  async getCashMovements(options?: {
    shiftId?: string
    registerId?: string
    limit?: number
  }): Promise<CashMovement[]> {
    const db = getDb()
    const conditions: string[] = []
    const params: unknown[] = []

    if (options?.shiftId) {
      conditions.push('cm.shift_id = ?')
      params.push(options.shiftId)
    }

    if (options?.registerId) {
      conditions.push('cm.register_id = ?')
      params.push(options.registerId)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const limit = options?.limit ?? 100

    const query = `
      SELECT cm.*, u.full_name as user_full_name, cr.name as register_name
      FROM cash_movements cm
      LEFT JOIN users u ON u.id = cm.user_id
      LEFT JOIN cash_registers cr ON cr.id = cm.register_id
      ${whereClause}
      ORDER BY cm.created_at DESC
      LIMIT ?
    `

    return db.select<CashMovement[]>(query, [...params, limit])
  }

  /**
   * Automatically check and close shifts that crossed the business day boundary (e.g., midnight or custom start hour).
   * Calculates exact expected cash, records closing snapshot and audit entry, ensuring 0 cash loss.
   */
  async checkAndAutoCloseExpiredShifts(options?: {
    businessDayStartHour?: number
    systemUser?: UserContext
  }): Promise<string[]> {
    const db = getDb()
    const cutoffHour = options?.businessDayStartHour ?? 0
    const systemUser = options?.systemUser ?? { id: 'system-auto-close', fullName: 'System Auto Closer', role: 'admin' }

    const openShifts = await db.select<Shift[]>(`
      SELECT s.*, cr.name as register_name, u.full_name as user_full_name
      FROM shifts s
      LEFT JOIN cash_registers cr ON cr.id = s.register_id
      LEFT JOIN users u ON u.id = s.user_id
      WHERE s.status = 'open'
    `)

    if (!openShifts || openShifts.length === 0) {
      return []
    }

    const now = new Date()
    const autoClosedShiftIds: string[] = []

    for (const shift of openShifts) {
      const openedDate = new Date(shift.opened_at)
      
      // Calculate whether the shift crossed midnight / business day cutoff boundary
      const openedMidnight = new Date(openedDate)
      openedMidnight.setHours(cutoffHour, 0, 0, 0)
      if (openedDate >= openedMidnight) {
        // Shift was opened after today's cutoff, so its next cutoff is tomorrow at cutoffHour
        openedMidnight.setDate(openedMidnight.getDate() + 1)
      }

      if (now >= openedMidnight) {
        // Shift is past business day boundary; auto close it safely
        const recon = await this.getShiftReconciliation(shift.id)
        const expectedCash = recon.expectedPhysicalCash
        const closingMovementId = uuidv4()

        await db.execute('BEGIN TRANSACTION')
        try {
          await db.execute(`
            UPDATE shifts
            SET
              status = 'closed',
              expected_cash = ?,
              actual_cash = ?,
              difference = 0,
              cash_sales = ?,
              notes = CASE 
                WHEN notes IS NULL OR notes = '' THEN 'إغلاق تلقائي بنهاية يوم العمل (Automatic shift close at business day cutoff)' 
                ELSE notes || '\n' || 'إغلاق تلقائي بنهاية يوم العمل (Automatic shift close at business day cutoff)' 
              END,
              closed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
              updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
            WHERE id = ? AND status = 'open'
          `, [
            expectedCash,
            expectedCash,
            recon.totalCashSales,
            shift.id,
          ])

          await db.execute(`
            INSERT INTO cash_movements (
              id, register_id, shift_id, user_id, amount,
              type, direction, reason, notes, created_at
            ) VALUES (
              ?, ?, ?, ?, ?,
              'closing', 'out', 'إغلاق تلقائي بنهاية يوم العمل', 'Automatic midnight shift close', strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
            )
          `, [
            closingMovementId,
            shift.register_id,
            shift.id,
            shift.user_id || systemUser.id,
            expectedCash,
          ])

          await db.execute('COMMIT')
          autoClosedShiftIds.push(shift.id)

          await auditService.log({
            userId: systemUser.id,
            userFullName: systemUser.fullName || 'System Auto Closer',
            action: 'auto_close_shift',
            resource: 'shifts',
            resourceId: shift.id,
            details: {
              expectedCash,
              actualCash: expectedCash,
              difference: 0,
              reason: 'Automatic shift close at business day cutoff',
            },
          })
        } catch (err) {
          await db.execute('ROLLBACK')
          console.error(`Failed to auto-close shift ${shift.id}:`, err)
        }
      }
    }

    return autoClosedShiftIds
  }

  /**
   * Get historical shifts list
   */
  async getShiftsHistory(limit = 50): Promise<Shift[]> {
    const db = getDb()
    const query = `
      SELECT s.*, cr.name as register_name, u.full_name as user_full_name
      FROM shifts s
      LEFT JOIN cash_registers cr ON cr.id = s.register_id
      LEFT JOIN users u ON u.id = s.user_id
      ORDER BY s.opened_at DESC
      LIMIT ?
    `
    return db.select<Shift[]>(query, [limit])
  }
}

export const cashRegisterService = new CashRegisterService()

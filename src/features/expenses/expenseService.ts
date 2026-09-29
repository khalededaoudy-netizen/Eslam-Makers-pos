/**
 * MAKERS POS — Expenses Service
 * Handles operating expenses, expense categories, cash drawer ledger integration,
 * atomic transactions, idempotency, audit trail, and vouchers.
 */

import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/services/db/database'
import { auditService } from '@/services/audit/auditService'
import { settingsService } from '@/services/settings/settingsService'
import { PaymentMethodType } from '@/features/payments/types'
import {
  Expense,
  ExpenseCategory,
  CreateExpenseInput,
  UpdateExpenseInput,
  CreateExpenseCategoryInput,
  UpdateExpenseCategoryInput,
  ExpenseFilter,
  ExpenseSummary,
  ExpenseVoucherData,
} from './types'

export interface UserContext {
  id: string
  fullName?: string
  username?: string
}

const VALID_PAYMENT_METHODS: PaymentMethodType[] = [
  'cash',
  'card',
  'instapay',
  'vodafone_cash',
  'bank_transfer',
  'other',
]

class ExpenseService {
  private inFlightOperations = new Set<string>()

  /**
   * Generate sequential and persistent expense number (e.g. EXP-20260929-000001)
   */
  async generateExpenseNumber(): Promise<string> {
    const db = getDb()
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
    const prefix = `EXP-${dateStr}-`

    const rows = await db.select<Array<{ expense_number: string }>>(
      `SELECT expense_number FROM expenses 
       WHERE expense_number LIKE ? 
       ORDER BY expense_number DESC LIMIT 1`,
      [`${prefix}%`]
    )

    let nextSeq = 1
    if (rows && rows.length > 0 && rows[0].expense_number) {
      const parts = rows[0].expense_number.split('-')
      const lastSeq = parseInt(parts[2], 10)
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1
      }
    }

    return `${prefix}${String(nextSeq).padStart(6, '0')}`
  }

  // ─── EXPENSE CATEGORIES ───────────────────────────────────────────────────

  async getExpenseCategories(includeInactive = false): Promise<ExpenseCategory[]> {
    const db = getDb()
    const query = includeInactive
      ? 'SELECT * FROM expense_categories ORDER BY is_active DESC, name_ar ASC'
      : 'SELECT * FROM expense_categories WHERE is_active = 1 ORDER BY name_ar ASC'

    const rows = await db.select<Array<{
      id: string
      name?: string | null
      name_ar: string
      name_en: string
      icon?: string | null
      is_active: number
      created_at: string
      updated_at: string
    }>>(query)

    return rows.map(r => ({
      id: r.id,
      name: r.name || r.name_en || r.name_ar,
      nameAr: r.name_ar,
      nameEn: r.name_en,
      icon: r.icon,
      isActive: Boolean(r.is_active),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }))
  }

  async getExpenseCategoryById(id: string): Promise<ExpenseCategory | null> {
    const db = getDb()
    const rows = await db.select<Array<{
      id: string
      name?: string | null
      name_ar: string
      name_en: string
      icon?: string | null
      is_active: number
      created_at: string
      updated_at: string
    }>>('SELECT * FROM expense_categories WHERE id = ? LIMIT 1', [id])

    if (!rows || rows.length === 0) return null
    const r = rows[0]
    return {
      id: r.id,
      name: r.name || r.name_en || r.name_ar,
      nameAr: r.name_ar,
      nameEn: r.name_en,
      icon: r.icon,
      isActive: Boolean(r.is_active),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }
  }

  async createExpenseCategory(
    input: CreateExpenseCategoryInput,
    user: UserContext
  ): Promise<ExpenseCategory> {
    const db = getDb()
    const nameAr = input.nameAr?.trim()
    const nameEn = input.nameEn?.trim() || nameAr

    if (!nameAr) {
      throw new Error('Expense category Arabic name is required')
    }

    const id = uuidv4()
    const now = new Date().toISOString()

    await db.execute(
      `INSERT INTO expense_categories (id, name, name_ar, name_en, icon, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, input.name || nameEn, nameAr, nameEn, input.icon || 'tag', now, now]
    )

    await auditService.log({
      userId: user.id,
      userFullName: user.fullName || user.username || 'User',
      action: 'create_expense_category',
      resource: 'expense_categories',
      resourceId: id,
      details: { nameAr, nameEn },
    })

    const cat = await this.getExpenseCategoryById(id)
    return cat!
  }

  async updateExpenseCategory(
    id: string,
    input: UpdateExpenseCategoryInput,
    user: UserContext
  ): Promise<ExpenseCategory> {
    const db = getDb()
    const existing = await this.getExpenseCategoryById(id)
    if (!existing) {
      throw new Error('Expense category not found')
    }

    const nameAr = input.nameAr?.trim() ?? existing.nameAr
    const nameEn = input.nameEn?.trim() ?? existing.nameEn
    const name = input.name?.trim() ?? existing.name
    const icon = input.icon ?? existing.icon
    const isActive = input.isActive !== undefined ? (input.isActive ? 1 : 0) : (existing.isActive ? 1 : 0)
    const now = new Date().toISOString()

    await db.execute(
      `UPDATE expense_categories 
       SET name = ?, name_ar = ?, name_en = ?, icon = ?, is_active = ?, updated_at = ?
       WHERE id = ?`,
      [name, nameAr, nameEn, icon, isActive, now, id]
    )

    await auditService.log({
      userId: user.id,
      userFullName: user.fullName || user.username || 'User',
      action: 'update_expense_category',
      resource: 'expense_categories',
      resourceId: id,
      details: { nameAr, nameEn, isActive },
    })

    const updated = await this.getExpenseCategoryById(id)
    return updated!
  }

  async toggleExpenseCategoryActive(
    id: string,
    isActive: boolean,
    user: UserContext
  ): Promise<ExpenseCategory> {
    return this.updateExpenseCategory(id, { isActive }, user)
  }

  // ─── EXPENSE CREATION ─────────────────────────────────────────────────────

  /**
   * Create an operating expense with atomic cash ledger integration and idempotency protection.
   */
  async createExpense(input: CreateExpenseInput, user: UserContext): Promise<Expense> {
    const db = getDb()

    // 1. Validation: Amount > 0
    const amount = Number(input.amount)
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Expense amount must be a positive number greater than zero')
    }

    // 2. Validation: Description
    const description = input.description?.trim()
    if (!description) {
      throw new Error('Expense description is required')
    }

    // 3. Validation: Payment Method
    const paymentMethod = (input.paymentMethod || 'cash').toLowerCase() as PaymentMethodType
    if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) {
      throw new Error(`Invalid payment method: ${input.paymentMethod}`)
    }

    // 4. Validation: Category if provided
    if (input.categoryId) {
      const cat = await this.getExpenseCategoryById(input.categoryId)
      if (!cat) {
        throw new Error('Selected expense category does not exist')
      }
    }

    // 5. Validation: Shift & Register for Cash vs Non-Cash
    let shiftId = input.shiftId || null
    let registerId = input.registerId || null

    if (paymentMethod === 'cash') {
      // Physical cash expenses strictly require an active open shift
      if (!shiftId) {
        // Try to locate active shift for current user
        const openShifts = await db.select<Array<{ id: string; register_id: string }>>(
          "SELECT id, register_id FROM shifts WHERE user_id = ? AND status = 'open' LIMIT 1",
          [user.id]
        )
        if (!openShifts || openShifts.length === 0) {
          throw new Error('Cannot record cash expense: No active open shift found for current user')
        }
        shiftId = openShifts[0].id
        registerId = registerId || openShifts[0].register_id
      }

      // Verify shift is open
      const shiftRows = await db.select<Array<{ id: string; status: string; register_id: string }>>(
        'SELECT id, status, register_id FROM shifts WHERE id = ? LIMIT 1',
        [shiftId]
      )
      if (!shiftRows || shiftRows.length === 0) {
        throw new Error('Shift not found')
      }
      if (shiftRows[0].status !== 'open') {
        throw new Error('Cannot record cash expense on a closed shift')
      }

      // If register provided, verify it matches shift's register
      if (registerId && registerId !== shiftRows[0].register_id) {
        throw new Error('Specified register does not belong to the active shift')
      }
      registerId = registerId || shiftRows[0].register_id
    } else {
      // Non-cash expense: optionally attach shift/register if user has one open, but not strictly required
      if (!shiftId) {
        const openShifts = await db.select<Array<{ id: string; register_id: string }>>(
          "SELECT id, register_id FROM shifts WHERE user_id = ? AND status = 'open' LIMIT 1",
          [user.id]
        )
        if (openShifts && openShifts.length > 0) {
          shiftId = openShifts[0].id
          registerId = registerId || openShifts[0].register_id
        }
      }
    }

    // 6. Validation: Supplier if provided
    if (input.supplierId) {
      const suppRows = await db.select<Array<{ id: string }>>(
        'SELECT id FROM suppliers WHERE id = ? LIMIT 1',
        [input.supplierId]
      )
      if (!suppRows || suppRows.length === 0) {
        throw new Error('Selected supplier does not exist')
      }
    }

    // 7. Idempotency Lock
    const idempotencyKey = `${user.id}_${paymentMethod}_${amount}_${description}_${input.expenseDate || ''}`
    if (this.inFlightOperations.has(idempotencyKey)) {
      throw new Error('Duplicate expense submission in progress. Please wait.')
    }
    this.inFlightOperations.add(idempotencyKey)

    const expenseId = uuidv4()
    const expenseNumber = await this.generateExpenseNumber()
    const affectsCash = paymentMethod === 'cash' ? 1 : 0
    const expenseDate = input.expenseDate || new Date().toISOString()
    const now = new Date().toISOString()

    try {
      await db.execute('BEGIN TRANSACTION')

      // Insert expense record
      await db.execute(
        `INSERT INTO expenses (
          id, expense_number, category_id, supplier_id, shift_id, register_id,
          user_id, amount, payment_method, affects_cash, description,
          reference, notes, status, recorded_by_id, expense_date, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, 'completed', ?, ?, ?, ?
        )`,
        [
          expenseId,
          expenseNumber,
          input.categoryId || null,
          input.supplierId || null,
          shiftId,
          registerId,
          user.id,
          amount,
          paymentMethod,
          affectsCash,
          description,
          input.reference?.trim() || null,
          input.notes?.trim() || null,
          user.id,
          expenseDate,
          now,
          now,
        ]
      )

      // If Cash expense -> create cash ledger movement and update shift cash_expenses
      if (affectsCash === 1 && shiftId && registerId) {
        const movementId = uuidv4()
        await db.execute(
          `INSERT INTO cash_movements (
            id, register_id, shift_id, user_id, amount,
            type, direction, payment_method, reason, reference_id, reference_type, notes, created_at
          ) VALUES (
            ?, ?, ?, ?, ?,
            'expense', 'out', 'cash', ?, ?, 'expense', ?, ?
          )`,
          [
            movementId,
            registerId,
            shiftId,
            user.id,
            amount,
            `مصروف تشغيلي: ${description}`,
            expenseId,
            input.notes?.trim() || null,
            now,
          ]
        )

        // Increment shift cash_expenses counter
        await db.execute(
          `UPDATE shifts 
           SET cash_expenses = cash_expenses + ?, updated_at = ?
           WHERE id = ?`,
          [amount, now, shiftId]
        )
      }

      await db.execute('COMMIT')
    } catch (error) {
      await db.execute('ROLLBACK')
      throw error
    } finally {
      this.inFlightOperations.delete(idempotencyKey)
    }

    // Audit Logging
    await auditService.log({
      userId: user.id,
      userFullName: user.fullName || user.username || 'User',
      action: 'create_expense',
      resource: 'expenses',
      resourceId: expenseId,
      details: {
        expenseNumber,
        amount,
        paymentMethod,
        affectsCash: Boolean(affectsCash),
        categoryId: input.categoryId,
        supplierId: input.supplierId,
        shiftId,
        registerId,
        description,
      },
    })

    const created = await this.getExpenseById(expenseId)
    return created!
  }

  // ─── EXPENSE CANCELLATION ─────────────────────────────────────────────────

  /**
   * Cancel an expense safely by preserving the original record and reversing any cash movement.
   */
  async cancelExpense(
    expenseId: string,
    reason: string,
    user: UserContext
  ): Promise<Expense> {
    const db = getDb()
    const existing = await this.getExpenseById(expenseId)
    if (!existing) {
      throw new Error('Expense not found')
    }
    if (existing.status === 'cancelled') {
      throw new Error('Expense is already cancelled')
    }

    const trimmedReason = reason?.trim()
    if (!trimmedReason) {
      throw new Error('Cancellation reason is required')
    }

    const now = new Date().toISOString()

    try {
      await db.execute('BEGIN TRANSACTION')

      // Mark expense as cancelled
      await db.execute(
        `UPDATE expenses 
         SET status = 'cancelled', notes = COALESCE(notes || '\n', '') || ?, updated_at = ?
         WHERE id = ?`,
        [`[Cancelled by ${user.fullName || user.username || 'User'}: ${trimmedReason}]`, now, expenseId]
      )

      // If it affected cash, reverse the cash movement
      if (existing.affectsCash && existing.paymentMethod === 'cash' && existing.shiftId && existing.registerId) {
        const reversalMovementId = uuidv4()
        await db.execute(
          `INSERT INTO cash_movements (
            id, register_id, shift_id, user_id, amount,
            type, direction, payment_method, reason, reference_id, reference_type, notes, created_at
          ) VALUES (
            ?, ?, ?, ?, ?,
            'expense_cancel', 'in', 'cash', ?, ?, 'expense', ?, ?
          )`,
          [
            reversalMovementId,
            existing.registerId,
            existing.shiftId,
            user.id,
            existing.amount,
            `إلغاء مصروف: ${existing.expenseNumber} — ${trimmedReason}`,
            expenseId,
            `Cancellation note: ${trimmedReason}`,
            now,
          ]
        )

        // Decrement shift cash_expenses counter
        await db.execute(
          `UPDATE shifts 
           SET cash_expenses = MAX(0, cash_expenses - ?), updated_at = ?
           WHERE id = ?`,
          [existing.amount, now, existing.shiftId]
        )
      }

      await db.execute('COMMIT')
    } catch (err) {
      await db.execute('ROLLBACK')
      throw err
    }

    // Audit Logging
    await auditService.log({
      userId: user.id,
      userFullName: user.fullName || user.username || 'User',
      action: 'cancel_expense',
      resource: 'expenses',
      resourceId: expenseId,
      details: {
        expenseNumber: existing.expenseNumber,
        amount: existing.amount,
        paymentMethod: existing.paymentMethod,
        reason: trimmedReason,
      },
    })

    const updated = await this.getExpenseById(expenseId)
    return updated!
  }

  // ─── EXPENSE UPDATE (NON-FINANCIAL ONLY) ───────────────────────────────────

  /**
   * Update non-financial fields of an expense (financial values are immutable once completed)
   */
  async updateExpense(
    id: string,
    input: UpdateExpenseInput,
    user: UserContext
  ): Promise<Expense> {
    const db = getDb()
    const existing = await this.getExpenseById(id)
    if (!existing) {
      throw new Error('Expense not found')
    }

    if (input.categoryId) {
      const cat = await this.getExpenseCategoryById(input.categoryId)
      if (!cat) throw new Error('Selected category not found')
    }

    if (input.supplierId) {
      const suppRows = await db.select<Array<{ id: string }>>(
        'SELECT id FROM suppliers WHERE id = ? LIMIT 1',
        [input.supplierId]
      )
      if (!suppRows || suppRows.length === 0) throw new Error('Selected supplier not found')
    }

    const description = input.description?.trim() ?? existing.description
    const reference = input.reference !== undefined ? (input.reference?.trim() || null) : existing.reference
    const notes = input.notes !== undefined ? (input.notes?.trim() || null) : existing.notes
    const categoryId = input.categoryId !== undefined ? (input.categoryId || null) : existing.categoryId
    const supplierId = input.supplierId !== undefined ? (input.supplierId || null) : existing.supplierId
    const now = new Date().toISOString()

    await db.execute(
      `UPDATE expenses 
       SET description = ?, reference = ?, notes = ?, category_id = ?, supplier_id = ?, updated_at = ?
       WHERE id = ?`,
      [description, reference, notes, categoryId, supplierId, now, id]
    )

    await auditService.log({
      userId: user.id,
      userFullName: user.fullName || user.username || 'User',
      action: 'update_expense',
      resource: 'expenses',
      resourceId: id,
      details: { description, reference, notes, categoryId, supplierId },
    })

    const updated = await this.getExpenseById(id)
    return updated!
  }

  // ─── EXPENSE QUERIES ──────────────────────────────────────────────────────

  async getExpenseById(id: string): Promise<Expense | null> {
    const db = getDb()
    const rows = await db.select<Array<{
      id: string
      expense_number: string
      category_id: string | null
      category_name: string | null
      category_name_ar: string | null
      category_name_en: string | null
      supplier_id: string | null
      supplier_name: string | null
      shift_id: string | null
      register_id: string | null
      register_name: string | null
      user_id: string
      user_name: string | null
      amount: number
      payment_method: string
      affects_cash: number
      description: string
      reference: string | null
      notes: string | null
      status: string
      expense_date: string
      receipt_path: string | null
      created_at: string
      updated_at: string
    }>>(`
      SELECT 
        e.id,
        e.expense_number,
        e.category_id,
        ec.name AS category_name,
        ec.name_ar AS category_name_ar,
        ec.name_en AS category_name_en,
        e.supplier_id,
        s.name AS supplier_name,
        e.shift_id,
        e.register_id,
        cr.name AS register_name,
        COALESCE(e.user_id, e.recorded_by_id) AS user_id,
        COALESCE(u.full_name, u.username) AS user_name,
        e.amount,
        e.payment_method,
        e.affects_cash,
        e.description,
        e.reference,
        e.notes,
        e.status,
        e.expense_date,
        e.receipt_path,
        e.created_at,
        e.updated_at
      FROM expenses e
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      LEFT JOIN suppliers s ON e.supplier_id = s.id
      LEFT JOIN cash_registers cr ON e.register_id = cr.id
      LEFT JOIN users u ON COALESCE(e.user_id, e.recorded_by_id) = u.id
      WHERE e.id = ?
      LIMIT 1
    `, [id])

    if (!rows || rows.length === 0) return null
    const r = rows[0]
    return {
      id: r.id,
      expenseNumber: r.expense_number || '',
      categoryId: r.category_id,
      categoryName: r.category_name || r.category_name_en || r.category_name_ar,
      categoryNameAr: r.category_name_ar,
      categoryNameEn: r.category_name_en,
      supplierId: r.supplier_id,
      supplierName: r.supplier_name,
      shiftId: r.shift_id,
      registerId: r.register_id,
      registerName: r.register_name,
      userId: r.user_id,
      userName: r.user_name,
      amount: Number(r.amount) || 0,
      paymentMethod: (r.payment_method || 'cash').toLowerCase() as PaymentMethodType,
      affectsCash: Boolean(r.affects_cash),
      description: r.description,
      reference: r.reference,
      notes: r.notes,
      status: (r.status || 'completed') as 'completed' | 'cancelled',
      expenseDate: r.expense_date,
      receiptPath: r.receipt_path,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }
  }

  async getExpenses(filter: ExpenseFilter = {}): Promise<{ expenses: Expense[]; total: number }> {
    const db = getDb()
    const conditions: string[] = []
    const params: any[] = []

    if (filter.search?.trim()) {
      const term = `%${filter.search.trim()}%`
      conditions.push(`(
        e.expense_number LIKE ? OR 
        e.description LIKE ? OR 
        e.reference LIKE ? OR 
        ec.name_ar LIKE ? OR 
        ec.name_en LIKE ? OR 
        s.name LIKE ?
      )`)
      params.push(term, term, term, term, term, term)
    }

    if (filter.categoryId) {
      conditions.push('e.category_id = ?')
      params.push(filter.categoryId)
    }

    if (filter.supplierId) {
      conditions.push('e.supplier_id = ?')
      params.push(filter.supplierId)
    }

    if (filter.paymentMethod && filter.paymentMethod !== 'all') {
      conditions.push('e.payment_method = ?')
      params.push(filter.paymentMethod)
    }

    if (filter.status && filter.status !== 'all') {
      conditions.push('e.status = ?')
      params.push(filter.status)
    }

    if (filter.shiftId) {
      conditions.push('e.shift_id = ?')
      params.push(filter.shiftId)
    }

    if (filter.startDate) {
      conditions.push('e.expense_date >= ?')
      params.push(filter.startDate)
    }

    if (filter.endDate) {
      conditions.push('e.expense_date <= ?')
      params.push(filter.endDate)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Total count
    const countRows = await db.select<Array<{ cnt: number }>>(`
      SELECT COUNT(*) as cnt
      FROM expenses e
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      LEFT JOIN suppliers s ON e.supplier_id = s.id
      ${whereClause}
    `, params)
    const total = countRows?.[0]?.cnt || 0

    // Pagination
    const limit = filter.limit || 50
    const page = filter.page || 1
    const offset = (page - 1) * limit

    const rows = await db.select<Array<{
      id: string
      expense_number: string
      category_id: string | null
      category_name: string | null
      category_name_ar: string | null
      category_name_en: string | null
      supplier_id: string | null
      supplier_name: string | null
      shift_id: string | null
      register_id: string | null
      register_name: string | null
      user_id: string
      user_name: string | null
      amount: number
      payment_method: string
      affects_cash: number
      description: string
      reference: string | null
      notes: string | null
      status: string
      expense_date: string
      receipt_path: string | null
      created_at: string
      updated_at: string
    }>>(`
      SELECT 
        e.id,
        e.expense_number,
        e.category_id,
        ec.name AS category_name,
        ec.name_ar AS category_name_ar,
        ec.name_en AS category_name_en,
        e.supplier_id,
        s.name AS supplier_name,
        e.shift_id,
        e.register_id,
        cr.name AS register_name,
        COALESCE(e.user_id, e.recorded_by_id) AS user_id,
        COALESCE(u.full_name, u.username) AS user_name,
        e.amount,
        e.payment_method,
        e.affects_cash,
        e.description,
        e.reference,
        e.notes,
        e.status,
        e.expense_date,
        e.receipt_path,
        e.created_at,
        e.updated_at
      FROM expenses e
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      LEFT JOIN suppliers s ON e.supplier_id = s.id
      LEFT JOIN cash_registers cr ON e.register_id = cr.id
      LEFT JOIN users u ON COALESCE(e.user_id, e.recorded_by_id) = u.id
      ${whereClause}
      ORDER BY e.expense_date DESC, e.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset])

    const list: Expense[] = rows.map(r => ({
      id: r.id,
      expenseNumber: r.expense_number || '',
      categoryId: r.category_id,
      categoryName: r.category_name || r.category_name_en || r.category_name_ar,
      categoryNameAr: r.category_name_ar,
      categoryNameEn: r.category_name_en,
      supplierId: r.supplier_id,
      supplierName: r.supplier_name,
      shiftId: r.shift_id,
      registerId: r.register_id,
      registerName: r.register_name,
      userId: r.user_id,
      userName: r.user_name,
      amount: Number(r.amount) || 0,
      paymentMethod: (r.payment_method || 'cash').toLowerCase() as PaymentMethodType,
      affectsCash: Boolean(r.affects_cash),
      description: r.description,
      reference: r.reference,
      notes: r.notes,
      status: (r.status || 'completed') as 'completed' | 'cancelled',
      expenseDate: r.expense_date,
      receiptPath: r.receipt_path,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }))

    return { expenses: list, total }
  }

  /**
   * Get KPI summary of expenses for the dashboard / expenses page header
   */
  async getExpenseSummary(activeShiftId?: string | null): Promise<ExpenseSummary> {
    const db = getDb()
    const today = new Date().toISOString().slice(0, 10)

    // Total and breakdowns (completed only)
    const rows = await db.select<Array<{
      total_amount: number
      cash_amount: number
      non_cash_amount: number
      count: number
    }>>(`
      SELECT 
        COALESCE(SUM(amount), 0) AS total_amount,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN amount ELSE 0 END), 0) AS cash_amount,
        COALESCE(SUM(CASE WHEN payment_method != 'cash' THEN amount ELSE 0 END), 0) AS non_cash_amount,
        COUNT(*) AS count
      FROM expenses
      WHERE status = 'completed'
    `)

    // Today's expenses
    const todayRows = await db.select<Array<{ today_total: number }>>(`
      SELECT COALESCE(SUM(amount), 0) AS today_total
      FROM expenses
      WHERE status = 'completed' AND (expense_date LIKE ? OR created_at LIKE ?)
    `, [`${today}%`, `${today}%`])

    // Current shift expenses
    let currentShiftExpenses = 0
    if (activeShiftId) {
      const shiftRows = await db.select<Array<{ shift_total: number }>>(`
        SELECT COALESCE(SUM(amount), 0) AS shift_total
        FROM expenses
        WHERE status = 'completed' AND shift_id = ?
      `, [activeShiftId])
      currentShiftExpenses = Number(shiftRows?.[0]?.shift_total) || 0
    }

    const r = rows?.[0] || { total_amount: 0, cash_amount: 0, non_cash_amount: 0, count: 0 }

    return {
      totalExpenses: Number(r.total_amount) || 0,
      cashExpenses: Number(r.cash_amount) || 0,
      nonCashExpenses: Number(r.non_cash_amount) || 0,
      todayExpenses: Number(todayRows?.[0]?.today_total) || 0,
      currentShiftExpenses,
      expenseCount: Number(r.count) || 0,
    }
  }

  // ─── VOUCHER BUILDER ──────────────────────────────────────────────────────

  async buildVoucherData(expenseId: string): Promise<ExpenseVoucherData> {
    const expense = await this.getExpenseById(expenseId)
    if (!expense) {
      throw new Error('Expense not found')
    }

    const settings = await settingsService.getAllSettings()

    return {
      storeName: settings.store_name_ar || settings.store_name || 'MAKERS POS',
      storePhone: settings.store_phone || '',
      storeAddress: settings.store_address || '',
      expenseNumber: expense.expenseNumber,
      date: expense.expenseDate || expense.createdAt,
      categoryName: expense.categoryNameAr || expense.categoryNameEn || 'عام',
      description: expense.description,
      amount: expense.amount,
      paymentMethod: expense.paymentMethod,
      reference: expense.reference || undefined,
      supplierName: expense.supplierName || undefined,
      userName: expense.userName || 'Admin',
      shiftId: expense.shiftId || undefined,
      registerName: expense.registerName || undefined,
      notes: expense.notes || undefined,
      status: expense.status,
    }
  }
}

export const expenseService = new ExpenseService()

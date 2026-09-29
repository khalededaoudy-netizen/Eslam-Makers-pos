/**
 * MAKERS POS — Customer Service
 * Centralized business logic for Customers, Profiles, Fast Search, Balance Tracking, and Audit Trails.
 */

import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/services/db/database'
import { auditService } from '@/services/audit/auditService'
import {
  Customer,
  CustomerListItem,
  CreateCustomerInput,
  UpdateCustomerInput,
  CustomerFilterOptions,
  CustomerOverview,
  DuplicateCustomerMatch,
} from './types'

export interface UserContext {
  id?: string
  fullName?: string
  role?: string
}

class CustomerService {
  /**
   * Generate next sequential unique customer code (e.g. CUS-000001)
   */
  async generateNextCustomerCode(): Promise<string> {
    const db = getDb()
    const rows = await db.select<Array<{ customer_code: string }>>(
      "SELECT customer_code FROM customers WHERE customer_code LIKE 'CUS-%' ORDER BY created_at DESC LIMIT 50"
    )

    let maxNum = 0
    for (const r of rows) {
      if (r.customer_code) {
        const match = r.customer_code.match(/CUS-(\d+)/i)
        if (match) {
          const num = parseInt(match[1], 10)
          if (!isNaN(num) && num > maxNum) {
            maxNum = num
          }
        }
      }
    }

    // Double check total count as a fallback
    const countRows = await db.select<Array<{ total: number }>>('SELECT count(*) as total FROM customers')
    const count = countRows[0]?.total || 0
    const nextNum = Math.max(maxNum + 1, count + 1)
    const code = `CUS-${nextNum.toString().padStart(6, '0')}`

    // Ensure uniqueness
    const exists = await db.select<Array<{ id: string }>>('SELECT id FROM customers WHERE customer_code = ? LIMIT 1', [code])
    if (exists && exists.length > 0) {
      return `CUS-${(nextNum + Math.floor(Math.random() * 900) + 100).toString().padStart(6, '0')}`
    }

    return code
  }

  /**
   * Check for potential duplicates by phone, WhatsApp, email, or code
   */
  async checkDuplicate(params: {
    phone?: string | null
    whatsapp?: string | null
    email?: string | null
    customerCode?: string | null
    excludeId?: string
  }): Promise<DuplicateCustomerMatch> {
    const db = getDb()
    const excludeClause = params.excludeId ? ' AND id != ?' : ''

    // 1. Phone check
    if (params.phone && params.phone.trim()) {
      const p = params.phone.trim()
      const sqlParams = params.excludeId ? [p, params.excludeId] : [p]
      const rows = await db.select<Customer[]>(
        `SELECT * FROM customers WHERE (phone = ? OR phone2 = ?)${excludeClause} LIMIT 1`,
        params.excludeId ? [p, p, params.excludeId] : [p, p]
      )
      if (rows && rows.length > 0) {
        return { isDuplicate: true, matchedField: 'phone', matchedCustomer: rows[0] }
      }
    }

    // 2. WhatsApp check
    if (params.whatsapp && params.whatsapp.trim()) {
      const w = params.whatsapp.trim()
      const sqlParams = params.excludeId ? [w, params.excludeId] : [w]
      const rows = await db.select<Customer[]>(
        `SELECT * FROM customers WHERE whatsapp = ?${excludeClause} LIMIT 1`,
        sqlParams
      )
      if (rows && rows.length > 0) {
        return { isDuplicate: true, matchedField: 'whatsapp', matchedCustomer: rows[0] }
      }
    }

    // 3. Email check
    if (params.email && params.email.trim()) {
      const e = params.email.trim().toLowerCase()
      const sqlParams = params.excludeId ? [e, params.excludeId] : [e]
      const rows = await db.select<Customer[]>(
        `SELECT * FROM customers WHERE LOWER(email) = ?${excludeClause} LIMIT 1`,
        sqlParams
      )
      if (rows && rows.length > 0) {
        return { isDuplicate: true, matchedField: 'email', matchedCustomer: rows[0] }
      }
    }

    // 4. Code check
    if (params.customerCode && params.customerCode.trim()) {
      const c = params.customerCode.trim()
      const sqlParams = params.excludeId ? [c, params.excludeId] : [c]
      const rows = await db.select<Customer[]>(
        `SELECT * FROM customers WHERE customer_code = ?${excludeClause} LIMIT 1`,
        sqlParams
      )
      if (rows && rows.length > 0) {
        return { isDuplicate: true, matchedField: 'code', matchedCustomer: rows[0] }
      }
    }

    return { isDuplicate: false, matchedField: null, matchedCustomer: null }
  }

  /**
   * Create a new customer
   */
  async createCustomer(
    input: CreateCustomerInput,
    user?: UserContext
  ): Promise<Customer> {
    const trimmedName = input.name.trim()
    if (!trimmedName) {
      throw new Error('Customer name is required')
    }

    const db = getDb()
    const id = uuidv4()
    const customerCode = input.customer_code?.trim() || await this.generateNextCustomerCode()
    const customerType = input.customer_type || 'individual'
    const creditLimit = Number(input.credit_limit) || 0

    await db.execute(`
      INSERT INTO customers (
        id, customer_code, name, phone, phone2, whatsapp, email, address, notes,
        customer_type, credit_limit, balance, is_active, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, 0, 1, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      )
    `, [
      id,
      customerCode,
      trimmedName,
      input.phone?.trim() || null,
      input.phone2?.trim() || null,
      input.whatsapp?.trim() || null,
      input.email?.trim() || null,
      input.address?.trim() || null,
      input.notes?.trim() || null,
      customerType,
      creditLimit,
    ])

    // Audit log
    await auditService.log({
      userId: user?.id,
      userFullName: user?.fullName,
      action: 'create_customer',
      resource: 'customers',
      resourceId: id,
      details: {
        customerCode,
        name: trimmedName,
        phone: input.phone,
        customerType,
      },
    })

    const created = await this.getCustomerById(id)
    if (!created) {
      throw new Error('Failed to retrieve newly created customer')
    }
    return created
  }

  /**
   * Get single customer by ID
   */
  async getCustomerById(id: string): Promise<Customer | null> {
    const db = getDb()
    const rows = await db.select<Customer[]>('SELECT * FROM customers WHERE id = ? LIMIT 1', [id])
    return rows && rows.length > 0 ? rows[0] : null
  }

  /**
   * Get single customer by Code (e.g. for fast POS barcode/code lookup)
   */
  async getCustomerByCode(code: string): Promise<Customer | null> {
    const db = getDb()
    const rows = await db.select<Customer[]>('SELECT * FROM customers WHERE customer_code = ? LIMIT 1', [code.trim()])
    return rows && rows.length > 0 ? rows[0] : null
  }

  /**
   * Get single customer by Phone (e.g. for quick POS lookup)
   */
  async getCustomerByPhone(phone: string): Promise<Customer | null> {
    const db = getDb()
    const p = phone.trim()
    const rows = await db.select<Customer[]>(
      'SELECT * FROM customers WHERE phone = ? OR phone2 = ? OR whatsapp = ? LIMIT 1',
      [p, p, p]
    )
    return rows && rows.length > 0 ? rows[0] : null
  }

  /**
   * List customers with rich filters, search, and pagination
   */
  async getCustomers(options?: CustomerFilterOptions): Promise<CustomerListItem[]> {
    const db = getDb()
    const conditions: string[] = []
    const sqlParams: unknown[] = []

    if (options?.status === 'active') {
      conditions.push('c.is_active = 1 AND c.archived_at IS NULL')
    } else if (options?.status === 'archived') {
      conditions.push('(c.is_active = 0 OR c.archived_at IS NOT NULL)')
    }

    if (options?.customerType && options.customerType !== 'all') {
      conditions.push('c.customer_type = ?')
      sqlParams.push(options.customerType)
    }

    if (options?.hasBalance) {
      conditions.push('c.balance > 0')
    }

    if (options?.search && options.search.trim()) {
      const q = `%${options.search.trim()}%`
      conditions.push(`(
        c.name LIKE ?
        OR c.phone LIKE ?
        OR c.phone2 LIKE ?
        OR c.whatsapp LIKE ?
        OR c.email LIKE ?
        OR c.customer_code LIKE ?
        OR c.address LIKE ?
      )`)
      sqlParams.push(q, q, q, q, q, q, q)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const limit = options?.limit ?? 500
    const offset = options?.offset ?? 0

    const query = `
      SELECT c.*,
             (SELECT count(*) FROM sales s WHERE s.customer_id = c.id) as sales_count,
             (SELECT MAX(s.created_at) FROM sales s WHERE s.customer_id = c.id) as last_sale_at
      FROM customers c
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `

    return db.select<CustomerListItem[]>(query, [...sqlParams, limit, offset])
  }

  /**
   * Update customer profile
   */
  async updateCustomer(
    id: string,
    input: UpdateCustomerInput,
    user?: UserContext
  ): Promise<Customer> {
    const current = await this.getCustomerById(id)
    if (!current) {
      throw new Error('Customer not found')
    }

    const db = getDb()
    const fields: string[] = []
    const sqlParams: unknown[] = []

    if (input.name !== undefined) {
      const trimmed = input.name.trim()
      if (!trimmed) throw new Error('Customer name cannot be empty')
      fields.push('name = ?')
      sqlParams.push(trimmed)
    }
    if (input.phone !== undefined) {
      fields.push('phone = ?')
      sqlParams.push(input.phone?.trim() || null)
    }
    if (input.phone2 !== undefined) {
      fields.push('phone2 = ?')
      sqlParams.push(input.phone2?.trim() || null)
    }
    if (input.whatsapp !== undefined) {
      fields.push('whatsapp = ?')
      sqlParams.push(input.whatsapp?.trim() || null)
    }
    if (input.email !== undefined) {
      fields.push('email = ?')
      sqlParams.push(input.email?.trim() || null)
    }
    if (input.address !== undefined) {
      fields.push('address = ?')
      sqlParams.push(input.address?.trim() || null)
    }
    if (input.notes !== undefined) {
      fields.push('notes = ?')
      sqlParams.push(input.notes?.trim() || null)
    }
    if (input.customer_type !== undefined) {
      fields.push('customer_type = ?')
      sqlParams.push(input.customer_type)
    }
    if (input.credit_limit !== undefined) {
      fields.push('credit_limit = ?')
      sqlParams.push(Number(input.credit_limit) || 0)
    }

    fields.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')")
    sqlParams.push(id)

    await db.execute(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`, sqlParams)

    // Audit log
    await auditService.log({
      userId: user?.id,
      userFullName: user?.fullName,
      action: 'update_customer',
      resource: 'customers',
      resourceId: id,
      details: {
        before: current,
        changes: input,
      },
    })

    const updated = await this.getCustomerById(id)
    return updated!
  }

  /**
   * Archive / Deactivate customer
   */
  async archiveCustomer(id: string, user?: UserContext): Promise<void> {
    const current = await this.getCustomerById(id)
    if (!current) throw new Error('Customer not found')

    const db = getDb()
    await db.execute(
      "UPDATE customers SET is_active = 0, archived_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?",
      [id]
    )

    await auditService.log({
      userId: user?.id,
      userFullName: user?.fullName,
      action: 'archive_customer',
      resource: 'customers',
      resourceId: id,
      details: { customerCode: current.customer_code, name: current.name },
    })
  }

  /**
   * Reactivate customer
   */
  async reactivateCustomer(id: string, user?: UserContext): Promise<void> {
    const current = await this.getCustomerById(id)
    if (!current) throw new Error('Customer not found')

    const db = getDb()
    await db.execute(
      "UPDATE customers SET is_active = 1, archived_at = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?",
      [id]
    )

    await auditService.log({
      userId: user?.id,
      userFullName: user?.fullName,
      action: 'reactivate_customer',
      resource: 'customers',
      resourceId: id,
      details: { customerCode: current.customer_code, name: current.name },
    })
  }

  /**
   * Get customer metrics overview
   */
  async getOverview(): Promise<CustomerOverview> {
    const db = getDb()
    const rows = await db.select<Array<{
      total: number
      active: number
      archived: number
      receivables: number
      with_balance: number
    }>>(`
      SELECT
        count(*) as total,
        SUM(CASE WHEN is_active = 1 AND archived_at IS NULL THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN is_active = 0 OR archived_at IS NOT NULL THEN 1 ELSE 0 END) as archived,
        SUM(CASE WHEN balance > 0 THEN balance ELSE 0 END) as receivables,
        SUM(CASE WHEN balance > 0 THEN 1 ELSE 0 END) as with_balance
      FROM customers
    `)

    const r = rows[0] || { total: 0, active: 0, archived: 0, receivables: 0, with_balance: 0 }
    return {
      totalCustomers: Number(r.total) || 0,
      activeCustomers: Number(r.active) || 0,
      archivedCustomers: Number(r.archived) || 0,
      totalReceivables: Number(r.receivables) || 0,
      withBalanceCount: Number(r.with_balance) || 0,
    }
  }
}

export const customerService = new CustomerService()

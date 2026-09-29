/**
 * MAKERS POS — Supplier Service
 * Manages suppliers, financial balances, contact information, and auditing.
 */

import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/services/db/database'
import { auditService } from '@/services/audit/auditService'

export interface SupplierItem {
  id: string
  name: string
  phone: string | null
  phone2: string | null
  whatsapp: string | null
  email: string | null
  address: string | null
  tax_number: string | null
  notes: string | null
  balance: number
  is_active: number
  archived_at: string | null
  created_at: string
  updated_at: string
  purchases_count?: number
  total_spent?: number
}

export interface CreateSupplierInput {
  name: string
  phone?: string | null
  phone2?: string | null
  whatsapp?: string | null
  email?: string | null
  address?: string | null
  taxNumber?: string | null
  notes?: string | null
  openingBalance?: number
  isActive?: boolean
}

export interface UpdateSupplierInput {
  name: string
  phone?: string | null
  phone2?: string | null
  whatsapp?: string | null
  email?: string | null
  address?: string | null
  taxNumber?: string | null
  notes?: string | null
  isActive?: boolean
}

class SupplierService {
  /**
   * Get list of suppliers with search, active filters, and aggregated purchase statistics
   */
  async getSuppliers(params?: {
    search?: string
    activeOnly?: boolean
    limit?: number
    offset?: number
  }): Promise<SupplierItem[]> {
    const db = getDb()
    const conditions: string[] = []
    const sqlParams: unknown[] = []

    if (params?.activeOnly) {
      conditions.push('s.is_active = 1 AND s.archived_at IS NULL')
    }

    if (params?.search && params.search.trim()) {
      const q = `%${params.search.trim()}%`
      conditions.push(`(
        s.name LIKE ?
        OR s.phone LIKE ?
        OR s.phone2 LIKE ?
        OR s.whatsapp LIKE ?
        OR s.email LIKE ?
        OR s.tax_number LIKE ?
      )`)
      sqlParams.push(q, q, q, q, q, q)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const limit = params?.limit ?? 200
    const offset = params?.offset ?? 0

    const query = `
      SELECT s.id, s.name, s.phone, s.phone2, s.whatsapp, s.email, s.address,
             s.tax_number, s.notes, s.balance, s.is_active, s.archived_at, s.created_at, s.updated_at,
             COUNT(p.id) as purchases_count,
             COALESCE(SUM(p.total), 0) as total_spent
      FROM suppliers s
      LEFT JOIN purchases p ON p.supplier_id = s.id AND p.status != 'cancelled'
      ${whereClause}
      GROUP BY s.id
      ORDER BY s.name ASC
      LIMIT ? OFFSET ?
    `

    const rows = await db.select<any[]>(query, [...sqlParams, limit, offset])
    return rows.map(r => ({
      ...r,
      balance: Number(r.balance) || 0,
      purchases_count: Number(r.purchases_count) || 0,
      total_spent: Number(r.total_spent) || 0,
    }))
  }

  /**
   * Get single supplier with purchase and payment history
   */
  async getSupplierById(id: string): Promise<{
    supplier: SupplierItem
    purchases: any[]
    payments: any[]
  } | null> {
    const db = getDb()
    const rows = await db.select<any[]>('SELECT * FROM suppliers WHERE id = ?', [id])
    if (!rows || rows.length === 0) return null

    const supplier = {
      ...rows[0],
      balance: Number(rows[0].balance) || 0,
    }

    const purchases = await db.select<any[]>(`
      SELECT p.id, p.purchase_number, p.purchased_at, p.status, p.total, p.paid_amount, p.balance, p.invoice_ref
      FROM purchases p
      WHERE p.supplier_id = ?
      ORDER BY p.purchased_at DESC
      LIMIT 50
    `, [id])

    const payments = await db.select<any[]>(`
      SELECT pp.id, pp.amount, pp.payment_method, pp.reference, pp.notes, pp.created_at, p.purchase_number
      FROM purchase_payments pp
      LEFT JOIN purchases p ON p.id = pp.purchase_id
      WHERE pp.supplier_id = ?
      ORDER BY pp.created_at DESC
      LIMIT 50
    `, [id])

    return {
      supplier,
      purchases: purchases.map(p => ({
        ...p,
        total: Number(p.total) || 0,
        paid_amount: Number(p.paid_amount) || 0,
        balance: Number(p.balance) || 0,
      })),
      payments: payments.map(pm => ({
        ...pm,
        amount: Number(pm.amount) || 0,
      })),
    }
  }

  /**
   * Create a new supplier
   */
  async createSupplier(
    input: CreateSupplierInput,
    user?: { id?: string; fullName?: string }
  ): Promise<string> {
    const trimmedName = input.name.trim()
    if (!trimmedName) {
      throw new Error('Supplier name is required')
    }

    const db = getDb()
    const id = uuidv4()
    const openingBalance = Number(input.openingBalance) || 0
    const now = new Date().toISOString()

    await db.execute(`
      INSERT INTO suppliers (
        id, name, phone, phone2, whatsapp, email, address,
        tax_number, notes, balance, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      trimmedName,
      input.phone?.trim() || null,
      input.phone2?.trim() || null,
      input.whatsapp?.trim() || null,
      input.email?.trim() || null,
      input.address?.trim() || null,
      input.taxNumber?.trim() || null,
      input.notes?.trim() || null,
      openingBalance,
      input.isActive !== false ? 1 : 0,
      now,
      now,
    ])

    await auditService.log({
      userId: user?.id,
      userFullName: user?.fullName,
      action: 'create_supplier',
      resource: 'suppliers',
      resourceId: id,
      details: {
        name: trimmedName,
        phone: input.phone,
        openingBalance,
      },
    })

    return id
  }

  /**
   * Update an existing supplier
   */
  async updateSupplier(
    id: string,
    input: UpdateSupplierInput,
    user?: { id?: string; fullName?: string }
  ): Promise<void> {
    const trimmedName = input.name.trim()
    if (!trimmedName) {
      throw new Error('Supplier name is required')
    }

    const db = getDb()
    const now = new Date().toISOString()

    await db.execute(`
      UPDATE suppliers SET
        name = ?,
        phone = ?,
        phone2 = ?,
        whatsapp = ?,
        email = ?,
        address = ?,
        tax_number = ?,
        notes = ?,
        is_active = ?,
        updated_at = ?
      WHERE id = ?
    `, [
      trimmedName,
      input.phone?.trim() || null,
      input.phone2?.trim() || null,
      input.whatsapp?.trim() || null,
      input.email?.trim() || null,
      input.address?.trim() || null,
      input.taxNumber?.trim() || null,
      input.notes?.trim() || null,
      input.isActive !== false ? 1 : 0,
      now,
      id,
    ])

    await auditService.log({
      userId: user?.id,
      userFullName: user?.fullName,
      action: 'update_supplier',
      resource: 'suppliers',
      resourceId: id,
      details: {
        name: trimmedName,
        phone: input.phone,
        email: input.email,
      },
    })
  }

  /**
   * Toggle active/inactive status
   */
  async toggleSupplierStatus(
    id: string,
    isActive: boolean,
    user?: { id?: string; fullName?: string }
  ): Promise<void> {
    const db = getDb()
    const now = new Date().toISOString()

    await db.execute(`
      UPDATE suppliers SET
        is_active = ?,
        archived_at = ?,
        updated_at = ?
      WHERE id = ?
    `, [isActive ? 1 : 0, isActive ? null : now, now, id])

    await auditService.log({
      userId: user?.id,
      userFullName: user?.fullName,
      action: isActive ? 'activate_supplier' : 'deactivate_supplier',
      resource: 'suppliers',
      resourceId: id,
    })
  }

  /**
   * Delete or archive supplier (archived if historical purchases exist)
   */
  async deleteSupplier(
    id: string,
    user?: { id?: string; fullName?: string }
  ): Promise<{ action: 'deleted' | 'archived' }> {
    const db = getDb()
    const purchaseCountRows = await db.select<any[]>(
      'SELECT COUNT(*) as c FROM purchases WHERE supplier_id = ?',
      [id]
    )
    const hasPurchases = (purchaseCountRows[0]?.c ?? 0) > 0

    if (hasPurchases) {
      // Archive instead of delete to preserve historical integrity
      await this.toggleSupplierStatus(id, false, user)
      return { action: 'archived' }
    }

    // Safe to delete if no historical purchases
    await db.execute('DELETE FROM suppliers WHERE id = ?', [id])

    await auditService.log({
      userId: user?.id,
      userFullName: user?.fullName,
      action: 'delete_supplier',
      resource: 'suppliers',
      resourceId: id,
    })

    return { action: 'deleted' }
  }

  /**
   * Get suppliers dashboard overview metrics
   */
  async getSupplierOverview(): Promise<{
    totalSuppliers: number
    activeSuppliers: number
    totalPayables: number
    totalPurchasesCount: number
  }> {
    const db = getDb()
    const rows = await db.select<any[]>(`
      SELECT 
        COUNT(*) as total_suppliers,
        SUM(CASE WHEN is_active = 1 AND archived_at IS NULL THEN 1 ELSE 0 END) as active_suppliers,
        SUM(balance) as total_payables
      FROM suppliers
    `)

    const purchRows = await db.select<any[]>('SELECT COUNT(*) as c FROM purchases WHERE status != "cancelled"')

    return {
      totalSuppliers: Number(rows[0]?.total_suppliers) || 0,
      activeSuppliers: Number(rows[0]?.active_suppliers) || 0,
      totalPayables: Number(rows[0]?.total_payables) || 0,
      totalPurchasesCount: Number(purchRows[0]?.c) || 0,
    }
  }
}

export const supplierService = new SupplierService()

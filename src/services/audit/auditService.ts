/**
 * MAKERS POS — Audit Log Service
 * Immutable log of all important actions
 */

import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db/database'

export interface AuditEntry {
  userId?: string
  userFullName?: string
  action: string
  resource?: string
  resourceId?: string
  details?: Record<string, unknown>
}

class AuditService {
  async log(entry: AuditEntry): Promise<void> {
    try {
      const db = getDb()
      await db.execute(
        `INSERT INTO audit_logs (id, user_id, user_full_name, action, resource, resource_id, details)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          entry.userId && entry.userId !== 'mock-admin-id' ? entry.userId : null,
          entry.userFullName ?? null,
          entry.action,
          entry.resource ?? null,
          entry.resourceId ?? null,
          entry.details ? JSON.stringify(entry.details) : null,
        ]
      )
    } catch (err) {
      // Audit failures must never crash the app
      console.error('Audit log error:', err)
    }
  }

  async query(filters: {
    userId?: string
    action?: string
    resource?: string
    dateFrom?: string
    dateTo?: string
    limit?: number
    offset?: number
  }) {
    const db = getDb()
    const conditions: string[] = []
    const params: unknown[] = []

    if (filters.userId) {
      conditions.push('user_id = ?')
      params.push(filters.userId)
    }
    if (filters.action) {
      conditions.push('action = ?')
      params.push(filters.action)
    }
    if (filters.resource) {
      conditions.push('resource = ?')
      params.push(filters.resource)
    }
    if (filters.dateFrom) {
      conditions.push('created_at >= ?')
      params.push(filters.dateFrom)
    }
    if (filters.dateTo) {
      conditions.push('created_at <= ?')
      params.push(filters.dateTo)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const limit = filters.limit ?? 100
    const offset = filters.offset ?? 0

    return db.select<Array<{
      id: string
      user_id: string | null
      user_full_name: string | null
      action: string
      resource: string | null
      resource_id: string | null
      details: string | null
      created_at: string
    }>>(`SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset])
  }
}

export const auditService = new AuditService()

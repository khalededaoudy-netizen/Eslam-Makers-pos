/**
 * MAKERS POS — Database Reset Service
 * Safely resets all operational data (sales, purchases, inventory, products, customers, suppliers)
 * while preserving users, roles, permissions, settings, and generating a mandatory pre-reset backup.
 */

import { getDb, withTransaction } from './database'
import { backupService } from './backupService'
import { auditService } from '../audit/auditService'

export const OPERATIONAL_TABLES = [
  'return_items',
  'returns',
  'sale_items',
  'sales',
  'payments',
  'purchase_payments',
  'purchase_items',
  'purchases',
  'inventory_movements',
  'product_locations',
  'product_attribute_values',
  'barcode_labels',
  'product_barcodes',
  'products',
  'product_categories',
  'brands',
  'product_units',
  'storage_locations',
  'cash_movements',
  'shifts',
  'cash_registers',
  'expenses',
  'held_carts',
  'customers',
  'suppliers',
] as const

/**
 * Fetch current row counts for all operational tables
 */
export async function getOperationalDataCounts(): Promise<Record<string, number>> {
  const db = getDb()
  const counts: Record<string, number> = {}

  for (const table of OPERATIONAL_TABLES) {
    try {
      const exists = await db.select<any[]>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
        [table]
      )
      if (exists && exists.length > 0) {
        const rows = await db.select<Array<{ c: number }>>(`SELECT COUNT(*) as c FROM ${table}`)
        counts[table] = rows?.[0]?.c ?? 0
      } else {
        counts[table] = 0
      }
    } catch {
      counts[table] = 0
    }
  }

  return counts
}

/**
 * Reset all operational data with mandatory pre-reset backup
 */
export async function resetOperationalData(options: {
  keepAuditLogs?: boolean
  userId: string
  importMakersCategories?: boolean
}): Promise<{ success: boolean; deleted: Record<string, number> }> {
  // 1. Mandatory Pre-reset backup
  await backupService.createBackup({
    filename: `pre_reset_${Date.now()}.db`,
    type: 'pre_reset',
    notes: 'Before reset all data',
    userId: options.userId,
  })

  const db = getDb()
  const deleted: Record<string, number> = {}

  await withTransaction(db, async (txDb) => {
    for (const table of OPERATIONAL_TABLES) {
      try {
        const exists = await db.select<any[]>(
          "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
          [table]
        )
        if (exists && exists.length > 0) {
          const [row] = await db.select<Array<{ c: number }>>(`SELECT COUNT(*) as c FROM ${table}`)
          deleted[table] = row?.c ?? 0
          await txDb.execute(`DELETE FROM ${table}`)
        } else {
          deleted[table] = 0
        }
      } catch (tableErr) {
        console.warn(`[resetService] Skipping non-fatal table reset error on ${table}:`, tableErr)
        deleted[table] = 0
      }
    }

    if (!options.keepAuditLogs) {
      await txDb.execute('DELETE FROM audit_logs')
    } else {
      await txDb.execute(`
        DELETE FROM audit_logs WHERE id NOT IN (
          SELECT id FROM audit_logs ORDER BY created_at DESC LIMIT 100
        )
      `)
    }
  })

  // 2. If importMakersCategories is true, auto-seed the 35 master categories
  if (options.importMakersCategories) {
    try {
      const { makersCategoryService } = await import('../categories/makersCategoryService')
      await makersCategoryService.importMakersCategories(undefined, {
        id: options.userId,
      })
      console.log('[resetService] Auto-imported 35 MAKERS categories after reset.')
    } catch (catErr) {
      console.warn('[resetService] Failed to auto-import MAKERS categories:', catErr)
    }
  }

  // 3. Ensure default cash register, units, and brand exist after operational reset
  try {
    const { cashRegisterService } = await import('@/features/cash-register/cashRegisterService')
    await cashRegisterService.ensureDefaultRegister()
  } catch (regErr) {
    console.warn('[resetService] Failed to ensure default cash register after reset:', regErr)
  }

  try {
    const { ensureDefaultUnits, ensureDefaultBrand } = await import('./database')
    await ensureDefaultUnits(db)
    await ensureDefaultBrand(db)
  } catch (seedErr) {
    console.warn('[resetService] Failed to ensure default units and brand after reset:', seedErr)
  }

  // Log to audit service
  try {
    await auditService.log({
      action: 'reset_all_data',
      resource: 'system',
      userId: options.userId,
      details: { deleted, importMakersCategories: !!options.importMakersCategories },
    })
  } catch (auditErr) {
    console.warn('[resetService] Audit log warning:', auditErr)
  }

  return { success: true, deleted }
}

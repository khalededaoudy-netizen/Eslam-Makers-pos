import { v4 as uuidv4 } from 'uuid'
import { getDb, AppDatabase } from '@/services/db/database'
import { auditService } from '@/services/audit/auditService'
import {
  MAKERS_MASTER_CATEGORIES,
  MakersMasterCategoryDef,
  normalizeCategoryName,
} from './makersCategories'

export interface CategoryWithCount {
  id: string
  name_ar: string
  name_en: string
  parent_id: string | null
  description: string | null
  color: string | null
  icon: string | null
  is_active: number
  sort_order: number
  product_count: number
  created_at: string
  updated_at: string
}

export interface ImportPreviewResult {
  total: number
  toCreate: number
  alreadyExists: number
  duplicatesPrevented: number
  categoriesToCreate: MakersMasterCategoryDef[]
  categoriesAlreadyExisting: MakersMasterCategoryDef[]
  oldUnmatchedCategories: { id: string; name_ar: string; name_en: string; product_count: number }[]
}

export interface ImportExecutionResult {
  total: number
  created: number
  alreadyExisted: number
  duplicatesPrevented: number
}

export class MakersCategoryService {
  /**
   * Get the authoritative 35 master categories definition
   */
  getMasterDefinitions(): readonly MakersMasterCategoryDef[] {
    return MAKERS_MASTER_CATEGORIES
  }

  /**
   * Get all categories with dynamic product counts for management UI
   */
  async getCategoriesWithCounts(database?: AppDatabase): Promise<CategoryWithCount[]> {
    const db = database || getDb()
    return db.select<CategoryWithCount[]>(`
      SELECT 
        c.id,
        c.name_ar,
        c.name_en,
        c.parent_id,
        c.description,
        c.color,
        c.icon,
        c.is_active,
        c.sort_order,
        c.created_at,
        c.updated_at,
        COUNT(p.id) AS product_count
      FROM product_categories c
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY c.sort_order ASC, c.name_ar ASC
    `)
  }

  /**
   * Preview MAKERS Categories Import without committing changes
   */
  async previewImport(database?: AppDatabase): Promise<ImportPreviewResult> {
    const db = database || getDb()
    const existingInDb = await db.select<{ id: string; name_ar: string; name_en: string; product_count: number }[]>(`
      SELECT c.id, c.name_ar, c.name_en, COUNT(p.id) AS product_count
      FROM product_categories c
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id
    `)

    const matchedDbIds = new Set<string>()
    const toCreate: MakersMasterCategoryDef[] = []
    const alreadyExisting: MakersMasterCategoryDef[] = []

    for (const master of MAKERS_MASTER_CATEGORIES) {
      const normEn = normalizeCategoryName(master.name_en)
      const normAr = normalizeCategoryName(master.name_ar)

      const found = existingInDb.find(e => {
        const eNormEn = normalizeCategoryName(e.name_en)
        const eNormAr = normalizeCategoryName(e.name_ar)
        return eNormEn === normEn || eNormAr === normAr
      })

      if (found) {
        alreadyExisting.push(master)
        matchedDbIds.add(found.id)
      } else {
        toCreate.push(master)
      }
    }

    const oldUnmatched = existingInDb.filter(e => !matchedDbIds.has(e.id))

    return {
      total: MAKERS_MASTER_CATEGORIES.length,
      toCreate: toCreate.length,
      alreadyExists: alreadyExisting.length,
      duplicatesPrevented: alreadyExisting.length,
      categoriesToCreate: toCreate,
      categoriesAlreadyExisting: alreadyExisting,
      oldUnmatchedCategories: oldUnmatched,
    }
  }

  /**
   * Atomically import / sync the 35 MAKERS Master Categories idempotently
   */
  async importMakersCategories(
    database?: AppDatabase,
    user?: { id?: string; fullName?: string }
  ): Promise<ImportExecutionResult> {
    const db = database || getDb()

    const existingInDb = await db.select<{ id: string; name_ar: string; name_en: string }[]>(`
      SELECT id, name_ar, name_en FROM product_categories
    `)

    let createdCount = 0
    let alreadyExistedCount = 0

    await db.execute('BEGIN TRANSACTION;')

    try {
      for (const master of MAKERS_MASTER_CATEGORIES) {
        const normEn = normalizeCategoryName(master.name_en)
        const normAr = normalizeCategoryName(master.name_ar)

        // Find existing record safely
        const matched = existingInDb.find(e => {
          const eNormEn = normalizeCategoryName(e.name_en)
          const eNormAr = normalizeCategoryName(e.name_ar)
          return eNormEn === normEn || eNormAr === normAr
        })

        if (matched) {
          // Idempotent update: ensure authoritative name_en, sort_order, icon, color, active
          await db.execute(`
            UPDATE product_categories SET
              name_en = ?,
              name_ar = ?,
              icon = ?,
              color = ?,
              description = ?,
              is_active = 1,
              sort_order = ?,
              updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
            WHERE id = ?
          `, [
            master.name_en,
            master.name_ar,
            master.icon,
            master.color,
            master.description || 'MAKERS Master Category',
            master.sort_order,
            matched.id,
          ])
          alreadyExistedCount++
        } else {
          // Create new record
          const id = uuidv4()
          await db.execute(`
            INSERT INTO product_categories (
              id, name_ar, name_en, parent_id, description, color, icon, is_active, sort_order, created_at, updated_at
            ) VALUES (?, ?, ?, NULL, ?, ?, ?, 1, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
          `, [
            id,
            master.name_ar,
            master.name_en,
            master.description || 'MAKERS Master Category',
            master.color,
            master.icon,
            master.sort_order,
          ])
          createdCount++
        }
      }

      await db.execute('COMMIT;')

      await auditService.log({
        userId: user?.id,
        userFullName: user?.fullName,
        action: 'import_makers_categories',
        resource: 'product_categories',
        details: {
          total: MAKERS_MASTER_CATEGORIES.length,
          created: createdCount,
          alreadyExisted: alreadyExistedCount,
        },
      })

      return {
        total: MAKERS_MASTER_CATEGORIES.length,
        created: createdCount,
        alreadyExisted: alreadyExistedCount,
        duplicatesPrevented: alreadyExistedCount,
      }
    } catch (err) {
      await db.execute('ROLLBACK;')
      throw err
    }
  }
}

export const makersCategoryService = new MakersCategoryService()

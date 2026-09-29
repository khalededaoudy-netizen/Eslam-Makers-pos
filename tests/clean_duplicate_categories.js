/**
 * MAKERS POS — Database Deduplication & Cleanup Script
 * 
 * 1. Creates a full backup of the installed database.
 * 2. Deduplicates product_categories to strictly match the 35 MAKERS Master Categories.
 * 3. Migrates any product associations to canonical categories.
 * 4. Deduplicates units, expense categories, cash registers, and attribute definitions.
 * 5. Verifies DB integrity and foreign keys.
 */

import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { MAKERS_MASTER_CATEGORIES, normalizeCategoryName } from '../src/services/categories/makersCategories.ts'
import { v4 as uuidv4 } from 'uuid'

const appData = process.env.APPDATA || ''
const dbPath = path.join(appData, 'com.makers.pos', 'makers_pos.db')

console.log('===============================================================')
console.log('MAKERS POS — Database Deduplication & Cleanup')
console.log(`Database Path: ${dbPath}`)
console.log('===============================================================\n')

if (!fs.existsSync(dbPath)) {
  console.error(`ERROR: Database not found at ${dbPath}`)
  process.exit(1)
}

// 1. Create Backup
const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
const backupPath = `${dbPath}.bak_${timestamp}`
fs.copyFileSync(dbPath, backupPath)
console.log(`[1] Backup created successfully:`)
console.log(`    -> ${backupPath}\n`)

const db = new DatabaseSync(dbPath)
db.exec('PRAGMA foreign_keys = ON;')

// Begin Transaction
db.exec('BEGIN TRANSACTION;')

try {
  // 2. Fetch existing categories
  const existingCats = db.prepare(`
    SELECT id, name_ar, name_en, icon, color, sort_order, is_active, created_at 
    FROM product_categories
    ORDER BY created_at ASC
  `).all()

  console.log(`[2] Initial Category Count: ${existingCats.length}`)

  // Map to hold canonical IDs for each master category
  const canonicalMap = new Map() // normEn -> canonical category row
  const dupIdToCanonicalId = new Map() // dupId -> canonicalId
  const toDeleteIds = new Set()

  for (const master of MAKERS_MASTER_CATEGORIES) {
    const normMasterEn = normalizeCategoryName(master.name_en)
    const normMasterAr = normalizeCategoryName(master.name_ar)

    // Find all matching rows in existingCats
    const matches = existingCats.filter(e => {
      const eNormEn = normalizeCategoryName(e.name_en)
      const eNormAr = normalizeCategoryName(e.name_ar)
      return eNormEn === normMasterEn || eNormAr === normMasterAr
    })

    if (matches.length > 0) {
      // Pick the first one as canonical
      const canonical = matches[0]
      canonicalMap.set(normMasterEn, canonical.id)

      // Update canonical row with authoritative values
      db.prepare(`
        UPDATE product_categories 
        SET name_en = ?, name_ar = ?, icon = ?, color = ?, sort_order = ?, is_active = 1, description = ?
        WHERE id = ?
      `).run(
        master.name_en,
        master.name_ar,
        master.icon,
        master.color,
        master.sort_order,
        master.description || 'MAKERS Master Category',
        canonical.id
      )

      // Mark other matches as duplicates to delete and map their IDs
      for (let i = 1; i < matches.length; i++) {
        dupIdToCanonicalId.set(matches[i].id, canonical.id)
        toDeleteIds.add(matches[i].id)
      }
    } else {
      // Missing master category: create it
      const newId = uuidv4()
      db.prepare(`
        INSERT INTO product_categories (id, name_ar, name_en, parent_id, description, color, icon, is_active, sort_order)
        VALUES (?, ?, ?, NULL, ?, ?, ?, 1, ?)
      `).run(
        newId,
        master.name_ar,
        master.name_en,
        master.description || 'MAKERS Master Category',
        master.color,
        master.icon,
        master.sort_order
      )
      canonicalMap.set(normMasterEn, newId)
    }
  }

  // Find completely unmatched old categories
  for (const e of existingCats) {
    const eNormEn = normalizeCategoryName(e.name_en)
    const eNormAr = normalizeCategoryName(e.name_ar)
    const isMaster = MAKERS_MASTER_CATEGORIES.some(m => {
      return normalizeCategoryName(m.name_en) === eNormEn || normalizeCategoryName(m.name_ar) === eNormAr
    })

    if (!isMaster && !toDeleteIds.has(e.id)) {
      toDeleteIds.add(e.id)
      // Check if products attached
      const linkedProds = db.prepare('SELECT count(*) as count FROM products WHERE category_id = ?').get(e.id)
      if (linkedProds.count > 0) {
        // Remap to first canonical category (e.g. Aluminum Profile & Shaft or default)
        const defaultCanonicalId = canonicalMap.values().next().value
        dupIdToCanonicalId.set(e.id, defaultCanonicalId)
      }
    }
  }

  console.log(`[3] Re-mapping ${dupIdToCanonicalId.size} duplicate/obsolete category references...`)

  // Remap products pointing to duplicates
  for (const [dupId, canonId] of dupIdToCanonicalId.entries()) {
    db.prepare('UPDATE products SET category_id = ? WHERE category_id = ?').run(canonId, dupId)
  }

  console.log(`[4] Deleting ${toDeleteIds.size} duplicate and obsolete category rows...`)
  for (const delId of toDeleteIds) {
    db.prepare('DELETE FROM product_categories WHERE id = ?').run(delId)
  }

  // 3. Deduplicate other tables that were multiplied on startup
  // (a) product_units
  const allUnits = db.prepare('SELECT id, symbol, name_en FROM product_units ORDER BY rowid ASC').all()
  const seenUnits = new Set()
  for (const u of allUnits) {
    const key = (u.symbol || '').toLowerCase().trim()
    if (seenUnits.has(key)) {
      db.prepare('DELETE FROM product_units WHERE id = ?').run(u.id)
    } else {
      seenUnits.add(key)
    }
  }

  // (b) expense_categories
  const allExp = db.prepare('SELECT id, name_en FROM expense_categories ORDER BY rowid ASC').all()
  const seenExp = new Set()
  for (const exp of allExp) {
    const key = (exp.name_en || '').toLowerCase().trim()
    if (seenExp.has(key)) {
      db.prepare('DELETE FROM expense_categories WHERE id = ?').run(exp.id)
    } else {
      seenExp.add(key)
    }
  }

  // (c) cash_registers (keep first 'Main Register' or active registers)
  const allRegs = db.prepare("SELECT id, name FROM cash_registers WHERE name = 'Main Register' ORDER BY rowid ASC").all()
  if (allRegs.length > 1) {
    const canonRegId = allRegs[0].id
    for (let i = 1; i < allRegs.length; i++) {
      const dupRegId = allRegs[i].id
      // Update any shifts pointing to dupRegId
      db.prepare('UPDATE shifts SET register_id = ? WHERE register_id = ?').run(canonRegId, dupRegId)
      db.prepare('DELETE FROM cash_registers WHERE id = ?').run(dupRegId)
    }
  }

  // (d) product_attribute_defs
  const allAttrs = db.prepare('SELECT id, name_en FROM product_attribute_defs ORDER BY rowid ASC').all()
  const seenAttrs = new Set()
  for (const a of allAttrs) {
    const key = (a.name_en || '').toLowerCase().trim()
    if (seenAttrs.has(key)) {
      db.prepare('DELETE FROM product_attribute_defs WHERE id = ?').run(a.id)
    } else {
      seenAttrs.add(key)
    }
  }

  // (e) storage_locations
  const allLocs = db.prepare('SELECT id, code FROM storage_locations ORDER BY rowid ASC').all()
  const seenLocs = new Set()
  for (const l of allLocs) {
    const key = (l.code || '').toLowerCase().trim()
    if (seenLocs.has(key)) {
      db.prepare('DELETE FROM storage_locations WHERE id = ?').run(l.id)
    } else {
      seenLocs.add(key)
    }
  }

  db.exec('COMMIT;')
  console.log('[5] Cleanup transaction committed successfully.\n')

} catch (err) {
  db.exec('ROLLBACK;')
  console.error('FATAL: Cleanup transaction rolled back due to error:', err)
  process.exit(1)
}

// 4. Verify Final State
console.log('===============================================================')
console.log('VERIFICATION')
console.log('===============================================================')

const finalCats = db.prepare('SELECT id, name_en, name_ar, sort_order, is_active FROM product_categories ORDER BY sort_order ASC').all()
console.log(`Total Categories: ${finalCats.length} (Expected: 35)`)

const dupGroups = db.prepare(`
  SELECT name_en, count(*) as cnt 
  FROM product_categories 
  GROUP BY name_en 
  HAVING cnt > 1
`).all()
console.log(`Duplicates Count: ${dupGroups.length} (Expected: 0)`)

const unexpected = finalCats.filter(c => {
  return !MAKERS_MASTER_CATEGORIES.some(m => normalizeCategoryName(m.name_en) === normalizeCategoryName(c.name_en))
})
console.log(`Unexpected Categories: ${unexpected.length} (Expected: 0)`)

const fkViolations = db.prepare('PRAGMA foreign_key_check;').all()
console.log(`Foreign Key Violations: ${fkViolations.length} (Expected: 0)`)

const integrity = db.prepare('PRAGMA integrity_check;').get()
console.log(`Integrity Check: ${integrity.integrity_check} (Expected: ok)`)

console.log('\n--- Final Category List ---')
finalCats.forEach((c, idx) => {
  console.log(`${idx + 1}. [${c.sort_order}] ${c.name_en} / ${c.name_ar} (Active: ${c.is_active})`)
})

if (finalCats.length === 35 && dupGroups.length === 0 && unexpected.length === 0 && fkViolations.length === 0 && integrity.integrity_check === 'ok') {
  console.log('\n✅ ALL DATABASE DEDUPLICATION CHECKS PASSED!')
} else {
  console.error('\n❌ DATABASE VERIFICATION FAILED!')
  process.exit(1)
}

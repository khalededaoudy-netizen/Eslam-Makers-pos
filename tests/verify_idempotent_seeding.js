import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import { MAKERS_MASTER_CATEGORIES, normalizeCategoryName } from '../src/services/categories/makersCategories.ts'
import { v4 as uuidv4 } from 'uuid'

const appData = process.env.APPDATA || ''
const dbPath = path.join(appData, 'com.makers.pos', 'makers_pos.db')

console.log('===============================================================')
console.log('MAKERS POS — Seed Idempotency Multi-Run Simulation')
console.log('===============================================================\n')

const db = new DatabaseSync(dbPath)

function simulateSeed() {
  // 1. Roles
  const existingRoles = db.prepare('SELECT id, name FROM roles').all()
  const roleMap = new Map(existingRoles.map(r => [r.name, r.id]))
  const rolesToEnsure = [
    { name: 'admin', displayName: 'Administrator', displayNameAr: 'مدير النظام' },
    { name: 'manager', displayName: 'Manager', displayNameAr: 'مدير' },
    { name: 'cashier', displayName: 'Cashier', displayNameAr: 'كاشير' },
  ]
  for (const r of rolesToEnsure) {
    if (!roleMap.has(r.name)) {
      const id = uuidv4()
      db.prepare('INSERT INTO roles (id, name, display_name, display_name_ar, is_system) VALUES (?, ?, ?, ?, 1)').run(id, r.name, r.displayName, r.displayNameAr)
      roleMap.set(r.name, id)
    }
  }

  // 2. Units
  const existingUnits = db.prepare('SELECT id, symbol, name_en FROM product_units').all()
  const unitSymbols = new Set(existingUnits.map(u => (u.symbol || '').toLowerCase().trim()))
  const unitNames = new Set(existingUnits.map(u => (u.name_en || '').toLowerCase().trim()))
  const units = [
    { nameAr: 'قطعة', nameEn: 'Piece', symbol: 'pcs', allowDecimal: 0 },
    { nameAr: 'متر', nameEn: 'Meter', symbol: 'm', allowDecimal: 1 },
    { nameAr: 'حزمة', nameEn: 'Pack', symbol: 'pk', allowDecimal: 0 },
    { nameAr: 'طقم', nameEn: 'Set', symbol: 'set', allowDecimal: 0 },
    { nameAr: 'لفة', nameEn: 'Roll', symbol: 'roll', allowDecimal: 0 },
    { nameAr: 'علبة', nameEn: 'Box', symbol: 'box', allowDecimal: 0 },
    { nameAr: 'زوج', nameEn: 'Pair', symbol: 'pr', allowDecimal: 0 },
    { nameAr: 'جرام', nameEn: 'Gram', symbol: 'g', allowDecimal: 1 },
    { nameAr: 'كيلوجرام', nameEn: 'Kilogram', symbol: 'kg', allowDecimal: 1 },
  ]
  for (const u of units) {
    if (!unitSymbols.has(u.symbol.toLowerCase().trim()) && !unitNames.has(u.nameEn.toLowerCase().trim())) {
      db.prepare('INSERT INTO product_units (id, name_ar, name_en, symbol, allow_decimal) VALUES (?, ?, ?, ?, ?)').run(uuidv4(), u.nameAr, u.nameEn, u.symbol, u.allowDecimal)
      unitSymbols.add(u.symbol.toLowerCase().trim())
    }
  }

  // 3. Master Categories
  const existingCats = db.prepare('SELECT id, name_ar, name_en FROM product_categories').all()
  for (const master of MAKERS_MASTER_CATEGORIES) {
    const normEn = normalizeCategoryName(master.name_en)
    const normAr = normalizeCategoryName(master.name_ar)
    const match = existingCats.find(e => {
      const eNormEn = normalizeCategoryName(e.name_en)
      const eNormAr = normalizeCategoryName(e.name_ar)
      return eNormEn === normEn || eNormAr === normAr
    })
    if (!match) {
      const id = uuidv4()
      db.prepare('INSERT INTO product_categories (id, name_ar, name_en, parent_id, description, color, icon, is_active, sort_order) VALUES (?, ?, ?, NULL, ?, ?, ?, 1, ?)').run(id, master.name_ar, master.name_en, master.description || 'MAKERS Master Category', master.color, master.icon, master.sort_order)
      existingCats.push({ id, name_ar: master.name_ar, name_en: master.name_en })
    }
  }

  // 4. Cash registers
  const existingRegisters = db.prepare('SELECT id, name FROM cash_registers').all()
  if (existingRegisters.length === 0) {
    db.prepare("INSERT INTO cash_registers (id, name, name_ar) VALUES (?, 'Main Register', 'الكاشير الرئيسي')").run(uuidv4())
  }
}

console.log('Running 50 consecutive simulated seed operations...')
for (let i = 1; i <= 50; i++) {
  simulateSeed()
}

const finalCount = db.prepare('SELECT count(*) as cnt FROM product_categories').get().cnt
const finalDups = db.prepare('SELECT name_en, count(*) as cnt FROM product_categories GROUP BY name_en HAVING cnt > 1').all()
const unitsCount = db.prepare('SELECT count(*) as cnt FROM product_units').get().cnt
const regCount = db.prepare('SELECT count(*) as cnt FROM cash_registers').get().cnt

console.log(`\nAfter 50 seed runs:`)
console.log(`- Categories: ${finalCount} (Expected: 35)`)
console.log(`- Category Duplicates: ${finalDups.length} (Expected: 0)`)
console.log(`- Units: ${unitsCount} (Expected: 9)`)
console.log(`- Cash Registers: ${regCount} (Expected: 1)`)

if (finalCount === 35 && finalDups.length === 0 && unitsCount === 9 && regCount === 1) {
  console.log('\n✅ SEED IDEMPOTENCY TEST PASSED 100% (50/50 runs created 0 duplicates)')
} else {
  console.error('\n❌ SEED IDEMPOTENCY TEST FAILED')
  process.exit(1)
}

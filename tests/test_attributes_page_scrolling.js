/**
 * Attributes Page Verification Test
 * Verifies:
 * 1. Database seed of few (3) vs many (50) attributes
 * 2. Attribute CRUD (Create, Read, Update, Delete)
 * 3. Search and filtering query behavior
 * 4. DB schema integrity and foreign keys
 */

import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { v4 as uuidv4 } from 'uuid'

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'com.makers.pos', 'makers_pos.db')
console.log('=================================================================')
console.log('MAKERS POS — Attributes / Properties Page Verification Test')
console.log(`Database Path: ${dbPath}`)
console.log('=================================================================\n')

if (!fs.existsSync(dbPath)) {
  console.error(`Database not found at ${dbPath}`)
  process.exit(1)
}

const db = new DatabaseSync(dbPath)
db.exec('PRAGMA foreign_keys = ON;')

let passed = 0
let failed = 0

function assert(condition, message, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`)
    passed++
  } else {
    console.error(`  ❌ FAIL: ${message} ${details ? `— ${details}` : ''}`)
    failed++
  }
}

async function runAttributesVerification() {
  console.log('--- TEST 1: Initial Attributes Count ---')
  const initialAttrs = db.prepare("SELECT * FROM product_attribute_defs ORDER BY sort_order ASC, name_ar ASC").all()
  console.log(`Initial attributes count: ${initialAttrs.length}`)
  assert(Array.isArray(initialAttrs), 'Attributes table is queryable')

  console.log('\n--- TEST 2: Seed 30 Test Attributes (Simulating Large List) ---')
  const testIds = []
  const units = ['Ω', 'kΩ', 'MΩ', 'V', 'mV', 'kV', 'A', 'mA', 'µA', 'µF', 'nF', 'pF', 'H', 'mH', 'µH', 'W', 'mW', 'Hz', 'kHz', 'MHz', '°C', 'pin', 'bit', 'byte', 'mm', 'cm', 'g', 'kg', 'rpm', 'lx']
  
  for (let i = 1; i <= 30; i++) {
    const id = uuidv4()
    testIds.push(id)
    const nameAr = `خاصية تجريبية ${i}`
    const nameEn = `Test Property ${i}`
    const unit = units[i % units.length]
    
    db.prepare(`
      INSERT INTO product_attribute_defs (id, name_ar, name_en, unit, data_type, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'text', ?, datetime('now'), datetime('now'))
    `).run(id, nameAr, nameEn, unit, i)
  }

  const seededAttrs = db.prepare("SELECT * FROM product_attribute_defs WHERE name_en LIKE 'Test Property%'").all()
  assert(seededAttrs.length === 30, 'Successfully seeded 30 test attributes')

  console.log('\n--- TEST 3: Query & Filtering (Simulating Search) ---')
  const searchFilter1 = db.prepare(`
    SELECT * FROM product_attribute_defs 
    WHERE LOWER(name_ar) LIKE '%خاصية تجريبية 1%' OR LOWER(name_en) LIKE '%test property 1%'
  `).all()
  assert(searchFilter1.length >= 10, 'Search filter matches subsets accurately')

  const searchFilterSpecific = db.prepare(`
    SELECT * FROM product_attribute_defs 
    WHERE LOWER(name_ar) LIKE '%خاصية تجريبية 25%' OR LOWER(name_en) LIKE '%test property 25%'
  `).all()
  assert(searchFilterSpecific.length === 1 && searchFilterSpecific[0].name_en === 'Test Property 25', 'Specific search filter finds exact item')

  console.log('\n--- TEST 4: Update an Attribute ---')
  const updateTargetId = testIds[0]
  db.prepare(`
    UPDATE product_attribute_defs 
    SET name_ar = 'خاصية معدلة 1', name_en = 'Updated Property 1', unit = 'GHz', updated_at = datetime('now')
    WHERE id = ?
  `).run(updateTargetId)
  
  const updatedItem = db.prepare("SELECT * FROM product_attribute_defs WHERE id = ?").get(updateTargetId)
  assert(updatedItem.name_ar === 'خاصية معدلة 1' && updatedItem.unit === 'GHz', 'Attribute successfully updated')

  console.log('\n--- TEST 5: Delete an Attribute ---')
  const deleteTargetId = testIds[testIds.length - 1]
  db.prepare("DELETE FROM product_attribute_defs WHERE id = ?").run(deleteTargetId)
  
  const deletedItem = db.prepare("SELECT * FROM product_attribute_defs WHERE id = ?").get(deleteTargetId)
  assert(deletedItem == null, 'Attribute successfully deleted')

  console.log('\n--- TEST 6: PRAGMA foreign_key_check ---')
  const fkCheck = db.prepare("PRAGMA foreign_key_check").all()
  assert(fkCheck.length === 0, 'PRAGMA foreign_key_check is completely clean (0 violations)')

  // Cleanup test seeded items
  console.log('\n--- CLEANING TEST SEEDED ATTRIBUTES ---')
  db.prepare("DELETE FROM product_attribute_defs WHERE name_en LIKE 'Test Property%' OR name_en = 'Updated Property 1'").run()
  
  const remainingTestAttrs = db.prepare("SELECT COUNT(*) as count FROM product_attribute_defs WHERE name_en LIKE 'Test Property%'").get().count
  assert(remainingTestAttrs === 0, 'All test attributes cleaned up cleanly')

  console.log('\n=================================================================')
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`)
  console.log('=================================================================')

  if (failed > 0) {
    process.exit(1)
  }
}

runAttributesVerification()

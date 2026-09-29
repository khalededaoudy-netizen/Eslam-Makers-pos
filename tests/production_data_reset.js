/**
 * MAKERS POS — Production Database Reset & Initialization Script
 * 
 * Safely purges test, demo, and operational data while strictly preserving:
 * 1. The primary Administrator account (credentials, password hash, role).
 * 2. System roles and default permissions.
 * 3. Database schema and migration tracking history.
 * 4. System settings (store info, thermal printer, barcode config).
 * 
 * Usage:
 *   node tests/production_data_reset.js            -> Dry-Run / Preview Mode
 *   node tests/production_data_reset.js --execute  -> Atomic Production Reset
 */

import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'

const appData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + '/.local/share')
const PROD_DB_PATH = path.join(appData, 'com.makers.pos', 'makers_pos.db')

const isExecuteMode = process.argv.includes('--execute') || process.argv.includes('--confirm') || process.argv.includes('-y')

console.log('======================================================================')
console.log('          MAKERS POS — PRODUCTION DATABASE RESET & PURGE')
console.log(` Mode:        ${isExecuteMode ? '🚀 LIVE ATOMIC EXECUTION' : '🔍 PREVIEW / DRY-RUN (Safety First)'}`)
console.log(` Target DB:   ${PROD_DB_PATH}`)
console.log('======================================================================\n')

if (!fs.existsSync(PROD_DB_PATH)) {
  console.error(`❌ FATAL: Database not found at ${PROD_DB_PATH}`)
  process.exit(1)
}

const db = new DatabaseSync(PROD_DB_PATH)

// 1. Verify Admin User Exists
const adminUser = db.prepare(`
  SELECT u.id, u.username, u.full_name, u.role_id, r.name as role_name, u.password_hash, u.is_active
  FROM users u
  JOIN roles r ON r.id = u.role_id
  WHERE r.name = 'admin' OR u.username = 'admin'
  LIMIT 1
`).get()

if (!adminUser) {
  console.error('❌ FATAL: No valid Administrator account found! Aborting to prevent lockout.')
  process.exit(1)
}

console.log(`👤 Protected Admin Identified: @${adminUser.username} (${adminUser.full_name}) [ID: ${adminUser.id}]\n`)

// List of operational tables to count and purge
const operationalTables = [
  { table: 'return_items', desc: 'Return item lines' },
  { table: 'returns', desc: 'Return invoices & refunds' },
  { table: 'payments', desc: 'Customer & sale payments' },
  { table: 'sale_items', desc: 'Sale item lines' },
  { table: 'sales', desc: 'Sales invoices' },
  { table: 'held_carts', desc: 'Held POS carts' },
  { table: 'purchase_payments', desc: 'Supplier purchase payments' },
  { table: 'purchase_items', desc: 'Purchase invoice item lines' },
  { table: 'purchases', desc: 'Purchase invoices' },
  { table: 'cash_movements', desc: 'Cash in / Cash out movements' },
  { table: 'expenses', desc: 'Expense entries' },
  { table: 'shifts', desc: 'Cash register shifts' },
  { table: 'inventory_movements', desc: 'Inventory audit movement logs' },
  { table: 'product_locations', desc: 'Product warehouse locations' },
  { table: 'product_attribute_values', desc: 'Product attribute values' },
  { table: 'product_barcodes', desc: 'Product secondary barcodes' },
  { table: 'barcode_labels', desc: 'Generated barcode print configs' },
  { table: 'kit_items', desc: 'Product bundle/kit items' },
  { table: 'kits', desc: 'Product bundle/kit headers' },
  { table: 'products', desc: 'Products catalog' },
  { table: 'customers', desc: 'Customers list' },
  { table: 'suppliers', desc: 'Suppliers list' },
  { table: 'sessions', desc: 'Active login sessions' },
  { table: 'user_permissions', desc: 'Custom user permissions overrides' },
  { table: 'users', desc: 'Non-admin users', customCount: "SELECT COUNT(*) as count FROM users WHERE id != '" + adminUser.id + "' AND username != 'admin'" },
  { table: 'audit_logs', desc: 'Audit trail logs' },
]

function getTableCount(tableDef) {
  try {
    const query = tableDef.customCount || `SELECT COUNT(*) as count FROM ${tableDef.table}`
    const res = db.prepare(query).get()
    return res ? res.count : 0
  } catch {
    return 0
  }
}

// Gather counts
const stats = operationalTables.map(t => ({
  ...t,
  count: getTableCount(t)
}))

console.log('--- 📊 OPERATIONAL & TEST DATA BREAKDOWN ---')
console.log('----------------------------------------------------------------------')
console.log(' Table Name                  | Records to Delete | Description')
console.log('----------------------------------------------------------------------')
let totalRecordsToPurge = 0
for (const s of stats) {
  console.log(` ${s.table.padEnd(27)} | ${s.count.toString().padStart(17)} | ${s.desc}`)
  totalRecordsToPurge += s.count
}
console.log('----------------------------------------------------------------------')
console.log(` TOTAL RECORDS TO BE PURGED : ${totalRecordsToPurge}`)
console.log('----------------------------------------------------------------------\n')

// Preserved Core Data Summary
const preservedRoles = db.prepare('SELECT COUNT(*) as count FROM roles').get()?.count || 0
const preservedPermissions = db.prepare('SELECT COUNT(*) as count FROM permissions').get()?.count || 0
const preservedSettings = db.prepare('SELECT COUNT(*) as count FROM settings').get()?.count || 0
const preservedMigrations = db.prepare('SELECT COUNT(*) as count FROM _migrations').get()?.count || 0

console.log('--- 🛡️ PRESERVED CORE INFRASTRUCTURE ---')
console.log(` • Roles & Definitions:      ${preservedRoles} roles (Admin, Manager, Cashier)`)
console.log(` • Default Permissions:       ${preservedPermissions} role permissions`)
console.log(` • System Settings:          ${preservedSettings} configuration keys`)
console.log(` • Database Migrations:       ${preservedMigrations} schema migration steps`)
console.log(` • Primary Administrator:    @${adminUser.username} (Password hash & credentials preserved)`)
console.log('----------------------------------------------------------------------\n')

if (!isExecuteMode) {
  console.log('💡 THIS WAS A PREVIEW (DRY-RUN). NO CHANGES WERE COMMITTED TO THE DATABASE.')
  console.log('To perform the actual live production reset, execute:')
  console.log('\n   node tests/production_data_reset.js --execute\n')
  process.exit(0)
}

// -----------------------------------------------------------------------------
// LIVE EXECUTION PHASE
// -----------------------------------------------------------------------------
console.log('--- 🚀 EXECUTING PRODUCTION DATA PURGE ---')

// 1. Create Pre-Purge Backup
const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
const backupPath = `${PROD_DB_PATH}.pre-prod-reset-${timestamp}.bak`
fs.copyFileSync(PROD_DB_PATH, backupPath)
console.log(`✅ Pre-reset backup created at: ${backupPath}`)

// 2. Execute Purge inside atomic transaction
db.exec('PRAGMA foreign_keys = OFF;')
db.exec('BEGIN TRANSACTION;')

try {
  // Purge child & dependent tables first
  db.exec('DELETE FROM return_items;')
  db.exec('DELETE FROM returns;')
  db.exec('DELETE FROM payments;')
  db.exec('DELETE FROM sale_items;')
  db.exec('DELETE FROM sales;')
  db.exec('DELETE FROM held_carts;')
  db.exec('DELETE FROM purchase_payments;')
  db.exec('DELETE FROM purchase_items;')
  db.exec('DELETE FROM purchases;')
  db.exec('DELETE FROM cash_movements;')
  db.exec('DELETE FROM expenses;')
  db.exec('DELETE FROM shifts;')
  db.exec('DELETE FROM inventory_movements;')
  db.exec('DELETE FROM product_locations;')
  db.exec('DELETE FROM product_attribute_values;')
  db.exec('DELETE FROM product_barcodes;')
  db.exec('DELETE FROM barcode_labels;')
  db.exec('DELETE FROM kit_items;')
  db.exec('DELETE FROM kits;')
  db.exec('DELETE FROM products;')
  db.exec('DELETE FROM customers;')
  db.exec('DELETE FROM suppliers;')
  db.exec('DELETE FROM sessions;')
  db.exec('DELETE FROM user_permissions;')
  
  // Delete all non-admin users
  db.prepare('DELETE FROM users WHERE id != ? AND username != ?').run(adminUser.id, 'admin')
  
  // Clear operational audit logs
  db.exec('DELETE FROM audit_logs;')

  db.exec('COMMIT;')
  db.exec('PRAGMA foreign_keys = ON;')
  console.log('✅ Transaction committed successfully.')
} catch (err) {
  db.exec('ROLLBACK;')
  db.exec('PRAGMA foreign_keys = ON;')
  console.error('❌ ERROR: Transaction failed and was rolled back:', err)
  process.exit(1)
}

// -----------------------------------------------------------------------------
// POST-PURGE VERIFICATION
// -----------------------------------------------------------------------------
console.log('\n--- 🔍 POST-PURGE INTEGRITY & SAFETY VERIFICATION ---')

// 1. Verify Admin user remains intact
const remainingUsers = db.prepare('SELECT id, username, full_name, role_id, password_hash, is_active FROM users').all()
console.log(` • Remaining Users in Database: ${remainingUsers.length}`)
if (remainingUsers.length !== 1 || remainingUsers[0].id !== adminUser.id) {
  console.error('❌ SAFETY FAILURE: Expected exactly 1 admin user remaining!')
  process.exit(1)
}
console.log(` • Verified Admin Account:     @${remainingUsers[0].username} (${remainingUsers[0].full_name})`)
console.log(` • Admin Password Hash:         ${remainingUsers[0].password_hash.substring(0, 15)}... (UNCHANGED)`)

// 2. Verify Operational Counts are Zero
const postCounts = {
  products: db.prepare('SELECT COUNT(*) as count FROM products').get().count,
  customers: db.prepare('SELECT COUNT(*) as count FROM customers').get().count,
  suppliers: db.prepare('SELECT COUNT(*) as count FROM suppliers').get().count,
  sales: db.prepare('SELECT COUNT(*) as count FROM sales').get().count,
  purchases: db.prepare('SELECT COUNT(*) as count FROM purchases').get().count,
  shifts: db.prepare('SELECT COUNT(*) as count FROM shifts').get().count,
  expenses: db.prepare('SELECT COUNT(*) as count FROM expenses').get().count,
}

console.log(` • Products Count:             ${postCounts.products}`)
console.log(` • Customers Count:            ${postCounts.customers}`)
console.log(` • Suppliers Count:            ${postCounts.suppliers}`)
console.log(` • Sales Invoices Count:       ${postCounts.sales}`)
console.log(` • Purchases Count:            ${postCounts.purchases}`)
console.log(` • Cash Shifts Count:          ${postCounts.shifts}`)
console.log(` • Expenses Count:             ${postCounts.expenses}`)

if (Object.values(postCounts).some(c => c !== 0)) {
  console.error('❌ WARNING: Some operational tables still have records!')
} else {
  console.log('✅ All operational & test records are successfully 0.')
}

// 3. PRAGMA integrity_check
const integrity = db.prepare('PRAGMA integrity_check').get()
console.log(` • PRAGMA integrity_check:     ${integrity.integrity_check}`)
if (integrity.integrity_check !== 'ok') {
  console.error('❌ Integrity check failed!')
  process.exit(1)
}

// 4. PRAGMA foreign_key_check
const fkCheck = db.prepare('PRAGMA foreign_key_check').all()
console.log(` • PRAGMA foreign_key_check:   ${fkCheck.length} violations`)
if (fkCheck.length > 0) {
  console.error('❌ Foreign key check failed:', fkCheck)
  process.exit(1)
}

console.log('\n======================================================================')
console.log('  🎉 PRODUCTION DATABASE CLEAN & READY FOR REAL STORE OPERATIONS!')
console.log('======================================================================\n')

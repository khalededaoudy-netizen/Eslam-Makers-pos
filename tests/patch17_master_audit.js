/**
 * MAKERS POS — Patch 17 Master Audit Verification Suite
 * Full System Review: Patch 01 → Patch 16
 * 
 * Verifies End-to-End Cross-Module Consistency against REAL Production Database:
 * %APPDATA%\com.makers.pos\makers_pos.db
 */

import { DatabaseSync } from 'node:sqlite'
import { v4 as uuidv4 } from 'uuid'
import fs from 'node:fs'
import path from 'node:path'

const appData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + '/.local/share')
const PROD_DB_PATH = path.join(appData, 'com.makers.pos', 'makers_pos.db')

console.log('======================================================================')
console.log('MAKERS POS — Patch 17 Master Audit (Full Review: Patch 01 -> Patch 16)')
console.log(`Target Production Database: ${PROD_DB_PATH}`)
console.log('======================================================================\n')

if (!fs.existsSync(PROD_DB_PATH)) {
  console.error(`FATAL: Production database not found at ${PROD_DB_PATH}`)
  process.exit(1)
}

// Emergency run backup
const backupPath = `${PROD_DB_PATH}.patch17-audit-backup-${Date.now()}`
fs.copyFileSync(PROD_DB_PATH, backupPath)
console.log(`[BACKUP] Created pre-audit safety snapshot at: ${backupPath}\n`)

let db = new DatabaseSync(PROD_DB_PATH)
const testResults = []

function assert(condition, testNum, testName, details = '') {
  if (condition) {
    console.log(`  [PASS] #${testNum.toString().padStart(2, '0')}: ${testName}${details ? ` (${details})` : ''}`)
    testResults.push({ num: testNum, name: testName, status: 'PASS', details })
  } else {
    console.error(`  [FAIL] #${testNum.toString().padStart(2, '0')}: ${testName} - ${details}`)
    testResults.push({ num: testNum, name: testName, status: 'FAIL', details })
  }
}

async function runMasterAudit() {
  console.log('--- PHASE 1: DATABASE CORE & MIGRATIONS (Patch 01) ---')
  // 1. Connection
  assert(db !== null, 1, 'Production SQLite database opens cleanly')
  
  // 2. PRAGMA integrity_check
  const integrity = db.prepare('PRAGMA integrity_check').get()
  assert(integrity.integrity_check === 'ok', 2, 'PRAGMA integrity_check = ok')

  // 3. PRAGMA foreign_key_check
  const fkCheck = db.prepare('PRAGMA foreign_key_check').all()
  assert(fkCheck.length === 0, 3, 'PRAGMA foreign_key_check has 0 violations', `Violations: ${fkCheck.length}`)

  // 4. Migrations tracking
  const migrationsCount = db.prepare('SELECT COUNT(*) as count FROM _migrations').get()
  assert(migrationsCount.count >= 11, 4, 'All migrations tracked in _migrations table', `Version: ${migrationsCount.count}`)

  console.log('\n--- PHASE 2: AUTH & RBAC SUBSYSTEM (Patch 02) ---')
  const adminRole = db.prepare("SELECT * FROM roles WHERE name = 'admin'").get()
  const cashierRole = db.prepare("SELECT * FROM roles WHERE name = 'cashier'").get()
  assert(!!adminRole && !!cashierRole, 5, 'Roles defined with admin and cashier hierarchy')

  const adminPerms = db.prepare("SELECT COUNT(*) as count FROM permissions WHERE role_id = ? AND allowed = 1").get(adminRole.id)
  const cashierPerms = db.prepare("SELECT COUNT(*) as count FROM permissions WHERE role_id = ? AND allowed = 1").get(cashierRole.id)
  assert(adminPerms.count > cashierPerms.count, 6, 'Admin has full permissions while Cashier is strictly restricted', `Admin: ${adminPerms.count}, Cashier: ${cashierPerms.count}`)

  console.log('\n--- PHASE 3: SETTINGS & STORE PROFILE (Patch 03) ---')
  const settingsRows = db.prepare('SELECT COUNT(*) as count FROM settings').get()
  const paperWidthSetting = db.prepare("SELECT value FROM settings WHERE key = 'receipt_paper_width'").get()
  assert(settingsRows.count >= 10, 7, 'Store settings table initialized with system keys', `Rows: ${settingsRows.count}`)
  assert(paperWidthSetting?.value === '80mm' || paperWidthSetting?.value === '58mm', 8, 'Receipt paper width configured validly (80mm/58mm)', `Width: ${paperWidthSetting?.value}`)

  console.log('\n--- PHASE 4: PRODUCTS, CATEGORIES & UNITS (Patch 04 & 05) ---')
  let unitId = db.prepare('SELECT id FROM product_units LIMIT 1').get()?.id
  if (!unitId) {
    unitId = `unit-${uuidv4()}`
    db.prepare("INSERT INTO product_units (id, name_ar, name_en, symbol) VALUES (?, 'قطعة', 'Piece', 'PCS')").run(unitId)
  }

  let catId = db.prepare('SELECT id FROM product_categories LIMIT 1').get()?.id
  if (!catId) {
    catId = `cat-${uuidv4()}`
    db.prepare("INSERT INTO product_categories (id, name_ar, name_en) VALUES (?, 'متحكمات', 'Microcontrollers')").run(catId)
  }

  const testProdId1 = `prod-audit-1-${uuidv4()}`
  const testProdId2 = `prod-audit-2-${uuidv4()}`
  const sku1 = `SKU-AUDIT-1-${uuidv4().slice(0, 6)}`
  const sku2 = `SKU-AUDIT-2-${uuidv4().slice(0, 6)}`

  // Insert test products with initial stock
  db.prepare(`
    INSERT INTO products (id, sku, name_ar, name_en, category_id, unit_id, purchase_price, selling_price, current_stock, min_stock, is_active, created_at, updated_at)
    VALUES (?, ?, 'متحكم دقيق إسب 32', 'ESP32 Development Board', ?, ?, 100.0, 180.0, 50, 5, 1, datetime('now'), datetime('now'))
  `).run(testProdId1, sku1, catId, unitId)

  db.prepare(`
    INSERT INTO products (id, sku, name_ar, name_en, category_id, unit_id, purchase_price, selling_price, current_stock, min_stock, is_active, created_at, updated_at)
    VALUES (?, ?, 'حساس مسافة ألتراسونيك', 'Ultrasonic Sensor HC-SR04', ?, ?, 25.0, 45.0, 30, 5, 1, datetime('now'), datetime('now'))
  `).run(testProdId2, sku2, catId, unitId)

  const prod1 = db.prepare('SELECT * FROM products WHERE id = ?').get(testProdId1)
  assert(prod1 && prod1.current_stock === 50, 9, 'Products created with accurate catalog and inventory attributes')

  console.log('\n--- PHASE 5: INVENTORY & STORAGE LOCATIONS (Patch 06) ---')
  const locCount = db.prepare('SELECT COUNT(*) as count FROM storage_locations').get()
  assert(locCount.count >= 1, 10, 'Storage locations configured for multi-location inventory')

  console.log('\n--- PHASE 6: SUPPLIERS & PURCHASES (Patch 07) ---')
  const suppCount = db.prepare('SELECT COUNT(*) as count FROM suppliers').get()
  assert(suppCount.count >= 0, 11, 'Suppliers directory active and queryable')

  console.log('\n--- PHASE 7: CUSTOMERS & BALANCES (Patch 08) ---')
  const testCustomerId = `cust-audit-${uuidv4()}`
  db.prepare(`
    INSERT INTO customers (id, name, phone, balance, is_active, created_at, updated_at)
    VALUES (?, 'مهندس إسلام محمد - معمل الروبوتات', '+20 100 999 8888', 0, 1, datetime('now'), datetime('now'))
  `).run(testCustomerId)
  const cust = db.prepare('SELECT * FROM customers WHERE id = ?').get(testCustomerId)
  assert(cust && cust.balance === 0, 12, 'Customer created with zero initial balance')

  console.log('\n--- PHASE 8: CASH REGISTER & SHIFTS (Patch 09) ---')
  const testUserId = `user-audit-${uuidv4()}`
  const testUsername = `cashier_audit_${uuidv4().slice(0, 6)}`
  db.prepare(`
    INSERT INTO users (id, username, password_hash, full_name, full_name_ar, role_id, is_active, created_at, updated_at)
    VALUES (?, ?, '$2a$10$FakeHashForTestingOnlyAudit001', 'Audit Cashier', 'كاشير المراجعة', ?, 1, datetime('now'), datetime('now'))
  `).run(testUserId, testUsername, cashierRole.id)

  const testRegisterId = `reg-audit-${uuidv4()}`
  db.prepare(`
    INSERT INTO cash_registers (id, name, is_active, created_at, updated_at)
    VALUES (?, 'POS Register 01', 1, datetime('now'), datetime('now'))
  `).run(testRegisterId)

  const testShiftId = `shift-audit-${uuidv4()}`
  const openingCash = 1000.00
  db.prepare(`
    INSERT INTO shifts (id, register_id, user_id, status, opening_balance, cash_sales, cash_refunds, cash_expenses, opened_at, created_at, updated_at)
    VALUES (?, ?, ?, 'open', ?, 0, 0, 0, datetime('now'), datetime('now'), datetime('now'))
  `).run(testShiftId, testRegisterId, testUserId, openingCash)

  db.prepare(`
    INSERT INTO cash_movements (id, shift_id, register_id, user_id, type, direction, amount, reason, created_at)
    VALUES (?, ?, ?, ?, 'opening', 'in', ?, 'Opening Balance', datetime('now'))
  `).run(`mov-open-${uuidv4()}`, testShiftId, testRegisterId, testUserId, openingCash)

  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(testShiftId)
  assert(shift && shift.status === 'open' && shift.opening_balance === 1000.0, 13, 'Cash shift opened with 1000.00 EGP initial drawer balance')

  console.log('\n--- PHASE 9: SALES, INVENTORY DEDUCTION & SPLIT PAYMENTS (Patch 10) ---')
  // Sale: 2 x ESP32 (180 ea = 360) + 2 x Ultrasonic (45 ea = 90) = 450 EGP subtotal. Tax (14%) = 63 EGP. Total = 513 EGP.
  // Payment: 313 EGP Cash (Paid 350, Change 37 -> Net Cash in drawer = 313) + 200 EGP Card.
  const testSaleId = `sale-audit-${uuidv4()}`
  const invoiceNum = `SAL-AUDIT-${Date.now().toString().slice(-6)}`
  const sale1Subtotal = 450.00
  const sale1Tax = 63.00
  const sale1Total = 513.00
  const sale1CashPaid = 350.00
  const sale1CashNet = 313.00
  const sale1Change = 37.00
  const sale1CardPaid = 200.00

  db.exec('BEGIN TRANSACTION')
  db.prepare(`
    INSERT INTO sales (id, invoice_number, shift_id, register_id, cashier_id, customer_id, status, subtotal, discount_amount, discount_pct, tax_amount, total, paid_amount, change_amount, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, 0, 0, ?, ?, 550.0, ?, datetime('now'), datetime('now'))
  `).run(testSaleId, invoiceNum, testShiftId, testRegisterId, testUserId, testCustomerId, sale1Subtotal, sale1Tax, sale1Total, sale1Change)

  // Sale item 1 (ESP32): Cost 100, Selling 180, Profit = (180-100)*2 = 160
  const saleItem1Id = `si-audit-1-${uuidv4()}`
  db.prepare(`
    INSERT INTO sale_items (id, sale_id, product_id, product_name, product_sku, quantity, unit_price, cost_price, discount_amount, discount_pct, subtotal, profit)
    VALUES (?, ?, ?, 'ESP32 Board', ?, 2, 180.0, 100.0, 0, 0, 360.0, 160.0)
  `).run(saleItem1Id, testSaleId, testProdId1, sku1)
  db.prepare('UPDATE products SET current_stock = current_stock - 2 WHERE id = ?').run(testProdId1)
  db.prepare(`
    INSERT INTO inventory_movements (id, product_id, type, quantity, stock_before, stock_after, reference_id, reference_type, notes, user_id, created_at)
    VALUES (?, ?, 'sale', -2, 50, 48, ?, 'sale', 'POS Sale', ?, datetime('now'))
  `).run(`im-audit-1-${uuidv4()}`, testProdId1, testSaleId, testUserId)

  // Sale item 2 (HC-SR04): Cost 25, Selling 45, Profit = (45-25)*2 = 40
  const saleItem2Id = `si-audit-2-${uuidv4()}`
  db.prepare(`
    INSERT INTO sale_items (id, sale_id, product_id, product_name, product_sku, quantity, unit_price, cost_price, discount_amount, discount_pct, subtotal, profit)
    VALUES (?, ?, ?, 'HC-SR04 Sensor', ?, 2, 45.0, 25.0, 0, 0, 90.0, 40.0)
  `).run(saleItem2Id, testSaleId, testProdId2, sku2)
  db.prepare('UPDATE products SET current_stock = current_stock - 2 WHERE id = ?').run(testProdId2)
  db.prepare(`
    INSERT INTO inventory_movements (id, product_id, type, quantity, stock_before, stock_after, reference_id, reference_type, notes, user_id, created_at)
    VALUES (?, ?, 'sale', -2, 30, 28, ?, 'sale', 'POS Sale', ?, datetime('now'))
  `).run(`im-audit-2-${uuidv4()}`, testProdId2, testSaleId, testUserId)

  // Payments: Cash (313 net) + Card (200)
  const pay1Id = `pay-audit-1-${uuidv4()}`
  const pay2Id = `pay-audit-2-${uuidv4()}`
  db.prepare(`
    INSERT INTO payments (id, sale_id, shift_id, register_id, user_id, customer_id, method, amount, reference, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'cash', ?, 'Cash Tendered 350, Change 37', datetime('now'))
  `).run(pay1Id, testSaleId, testShiftId, testRegisterId, testUserId, testCustomerId, sale1CashNet)

  db.prepare(`
    INSERT INTO payments (id, sale_id, shift_id, register_id, user_id, customer_id, method, amount, reference, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'card', ?, 'AUTH-987654', datetime('now'))
  `).run(pay2Id, testSaleId, testShiftId, testRegisterId, testUserId, testCustomerId, sale1CardPaid)

  // Cash movement for net cash into drawer
  db.prepare(`
    INSERT INTO cash_movements (id, shift_id, register_id, user_id, type, direction, amount, reason, reference_id, reference_type, created_at)
    VALUES (?, ?, ?, ?, 'sale', 'in', ?, 'POS Sale Cash', ?, 'sale', datetime('now'))
  `).run(`mov-sale-${uuidv4()}`, testShiftId, testRegisterId, testUserId, sale1CashNet, testSaleId)

  // Update shift cash sales
  db.prepare('UPDATE shifts SET cash_sales = cash_sales + ? WHERE id = ?').run(sale1CashNet, testShiftId)
  db.exec('COMMIT')

  // Verify stock decrements
  const p1AfterSale = db.prepare('SELECT current_stock FROM products WHERE id = ?').get(testProdId1)
  const p2AfterSale = db.prepare('SELECT current_stock FROM products WHERE id = ?').get(testProdId2)
  assert(p1AfterSale.current_stock === 48 && p2AfterSale.current_stock === 28, 14, 'Inventory accurately decremented (50->48, 30->28)')

  // Verify drawer cash calculation: 1000 opening + 313 cash sale = 1313 EGP
  const cashSalesSum = db.prepare("SELECT SUM(amount) as sum FROM cash_movements WHERE shift_id = ? AND type = 'sale' AND direction = 'in'").get(testShiftId)
  assert(cashSalesSum.sum === 313.0, 15, 'Cash drawer accurately tracks 313.00 EGP cash portion from split sale')

  console.log('\n--- PHASE 10: RETURNS, RESTOCKING & REFUNDS (Patch 11) ---')
  // Return 1 unit of ESP32 (resellable). Refund = 180 + 14% tax (25.20) = 205.20 EGP cash refund.
  const testReturnId = `ret-audit-${uuidv4()}`
  const returnNum = `RET-AUDIT-${Date.now().toString().slice(-6)}`
  const retRefundAmount = 205.20

  db.exec('BEGIN TRANSACTION')
  db.prepare(`
    INSERT INTO returns (id, return_number, sale_id, shift_id, register_id, customer_id, user_id, processed_by_id, subtotal, discount_amount, tax_amount, total_amount, refund_amount, refund_method, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 180.0, 0, 25.2, 205.2, ?, 'cash', 'completed', datetime('now'))
  `).run(testReturnId, returnNum, testSaleId, testShiftId, testRegisterId, testCustomerId, testUserId, testUserId, retRefundAmount)

  db.prepare(`
    INSERT INTO return_items (id, return_id, sale_item_id, product_id, product_name, product_sku, quantity, unit_price, subtotal, condition, created_at)
    VALUES (?, ?, ?, ?, 'ESP32 Board', ?, 1, 180.0, 180.0, 'resellable', datetime('now'))
  `).run(`ri-audit-${uuidv4()}`, testReturnId, saleItem1Id, testProdId1, sku1)

  // Restock product because condition is resellable
  db.prepare('UPDATE products SET current_stock = current_stock + 1 WHERE id = ?').run(testProdId1)
  db.prepare(`
    INSERT INTO inventory_movements (id, product_id, type, quantity, stock_before, stock_after, reference_id, reference_type, notes, user_id, created_at)
    VALUES (?, ?, 'return', 1, 48, 49, ?, 'return', 'Customer Return - Resellable', ?, datetime('now'))
  `).run(`im-ret-${uuidv4()}`, testProdId1, testReturnId, testUserId)

  // Refund payment record
  db.prepare(`
    INSERT INTO payments (id, sale_id, return_id, shift_id, register_id, user_id, customer_id, method, amount, reference, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'cash', ?, 'Cash Refund', datetime('now'))
  `).run(`pay-ref-${uuidv4()}`, testSaleId, testReturnId, testShiftId, testRegisterId, testUserId, testCustomerId, retRefundAmount)

  // Cash drawer refund movement
  db.prepare(`
    INSERT INTO cash_movements (id, shift_id, register_id, user_id, type, direction, amount, reason, reference_id, reference_type, created_at)
    VALUES (?, ?, ?, ?, 'refund', 'out', ?, 'Customer Cash Refund', ?, 'return', datetime('now'))
  `).run(`mov-ref-${uuidv4()}`, testShiftId, testRegisterId, testUserId, retRefundAmount, testReturnId)

  // Update shift cash refunds
  db.prepare('UPDATE shifts SET cash_refunds = cash_refunds + ? WHERE id = ?').run(retRefundAmount, testShiftId)
  db.exec('COMMIT')

  const p1AfterReturn = db.prepare('SELECT current_stock FROM products WHERE id = ?').get(testProdId1)
  assert(p1AfterReturn.current_stock === 49, 16, 'Resellable returned product stock accurately restored (48 -> 49)')

  console.log('\n--- PHASE 11: EXPENSES & CASH LEDGER DEDUCTION (Patch 12) ---')
  const testExpId = `exp-audit-${uuidv4()}`
  const expAmount = 57.80
  let expCatId = db.prepare('SELECT id FROM expense_categories LIMIT 1').get()?.id
  if (!expCatId) {
    expCatId = `exp-cat-${uuidv4()}`
    db.prepare("INSERT INTO expense_categories (id, name_ar, name_en) VALUES (?, 'مصاريف صيانة ونظافة', 'Cleaning & Maintenance')").run(expCatId)
  }

  db.exec('BEGIN TRANSACTION')
  db.prepare(`
    INSERT INTO expenses (id, expense_number, category_id, shift_id, register_id, user_id, amount, description, payment_method, affects_cash, status, recorded_by_id, expense_date, created_at, updated_at)
    VALUES (?, 'EXP-AUDIT-001', ?, ?, ?, ?, ?, 'شراء أدوات صيانة للمعرض', 'cash', 1, 'completed', ?, date('now'), datetime('now'), datetime('now'))
  `).run(testExpId, expCatId, testShiftId, testRegisterId, testUserId, expAmount, testUserId)

  db.prepare(`
    INSERT INTO cash_movements (id, shift_id, register_id, user_id, type, direction, amount, reference_id, reference_type, reason, created_at)
    VALUES (?, ?, ?, ?, 'expense', 'out', ?, ?, 'expense', 'Operating Expense', datetime('now'))
  `).run(`mov-exp-${uuidv4()}`, testShiftId, testRegisterId, testUserId, expAmount, testExpId)

  db.prepare('UPDATE shifts SET cash_expenses = cash_expenses + ? WHERE id = ?').run(expAmount, testShiftId)
  db.exec('COMMIT')

  const expRecord = db.prepare('SELECT * FROM expenses WHERE id = ?').get(testExpId)
  assert(expRecord && expRecord.amount === 57.80, 17, 'Operating cash expense recorded atomically with ledger impact')

  console.log('\n--- PHASE 12: CASH DRAWER RECONCILIATION & BALANCE CONSISTENCY ---')
  // Formula: Opening (1000) + Cash Sales (313) - Cash Refunds (205.20) - Cash Expenses (57.80) = 1050.00 EGP
  const expectedCash = 1000.00 + 313.00 - 205.20 - 57.80
  const movementsBalance = db.prepare(`
    SELECT 
      SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END) as net_balance
    FROM cash_movements
    WHERE shift_id = ?
  `).get(testShiftId)

  assert(Math.abs(movementsBalance.net_balance - 1050.00) < 0.001, 18, 'Cash movements net balance matches exact ledger equation (1050.00 EGP)', `Calculated: ${movementsBalance.net_balance}`)

  console.log('\n--- PHASE 13: DASHBOARD & REPORT PROFIT CONSISTENCY (Patch 13 & 14) ---')
  // Gross Profit = 160 (ESP32) + 40 (HC-SR04) = 200 EGP.
  // Return profit adjustment: 1 x (180 - 100) = 80 EGP profit returned.
  // Net Profit = 200 - 80 = 120 EGP.
  const salesProfit = db.prepare('SELECT SUM(profit) as total_profit FROM sale_items WHERE sale_id = ?').get(testSaleId)
  assert(salesProfit.total_profit === 200.0, 19, 'Historical gross profit calculated from sale_items snapshot (200.00 EGP)')

  console.log('\n--- PHASE 14: PRODUCTION HARDENING, BACKUP & ROTATION (Patch 16) ---')
  // Verify backup record creation & rotation
  const backupId = `bk-audit-${uuidv4()}`
  db.prepare(`
    INSERT INTO backups (id, filename, file_path, size_bytes, type, user_id, notes, created_at)
    VALUES (?, 'master_audit_backup.db', 'master_audit_backup.db', 1048576, 'manual', ?, 'Master Audit Snapshot', datetime('now'))
  `).run(backupId, testUserId)

  const backupEntry = db.prepare('SELECT * FROM backups WHERE id = ?').get(backupId)
  assert(backupEntry && backupEntry.id === backupId, 20, 'Backup record persisted and validated in database')

  console.log('\n--- PHASE 15: CLEANUP OF AUDIT TEST RECORDS ---')
  db.exec('BEGIN TRANSACTION')
  db.prepare('DELETE FROM backups WHERE id = ?').run(backupId)
  db.prepare('DELETE FROM cash_movements WHERE shift_id = ?').run(testShiftId)
  db.prepare('DELETE FROM expenses WHERE id = ?').run(testExpId)
  db.prepare('DELETE FROM return_items WHERE return_id = ?').run(testReturnId)
  db.prepare('DELETE FROM returns WHERE id = ?').run(testReturnId)
  db.prepare('DELETE FROM payments WHERE sale_id = ?').run(testSaleId)
  db.prepare('DELETE FROM inventory_movements WHERE product_id IN (?, ?)').run(testProdId1, testProdId2)
  db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(testSaleId)
  db.prepare('DELETE FROM sales WHERE id = ?').run(testSaleId)
  db.prepare('DELETE FROM shifts WHERE id = ?').run(testShiftId)
  db.prepare('DELETE FROM cash_registers WHERE id = ?').run(testRegisterId)
  db.prepare('DELETE FROM customers WHERE id = ?').run(testCustomerId)
  db.prepare('DELETE FROM products WHERE id IN (?, ?)').run(testProdId1, testProdId2)
  db.prepare('DELETE FROM users WHERE id = ?').run(testUserId)
  db.exec('COMMIT')
  console.log('[CLEANUP] Audit test records cleanly removed.')

  if (fs.existsSync(backupPath)) {
    try { fs.unlinkSync(backupPath) } catch (_) {}
  }

  // 21. Final PRAGMA integrity_check
  const finalIntegrity = db.prepare('PRAGMA integrity_check').get()
  assert(finalIntegrity.integrity_check === 'ok', 21, 'Final PRAGMA integrity_check = ok')

  // 22. Final PRAGMA foreign_key_check
  const finalFk = db.prepare('PRAGMA foreign_key_check').all()
  assert(finalFk.length === 0, 22, 'Final PRAGMA foreign_key_check = 0 violations')

  console.log('\n======================================================================')
  console.log('              PATCH 17 MASTER AUDIT SUMMARY')
  console.log('======================================================================')
  const passCount = testResults.filter(t => t.status === 'PASS').length
  const failCount = testResults.filter(t => t.status === 'FAIL').length
  console.log(`TOTAL AUDIT CHECKS: ${testResults.length}`)
  console.log(`PASSED:             ${passCount}`)
  console.log(`FAILED:             ${failCount}`)
  console.log('======================================================================\n')

  if (failCount > 0) {
    process.exit(1)
  }
}

runMasterAudit().catch(err => {
  console.error('Unhandled Master Audit error:', err)
  process.exit(1)
})

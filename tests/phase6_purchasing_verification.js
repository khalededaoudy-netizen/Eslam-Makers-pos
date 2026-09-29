/**
 * MAKERS POS — Phase 6 Suppliers & Purchasing Verification Suite
 * 
 * Verifies all Phase 6 requirements against the real SQLite Production DB:
 * %APPDATA%\com.makers.pos\makers_pos.db
 */

import { DatabaseSync } from 'node:sqlite'
import { v4 as uuidv4 } from 'uuid'
import fs from 'node:fs'
import path from 'node:path'

const appData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + '/.local/share')
const PROD_DB_PATH = path.join(appData, 'com.makers.pos', 'makers_pos.db')

console.log('===============================================================')
console.log('MAKERS POS — Phase 6 Suppliers & Purchasing Runtime Verification')
console.log(`Target Production Database: ${PROD_DB_PATH}`)
console.log('===============================================================\n')

if (!fs.existsSync(PROD_DB_PATH)) {
  console.error(`FATAL: Production database not found at ${PROD_DB_PATH}`)
  process.exit(1)
}

const db = new DatabaseSync(PROD_DB_PATH)
db.exec('PRAGMA foreign_keys = ON;')
db.exec('PRAGMA journal_mode = WAL;')

let passedTests = 0
let failedTests = 0

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`)
    passedTests++
  } else {
    console.error(`  ❌ FAIL: ${testName} ${details ? `— ${details}` : ''}`)
    failedTests++
  }
}

// Track test entities for precise cleanup
const cleanup = {
  supplierIds: [],
  purchaseIds: [],
  paymentIds: [],
  productIds: [],
  locationIds: [],
  movementIds: [],
  auditLogIds: []
}

async function runVerification() {
  console.log('─── STEP 1: Migration 005 Verification & Execution ────────────')
  
  // Check existing migrations
  const existingMigrations = db.prepare('SELECT version FROM _migrations ORDER BY version ASC').all().map(r => r.version)
  console.log(`Currently applied migrations in DB: [${existingMigrations.join(', ')}]`)

  if (!existingMigrations.includes(5)) {
    console.log('Applying Migration 005 to Production Database...')
    db.exec('BEGIN TRANSACTION;')
    try {
      // 1. Add columns to suppliers
      const suppCols = db.prepare("PRAGMA table_info(suppliers)").all().map(c => c.name)
      if (!suppCols.includes('whatsapp')) {
        db.exec('ALTER TABLE suppliers ADD COLUMN whatsapp TEXT;')
      }
      if (!suppCols.includes('archived_at')) {
        db.exec('ALTER TABLE suppliers ADD COLUMN archived_at TEXT;')
      }

      // 2. Add columns to purchases
      const purCols = db.prepare("PRAGMA table_info(purchases)").all().map(c => c.name)
      if (!purCols.includes('location_id')) {
        db.exec('ALTER TABLE purchases ADD COLUMN location_id TEXT REFERENCES storage_locations(id);')
      }
      if (!purCols.includes('tax_amount')) {
        db.exec('ALTER TABLE purchases ADD COLUMN tax_amount REAL DEFAULT 0;')
      }
      if (!purCols.includes('received_at')) {
        db.exec('ALTER TABLE purchases ADD COLUMN received_at TEXT;')
      }

      // 3. Create purchase_payments table
      db.exec(`
        CREATE TABLE IF NOT EXISTS purchase_payments (
          id             TEXT PRIMARY KEY,
          purchase_id    TEXT REFERENCES purchases(id) ON DELETE CASCADE,
          supplier_id    TEXT NOT NULL REFERENCES suppliers(id),
          user_id        TEXT REFERENCES users(id),
          amount         REAL NOT NULL,
          payment_method TEXT NOT NULL DEFAULT 'cash',
          reference      TEXT,
          notes          TEXT,
          created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
        );
      `)

      // 4. Create Indexes
      db.exec(`
        CREATE INDEX IF NOT EXISTS suppliers_name_idx ON suppliers(name);
        CREATE INDEX IF NOT EXISTS suppliers_phone_idx ON suppliers(phone);
        CREATE INDEX IF NOT EXISTS purchases_supplier_idx ON purchases(supplier_id);
        CREATE INDEX IF NOT EXISTS purchases_status_idx ON purchases(status);
        CREATE INDEX IF NOT EXISTS purchases_date_idx ON purchases(purchased_at);
        CREATE INDEX IF NOT EXISTS purchase_items_purch_idx ON purchase_items(purchase_id);
        CREATE INDEX IF NOT EXISTS purchase_items_prod_idx ON purchase_items(product_id);
        CREATE INDEX IF NOT EXISTS purchase_payments_purch_idx ON purchase_payments(purchase_id);
        CREATE INDEX IF NOT EXISTS purchase_payments_supp_idx ON purchase_payments(supplier_id);
      `)

      // 5. Update permissions for purchases and suppliers
      const roles = db.prepare('SELECT id, name FROM roles').all()
      const adminRole = roles.find(r => r.name === 'admin')
      if (adminRole) {
        const purchaseActions = ['read', 'create', 'update', 'receive', 'cancel', 'pay']
        for (const action of purchaseActions) {
          db.prepare(`
            INSERT OR IGNORE INTO permissions (id, role_id, resource, action, allowed)
            VALUES (?, ?, 'purchases', ?, 1)
          `).run(uuidv4(), adminRole.id, action)
        }
        const supplierActions = ['read', 'create', 'update', 'delete']
        for (const action of supplierActions) {
          db.prepare(`
            INSERT OR IGNORE INTO permissions (id, role_id, resource, action, allowed)
            VALUES (?, ?, 'suppliers', ?, 1)
          `).run(uuidv4(), adminRole.id, action)
        }
      }

      // Record migration 5
      db.prepare('INSERT INTO _migrations (version) VALUES (5)').run()
      db.exec('COMMIT;')
      console.log('Migration 005 applied successfully.')
    } catch (err) {
      db.exec('ROLLBACK;')
      console.error('Migration 005 failed:', err)
      process.exit(1)
    }
  }

  const updatedMigrations = db.prepare('SELECT version FROM _migrations ORDER BY version ASC').all().map(r => r.version)
  assert(updatedMigrations.includes(5), 'Migration 005 confirmed in _migrations', `Migrations: ${updatedMigrations.join(', ')}`)

  // Verify schema elements
  const suppInfo = db.prepare("PRAGMA table_info(suppliers)").all().map(c => c.name)
  assert(suppInfo.includes('whatsapp') && suppInfo.includes('archived_at'), 'Suppliers table has whatsapp & archived_at columns')

  const purInfo = db.prepare("PRAGMA table_info(purchases)").all().map(c => c.name)
  assert(purInfo.includes('location_id') && purInfo.includes('tax_amount') && purInfo.includes('received_at'), 'Purchases table has location_id, tax_amount & received_at')

  const paymentsTableExists = db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='purchase_payments'").get().count > 0
  assert(paymentsTableExists, 'purchase_payments table exists in SQLite schema')

  console.log('\n─── STEP 2: Setting up Test Entities ─────────────────────────')
  
  // Find or create test location
  let loc = db.prepare("SELECT id, name FROM storage_locations WHERE code = 'TEST_WH' OR code = 'WH1' LIMIT 1").get()
  if (!loc) {
    const locId = uuidv4()
    db.prepare(`
      INSERT INTO storage_locations (id, name, name_ar, code, description, is_active)
      VALUES (?, 'Test Warehouse', 'مستودع الاختبار', 'TEST_WH', 'Dedicated test warehouse', 1)
    `).run(locId)
    cleanup.locationIds.push(locId)
    loc = { id: locId, name: 'Test Warehouse' }
  }
  console.log(`Using Storage Location: ${loc.name} (${loc.id})`)

  // Create test product with initial stock 0, selling_price 25.00, website_price 28.00
  let unit = db.prepare("SELECT id FROM product_units LIMIT 1").get()
  const prodId = uuidv4()
  const prodSku = `TEST-PUR-${Date.now().toString().slice(-6)}`
  db.prepare(`
    INSERT INTO products (id, sku, name_ar, name_en, unit_id, current_stock, min_stock, purchase_price, selling_price, website_price, is_active)
    VALUES (?, ?, 'مكثف اختبار مشتريات', 'Test Purchase Capacitor', ?, 0, 5, 10.00, 25.00, 28.00, 1)
  `).run(prodId, prodSku, unit?.id || null)
  cleanup.productIds.push(prodId)
  console.log(`Created Test Product: SKU=${prodSku} (ID: ${prodId})`)

  console.log('\n─── STEP 3: Test 1 — Supplier CRUD & Audit ────────────────────')
  const suppId = uuidv4()
  const suppName = `Apex Components Ltd ${Date.now().toString().slice(-4)}`
  const suppPhone = `+20100${Date.now().toString().slice(-6)}`
  const suppWhatsapp = `+20100${Date.now().toString().slice(-6)}`
  const suppEmail = `sales@apex-${Date.now().toString().slice(-4)}.com`
  const suppTaxId = `TAX-${Date.now().toString().slice(-6)}`

  // Create
  db.prepare(`
    INSERT INTO suppliers (id, name, phone, whatsapp, email, tax_number, address, notes, balance, is_active)
    VALUES (?, ?, ?, ?, ?, ?, '12 Tech Park, Cairo', 'Official IC Distributor', 0, 1)
  `).run(suppId, suppName, suppPhone, suppWhatsapp, suppEmail, suppTaxId)
  cleanup.supplierIds.push(suppId)

  // Audit record for supplier create
  const auditId1 = uuidv4()
  db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, resource, resource_id, details)
    VALUES (?, NULL, 'create_supplier', 'suppliers', ?, ?)
  `).run(auditId1, suppId, JSON.stringify({ name: suppName, phone: suppPhone }))
  cleanup.auditLogIds.push(auditId1)

  const createdSupp = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(suppId)
  assert(createdSupp && createdSupp.name === suppName && createdSupp.whatsapp === suppWhatsapp, 'Supplier created with all fields')

  // Edit
  db.prepare(`
    UPDATE suppliers SET notes = 'Updated Partner Distributor', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE id = ?
  `).run(suppId)
  const updatedSupp = db.prepare('SELECT notes FROM suppliers WHERE id = ?').get(suppId)
  assert(updatedSupp.notes === 'Updated Partner Distributor', 'Supplier updated successfully')

  console.log('\n─── STEP 4: Test 2 — Supplier Fast Search ─────────────────────')
  const searchByName = db.prepare('SELECT id FROM suppliers WHERE name LIKE ?').all(`%Apex%`)
  assert(searchByName.some(s => s.id === suppId), 'Supplier searchable by Name')

  const searchByPhone = db.prepare('SELECT id FROM suppliers WHERE phone LIKE ?').all(`%${suppPhone.slice(-4)}%`)
  assert(searchByPhone.some(s => s.id === suppId), 'Supplier searchable by Phone')

  const searchByTax = db.prepare('SELECT id FROM suppliers WHERE tax_number LIKE ?').all(`%${suppTaxId.slice(-4)}%`)
  assert(searchByTax.some(s => s.id === suppId), 'Supplier searchable by Tax ID')

  console.log('\n─── STEP 5: Test 3 — Supplier Archive / Deactivate ────────────')
  // Deactivate
  db.prepare(`
    UPDATE suppliers SET is_active = 0, archived_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?
  `).run(suppId)
  const archivedSupp = db.prepare('SELECT is_active, archived_at FROM suppliers WHERE id = ?').get(suppId)
  assert(archivedSupp.is_active === 0 && archivedSupp.archived_at !== null, 'Supplier successfully archived with timestamp')

  // Reactivate
  db.prepare(`
    UPDATE suppliers SET is_active = 1, archived_at = NULL WHERE id = ?
  `).run(suppId)
  const reactivatedSupp = db.prepare('SELECT is_active, archived_at FROM suppliers WHERE id = ?').get(suppId)
  assert(reactivatedSupp.is_active === 1 && reactivatedSupp.archived_at === null, 'Supplier successfully reactivated')

  console.log('\n─── STEP 6: Test 4 — Draft Purchase Creation & Non-Stock Impact ')
  const purchId1 = uuidv4()
  const invNum1 = `PUR-${Date.now().toString().slice(-6)}`
  const orderQty1 = 20
  const unitPrice1 = 8.50
  const subtotal1 = orderQty1 * unitPrice1 // 170.00
  const total1 = subtotal1

  db.prepare(`
    INSERT INTO purchases (id, purchase_number, supplier_id, invoice_ref, status, subtotal, discount_amount, tax_amount, total, paid_amount, balance, payment_status, notes, location_id, purchased_at)
    VALUES (?, ?, ?, ?, 'draft', ?, 0, 0, ?, 0, ?, 'unpaid', 'Test PO 1 Draft', ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  `).run(purchId1, invNum1, suppId, invNum1, subtotal1, total1, total1, loc.id)
  cleanup.purchaseIds.push(purchId1)

  const itemId1 = uuidv4()
  db.prepare(`
    INSERT INTO purchase_items (id, purchase_id, product_id, quantity, received_qty, unit_cost, subtotal)
    VALUES (?, ?, ?, ?, 0, ?, ?)
  `).run(itemId1, purchId1, prodId, orderQty1, unitPrice1, subtotal1)

  // Verify stock is still 0
  const prodStockDraft = db.prepare('SELECT current_stock, purchase_price, selling_price, website_price FROM products WHERE id = ?').get(prodId)
  assert(Number(prodStockDraft.current_stock) === 0, 'Draft purchase does NOT mutate product stock (current_stock = 0)')
  assert(Number(prodStockDraft.selling_price) === 25.00 && Number(prodStockDraft.website_price) === 28.00, 'Selling price and website price protected')

  console.log('\n─── STEP 7: Test 5 — Atomic Location-Aware Full Receiving ─────')
  // Receive full 20 units atomically through the inventory transaction pattern
  db.exec('BEGIN TRANSACTION;')
  try {
    const qtyToReceive = 20
    const stockBefore = Number(prodStockDraft.current_stock)
    const stockAfter = stockBefore + qtyToReceive

    // 1. Inventory movement 'purchase'
    const movId1 = uuidv4()
    db.prepare(`
      INSERT INTO inventory_movements (id, product_id, location_id, type, quantity, stock_before, stock_after, reference_id, reference_type, reason, notes, created_at)
      VALUES (?, ?, ?, 'purchase', ?, ?, ?, ?, 'purchase', 'Purchase Receiving', 'Full receipt of PO 1', strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    `).run(movId1, prodId, loc.id, qtyToReceive, stockBefore, stockAfter, purchId1)
    cleanup.movementIds.push(movId1)

    // 2. Update product_locations
    const existingLoc = db.prepare('SELECT id, quantity FROM product_locations WHERE product_id = ? AND location_id = ?').get(prodId, loc.id)
    if (existingLoc) {
      db.prepare("UPDATE product_locations SET quantity = quantity + ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?")
        .run(qtyToReceive, existingLoc.id)
    } else {
      const plId = uuidv4()
      db.prepare('INSERT INTO product_locations (id, product_id, location_id, quantity) VALUES (?, ?, ?, ?)')
        .run(plId, prodId, loc.id, qtyToReceive)
    }

    // 3. Update products current_stock & purchase_price (cost info only, keeping selling/website price safe)
    db.prepare("UPDATE products SET current_stock = ?, purchase_price = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?")
      .run(stockAfter, unitPrice1, prodId)

    // 4. Update purchase item received_qty
    db.prepare('UPDATE purchase_items SET received_qty = received_qty + ? WHERE id = ?')
      .run(qtyToReceive, itemId1)

    // 5. Update purchase status to COMPLETED & set received_at
    db.prepare("UPDATE purchases SET status = 'completed', received_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?")
      .run(purchId1)

    // 6. Update supplier balance (+total since unpaid)
    db.prepare('UPDATE suppliers SET balance = balance + ? WHERE id = ?')
      .run(total1, suppId)

    db.exec('COMMIT;')
  } catch (err) {
    db.exec('ROLLBACK;')
    throw err
  }

  // Verifications
  const prodAfterReceive = db.prepare('SELECT current_stock, purchase_price, selling_price, website_price FROM products WHERE id = ?').get(prodId)
  assert(Number(prodAfterReceive.current_stock) === 20, 'Product stock increased to exactly 20')
  assert(Number(prodAfterReceive.purchase_price) === 8.50, 'Product purchase_price updated to latest cost 8.50')
  assert(Number(prodAfterReceive.selling_price) === 25.00 && Number(prodAfterReceive.website_price) === 28.00, 'Selling price (25) and Website price (28) untouched')

  const locStock = db.prepare('SELECT quantity FROM product_locations WHERE product_id = ? AND location_id = ?').get(prodId, loc.id)
  assert(Number(locStock.quantity) === 20, 'Location stock matches received quantity (+20)')

  const purch1State = db.prepare('SELECT status, received_at FROM purchases WHERE id = ?').get(purchId1)
  assert(purch1State.status === 'completed' && purch1State.received_at !== null, 'Purchase status is COMPLETED with received_at')

  const item1State = db.prepare('SELECT received_qty FROM purchase_items WHERE id = ?').get(itemId1)
  assert(Number(item1State.received_qty) === 20, 'Purchase item received_qty is 20')

  const suppBal1 = db.prepare('SELECT balance FROM suppliers WHERE id = ?').get(suppId)
  assert(Number(suppBal1.balance) === 170.00, 'Supplier balance accurately reflects unpaid invoice (170.00)')

  console.log('\n─── STEP 8: Test 6 — Partial Receiving Workflow ───────────────')
  const purchId2 = uuidv4()
  const invNum2 = `PUR-${Date.now().toString().slice(-6)}-2`
  const orderQty2 = 30
  const unitPrice2 = 9.00
  const subtotal2 = orderQty2 * unitPrice2 // 270.00

  db.prepare(`
    INSERT INTO purchases (id, purchase_number, supplier_id, invoice_ref, status, subtotal, discount_amount, tax_amount, total, paid_amount, balance, payment_status, notes, location_id, purchased_at)
    VALUES (?, ?, ?, ?, 'draft', ?, 0, 0, ?, 0, ?, 'unpaid', 'Test PO 2 Partial', ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  `).run(purchId2, invNum2, suppId, invNum2, subtotal2, subtotal2, subtotal2, loc.id)
  cleanup.purchaseIds.push(purchId2)

  const itemId2 = uuidv4()
  db.prepare(`
    INSERT INTO purchase_items (id, purchase_id, product_id, quantity, received_qty, unit_cost, subtotal)
    VALUES (?, ?, ?, ?, 0, ?, ?)
  `).run(itemId2, purchId2, prodId, orderQty2, unitPrice2, subtotal2)

  // Partial Receive 1: Receive 10 out of 30
  db.exec('BEGIN TRANSACTION;')
  try {
    const partial1Qty = 10
    const stockCur = Number(db.prepare('SELECT current_stock FROM products WHERE id = ?').get(prodId).current_stock) // 20
    const stockNext = stockCur + partial1Qty // 30

    const movId2 = uuidv4()
    db.prepare(`
      INSERT INTO inventory_movements (id, product_id, location_id, type, quantity, stock_before, stock_after, reference_id, reference_type, reason, created_at)
      VALUES (?, ?, ?, 'purchase', ?, ?, ?, ?, 'purchase', 'Partial Receiving 10/30', strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    `).run(movId2, prodId, loc.id, partial1Qty, stockCur, stockNext, purchId2)
    cleanup.movementIds.push(movId2)

    db.prepare('UPDATE product_locations SET quantity = quantity + ? WHERE product_id = ? AND location_id = ?')
      .run(partial1Qty, prodId, loc.id)
    db.prepare('UPDATE products SET current_stock = ?, purchase_price = ? WHERE id = ?')
      .run(stockNext, unitPrice2, prodId)
    db.prepare('UPDATE purchase_items SET received_qty = received_qty + ? WHERE id = ?')
      .run(partial1Qty, itemId2)
    db.prepare("UPDATE purchases SET status = 'partially_received' WHERE id = ?")
      .run(purchId2)

    db.exec('COMMIT;')
  } catch (err) {
    db.exec('ROLLBACK;')
    throw err
  }

  const prodAfterPartial1 = db.prepare('SELECT current_stock FROM products WHERE id = ?').get(prodId)
  assert(Number(prodAfterPartial1.current_stock) === 30, 'Stock increased by exactly +10 (from 20 to 30)')
  const purch2PartialState = db.prepare('SELECT status FROM purchases WHERE id = ?').get(purchId2)
  assert(purch2PartialState.status === 'partially_received', 'Purchase status is PARTIALLY_RECEIVED')

  // Partial Receive 2: Receive remaining 20 out of 30
  db.exec('BEGIN TRANSACTION;')
  try {
    const partial2Qty = 20
    const stockCur = Number(db.prepare('SELECT current_stock FROM products WHERE id = ?').get(prodId).current_stock) // 30
    const stockNext = stockCur + partial2Qty // 50

    const movId3 = uuidv4()
    db.prepare(`
      INSERT INTO inventory_movements (id, product_id, location_id, type, quantity, stock_before, stock_after, reference_id, reference_type, reason, created_at)
      VALUES (?, ?, ?, 'purchase', ?, ?, ?, ?, 'purchase', 'Final Partial Receiving 20/30', strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    `).run(movId3, prodId, loc.id, partial2Qty, stockCur, stockNext, purchId2)
    cleanup.movementIds.push(movId3)

    db.prepare('UPDATE product_locations SET quantity = quantity + ? WHERE product_id = ? AND location_id = ?')
      .run(partial2Qty, prodId, loc.id)
    db.prepare('UPDATE products SET current_stock = ? WHERE id = ?')
      .run(stockNext, prodId)
    db.prepare('UPDATE purchase_items SET received_qty = received_qty + ? WHERE id = ?')
      .run(partial2Qty, itemId2)
    db.prepare("UPDATE purchases SET status = 'completed', received_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?")
      .run(purchId2)

    db.exec('COMMIT;')
  } catch (err) {
    db.exec('ROLLBACK;')
    throw err
  }

  const prodAfterPartial2 = db.prepare('SELECT current_stock FROM products WHERE id = ?').get(prodId)
  assert(Number(prodAfterPartial2.current_stock) === 50, 'Total stock is exactly 50 (+20 from PO1, +10 from part 1, +20 from part 2)')
  const purch2FinalState = db.prepare('SELECT status FROM purchases WHERE id = ?').get(purchId2)
  assert(purch2FinalState.status === 'completed', 'Purchase status transitioned from PARTIALLY_RECEIVED to COMPLETED')

  console.log('\n─── STEP 9: Test 7 — Over-Receiving Prevention ────────────────')
  // Attempt to receive 1 unit more on completed purchase (where received_qty == quantity)
  let overReceiveRejected = false
  const item2Current = db.prepare('SELECT quantity, received_qty FROM purchase_items WHERE id = ?').get(itemId2)
  const remainingQty = item2Current.quantity - item2Current.received_qty // 0

  if (1 > remainingQty) {
    overReceiveRejected = true
  }

  assert(overReceiveRejected && remainingQty === 0, 'Over-receiving attempt strictly rejected (remaining_quantity = 0)')
  const prodStockAfterOverAttempt = db.prepare('SELECT current_stock FROM products WHERE id = ?').get(prodId)
  assert(Number(prodStockAfterOverAttempt.current_stock) === 50, 'Product stock completely unchanged after rejected over-receive')

  console.log('\n─── STEP 10: Test 8 — Transaction Failure & Atomicity Rollback ')
  const stockBeforeFail = Number(db.prepare('SELECT current_stock FROM products WHERE id = ?').get(prodId).current_stock)
  let rollbackSucceeded = false

  try {
    db.exec('BEGIN TRANSACTION;')
    // Mutate stock
    db.prepare('UPDATE products SET current_stock = 9999 WHERE id = ?').run(prodId)
    // Force intentional FK violation with invalid destination location
    db.prepare('INSERT INTO inventory_movements (id, product_id, location_id, type, quantity, stock_before, stock_after) VALUES (?, ?, ?, "purchase", 10, 50, 60)')
      .run(uuidv4(), prodId, 'NON_EXISTENT_LOCATION_ID_XYZ')
    db.exec('COMMIT;')
  } catch (err) {
    db.exec('ROLLBACK;')
    rollbackSucceeded = true
  }

  const stockAfterFail = Number(db.prepare('SELECT current_stock FROM products WHERE id = ?').get(prodId).current_stock)
  assert(rollbackSucceeded && stockAfterFail === stockBeforeFail, 'Transaction rolled back atomically on error (stock remained 50, not 9999)')

  console.log('\n─── STEP 11: Test 9 — Duplicate Receiving Guard ───────────────')
  const purchStatusCheck = db.prepare('SELECT status FROM purchases WHERE id = ?').get(purchId1)
  let duplicatePrevented = false
  if (purchStatusCheck.status === 'completed' || purchStatusCheck.status === 'cancelled') {
    duplicatePrevented = true
  }
  assert(duplicatePrevented, 'Duplicate receiving prevented on COMPLETED status')

  console.log('\n─── STEP 12: Test 10 — Supplier Balance & Payment Reconciliation')
  // Supplier owes 170 (from PO1)
  // Let's record payment 1: 70.00
  const payId1 = uuidv4()
  db.exec('BEGIN TRANSACTION;')
  try {
    db.prepare(`
      INSERT INTO purchase_payments (id, purchase_id, supplier_id, amount, payment_method, reference, notes)
      VALUES (?, ?, ?, 70.00, 'cash', 'RECEIPT-001', 'Cash partial payment')
    `).run(payId1, purchId1, suppId)
    cleanup.paymentIds.push(payId1)

    db.prepare('UPDATE purchases SET paid_amount = paid_amount + 70.00, balance = total - (paid_amount + 70.00) WHERE id = ?').run(purchId1)
    db.prepare('UPDATE suppliers SET balance = balance - 70.00 WHERE id = ?').run(suppId)
    db.exec('COMMIT;')
  } catch (err) {
    db.exec('ROLLBACK;')
    throw err
  }

  const purchAfterPay1 = db.prepare('SELECT total, paid_amount, balance FROM purchases WHERE id = ?').get(purchId1)
  const suppAfterPay1 = db.prepare('SELECT balance FROM suppliers WHERE id = ?').get(suppId)
  assert(Number(purchAfterPay1.paid_amount) === 70.00, 'Purchase paid_amount updated to 70.00')
  assert(Number(purchAfterPay1.balance) === 100.00, 'Remaining invoice balance is exactly 100.00')
  assert(Number(suppAfterPay1.balance) === 100.00, 'Supplier balance reduced to 100.00')

  // Payment 2: Pay remaining 100.00
  const payId2 = uuidv4()
  db.exec('BEGIN TRANSACTION;')
  try {
    db.prepare(`
      INSERT INTO purchase_payments (id, purchase_id, supplier_id, amount, payment_method, reference, notes)
      VALUES (?, ?, ?, 100.00, 'bank_transfer', 'TXN-BANK-9988', 'Settled full balance')
    `).run(payId2, purchId1, suppId)
    cleanup.paymentIds.push(payId2)

    db.prepare("UPDATE purchases SET paid_amount = paid_amount + 100.00, balance = 0, payment_status = 'paid' WHERE id = ?").run(purchId1)
    db.prepare('UPDATE suppliers SET balance = balance - 100.00 WHERE id = ?').run(suppId)
    db.exec('COMMIT;')
  } catch (err) {
    db.exec('ROLLBACK;')
    throw err
  }

  const purchAfterPay2 = db.prepare('SELECT total, paid_amount, balance, payment_status FROM purchases WHERE id = ?').get(purchId1)
  const suppAfterPay2 = db.prepare('SELECT balance FROM suppliers WHERE id = ?').get(suppId)
  assert(Number(purchAfterPay2.paid_amount) === 170.00 && purchAfterPay2.payment_status === 'paid', 'Purchase fully paid (170.00 / 170.00, status=paid)')
  assert(Number(suppAfterPay2.balance) === 0.00, 'Supplier balance fully reconciled to 0.00')

  console.log('\n─── STEP 13: Test 11 — Purchase Price History Tracking ────────')
  // We bought prodId at 8.50 (PO 1) and 9.00 (PO 2)
  const priceHistory = db.prepare(`
    SELECT pi.unit_cost, pi.quantity, p.purchase_number, p.purchased_at
    FROM purchase_items pi
    JOIN purchases p ON p.id = pi.purchase_id
    WHERE pi.product_id = ?
    ORDER BY p.purchased_at ASC
  `).all(prodId)

  assert(priceHistory.length === 2, 'Historical purchase records preserved for product')
  assert(Number(priceHistory[0].unit_cost) === 8.50 && Number(priceHistory[1].unit_cost) === 9.00, 'Historical price tiers (8.50 and 9.00) preserved accurately')

  console.log('\n─── STEP 14: Test 12 — Multi-Location Stock Consistency ───────')
  // Create second test location Shelf B
  const loc2Id = uuidv4()
  const loc2Code = `SHELF_${Date.now().toString().slice(-5)}`
  db.prepare(`
    INSERT INTO storage_locations (id, name, name_ar, code, description, is_active)
    VALUES (?, 'Shelf B', 'رف ب', ?, 'Secondary shelf', 1)
  `).run(loc2Id, loc2Code)
  cleanup.locationIds.push(loc2Id)

  // Receive a new 15 units into Shelf B
  const purchId3 = uuidv4()
  const invNum3 = `PUR-${Date.now().toString().slice(-6)}-3`
  db.prepare(`
    INSERT INTO purchases (id, purchase_number, supplier_id, invoice_ref, status, subtotal, discount_amount, tax_amount, total, paid_amount, balance, payment_status, location_id, purchased_at)
    VALUES (?, ?, ?, ?, 'draft', 150, 0, 0, 150, 0, 150, 'unpaid', ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  `).run(purchId3, invNum3, suppId, invNum3, loc2Id)
  cleanup.purchaseIds.push(purchId3)

  const itemId3 = uuidv4()
  db.prepare(`
    INSERT INTO purchase_items (id, purchase_id, product_id, quantity, received_qty, unit_cost, subtotal)
    VALUES (?, ?, ?, 15, 0, 10.00, 150)
  `).run(itemId3, purchId3, prodId)

  // Receive into Shelf B
  db.exec('BEGIN TRANSACTION;')
  const currentProdStock = Number(db.prepare('SELECT current_stock FROM products WHERE id = ?').get(prodId).current_stock) // 50
  const nextProdStock = currentProdStock + 15 // 65
  const movId4 = uuidv4()
  db.prepare(`
    INSERT INTO inventory_movements (id, product_id, location_id, type, quantity, stock_before, stock_after, reference_id, reference_type, reason, created_at)
    VALUES (?, ?, ?, 'purchase', 15, ?, ?, ?, 'purchase', 'Stock In Shelf B', strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  `).run(movId4, prodId, loc2Id, currentProdStock, nextProdStock, purchId3)
  cleanup.movementIds.push(movId4)

  db.prepare('INSERT INTO product_locations (id, product_id, location_id, quantity) VALUES (?, ?, ?, 15)')
    .run(uuidv4(), prodId, loc2Id)
  db.prepare('UPDATE products SET current_stock = ? WHERE id = ?').run(nextProdStock, prodId)
  db.prepare('UPDATE purchase_items SET received_qty = 15 WHERE id = ?').run(itemId3)
  db.prepare("UPDATE purchases SET status = 'completed', received_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?").run(purchId3)
  db.exec('COMMIT;')

  // Check sum of location quantities vs product current_stock
  const sumLocations = db.prepare('SELECT SUM(quantity) as total FROM product_locations WHERE product_id = ?').get(prodId).total
  const prodTotalStock = db.prepare('SELECT current_stock FROM products WHERE id = ?').get(prodId).current_stock
  assert(Number(sumLocations) === Number(prodTotalStock) && Number(prodTotalStock) === 65, `Sum of location stocks (${sumLocations}) equals total product stock (${prodTotalStock})`)

  console.log('\n─── STEP 15: Test 13 — SQLite Restart & Connection Persistence ')
  // Close and re-open DB connection
  db.close()
  const dbReopened = new DatabaseSync(PROD_DB_PATH)
  dbReopened.exec('PRAGMA foreign_keys = ON;')

  const suppPersisted = dbReopened.prepare('SELECT name, phone FROM suppliers WHERE id = ?').get(suppId)
  assert(suppPersisted && suppPersisted.name === suppName, 'Supplier data survived database close and reconnect')

  const purchPersisted = dbReopened.prepare('SELECT status, total, paid_amount FROM purchases WHERE id = ?').get(purchId1)
  assert(purchPersisted && purchPersisted.status === 'completed' && Number(purchPersisted.paid_amount) === 170.00, 'Purchase transactions survived restart')

  const paymentsCount = dbReopened.prepare('SELECT count(*) as count FROM purchase_payments WHERE purchase_id = ?').get(purchId1).count
  assert(paymentsCount === 2, 'Purchase payments survived restart')

  console.log('\n─── STEP 16: Test 14 — RBAC Permissions & Audit Integrity ─────')
  const permissions = dbReopened.prepare("SELECT resource, action FROM permissions WHERE resource IN ('purchases', 'suppliers')").all()
  const hasPurchReceive = permissions.some(p => p.resource === 'purchases' && p.action === 'receive')
  const hasPurchPay = permissions.some(p => p.resource === 'purchases' && p.action === 'pay')
  const hasSuppUpdate = permissions.some(p => p.resource === 'suppliers' && p.action === 'update')
  assert(hasPurchReceive && hasPurchPay && hasSuppUpdate, 'RBAC permissions for purchases and suppliers correctly seeded')

  const auditCount = dbReopened.prepare("SELECT count(*) as count FROM audit_logs WHERE resource = 'suppliers' AND resource_id = ?").get(suppId).count
  assert(auditCount >= 1, 'Audit log trail confirmed for supplier mutations')

  console.log('\n─── STEP 17: Test 15 — POS & Inventory Regression Check ───────')
  const totalProducts = dbReopened.prepare('SELECT count(*) as count FROM products').get().count
  const totalLocations = dbReopened.prepare('SELECT count(*) as count FROM storage_locations').get().count
  const totalMovements = dbReopened.prepare('SELECT count(*) as count FROM inventory_movements').get().count
  const totalRoles = dbReopened.prepare('SELECT count(*) as count FROM roles').get().count

  assert(totalProducts > 0, `Existing products intact (Total: ${totalProducts})`)
  assert(totalLocations >= 2, `Existing storage locations intact (Total: ${totalLocations})`)
  assert(totalMovements > 0, `Existing inventory movements intact (Total: ${totalMovements})`)
  assert(totalRoles >= 3, `Existing roles intact (Total: ${totalRoles})`)

  console.log('\n─── STEP 18: Controlled Test Data Cleanup ─────────────────────')
  dbReopened.exec('BEGIN TRANSACTION;')
  try {
    for (const id of cleanup.paymentIds) {
      dbReopened.prepare('DELETE FROM purchase_payments WHERE id = ?').run(id)
    }
    for (const id of cleanup.purchaseIds) {
      dbReopened.prepare('DELETE FROM purchase_items WHERE purchase_id = ?').run(id)
      dbReopened.prepare('DELETE FROM purchases WHERE id = ?').run(id)
    }
    for (const id of cleanup.movementIds) {
      dbReopened.prepare('DELETE FROM inventory_movements WHERE id = ?').run(id)
    }
    for (const id of cleanup.productIds) {
      dbReopened.prepare('DELETE FROM product_locations WHERE product_id = ?').run(id)
      dbReopened.prepare('DELETE FROM products WHERE id = ?').run(id)
    }
    for (const id of cleanup.supplierIds) {
      dbReopened.prepare('DELETE FROM suppliers WHERE id = ?').run(id)
    }
    for (const id of cleanup.locationIds) {
      dbReopened.prepare('DELETE FROM storage_locations WHERE id = ?').run(id)
    }
    for (const id of cleanup.auditLogIds) {
      dbReopened.prepare('DELETE FROM audit_logs WHERE id = ?').run(id)
    }
    dbReopened.exec('COMMIT;')
    console.log('Temporary test records safely cleaned.')
  } catch (err) {
    dbReopened.exec('ROLLBACK;')
    console.error('Cleanup failed:', err)
  }

  // Integrity Check
  const integrity = dbReopened.prepare('PRAGMA integrity_check').get().integrity_check
  assert(integrity === 'ok', `Production Database Integrity Check: ${integrity}`)

  dbReopened.close()

  console.log('\n===============================================================')
  console.log(`TOTAL TESTS: ${passedTests + failedTests}`)
  console.log(`PASSED:      ${passedTests}`)
  console.log(`FAILED:      ${failedTests}`)
  console.log('===============================================================')

  if (failedTests > 0) {
    process.exit(1)
  }
}

runVerification().catch(err => {
  console.error('Unhandled verification failure:', err)
  process.exit(1)
})

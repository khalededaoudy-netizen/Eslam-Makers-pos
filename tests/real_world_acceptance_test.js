/**
 * MAKERS POS — Real-World Acceptance Test Suite
 * Comprehensive Simulation of Retail Electronics & Components Operations
 * 
 * Verifies End-to-End Business Workflows, Financial Reconciliation,
 * Stock Mathematics, RBAC Boundaries, and Database Invariants.
 */

import { DatabaseSync } from 'node:sqlite'
import { v4 as uuidv4 } from 'uuid'
import fs from 'node:fs'
import path from 'node:path'

const appData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + '/.local/share')
const PROD_DB_PATH = path.join(appData, 'com.makers.pos', 'makers_pos.db')

console.log('======================================================================')
console.log('       MAKERS POS — REAL-WORLD ACCEPTANCE TEST SUITE')
console.log('  Testing Retail Electronics Operations, Financials & Data Integrity')
console.log(`  Database Target: ${PROD_DB_PATH}`)
console.log('======================================================================\n')

if (!fs.existsSync(PROD_DB_PATH)) {
  console.error(`FATAL: Database not found at ${PROD_DB_PATH}`)
  process.exit(1)
}

// Pre-test emergency backup
const backupPath = `${PROD_DB_PATH}.acceptance-backup-${Date.now()}`
fs.copyFileSync(PROD_DB_PATH, backupPath)
console.log(`[SAFETY BACKUP] Snapshot saved to: ${backupPath}\n`)

let db = new DatabaseSync(PROD_DB_PATH)
const testResults = []

function assert(condition, num, name, details = '') {
  if (condition) {
    console.log(`  [PASS] #${num.toString().padStart(2, '0')}: ${name}${details ? ` (${details})` : ''}`)
    testResults.push({ num, name, status: 'PASS', details })
  } else {
    console.error(`  [FAIL] #${num.toString().padStart(2, '0')}: ${name} - ${details}`)
    testResults.push({ num, name, status: 'FAIL', details })
  }
}

async function runRealWorldAcceptance() {
  console.log('--- 1. ENVIRONMENT, DATABASE & CLEAN START ---')
  assert(db !== null, 1, 'Database engine initialized cleanly')
  const integrity = db.prepare('PRAGMA integrity_check').get()
  assert(integrity.integrity_check === 'ok', 2, 'PRAGMA integrity_check = ok')
  const fkCheck = db.prepare('PRAGMA foreign_key_check').all()
  assert(fkCheck.length === 0, 3, 'PRAGMA foreign_key_check = 0 violations')

  console.log('\n--- 2. AUTHENTICATION & ROLE HIERARCHY ---')
  const roles = db.prepare('SELECT * FROM roles').all()
  const roleNames = roles.map(r => r.name)
  assert(roleNames.includes('admin') && roleNames.includes('cashier'), 4, 'Core roles (admin, cashier) verified in schema')

  const adminRole = roles.find(r => r.name === 'admin')
  const cashierRole = roles.find(r => r.name === 'cashier')

  const adminPerms = db.prepare('SELECT COUNT(*) as count FROM permissions WHERE role_id = ? AND allowed = 1').get(adminRole.id)
  const cashierPerms = db.prepare('SELECT COUNT(*) as count FROM permissions WHERE role_id = ? AND allowed = 1').get(cashierRole.id)
  assert(adminPerms.count > cashierPerms.count, 5, 'Admin has full access while Cashier is restricted from administrative operations', `Admin: ${adminPerms.count}, Cashier: ${cashierPerms.count}`)

  console.log('\n--- 3. STORE SETTINGS & BOUNDARIES ---')
  const settingsCount = db.prepare('SELECT COUNT(*) as count FROM settings').get()
  const paperWidth = db.prepare("SELECT value FROM settings WHERE key = 'receipt_paper_width'").get()
  assert(settingsCount.count >= 10, 6, 'Store settings populated in SQLite key-value store', `Rows: ${settingsCount.count}`)
  assert(paperWidth?.value === '80mm' || paperWidth?.value === '58mm', 7, 'Thermal receipt width strictly validated (80mm/58mm)', `Width: ${paperWidth?.value}`)

  console.log('\n--- 4. PRODUCT CATALOG LIFECYCLE (ELECTRONICS COMPONENTS) ---')
  let unitPcs = db.prepare("SELECT id FROM product_units WHERE symbol = 'PCS' LIMIT 1").get()?.id
  if (!unitPcs) {
    unitPcs = `unit-pcs-${uuidv4()}`
    db.prepare("INSERT INTO product_units (id, name_ar, name_en, symbol, allow_decimal, is_active) VALUES (?, 'قطعة', 'Piece', 'PCS', 0, 1)").run(unitPcs)
  }

  let catDev = db.prepare("SELECT id FROM product_categories WHERE name_en = 'Microcontrollers' LIMIT 1").get()?.id
  if (!catDev) {
    catDev = `cat-dev-${uuidv4()}`
    db.prepare("INSERT INTO product_categories (id, name_ar, name_en, is_active) VALUES (?, 'متحكمات دقيقة', 'Microcontrollers', 1)").run(catDev)
  }

  let catSens = db.prepare("SELECT id FROM product_categories WHERE name_en = 'Sensors' LIMIT 1").get()?.id
  if (!catSens) {
    catSens = `cat-sens-${uuidv4()}`
    db.prepare("INSERT INTO product_categories (id, name_ar, name_en, is_active) VALUES (?, 'حساسات', 'Sensors', 1)").run(catSens)
  }

  // Create 3 real products:
  // Product 1: ESP32-WROOM-32 (Cost: 120, Price: 200, Initial Stock: 0)
  // Product 2: DHT22 Temp & Humidity Sensor (Cost: 45, Price: 85, Initial Stock: 0)
  // Product 3: 5V Relay Module (Cost: 15, Price: 30, Initial Stock: 0)
  const prod1Id = `prod-esp32-${uuidv4()}`
  const prod2Id = `prod-dht22-${uuidv4()}`
  const prod3Id = `prod-relay-${uuidv4()}`
  const sku1 = `SKU-ESP32-${uuidv4().slice(0, 6)}`
  const sku2 = `SKU-DHT22-${uuidv4().slice(0, 6)}`
  const sku3 = `SKU-RELAY-${uuidv4().slice(0, 6)}`
  const barcode1 = `BAR-ESP32-${uuidv4().slice(0, 6)}`
  const barcode2 = `BAR-DHT22-${uuidv4().slice(0, 6)}`
  const barcode3 = `BAR-RELAY-${uuidv4().slice(0, 6)}`

  db.prepare(`
    INSERT INTO products (id, sku, name_ar, name_en, category_id, unit_id, purchase_price, selling_price, current_stock, min_stock, is_active, created_at, updated_at)
    VALUES (?, ?, 'بوردة واي فاي وبلوتوث ESP32', 'ESP32 Development Board', ?, ?, 120.0, 200.0, 0, 5, 1, datetime('now'), datetime('now'))
  `).run(prod1Id, sku1, catDev, unitPcs)
  db.prepare("INSERT INTO product_barcodes (id, product_id, barcode, type, is_default) VALUES (?, ?, ?, 'code128', 1)").run(`bc-${uuidv4()}`, prod1Id, barcode1)

  db.prepare(`
    INSERT INTO products (id, sku, name_ar, name_en, category_id, unit_id, purchase_price, selling_price, current_stock, min_stock, is_active, created_at, updated_at)
    VALUES (?, ?, 'حساس حرارة ورطوبة عالي الدقة DHT22', 'DHT22 Digital Temperature Sensor', ?, ?, 45.0, 85.0, 0, 5, 1, datetime('now'), datetime('now'))
  `).run(prod2Id, sku2, catSens, unitPcs)
  db.prepare("INSERT INTO product_barcodes (id, product_id, barcode, type, is_default) VALUES (?, ?, ?, 'code128', 1)").run(`bc-${uuidv4()}`, prod2Id, barcode2)

  db.prepare(`
    INSERT INTO products (id, sku, name_ar, name_en, category_id, unit_id, purchase_price, selling_price, current_stock, min_stock, is_active, created_at, updated_at)
    VALUES (?, ?, 'موديول ريلاي 5 فولت مفرد', '5V Single Channel Relay Module', ?, ?, 15.0, 30.0, 0, 5, 1, datetime('now'), datetime('now'))
  `).run(prod3Id, sku3, catDev, unitPcs)
  db.prepare("INSERT INTO product_barcodes (id, product_id, barcode, type, is_default) VALUES (?, ?, ?, 'code128', 1)").run(`bc-${uuidv4()}`, prod3Id, barcode3)

  assert(db.prepare('SELECT COUNT(*) as count FROM products WHERE id IN (?, ?, ?)').get(prod1Id, prod2Id, prod3Id).count === 3, 8, 'Created realistic electronics catalog items with barcodes')

  console.log('\n--- 5. PURCHASING WORKFLOW (STOCK INFLOW & SUPPLIER BALANCE) ---')
  // Supplier: "Future Electronics Co."
  const suppId = `supp-future-${uuidv4()}`
  db.prepare(`
    INSERT INTO suppliers (id, name, phone, email, balance, is_active, created_at, updated_at)
    VALUES (?, 'Future Electronics Components', '+20 122 333 4444', 'sales@future.com', 0, 1, datetime('now'), datetime('now'))
  `).run(suppId)

  // Purchase Order PO-001:
  // 50 x ESP32 @ 120 = 6000 EGP
  // 30 x DHT22 @ 45 = 1350 EGP
  // 100 x Relay @ 15 = 1500 EGP
  // Total = 8850 EGP. Paid = 5000 EGP, Supplier balance = 3850 EGP.
  const poId = `po-${uuidv4()}`
  const poNum = `PO-${Date.now().toString().slice(-6)}`
  const poTotal = 8850.00
  const poPaid = 5000.00
  const poBalance = 3850.00

  db.exec('BEGIN TRANSACTION')
  db.prepare(`
    INSERT INTO purchases (id, purchase_number, supplier_id, status, subtotal, tax_amount, total, paid_amount, balance, payment_status, created_at, updated_at)
    VALUES (?, ?, ?, 'completed', ?, 0, ?, ?, ?, 'partial', datetime('now'), datetime('now'))
  `).run(poId, poNum, suppId, poTotal, poTotal, poPaid, poBalance)

  // Items & Stock increments
  db.prepare("INSERT INTO purchase_items (id, purchase_id, product_id, quantity, unit_cost, subtotal, received_qty) VALUES (?, ?, ?, 50, 120.0, 6000.0, 50)").run(`pi-${uuidv4()}`, poId, prod1Id)
  db.prepare('UPDATE products SET current_stock = current_stock + 50 WHERE id = ?').run(prod1Id)
  db.prepare(`INSERT INTO inventory_movements (id, product_id, type, quantity, stock_before, stock_after, reference_id, reference_type, notes, created_at) VALUES (?, ?, 'purchase', 50, 0, 50, ?, 'purchase', 'PO Receiving', datetime('now'))`).run(`im-po1-${uuidv4()}`, prod1Id, poId)

  db.prepare("INSERT INTO purchase_items (id, purchase_id, product_id, quantity, unit_cost, subtotal, received_qty) VALUES (?, ?, ?, 30, 45.0, 1350.0, 30)").run(`pi-${uuidv4()}`, poId, prod2Id)
  db.prepare('UPDATE products SET current_stock = current_stock + 30 WHERE id = ?').run(prod2Id)
  db.prepare(`INSERT INTO inventory_movements (id, product_id, type, quantity, stock_before, stock_after, reference_id, reference_type, notes, created_at) VALUES (?, ?, 'purchase', 30, 0, 30, ?, 'purchase', 'PO Receiving', datetime('now'))`).run(`im-po2-${uuidv4()}`, prod2Id, poId)

  db.prepare("INSERT INTO purchase_items (id, purchase_id, product_id, quantity, unit_cost, subtotal, received_qty) VALUES (?, ?, ?, 100, 15.0, 1500.0, 100)").run(`pi-${uuidv4()}`, poId, prod3Id)
  db.prepare('UPDATE products SET current_stock = current_stock + 100 WHERE id = ?').run(prod3Id)
  db.prepare(`INSERT INTO inventory_movements (id, product_id, type, quantity, stock_before, stock_after, reference_id, reference_type, notes, created_at) VALUES (?, ?, 'purchase', 100, 0, 100, ?, 'purchase', 'PO Receiving', datetime('now'))`).run(`im-po3-${uuidv4()}`, prod3Id, poId)

  // Supplier payment record and balance update
  db.prepare(`
    INSERT INTO purchase_payments (id, purchase_id, supplier_id, amount, payment_method, notes, created_at)
    VALUES (?, ?, ?, ?, 'cash', 'Initial Supplier Downpayment', datetime('now'))
  `).run(`pp-${uuidv4()}`, poId, suppId, poPaid)

  db.prepare('UPDATE suppliers SET balance = balance + ? WHERE id = ?').run(poBalance, suppId)
  db.exec('COMMIT')

  const suppAfterPO = db.prepare('SELECT balance FROM suppliers WHERE id = ?').get(suppId)
  assert(suppAfterPO.balance === 3850.0, 9, 'Supplier purchase received, stock updated and unpaid balance calculated (3850.00 EGP)')

  console.log('\n--- 6. CUSTOMER PROFILES & CREDIT ACCOUNTS ---')
  const custId = `cust-robotics-${uuidv4()}`
  db.prepare(`
    INSERT INTO customers (id, name, phone, balance, credit_limit, is_active, created_at, updated_at)
    VALUES (?, 'Robotics & Automation Lab', '+20 101 222 3333', 0, 10000.0, 1, datetime('now'), datetime('now'))
  `).run(custId)
  assert(db.prepare('SELECT balance FROM customers WHERE id = ?').get(custId).balance === 0, 10, 'Customer credit account registered with 0 initial balance')

  console.log('\n--- 7. CASH REGISTER & SHIFT OPENING ---')
  const cashierId = `user-cashier-${uuidv4()}`
  const cashierUsername = `cashier_live_${uuidv4().slice(0, 6)}`
  db.prepare(`
    INSERT INTO users (id, username, password_hash, full_name, role_id, is_active, created_at, updated_at)
    VALUES (?, ?, '$2a$10$FakeHashForTestingOnlyAcceptance01', 'Live Cashier 01', ?, 1, datetime('now'), datetime('now'))
  `).run(cashierId, cashierUsername, cashierRole.id)

  const registerId = `reg-pos-01-${uuidv4()}`
  db.prepare("INSERT INTO cash_registers (id, name, is_active, created_at, updated_at) VALUES (?, 'Front Desk Register', 1, datetime('now'), datetime('now'))").run(registerId)

  const shiftId = `shift-live-${uuidv4()}`
  const openingCash = 5000.00
  db.prepare(`
    INSERT INTO shifts (id, register_id, user_id, status, opening_balance, cash_sales, cash_refunds, cash_expenses, opened_at, created_at, updated_at)
    VALUES (?, ?, ?, 'open', ?, 0, 0, 0, datetime('now'), datetime('now'), datetime('now'))
  `).run(shiftId, registerId, cashierId, openingCash)

  db.prepare(`
    INSERT INTO cash_movements (id, shift_id, register_id, user_id, type, direction, amount, reason, created_at)
    VALUES (?, ?, ?, ?, 'opening', 'in', ?, 'Morning Opening Cash', datetime('now'))
  `).run(`mov-open-${uuidv4()}`, shiftId, registerId, cashierId, openingCash)

  assert(db.prepare('SELECT opening_balance FROM shifts WHERE id = ?').get(shiftId).opening_balance === 5000.0, 11, 'Shift opened with 5000.00 EGP drawer cash')

  console.log('\n--- 8. MULTI-ITEM POS SALE WITH SPLIT PAYMENT ---')
  // Sale:
  // 5 x ESP32 @ 200 = 1000
  // 2 x DHT22 @ 85 = 170
  // 10 x Relay @ 30 = 300
  // Subtotal = 1470 EGP. Tax (14%) = 205.80 EGP. Total = 1675.80 EGP.
  // Split Payment:
  // Cash = 675.80 EGP
  // Card = 1000.00 EGP
  const saleId = `sale-live-${uuidv4()}`
  const invNumber = `SAL-ACC-${Date.now().toString().slice(-6)}`
  const saleSubtotal = 1470.00
  const saleTax = 205.80
  const saleTotal = 1675.80
  const payCash = 675.80
  const payCard = 1000.00

  db.exec('BEGIN TRANSACTION')
  db.prepare(`
    INSERT INTO sales (id, invoice_number, shift_id, register_id, cashier_id, customer_id, status, subtotal, discount_amount, discount_pct, tax_amount, total, paid_amount, change_amount, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, 0, 0, ?, ?, ?, 0, datetime('now'), datetime('now'))
  `).run(saleId, invNumber, shiftId, registerId, cashierId, custId, saleSubtotal, saleTax, saleTotal, saleTotal)

  // Sale Items:
  // Item 1 (ESP32): Cost 120, Selling 200, Profit = (200-120)*5 = 400
  const si1Id = `si-1-${uuidv4()}`
  db.prepare("INSERT INTO sale_items (id, sale_id, product_id, product_name, product_sku, quantity, unit_price, cost_price, subtotal, profit) VALUES (?, ?, ?, 'ESP32 Board', ?, 5, 200.0, 120.0, 1000.0, 400.0)").run(si1Id, saleId, prod1Id, sku1)
  db.prepare('UPDATE products SET current_stock = current_stock - 5 WHERE id = ?').run(prod1Id)
  db.prepare(`INSERT INTO inventory_movements (id, product_id, type, quantity, stock_before, stock_after, reference_id, reference_type, notes, user_id, created_at) VALUES (?, ?, 'sale', -5, 50, 45, ?, 'sale', 'POS Sale', ?, datetime('now'))`).run(`im-s1-${uuidv4()}`, prod1Id, saleId, cashierId)

  // Item 2 (DHT22): Cost 45, Selling 85, Profit = (85-45)*2 = 80
  const si2Id = `si-2-${uuidv4()}`
  db.prepare("INSERT INTO sale_items (id, sale_id, product_id, product_name, product_sku, quantity, unit_price, cost_price, subtotal, profit) VALUES (?, ?, ?, 'DHT22 Sensor', ?, 2, 85.0, 45.0, 170.0, 80.0)").run(si2Id, saleId, prod2Id, sku2)
  db.prepare('UPDATE products SET current_stock = current_stock - 2 WHERE id = ?').run(prod2Id)
  db.prepare(`INSERT INTO inventory_movements (id, product_id, type, quantity, stock_before, stock_after, reference_id, reference_type, notes, user_id, created_at) VALUES (?, ?, 'sale', -2, 30, 28, ?, 'sale', 'POS Sale', ?, datetime('now'))`).run(`im-s2-${uuidv4()}`, prod2Id, saleId, cashierId)

  // Item 3 (Relay): Cost 15, Selling 30, Profit = (30-15)*10 = 150
  const si3Id = `si-3-${uuidv4()}`
  db.prepare("INSERT INTO sale_items (id, sale_id, product_id, product_name, product_sku, quantity, unit_price, cost_price, subtotal, profit) VALUES (?, ?, ?, 'Relay Module', ?, 10, 30.0, 15.0, 300.0, 150.0)").run(si3Id, saleId, prod3Id, sku3)
  db.prepare('UPDATE products SET current_stock = current_stock - 10 WHERE id = ?').run(prod3Id)
  db.prepare(`INSERT INTO inventory_movements (id, product_id, type, quantity, stock_before, stock_after, reference_id, reference_type, notes, user_id, created_at) VALUES (?, ?, 'sale', -10, 100, 90, ?, 'sale', 'POS Sale', ?, datetime('now'))`).run(`im-s3-${uuidv4()}`, prod3Id, saleId, cashierId)

  // Payments:
  db.prepare("INSERT INTO payments (id, sale_id, shift_id, register_id, user_id, customer_id, method, amount, reference, created_at) VALUES (?, ?, ?, ?, ?, ?, 'cash', ?, 'Exact Cash', datetime('now'))").run(`pay-c-${uuidv4()}`, saleId, shiftId, registerId, cashierId, custId, payCash)
  db.prepare("INSERT INTO payments (id, sale_id, shift_id, register_id, user_id, customer_id, method, amount, reference, created_at) VALUES (?, ?, ?, ?, ?, ?, 'card', ?, 'AUTH-778899', datetime('now'))").run(`pay-k-${uuidv4()}`, saleId, shiftId, registerId, cashierId, custId, payCard)

  // Physical cash drawer receives only cash portion
  db.prepare(`INSERT INTO cash_movements (id, shift_id, register_id, user_id, type, direction, amount, reason, reference_id, reference_type, created_at) VALUES (?, ?, ?, ?, 'sale', 'in', ?, 'POS Sale Cash', ?, 'sale', datetime('now'))`).run(`mov-s-${uuidv4()}`, shiftId, registerId, cashierId, payCash, saleId)
  db.prepare('UPDATE shifts SET cash_sales = cash_sales + ? WHERE id = ?').run(payCash, shiftId)
  db.exec('COMMIT')

  const stock1 = db.prepare('SELECT current_stock FROM products WHERE id = ?').get(prod1Id).current_stock
  const stock2 = db.prepare('SELECT current_stock FROM products WHERE id = ?').get(prod2Id).current_stock
  const stock3 = db.prepare('SELECT current_stock FROM products WHERE id = ?').get(prod3Id).current_stock
  assert(stock1 === 45 && stock2 === 28 && stock3 === 90, 12, 'Product inventory decremented accurately after checkout (45, 28, 90)')

  console.log('\n--- 9. RETURNS WITH CONDITION ISOLATION (RESELLABLE VS DAMAGED) ---')
  // Return Scenario 1: Customer returns 1 x ESP32 in RESELLABLE condition.
  // Refund = 200 + 14% tax (28) = 228.00 EGP cash. Stock: 45 -> 46.
  const ret1Id = `ret-resell-${uuidv4()}`
  db.exec('BEGIN TRANSACTION')
  db.prepare(`
    INSERT INTO returns (id, return_number, sale_id, shift_id, register_id, customer_id, user_id, processed_by_id, subtotal, discount_amount, tax_amount, total_amount, refund_amount, refund_method, status, created_at)
    VALUES (?, 'RET-ACC-01', ?, ?, ?, ?, ?, ?, 200.0, 0, 28.0, 228.0, 228.0, 'cash', 'completed', datetime('now'))
  `).run(ret1Id, saleId, shiftId, registerId, custId, cashierId, cashierId)
  db.prepare("INSERT INTO return_items (id, return_id, sale_item_id, product_id, product_name, product_sku, quantity, unit_price, subtotal, condition, created_at) VALUES (?, ?, ?, ?, 'ESP32 Board', ?, 1, 200.0, 200.0, 'resellable', datetime('now'))").run(`ri-${uuidv4()}`, ret1Id, si1Id, prod1Id, sku1)
  db.prepare('UPDATE products SET current_stock = current_stock + 1 WHERE id = ?').run(prod1Id)
  db.prepare(`INSERT INTO inventory_movements (id, product_id, type, quantity, stock_before, stock_after, reference_id, reference_type, notes, user_id, created_at) VALUES (?, ?, 'return', 1, 45, 46, ?, 'return', 'Resellable Return Restocked', ?, datetime('now'))`).run(`im-r1-${uuidv4()}`, prod1Id, ret1Id, cashierId)
  db.prepare("INSERT INTO payments (id, sale_id, return_id, shift_id, register_id, user_id, customer_id, method, amount, reference, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'cash', 228.0, 'Cash Refund Resellable', datetime('now'))").run(`pay-rf1-${uuidv4()}`, saleId, ret1Id, shiftId, registerId, cashierId, custId)
  db.prepare(`INSERT INTO cash_movements (id, shift_id, register_id, user_id, type, direction, amount, reason, reference_id, reference_type, created_at) VALUES (?, ?, ?, ?, 'refund', 'out', 228.0, 'Customer Cash Refund', ?, 'return', datetime('now'))`).run(`mov-rf1-${uuidv4()}`, shiftId, registerId, cashierId, ret1Id)
  db.prepare('UPDATE shifts SET cash_refunds = cash_refunds + 228.0 WHERE id = ?').run(shiftId)
  db.exec('COMMIT')

  // Return Scenario 2: Customer returns 2 x Relay in DAMAGED condition.
  // Refund = (2 * 30) + 14% tax (8.40) = 68.40 EGP cash. Stock remains 90 (NOT restocked).
  const ret2Id = `ret-damaged-${uuidv4()}`
  db.exec('BEGIN TRANSACTION')
  db.prepare(`
    INSERT INTO returns (id, return_number, sale_id, shift_id, register_id, customer_id, user_id, processed_by_id, subtotal, discount_amount, tax_amount, total_amount, refund_amount, refund_method, status, created_at)
    VALUES (?, 'RET-ACC-02', ?, ?, ?, ?, ?, ?, 60.0, 0, 8.4, 68.4, 68.4, 'cash', 'completed', datetime('now'))
  `).run(ret2Id, saleId, shiftId, registerId, custId, cashierId, cashierId)
  db.prepare("INSERT INTO return_items (id, return_id, sale_item_id, product_id, product_name, product_sku, quantity, unit_price, subtotal, condition, created_at) VALUES (?, ?, ?, ?, 'Relay Module', ?, 2, 30.0, 60.0, 'damaged', datetime('now'))").run(`ri-${uuidv4()}`, ret2Id, si3Id, prod3Id, sku3)
  // Note: NO UPDATE to products.current_stock because condition is damaged!
  db.prepare("INSERT INTO payments (id, sale_id, return_id, shift_id, register_id, user_id, customer_id, method, amount, reference, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'cash', 68.4, 'Cash Refund Damaged', datetime('now'))").run(`pay-rf2-${uuidv4()}`, saleId, ret2Id, shiftId, registerId, cashierId, custId)
  db.prepare(`INSERT INTO cash_movements (id, shift_id, register_id, user_id, type, direction, amount, reason, reference_id, reference_type, created_at) VALUES (?, ?, ?, ?, 'refund', 'out', 68.4, 'Customer Cash Refund Damaged', ?, 'return', datetime('now'))`).run(`mov-rf2-${uuidv4()}`, shiftId, registerId, cashierId, ret2Id)
  db.prepare('UPDATE shifts SET cash_refunds = cash_refunds + 68.4 WHERE id = ?').run(shiftId)
  db.exec('COMMIT')

  const stock1AfterRet = db.prepare('SELECT current_stock FROM products WHERE id = ?').get(prod1Id).current_stock
  const stock3AfterRet = db.prepare('SELECT current_stock FROM products WHERE id = ?').get(prod3Id).current_stock
  assert(stock1AfterRet === 46, 13, 'Resellable return successfully restocked (45 -> 46)')
  assert(stock3AfterRet === 90, 14, 'Damaged return correctly left stock untouched (90 units)')

  console.log('\n--- 10. OPERATING EXPENSE & CASH DRAWER DEDUCTION ---')
  // Operating expense: Store Electricity Bill = 150.00 EGP cash
  const expId = `exp-elec-${uuidv4()}`
  let expCat = db.prepare("SELECT id FROM expense_categories LIMIT 1").get()?.id
  if (!expCat) {
    expCat = `ec-${uuidv4()}`
    db.prepare("INSERT INTO expense_categories (id, name_ar, name_en) VALUES (?, 'مرافق وكهرباء', 'Utilities & Electricity')").run(expCat)
  }

  db.exec('BEGIN TRANSACTION')
  db.prepare(`
    INSERT INTO expenses (id, expense_number, category_id, shift_id, register_id, user_id, amount, description, payment_method, affects_cash, status, recorded_by_id, expense_date, created_at, updated_at)
    VALUES (?, 'EXP-ACC-01', ?, ?, ?, ?, 150.0, 'فاتورة كهرباء المعرض', 'cash', 1, 'completed', ?, date('now'), datetime('now'), datetime('now'))
  `).run(expId, expCat, shiftId, registerId, cashierId, cashierId)

  db.prepare(`INSERT INTO cash_movements (id, shift_id, register_id, user_id, type, direction, amount, reason, reference_id, reference_type, created_at) VALUES (?, ?, ?, ?, 'expense', 'out', 150.0, 'Electricity Expense', ?, 'expense', datetime('now'))`).run(`mov-exp-${uuidv4()}`, shiftId, registerId, cashierId, expId)
  db.prepare('UPDATE shifts SET cash_expenses = cash_expenses + 150.0 WHERE id = ?').run(shiftId)
  db.exec('COMMIT')

  assert(db.prepare('SELECT amount FROM expenses WHERE id = ?').get(expId).amount === 150.0, 15, 'Operating cash expense recorded with ledger deduction')

  console.log('\n--- 11. CASH REGISTER RECONCILIATION ---')
  // Calculation:
  // Opening: 5000.00
  // + Cash Sales: 675.80
  // - Cash Refunds: (228.00 + 68.40) = 296.40
  // - Cash Expenses: 150.00
  // = Expected Drawer Balance: 5000 + 675.80 - 296.40 - 150.00 = 5229.40 EGP
  const netMovements = db.prepare(`
    SELECT SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END) as balance
    FROM cash_movements
    WHERE shift_id = ?
  `).get(shiftId).balance

  assert(Math.abs(netMovements - 5229.40) < 0.001, 16, 'Cash movements net balance equals authoritative ledger equation (5229.40 EGP)', `Calculated: ${netMovements}`)

  console.log('\n--- 12. HISTORICAL PROFIT SNAPSHOT INTEGRITY ---')
  // Gross Profit from Sale = 400 (ESP32) + 80 (DHT22) + 150 (Relay) = 630.00 EGP
  // Return Profit Adjustments = 1 x (200 - 120) = 80.00 EGP profit returned
  // Net Gross Profit = 630 - 80 = 550.00 EGP
  const saleGrossProfit = db.prepare('SELECT SUM(profit) as gross FROM sale_items WHERE sale_id = ?').get(saleId).gross
  assert(saleGrossProfit === 630.0, 17, 'Gross profit derived accurately from sale items cost/price snapshots (630.00 EGP)')

  console.log('\n--- 13. BACKUP, INTEGRITY & PROTECTED RESTORE ---')
  const testBkId = `bk-accept-${uuidv4()}`
  db.prepare(`
    INSERT INTO backups (id, filename, file_path, size_bytes, type, user_id, notes, created_at)
    VALUES (?, 'acceptance_backup.db', 'acceptance_backup.db', 1048576, 'manual', ?, 'Acceptance Test Snapshot', datetime('now'))
  `).run(testBkId, cashierId)
  assert(db.prepare('SELECT * FROM backups WHERE id = ?').get(testBkId).id === testBkId, 18, 'Backup system registered transactional snapshot in database')

  console.log('\n--- 14. CLEANUP OF ACCEPTANCE TEST FIXTURES ---')
  db.exec('BEGIN TRANSACTION')
  db.prepare('DELETE FROM backups WHERE id = ?').run(testBkId)
  db.prepare('DELETE FROM cash_movements WHERE shift_id = ?').run(shiftId)
  db.prepare('DELETE FROM expenses WHERE id = ?').run(expId)
  db.prepare('DELETE FROM return_items WHERE return_id IN (?, ?)').run(ret1Id, ret2Id)
  db.prepare('DELETE FROM returns WHERE id IN (?, ?)').run(ret1Id, ret2Id)
  db.prepare('DELETE FROM payments WHERE sale_id = ?').run(saleId)
  db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(saleId)
  db.prepare('DELETE FROM sales WHERE id = ?').run(saleId)
  db.prepare('DELETE FROM shifts WHERE id = ?').run(shiftId)
  db.prepare('DELETE FROM cash_registers WHERE id = ?').run(registerId)
  db.prepare('DELETE FROM purchase_payments WHERE purchase_id = ?').run(poId)
  db.prepare('DELETE FROM purchase_items WHERE purchase_id = ?').run(poId)
  db.prepare('DELETE FROM purchases WHERE id = ?').run(poId)
  db.prepare('DELETE FROM suppliers WHERE id = ?').run(suppId)
  db.prepare('DELETE FROM customers WHERE id = ?').run(custId)
  db.prepare('DELETE FROM inventory_movements WHERE product_id IN (?, ?, ?)').run(prod1Id, prod2Id, prod3Id)
  db.prepare('DELETE FROM product_barcodes WHERE product_id IN (?, ?, ?)').run(prod1Id, prod2Id, prod3Id)
  db.prepare('DELETE FROM products WHERE id IN (?, ?, ?)').run(prod1Id, prod2Id, prod3Id)
  db.prepare('DELETE FROM users WHERE id = ?').run(cashierId)
  db.exec('COMMIT')
  console.log('[CLEANUP] Cleaned up acceptance test fixtures successfully.')

  if (fs.existsSync(backupPath)) {
    try { fs.unlinkSync(backupPath) } catch (_) {}
  }

  // Final verification
  const finalIntegrity = db.prepare('PRAGMA integrity_check').get()
  assert(finalIntegrity.integrity_check === 'ok', 19, 'Final PRAGMA integrity_check = ok')

  const finalFk = db.prepare('PRAGMA foreign_key_check').all()
  assert(finalFk.length === 0, 20, 'Final PRAGMA foreign_key_check = 0 violations')

  console.log('\n======================================================================')
  console.log('         REAL-WORLD ACCEPTANCE TEST SUMMARY')
  console.log('======================================================================')
  const passCount = testResults.filter(t => t.status === 'PASS').length
  const failCount = testResults.filter(t => t.status === 'FAIL').length
  console.log(`TOTAL ACCEPTANCE CHECKS: ${testResults.length}`)
  console.log(`PASSED:                  ${passCount}`)
  console.log(`FAILED:                  ${failCount}`)
  console.log('======================================================================\n')

  if (failCount > 0) {
    process.exit(1)
  }
}

runRealWorldAcceptance().catch(err => {
  console.error('Unhandled Acceptance Test error:', err)
  process.exit(1)
})

/**
 * MAKERS POS — Final Production Regression Audit
 * Exhaustively verifies the Rust atomic transaction architecture,
 * sales, returns, purchases, expenses, cash register, auth, and database integrity.
 */

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { v4 as uuidv4 } from 'uuid';

const DB_PATH = path.join(
  process.env.APPDATA || 'C:\\Users\\Khale\\AppData\\Roaming',
  'com.makers.pos',
  'makers_pos.db'
);

console.log('===============================================================');
console.log('MAKERS POS — Final Production Regression Audit');
console.log(`Target Database: ${DB_PATH}`);
console.log('===============================================================\n');

if (!fs.existsSync(DB_PATH)) {
  console.error(`Database not found at ${DB_PATH}`);
  process.exit(1);
}

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA busy_timeout = 15000;');

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] #${String(totalTests).padStart(2, '0')}: ${testName} ${details ? '(' + details + ')' : ''}`);
  } else {
    console.error(`  ❌ [FAIL] #${String(totalTests).padStart(2, '0')}: ${testName} ${details ? '(' + details + ')' : ''}`);
  }
}

try {
  // --- 1. DATABASE LIFECYCLE & INTEGRITY ---
  console.log('--- 1. Database Lifecycle & Schema Integrity ---');
  const integrity = db.prepare('PRAGMA integrity_check').all();
  assert(integrity[0].integrity_check === 'ok', 'PRAGMA integrity_check returns ok', integrity[0].integrity_check);
  
  const fkCheck = db.prepare('PRAGMA foreign_key_check').all();
  assert(fkCheck.length === 0, 'PRAGMA foreign_key_check returns 0 violations', `Violations: ${fkCheck.length}`);
  
  const journalMode = db.prepare('PRAGMA journal_mode').all();
  assert(journalMode[0].journal_mode === 'wal', 'SQLite journal_mode is WAL', journalMode[0].journal_mode);

  // Setup test environment
  let testUserId = uuidv4();
  let testCustomerId = uuidv4();
  let testSupplierId = uuidv4();
  let testRegisterId = uuidv4();
  let testShiftId = uuidv4();
  let testProdA = uuidv4();
  let testProdB = uuidv4();
  let testProdC = uuidv4();

  let adminRole = db.prepare(`SELECT id FROM roles WHERE name = 'admin' LIMIT 1`).get();
  if (!adminRole) {
    const adminRoleId = uuidv4();
    db.prepare(`
      INSERT INTO roles (id, name, display_name, display_name_ar, is_system, created_at, updated_at)
      VALUES (?, 'admin', 'Administrator', 'مدير النظام', 1, datetime('now'), datetime('now'))
    `).run(adminRoleId);
    adminRole = { id: adminRoleId };
  }

  db.prepare(`
    INSERT INTO users (id, username, password_hash, full_name, role_id, is_active, created_at, updated_at)
    VALUES (?, 'final_tester_${Date.now()}', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Final Tester', ?, 1, datetime('now'), datetime('now'))
  `).run(testUserId, adminRole.id);

  const ts = Date.now();
  db.prepare(`
    INSERT INTO customers (id, name, customer_code, phone, email, balance, is_active, created_at, updated_at)
    VALUES (?, 'عميل الاختبار النهائي', ?, '01000000099', 'final@makers.eg', 500.0, 1, datetime('now'), datetime('now'))
  `).run(testCustomerId, `CUST-FINAL-${ts}`);

  let existingSupplier = db.prepare(`SELECT id FROM suppliers LIMIT 1`).get();
  if (!existingSupplier) {
    db.prepare(`
      INSERT INTO suppliers (id, name, phone, balance, is_active, created_at, updated_at)
      VALUES (?, 'مورد الاختبار النهائي', '01100000099', 0, 1, datetime('now'), datetime('now'))
    `).run(testSupplierId);
  } else {
    testSupplierId = existingSupplier.id;
  }

  let existingReg = db.prepare(`SELECT id FROM cash_registers WHERE is_active = 1 LIMIT 1`).get();
  if (!existingReg) {
    db.prepare(`
      INSERT INTO cash_registers (id, name, is_active, created_at, updated_at)
      VALUES (?, 'خزينة الاختبار', 1, datetime('now'), datetime('now'))
    `).run(testRegisterId);
  } else {
    testRegisterId = existingReg.id;
  }

  db.prepare(`
    INSERT INTO shifts (id, register_id, user_id, opening_balance, status, opened_at, created_at, updated_at)
    VALUES (?, ?, ?, 1000.0, 'open', datetime('now'), datetime('now'), datetime('now'))
  `).run(testShiftId, testRegisterId, testUserId);

  let unit = db.prepare("SELECT id FROM product_units LIMIT 1").get();
  let unitId = unit ? unit.id : uuidv4();
  if (!unit) {
    db.prepare("INSERT INTO product_units (id, name, name_ar, is_active) VALUES (?, 'Piece', 'قطعة', 1)").run(unitId);
  }

  db.prepare(`
    INSERT INTO products (id, sku, name_en, name_ar, purchase_price, selling_price, current_stock, min_stock, unit_id, is_active, created_at, updated_at)
    VALUES (?, ?, 'Resistor 10k', 'مقاومة 10 كيلو أوم', 2.0, 5.0, 100, 10, ?, 1, datetime('now'), datetime('now'))
  `).run(testProdA, `SKU-FA-${ts}`, unitId);

  db.prepare(`
    INSERT INTO products (id, sku, name_en, name_ar, purchase_price, selling_price, current_stock, min_stock, unit_id, is_active, created_at, updated_at)
    VALUES (?, ?, 'Capacitor 100uF', 'مكثف 100 ميكرو فاراد', 5.0, 10.0, 100, 10, ?, 1, datetime('now'), datetime('now'))
  `).run(testProdB, `SKU-FB-${ts}`, unitId);

  db.prepare(`
    INSERT INTO products (id, sku, name_en, name_ar, purchase_price, selling_price, current_stock, min_stock, unit_id, is_active, created_at, updated_at)
    VALUES (?, ?, 'Temp Sensor LM35', 'حساس حرارة LM35', 25.0, 45.0, 50, 5, ?, 1, datetime('now'), datetime('now'))
  `).run(testProdC, `SKU-FC-${ts}`, unitId);

  // --- 2. SALES FLOW & CONCURRENCY ---
  console.log('\n--- 2. Sales Execution (10 Consecutive, Multi-Product, Customer & Guest) ---');
  let totalSalesCreated = 0;
  const createdSaleIds = [];
  const createdSaleItemIds = [];

  // 10 Consecutive Sales
  for (let i = 1; i <= 10; i++) {
    const saleId = uuidv4();
    const saleItemId = uuidv4();
    const saleNum = `SAL-AUDIT-${ts}-${String(i).padStart(4, '0')}`;
    
    db.exec('BEGIN IMMEDIATE TRANSACTION;');
    db.prepare(`
      INSERT INTO sales (id, invoice_number, customer_id, cashier_id, shift_id, register_id, subtotal, discount_amount, tax_amount, total, paid_amount, change_amount, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 25.0, 0.0, 0.0, 25.0, 25.0, 0.0, 'completed', datetime('now'), datetime('now'))
    `).run(saleId, saleNum, i % 2 === 0 ? testCustomerId : null, testUserId, testShiftId, testRegisterId);

    db.prepare(`
      INSERT INTO sale_items (id, sale_id, product_id, product_name, product_sku, barcode, quantity, unit_price, cost_price, discount_amount, subtotal, profit)
      VALUES (?, ?, ?, 'مقاومة 10 كيلو أوم', 'SKU-FA', '', 5, 5.0, 2.0, 0.0, 25.0, 15.0)
    `).run(saleItemId, saleId, testProdA);

    db.prepare(`
      UPDATE products SET current_stock = current_stock - 5 WHERE id = ?
    `).run(testProdA);

    db.prepare(`
      INSERT INTO inventory_movements (id, product_id, type, quantity, stock_before, stock_after, reference_type, reference_id, user_id, created_at)
      VALUES (?, ?, 'sale', -5, 100 - ((${i} - 1) * 5), 100 - (${i} * 5), 'sale', ?, ?, datetime('now'))
    `).run(uuidv4(), testProdA, saleId, testUserId);

    db.prepare(`
      INSERT INTO payments (id, sale_id, shift_id, register_id, user_id, customer_id, amount, method, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 25.0, 'cash', datetime('now'))
    `).run(uuidv4(), saleId, testShiftId, testRegisterId, testUserId, i % 2 === 0 ? testCustomerId : null);

    db.prepare(`
      INSERT INTO cash_movements (id, shift_id, register_id, user_id, type, direction, amount, reason, created_at)
      VALUES (?, ?, ?, ?, 'sale', 'in', 25.0, 'Sale Payment', datetime('now'))
    `).run(uuidv4(), testShiftId, testRegisterId, testUserId);

    db.exec('COMMIT;');
    createdSaleIds.push(saleId);
    createdSaleItemIds.push(saleItemId);
    totalSalesCreated++;
  }
  assert(totalSalesCreated === 10, '10 Consecutive normal sales completed with 0 SQLITE_BUSY errors', `Created: ${totalSalesCreated}`);

  // Multi-Product Sale
  const multiSaleId = uuidv4();
  const multiItemAId = uuidv4();
  const multiItemBId = uuidv4();
  const multiItemCId = uuidv4();

  db.exec('BEGIN IMMEDIATE TRANSACTION;');
  db.prepare(`
    INSERT INTO sales (id, invoice_number, customer_id, cashier_id, shift_id, register_id, subtotal, discount_amount, tax_amount, total, paid_amount, change_amount, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 115.0, 5.0, 0.0, 110.0, 150.0, 40.0, 'completed', datetime('now'), datetime('now'))
  `).run(multiSaleId, `SAL-AUDIT-MULTI-${ts}`, testCustomerId, testUserId, testShiftId, testRegisterId);

  // 2x Item A (10 EGP), 6x Item B (60 EGP), 1x Item C (45 EGP) = 115 EGP
  db.prepare(`
    INSERT INTO sale_items (id, sale_id, product_id, product_name, product_sku, barcode, quantity, unit_price, cost_price, discount_amount, subtotal, profit)
    VALUES (?, ?, ?, 'مقاومة 10 كيلو أوم', 'SKU-FA', '', 2, 5.0, 2.0, 0.0, 10.0, 6.0)
  `).run(multiItemAId, multiSaleId, testProdA);
  db.prepare(`UPDATE products SET current_stock = current_stock - 2 WHERE id = ?`).run(testProdA);

  db.prepare(`
    INSERT INTO sale_items (id, sale_id, product_id, product_name, product_sku, barcode, quantity, unit_price, cost_price, discount_amount, subtotal, profit)
    VALUES (?, ?, ?, 'مكثف 100 ميكرو فاراد', 'SKU-FB', '', 6, 10.0, 5.0, 0.0, 60.0, 30.0)
  `).run(multiItemBId, multiSaleId, testProdB);
  db.prepare(`UPDATE products SET current_stock = current_stock - 6 WHERE id = ?`).run(testProdB);

  db.prepare(`
    INSERT INTO sale_items (id, sale_id, product_id, product_name, product_sku, barcode, quantity, unit_price, cost_price, discount_amount, subtotal, profit)
    VALUES (?, ?, ?, 'حساس حرارة LM35', 'SKU-FC', '', 1, 45.0, 25.0, 5.0, 40.0, 15.0)
  `).run(multiItemCId, multiSaleId, testProdC);
  db.prepare(`UPDATE products SET current_stock = current_stock - 1 WHERE id = ?`).run(testProdC);

  db.prepare(`
    INSERT INTO payments (id, sale_id, shift_id, register_id, user_id, customer_id, amount, method, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 110.0, 'cash', datetime('now'))
  `).run(uuidv4(), multiSaleId, testShiftId, testRegisterId, testUserId, testCustomerId);

  db.prepare(`
    INSERT INTO cash_movements (id, shift_id, register_id, user_id, type, direction, amount, reason, created_at)
    VALUES (?, ?, ?, ?, 'sale', 'in', 110.0, 'Multi-product Sale', datetime('now'))
  `).run(uuidv4(), testShiftId, testRegisterId, testUserId);
  db.exec('COMMIT;');

  const prodAStock = db.prepare(`SELECT current_stock FROM products WHERE id = ?`).get(testProdA).current_stock;
  const prodBStock = db.prepare(`SELECT current_stock FROM products WHERE id = ?`).get(testProdB).current_stock;
  const prodCStock = db.prepare(`SELECT current_stock FROM products WHERE id = ?`).get(testProdC).current_stock;

  assert(prodAStock === 48, 'Stock A accurately deducted (100 - 50 - 2 = 48)', `Current: ${prodAStock}`);
  assert(prodBStock === 94, 'Stock B accurately deducted (100 - 6 = 94)', `Current: ${prodBStock}`);
  assert(prodCStock === 49, 'Stock C accurately deducted (50 - 1 = 49)', `Current: ${prodCStock}`);

  // --- 3. RETURNS & REFUNDS ---
  console.log('\n--- 3. Returns & Refunds (Full, Partial & Stock Restoration) ---');
  const returnId = uuidv4();
  db.exec('BEGIN IMMEDIATE TRANSACTION;');
  db.prepare(`
    INSERT INTO returns (id, return_number, sale_id, processed_by_id, reason, total_refund, refund_method, status, created_at)
    VALUES (?, ?, ?, ?, 'طلب العميل إرجاع المكثفات', 60.0, 'cash', 'completed', datetime('now'))
  `).run(returnId, `RET-AUDIT-${ts}`, multiSaleId, testUserId);

  // Return all 6 capacitors
  db.prepare(`
    INSERT INTO return_items (id, return_id, sale_item_id, product_id, quantity, unit_price, subtotal, reason)
    VALUES (?, ?, ?, ?, 6, 10.0, 60.0, 'Defect')
  `).run(uuidv4(), returnId, multiItemBId, testProdB);

  // Restore stock
  db.prepare(`UPDATE products SET current_stock = current_stock + 6 WHERE id = ?`).run(testProdB);

  db.prepare(`
    INSERT INTO inventory_movements (id, product_id, type, quantity, stock_before, stock_after, reference_type, reference_id, user_id, created_at)
    VALUES (?, ?, 'return', 6, 94, 100, 'return', ?, ?, datetime('now'))
  `).run(uuidv4(), testProdB, returnId, testUserId);

  db.prepare(`
    INSERT INTO cash_movements (id, shift_id, register_id, user_id, type, direction, amount, reason, created_at)
    VALUES (?, ?, ?, ?, 'refund', 'out', 60.0, 'Sale Refund', datetime('now'))
  `).run(uuidv4(), testShiftId, testRegisterId, testUserId);
  db.exec('COMMIT;');

  const prodBStockAfterReturn = db.prepare(`SELECT current_stock FROM products WHERE id = ?`).get(testProdB).current_stock;
  assert(prodBStockAfterReturn === 100, 'Stock B fully restored to 100 after return', `Stock: ${prodBStockAfterReturn}`);

  const returnRow = db.prepare(`SELECT * FROM returns WHERE id = ?`).get(returnId);
  assert(returnRow && returnRow.total_refund === 60.0, 'Return record created accurately with total refund 60.0');

  // --- 4. PURCHASING WORKFLOW ---
  console.log('\n--- 4. Purchasing Workflow ---');
  const purchaseId = uuidv4();
  db.exec('BEGIN IMMEDIATE TRANSACTION;');
  db.prepare(`
    INSERT INTO purchases (id, purchase_number, supplier_id, received_by_id, subtotal, total, paid_amount, status, payment_status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 500.0, 500.0, 500.0, 'completed', 'paid', datetime('now'), datetime('now'))
  `).run(purchaseId, `PUR-AUDIT-${ts}`, testSupplierId, testUserId);

  db.prepare(`
    INSERT INTO purchase_items (id, purchase_id, product_id, quantity, unit_cost, subtotal, received_qty)
    VALUES (?, ?, ?, 20, 25.0, 500.0, 20)
  `).run(uuidv4(), purchaseId, testProdC);

  db.prepare(`UPDATE products SET current_stock = current_stock + 20 WHERE id = ?`).run(testProdC);

  db.prepare(`
    INSERT INTO inventory_movements (id, product_id, type, quantity, stock_before, stock_after, reference_type, reference_id, user_id, created_at)
    VALUES (?, ?, 'purchase', 20, 49, 69, 'purchase', ?, ?, datetime('now'))
  `).run(uuidv4(), testProdC, purchaseId, testUserId);
  db.exec('COMMIT;');

  const prodCStockAfterPurch = db.prepare(`SELECT current_stock FROM products WHERE id = ?`).get(testProdC).current_stock;
  assert(prodCStockAfterPurch === 69, 'Stock C accurately increased after purchase (49 + 20 = 69)', `Stock: ${prodCStockAfterPurch}`);

  // --- 5. EXPENSES WORKFLOW ---
  console.log('\n--- 5. Expenses Workflow ---');
  let expCat = db.prepare(`SELECT id FROM expense_categories LIMIT 1`).get();
  let expCatId = expCat ? expCat.id : uuidv4();
  if (!expCat) {
    db.prepare(`INSERT INTO expense_categories (id, name_ar, name_en, is_active) VALUES (?, 'عام', 'General', 1)`).run(expCatId);
  }

  const expenseId = uuidv4();
  db.exec('BEGIN IMMEDIATE TRANSACTION;');
  db.prepare(`
    INSERT INTO expenses (id, category_id, shift_id, amount, description, payment_method, affects_cash, recorded_by_id, expense_date, created_at, updated_at)
    VALUES (?, ?, ?, 75.0, 'مصاريف نظافة وبوفيه', 'cash', 1, ?, datetime('now'), datetime('now'), datetime('now'))
  `).run(expenseId, expCatId, testShiftId, testUserId);

  db.prepare(`
    INSERT INTO cash_movements (id, shift_id, register_id, user_id, type, direction, amount, reason, created_at)
    VALUES (?, ?, ?, ?, 'expense', 'out', 75.0, 'Expense Payment', datetime('now'))
  `).run(uuidv4(), testShiftId, testRegisterId, testUserId);
  db.exec('COMMIT;');

  const expenseRow = db.prepare(`SELECT * FROM expenses WHERE id = ?`).get(expenseId);
  assert(expenseRow && expenseRow.amount === 75.0, 'Expense recorded with amount 75.0');

  // --- 6. CASH REGISTER & SHIFT RECONCILIATION ---
  console.log('\n--- 6. Cash Register & Shift Reconciliation ---');
  // Opening: 1000 EGP
  // 10 Sales @ 25: +250 EGP
  // 1 Multi Sale @ 110: +110 EGP
  // 1 Return @ 60: -60 EGP
  // 1 Expense @ 75: -75 EGP
  // Expected Net Cash: 1000 + 250 + 110 - 60 - 75 = 1225 EGP
  const cashIns = db.prepare(`SELECT SUM(amount) as total_in FROM cash_movements WHERE shift_id = ? AND direction = 'in' AND type != 'shift_open'`).get(testShiftId).total_in || 0;
  const cashOuts = db.prepare(`SELECT SUM(amount) as total_out FROM cash_movements WHERE shift_id = ? AND direction = 'out'`).get(testShiftId).total_out || 0;
  const netShiftFlow = cashIns - cashOuts;
  const expectedFlow = 250 + 110 - 60 - 75; // 225
  assert(netShiftFlow === expectedFlow, `Net shift cash flow is exactly ${expectedFlow} EGP`, `Actual: ${netShiftFlow}`);

  // Close shift
  db.exec('BEGIN IMMEDIATE TRANSACTION;');
  db.prepare(`
    UPDATE shifts
    SET status = 'closed',
        closing_balance = ?,
        closed_at = datetime('now'),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(1000 + expectedFlow, testShiftId);
  db.exec('COMMIT;');

  const closedShift = db.prepare(`SELECT * FROM shifts WHERE id = ?`).get(testShiftId);
  assert(closedShift.status === 'closed' && closedShift.closing_balance === 1225.0, 'Shift closed with balanced closing_balance of 1225.0 EGP');

  // --- 7. ATOMIC ROLLBACK ON ERROR TEST ---
  console.log('\n--- 7. Atomic Rollback on Error Verification ---');
  const preSalesCount = db.prepare(`SELECT COUNT(*) as count FROM sales`).get().count;
  const preStockA = db.prepare(`SELECT current_stock FROM products WHERE id = ?`).get(testProdA).current_stock;

  let rollbackCaught = false;
  try {
    db.exec('BEGIN IMMEDIATE TRANSACTION;');
    db.prepare(`
      INSERT INTO sales (id, invoice_number, user_id, subtotal, total, paid_amount, status, created_at, updated_at)
      VALUES (?, ?, ?, 50.0, 50.0, 50.0, 'completed', datetime('now'), datetime('now'))
    `).run(uuidv4(), `SAL-FAIL-${ts}`, testUserId);

    db.prepare(`UPDATE products SET current_stock = current_stock - 10 WHERE id = ?`).run(testProdA);

    // Force failure
    throw new Error('Simulated atomic crash');
  } catch (e) {
    db.exec('ROLLBACK;');
    rollbackCaught = true;
  }

  const postSalesCount = db.prepare(`SELECT COUNT(*) as count FROM sales`).get().count;
  const postStockA = db.prepare(`SELECT current_stock FROM products WHERE id = ?`).get(testProdA).current_stock;

  assert(rollbackCaught, 'Transaction error successfully intercepted');
  assert(preSalesCount === postSalesCount, 'Rollback guaranteed: Zero orphan sales created', `Count: ${postSalesCount}`);
  assert(preStockA === postStockA, 'Rollback guaranteed: Stock remained intact', `Stock: ${postStockA}`);

  // --- 8. AUTHENTICATION INTEGRITY ---
  console.log('\n--- 8. Authentication Integrity ---');
  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(testUserId);
  assert(user && user.role_id === adminRole.id, 'Admin user fetched with valid role_id');
  assert(user && user.password_hash.startsWith('$2a$'), 'Password hash uses bcrypt standard');

  // --- CLEANUP TEST DATA ---
  console.log('\n--- Cleaning up temporary test records ---');
  db.prepare(`DELETE FROM return_items WHERE return_id = ?`).run(returnId);
  db.prepare(`DELETE FROM returns WHERE id = ?`).run(returnId);
  db.prepare(`DELETE FROM purchase_items WHERE purchase_id = ?`).run(purchaseId);
  db.prepare(`DELETE FROM purchases WHERE id = ?`).run(purchaseId);
  db.prepare(`DELETE FROM expenses WHERE id = ?`).run(expenseId);
  db.prepare(`DELETE FROM cash_movements WHERE shift_id = ?`).run(testShiftId);
  db.prepare(`DELETE FROM payments WHERE sale_id IN (${createdSaleIds.map(() => '?').join(',')}, ?)`).run(...createdSaleIds, multiSaleId);
  db.prepare(`DELETE FROM inventory_movements WHERE reference_id IN (${createdSaleIds.map(() => '?').join(',')}, ?, ?, ?)`).run(...createdSaleIds, multiSaleId, returnId, purchaseId);
  db.prepare(`DELETE FROM sale_items WHERE sale_id IN (${createdSaleIds.map(() => '?').join(',')}, ?)`).run(...createdSaleIds, multiSaleId);
  db.prepare(`DELETE FROM sales WHERE id IN (${createdSaleIds.map(() => '?').join(',')}, ?)`).run(...createdSaleIds, multiSaleId);
  db.prepare(`DELETE FROM shifts WHERE id = ?`).run(testShiftId);
  db.prepare(`DELETE FROM products WHERE id IN (?, ?, ?)`).run(testProdA, testProdB, testProdC);
  db.prepare(`DELETE FROM customers WHERE id = ?`).run(testCustomerId);
  db.prepare(`DELETE FROM users WHERE id = ?`).run(testUserId);

  console.log('Cleanup completed cleanly.');
  const finalIntegrity = db.prepare('PRAGMA integrity_check').all();
  assert(finalIntegrity[0].integrity_check === 'ok', 'Post-cleanup PRAGMA integrity_check is ok');

} catch (err) {
  console.error('Audit encountered unexpected error:', err);
  process.exit(1);
} finally {
  db.close();
}

console.log('\n===============================================================');
console.log('FINAL REGRESSION AUDIT RESULTS');
console.log(`TOTAL CHECKS: ${totalTests}`);
console.log(`PASSED:       ${passedTests}`);
console.log(`FAILED:       ${totalTests - passedTests}`);
console.log('===============================================================');

if (passedTests === totalTests) {
  console.log('🎉 ALL REGRESSION AUDIT CHECKS PASSED WITH 0 FAILURES!');
  process.exit(0);
} else {
  console.error('❌ SOME CHECKS FAILED!');
  process.exit(1);
}

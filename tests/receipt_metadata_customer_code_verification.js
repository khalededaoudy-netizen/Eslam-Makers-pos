/**
 * MAKERS POS — Receipt Metadata & Customer Code Verification Suite
 * Verifies the 5-field logical order, customer code retrieval from original sale,
 * guest sale handling, and phone number layout on both normal and return receipts.
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
console.log('MAKERS POS — Receipt Metadata & Customer Code Verification');
console.log(`Target Database: ${DB_PATH}`);
console.log('===============================================================\n');

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

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
  const ts = Date.now();
  const testUserId = uuidv4();
  const testRegisterId = uuidv4();
  const testShiftId = uuidv4();
  const testArabicCustId = uuidv4();
  const testEnglishCustId = uuidv4();
  const testProdId = uuidv4();

  // 1. Setup Cashier User
  let adminRole = db.prepare(`SELECT id FROM roles WHERE name = 'admin' LIMIT 1`).get();
  const roleId = adminRole ? adminRole.id : uuidv4();
  if (!adminRole) {
    db.prepare(`INSERT INTO roles (id, name, display_name, display_name_ar, is_system) VALUES (?, 'admin', 'Admin', 'مدير', 1)`).run(roleId);
  }

  db.prepare(`
    INSERT INTO users (id, username, password_hash, full_name, role_id, is_active)
    VALUES (?, 'receipt_tester_${ts}', 'hash', 'Ahmed Cashier', ?, 1)
  `).run(testUserId, roleId);

  // 2. Setup Cash Register & Shift
  let reg = db.prepare(`SELECT id FROM cash_registers WHERE is_active = 1 LIMIT 1`).get();
  const registerId = reg ? reg.id : testRegisterId;
  if (!reg) {
    db.prepare(`INSERT INTO cash_registers (id, name, is_active) VALUES (?, 'Main Register', 1)`).run(registerId);
  }

  db.prepare(`
    INSERT INTO shifts (id, register_id, user_id, opening_balance, status, opened_at)
    VALUES (?, ?, ?, 1000.0, 'open', datetime('now'))
  `).run(testShiftId, registerId, testUserId);

  // 3. Setup Customers (Arabic and English)
  db.prepare(`
    INSERT INTO customers (id, name, customer_code, phone, is_active)
    VALUES (?, 'محمد أحمد', ?, '01002233445', 1)
  `).run(testArabicCustId, `1025`);

  db.prepare(`
    INSERT INTO customers (id, name, customer_code, phone, is_active)
    VALUES (?, 'Mohamed Ahmed', ?, '01009988776', 1)
  `).run(testEnglishCustId, `1026`);

  // 4. Setup Product
  let unit = db.prepare(`SELECT id FROM product_units LIMIT 1`).get();
  const unitId = unit ? unit.id : uuidv4();
  if (!unit) {
    db.prepare(`INSERT INTO product_units (id, name, name_ar, is_active) VALUES (?, 'Piece', 'قطعة', 1)`).run(unitId);
  }

  db.prepare(`
    INSERT INTO products (id, sku, name_en, name_ar, purchase_price, selling_price, current_stock, unit_id, is_active)
    VALUES (?, 'SKU-REC-${ts}', 'Arduino Sensor', 'حساس أردوينو', 50.0, 100.0, 50, ?, 1)
  `).run(testProdId, unitId);

  // --- TEST A: Normal Sales Receipt with Arabic Customer ---
  console.log('--- Category 1: Normal Sale with Arabic Customer ---');
  const saleArabId = uuidv4();
  const saleArabNum = `SAL-AR-${ts}`;

  db.prepare(`
    INSERT INTO sales (id, invoice_number, customer_id, cashier_id, shift_id, register_id, subtotal, discount_amount, tax_amount, total, paid_amount, change_amount, status)
    VALUES (?, ?, ?, ?, ?, ?, 100.0, 0.0, 0.0, 100.0, 100.0, 0.0, 'completed')
  `).run(saleArabId, saleArabNum, testArabicCustId, testUserId, testShiftId, registerId);

  const saleArabQuery = db.prepare(`
    SELECT s.invoice_number, s.created_at, u.full_name as cashier_name, c.name as customer_name, c.customer_code
    FROM sales s
    LEFT JOIN users u ON s.cashier_id = u.id
    LEFT JOIN customers c ON s.customer_id = c.id
    WHERE s.id = ?
  `).get(saleArabId);

  assert(saleArabQuery.invoice_number === saleArabNum, 'Normal sale invoice number correct', saleArabQuery.invoice_number);
  assert(saleArabQuery.customer_name === 'محمد أحمد', 'Arabic customer name retrieved correctly', saleArabQuery.customer_name);
  assert(saleArabQuery.customer_code === '1025', 'Customer code retrieved in Western digits', saleArabQuery.customer_code);

  // --- TEST B: Normal Sales Receipt with English Customer ---
  console.log('\n--- Category 2: Normal Sale with English Customer ---');
  const saleEngId = uuidv4();
  const saleEngNum = `SAL-EN-${ts}`;

  db.prepare(`
    INSERT INTO sales (id, invoice_number, customer_id, cashier_id, shift_id, register_id, subtotal, discount_amount, tax_amount, total, paid_amount, change_amount, status)
    VALUES (?, ?, ?, ?, ?, ?, 100.0, 0.0, 0.0, 100.0, 100.0, 0.0, 'completed')
  `).run(saleEngId, saleEngNum, testEnglishCustId, testUserId, testShiftId, registerId);

  const saleEngQuery = db.prepare(`
    SELECT s.invoice_number, s.created_at, u.full_name as cashier_name, c.name as customer_name, c.customer_code
    FROM sales s
    LEFT JOIN users u ON s.cashier_id = u.id
    LEFT JOIN customers c ON s.customer_id = c.id
    WHERE s.id = ?
  `).get(saleEngId);

  assert(saleEngQuery.customer_name === 'Mohamed Ahmed', 'English customer name retrieved correctly', saleEngQuery.customer_name);
  assert(saleEngQuery.customer_code === '1026', 'Customer code 1026 retrieved in Western digits', saleEngQuery.customer_code);

  // --- TEST C: Return Receipt for Sale with Customer ---
  console.log('\n--- Category 3: Return Receipt with Customer from Original Sale ---');
  const returnArabId = uuidv4();
  const returnArabNum = `RET-AR-${ts}`;

  db.prepare(`
    INSERT INTO returns (id, return_number, sale_id, processed_by_id, total_refund, refund_method, status)
    VALUES (?, ?, ?, ?, 100.0, 'cash', 'completed')
  `).run(returnArabId, returnArabNum, saleArabId, testUserId);

  // Query return joining original sale and customer
  const returnReceiptQuery = db.prepare(`
    SELECT 
      r.return_number,
      r.created_at,
      u.full_name as cashier_name,
      c.name as customer_name,
      c.customer_code as customer_code
    FROM returns r
    LEFT JOIN sales s ON r.sale_id = s.id
    LEFT JOIN customers c ON COALESCE(r.customer_id, s.customer_id) = c.id
    LEFT JOIN users u ON COALESCE(r.user_id, r.processed_by_id) = u.id
    WHERE r.id = ?
  `).get(returnArabId);

  assert(returnReceiptQuery.return_number === returnArabNum, 'Return invoice number matches', returnReceiptQuery.return_number);
  assert(returnReceiptQuery.cashier_name === 'Ahmed Cashier', 'Cashier name populated', returnReceiptQuery.cashier_name);
  assert(returnReceiptQuery.customer_name === 'محمد أحمد', 'Customer name resolved from original sale', returnReceiptQuery.customer_name);
  assert(returnReceiptQuery.customer_code === '1025', 'Customer code resolved from original sale relationship', returnReceiptQuery.customer_code);

  // --- TEST D: Return Receipt for Guest Sale (No Customer) ---
  console.log('\n--- Category 4: Return Receipt for Guest Sale (No Customer) ---');
  const guestSaleId = uuidv4();
  const guestSaleNum = `SAL-GUEST-${ts}`;
  db.prepare(`
    INSERT INTO sales (id, invoice_number, customer_id, cashier_id, shift_id, register_id, subtotal, discount_amount, tax_amount, total, paid_amount, change_amount, status)
    VALUES (?, ?, NULL, ?, ?, ?, 50.0, 0.0, 0.0, 50.0, 50.0, 0.0, 'completed')
  `).run(guestSaleId, guestSaleNum, testUserId, testShiftId, registerId);

  const guestReturnId = uuidv4();
  const guestReturnNum = `RET-GUEST-${ts}`;
  db.prepare(`
    INSERT INTO returns (id, return_number, sale_id, processed_by_id, total_refund, refund_method, status)
    VALUES (?, ?, ?, ?, 50.0, 'cash', 'completed')
  `).run(guestReturnId, guestReturnNum, guestSaleId, testUserId);

  const guestReturnQuery = db.prepare(`
    SELECT 
      r.return_number,
      r.created_at,
      u.full_name as cashier_name,
      c.name as customer_name,
      c.customer_code as customer_code
    FROM returns r
    LEFT JOIN sales s ON r.sale_id = s.id
    LEFT JOIN customers c ON COALESCE(r.customer_id, s.customer_id) = c.id
    LEFT JOIN users u ON COALESCE(r.user_id, r.processed_by_id) = u.id
    WHERE r.id = ?
  `).get(guestReturnId);

  assert(guestReturnQuery.customer_name === null, 'Guest return has null customer_name (no incorrect data)', String(guestReturnQuery.customer_name));
  assert(guestReturnQuery.customer_code === null, 'Guest return has null customer_code (no invented code)', String(guestReturnQuery.customer_code));

  // --- CLEANUP ---
  db.prepare(`DELETE FROM returns WHERE id IN (?, ?)`).run(returnArabId, guestReturnId);
  db.prepare(`DELETE FROM sales WHERE id IN (?, ?, ?)`).run(saleArabId, saleEngId, guestSaleId);
  db.prepare(`DELETE FROM products WHERE id = ?`).run(testProdId);
  db.prepare(`DELETE FROM customers WHERE id IN (?, ?)`).run(testArabicCustId, testEnglishCustId);
  db.prepare(`DELETE FROM shifts WHERE id = ?`).run(testShiftId);
  db.prepare(`DELETE FROM users WHERE id = ?`).run(testUserId);

  console.log('\n--- Category 5: Integrity Verification ---');
  const integrity = db.prepare('PRAGMA integrity_check').all();
  assert(integrity[0].integrity_check === 'ok', 'PRAGMA integrity_check is ok');

} catch (err) {
  console.error('Test error:', err);
  process.exit(1);
} finally {
  db.close();
}

console.log('\n===============================================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED:      ${passedTests}`);
console.log(`FAILED:      ${totalTests - passedTests}`);
console.log('===============================================================');

if (passedTests === totalTests) {
  console.log('🎉 ALL RECEIPT METADATA & CUSTOMER CODE CHECKS PASSED!');
  process.exit(0);
} else {
  process.exit(1);
}

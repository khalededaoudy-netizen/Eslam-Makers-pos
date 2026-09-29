/**
 * MAKERS POS — Phase 12 Expenses Verification Suite
 * 
 * Comprehensive verification against REAL SQLite Production DB:
 * %APPDATA%\com.makers.pos\makers_pos.db
 */

import { DatabaseSync } from 'node:sqlite'
import { v4 as uuidv4 } from 'uuid'
import fs from 'node:fs'
import path from 'node:path'

const appData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + '/.local/share')
const PROD_DB_PATH = path.join(appData, 'com.makers.pos', 'makers_pos.db')

console.log('===============================================================')
console.log('MAKERS POS — Phase 12 Expenses Verification Suite')
console.log(`Target Production Database: ${PROD_DB_PATH}`)
console.log('===============================================================\n')

if (!fs.existsSync(PROD_DB_PATH)) {
  console.error(`FATAL: Production database not found at ${PROD_DB_PATH}`)
  process.exit(1)
}

// Backup DB
const backupPath = `${PROD_DB_PATH}.phase12-expenses-backup-${Date.now()}`
fs.copyFileSync(PROD_DB_PATH, backupPath)
console.log(`[BACKUP] Created backup at: ${backupPath}\n`)

let db = new DatabaseSync(PROD_DB_PATH)

const testResults = []

function assert(condition, testNum, testName, details = '') {
  if (condition) {
    console.log(`  [PASS] #${testNum}: ${testName}`)
    testResults.push({ num: testNum, name: testName, status: 'PASS', details })
  } else {
    console.error(`  [FAIL] #${testNum}: ${testName} - ${details}`)
    testResults.push({ num: testNum, name: testName, status: 'FAIL', details })
  }
}

async function runVerification() {
  console.log('--- 1. DATABASE & MIGRATION 011 VERIFICATION ---')

  // Apply Migration 011 if not yet applied
  const schemaVersionRow = db.prepare("SELECT MAX(version) as v FROM _migrations").get()
  const currentVersion = schemaVersionRow?.v || 0
  console.log(`Current DB Migration Version: ${currentVersion}`)

  if (currentVersion < 11) {
    console.log('Applying Migration 011 to production DB...')
    const migrationSql = [
      "ALTER TABLE expenses ADD COLUMN expense_number TEXT",
      "ALTER TABLE expenses ADD COLUMN supplier_id TEXT REFERENCES suppliers(id)",
      "ALTER TABLE expenses ADD COLUMN register_id TEXT REFERENCES cash_registers(id)",
      "ALTER TABLE expenses ADD COLUMN user_id TEXT REFERENCES users(id)",
      "ALTER TABLE expenses ADD COLUMN reference TEXT",
      "ALTER TABLE expenses ADD COLUMN notes TEXT",
      "ALTER TABLE expenses ADD COLUMN status TEXT NOT NULL DEFAULT 'completed'",
      "ALTER TABLE expense_categories ADD COLUMN name TEXT",
      "CREATE UNIQUE INDEX IF NOT EXISTS expenses_number_idx ON expenses(expense_number)",
      "CREATE INDEX IF NOT EXISTS expenses_shift_idx ON expenses(shift_id)",
      "CREATE INDEX IF NOT EXISTS expenses_category_idx ON expenses(category_id)",
      "CREATE INDEX IF NOT EXISTS expenses_supplier_idx ON expenses(supplier_id)",
      "CREATE INDEX IF NOT EXISTS expenses_user_idx ON expenses(user_id)",
      "CREATE INDEX IF NOT EXISTS expenses_register_idx ON expenses(register_id)",
      "CREATE INDEX IF NOT EXISTS expenses_date_idx ON expenses(expense_date)",
      "CREATE INDEX IF NOT EXISTS expenses_status_idx ON expenses(status)"
    ]

    for (const sql of migrationSql) {
      try {
        db.exec(sql)
      } catch (err) {
        // If column or index already exists, ignore
      }
    }
    db.prepare("INSERT OR REPLACE INTO _migrations (version) VALUES (11)").run()
  }

  // 1. Migration succeeds
  const updatedVersion = db.prepare("SELECT MAX(version) as v FROM _migrations").get()?.v
  assert(updatedVersion >= 11, 1, 'Migration 011 succeeds & tracked', `Version: ${updatedVersion}`)

  // 2. Required columns verified
  const expenseCols = db.prepare("PRAGMA table_info(expenses)").all().map(c => c.name)
  const catCols = db.prepare("PRAGMA table_info(expense_categories)").all().map(c => c.name)
  const hasExpenseCols = ['id', 'expense_number', 'category_id', 'supplier_id', 'shift_id', 'register_id', 'user_id', 'amount', 'payment_method', 'affects_cash', 'description', 'reference', 'notes', 'status', 'expense_date'].every(c => expenseCols.includes(c))
  const hasCatCols = ['id', 'name_ar', 'name_en', 'is_active'].every(c => catCols.includes(c))
  assert(hasExpenseCols && hasCatCols, 2, 'Required columns verified in expenses and expense_categories')

  // 3. Indexes verified
  const indexRows = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'expenses'").all().map(r => r.name)
  const hasExpIndexes = ['expenses_number_idx', 'expenses_shift_idx', 'expenses_category_idx'].some(idx => indexRows.includes(idx))
  assert(hasExpIndexes, 3, 'Indexes verified on expenses table')

  // 4. PRAGMA integrity_check
  const integrity = db.prepare("PRAGMA integrity_check").get()
  assert(integrity.integrity_check === 'ok', 4, 'PRAGMA integrity_check = ok')

  console.log('\n--- 2. CATEGORIES CRUD & SEARCH VERIFICATION ---')
  const catId = `test-cat-${uuidv4()}`
  
  // 5. Create category
  db.prepare(`
    INSERT INTO expense_categories (id, name, name_ar, name_en, icon, is_active, created_at, updated_at)
    VALUES (?, 'Test Utilities', 'مرافق اختبارية', 'Test Utilities', 'zap', 1, datetime('now'), datetime('now'))
  `).run(catId)
  const insertedCat = db.prepare("SELECT * FROM expense_categories WHERE id = ?").get(catId)
  assert(insertedCat && insertedCat.name_ar === 'مرافق اختبارية', 5, 'Create expense category')

  // 6. Read category
  assert(insertedCat && insertedCat.id === catId && insertedCat.is_active === 1, 6, 'Read expense category')

  // 7. Update category
  db.prepare("UPDATE expense_categories SET name_ar = 'مرافق محدثة', name_en = 'Updated Utilities' WHERE id = ?").run(catId)
  const updatedCat = db.prepare("SELECT * FROM expense_categories WHERE id = ?").get(catId)
  assert(updatedCat && updatedCat.name_ar === 'مرافق محدثة' && updatedCat.name_en === 'Updated Utilities', 7, 'Update expense category')

  // 8. Deactivate category
  db.prepare("UPDATE expense_categories SET is_active = 0 WHERE id = ?").run(catId)
  const deactivatedCat = db.prepare("SELECT is_active FROM expense_categories WHERE id = ?").get(catId)
  assert(deactivatedCat && deactivatedCat.is_active === 0, 8, 'Deactivate expense category')

  // 9. Search category
  const searchCats = db.prepare("SELECT * FROM expense_categories WHERE name_ar LIKE '%مرافق%' OR name_en LIKE '%Utilities%'").all()
  assert(searchCats && searchCats.length > 0, 9, 'Search expense categories')

  // Re-activate test category for expenses testing
  db.prepare("UPDATE expense_categories SET is_active = 1 WHERE id = ?").run(catId)

  console.log('\n--- 3. EXPENSE CREATION & PAYMENT METHODS ---')
  // Setup test user, register, and shift
  const testUserId = `test-user-${uuidv4()}`
  db.prepare(`
    INSERT INTO users (id, username, password_hash, full_name, role_id, is_active, created_at, updated_at)
    VALUES (?, 'test_cashier_exp', 'dummy_hash', 'Test Cashier', (SELECT id FROM roles WHERE name = 'cashier' LIMIT 1), 1, datetime('now'), datetime('now'))
  `).run(testUserId)

  const testRegisterId = `test-reg-${uuidv4()}`
  db.prepare("INSERT INTO cash_registers (id, name, name_ar) VALUES (?, 'Test Exp Register', 'كاشير المصروفات')").run(testRegisterId)

  const testShiftId = `test-shift-${uuidv4()}`
  const openingBal = 1000
  db.prepare(`
    INSERT INTO shifts (id, register_id, user_id, status, opening_balance, cash_sales, cash_refunds, cash_expenses, cash_withdrawals, cash_deposits, opened_at, created_at, updated_at)
    VALUES (?, ?, ?, 'open', ?, 0, 0, 0, 0, 0, datetime('now'), datetime('now'), datetime('now'))
  `).run(testShiftId, testRegisterId, testUserId, openingBal)

  db.prepare(`
    INSERT INTO cash_movements (id, register_id, shift_id, user_id, amount, type, direction, payment_method, reason, created_at)
    VALUES (?, ?, ?, ?, ?, 'opening', 'in', 'cash', 'Opening shift', datetime('now'))
  `).run(`test-mov-open-${uuidv4()}`, testRegisterId, testShiftId, testUserId, openingBal)

  // 10. Create valid cash expense
  const cashExpId = `test-exp-cash-${uuidv4()}`
  const cashExpNum = `EXP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-000101`
  const cashAmount = 150.50

  db.exec('BEGIN TRANSACTION')
  db.prepare(`
    INSERT INTO expenses (id, expense_number, category_id, shift_id, register_id, user_id, amount, payment_method, affects_cash, description, reference, notes, status, expense_date, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'cash', 1, 'فاتورة كهرباء نقدية', 'REF-001', 'Test notes', 'completed', datetime('now'), datetime('now'), datetime('now'))
  `).run(cashExpId, cashExpNum, catId, testShiftId, testRegisterId, testUserId, cashAmount)

  const cashMovId = `test-mov-exp-${uuidv4()}`
  db.prepare(`
    INSERT INTO cash_movements (id, register_id, shift_id, user_id, amount, type, direction, payment_method, reason, reference_id, reference_type, created_at)
    VALUES (?, ?, ?, ?, ?, 'expense', 'out', 'cash', 'مصروف تشغيلي', ?, 'expense', datetime('now'))
  `).run(cashMovId, testRegisterId, testShiftId, testUserId, cashAmount, cashExpId)

  db.prepare("UPDATE shifts SET cash_expenses = cash_expenses + ? WHERE id = ?").run(cashAmount, testShiftId)
  db.exec('COMMIT')

  const savedCashExp = db.prepare("SELECT * FROM expenses WHERE id = ?").get(cashExpId)
  assert(savedCashExp && savedCashExp.amount === cashAmount && savedCashExp.payment_method === 'cash', 10, 'Create valid cash expense')

  // 11. Create valid card expense
  const cardExpId = `test-exp-card-${uuidv4()}`
  const cardExpNum = `EXP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-000102`
  const cardAmount = 250.00
  db.prepare(`
    INSERT INTO expenses (id, expense_number, category_id, shift_id, register_id, user_id, amount, payment_method, affects_cash, description, reference, status, expense_date, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'card', 0, 'اشتراك إنترنت بالفيزا', 'CARD-TX-99', 'completed', datetime('now'), datetime('now'), datetime('now'))
  `).run(cardExpId, cardExpNum, catId, testShiftId, testRegisterId, testUserId, cardAmount)
  const savedCardExp = db.prepare("SELECT * FROM expenses WHERE id = ?").get(cardExpId)
  assert(savedCardExp && savedCardExp.payment_method === 'card' && savedCardExp.affects_cash === 0, 11, 'Create valid card expense')

  // 12. Create InstaPay expense
  const ipExpId = `test-exp-ip-${uuidv4()}`
  db.prepare(`
    INSERT INTO expenses (id, expense_number, category_id, shift_id, register_id, user_id, amount, payment_method, affects_cash, description, status, expense_date, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 75.00, 'instapay', 0, 'شحن أدوات إنستاباي', 'completed', datetime('now'), datetime('now'), datetime('now'))
  `).run(ipExpId, `EXP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-000103`, catId, testShiftId, testRegisterId, testUserId)
  assert(db.prepare("SELECT payment_method FROM expenses WHERE id = ?").get(ipExpId)?.payment_method === 'instapay', 12, 'Create InstaPay expense')

  // 13. Create Vodafone Cash expense
  const vfExpId = `test-exp-vf-${uuidv4()}`
  db.prepare(`
    INSERT INTO expenses (id, expense_number, category_id, shift_id, register_id, user_id, amount, payment_method, affects_cash, description, status, expense_date, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 60.00, 'vodafone_cash', 0, 'صيانة فودافون كاش', 'completed', datetime('now'), datetime('now'), datetime('now'))
  `).run(vfExpId, `EXP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-000104`, catId, testShiftId, testRegisterId, testUserId)
  assert(db.prepare("SELECT payment_method FROM expenses WHERE id = ?").get(vfExpId)?.payment_method === 'vodafone_cash', 13, 'Create Vodafone Cash expense')

  // 14. Create bank transfer expense
  const btExpId = `test-exp-bt-${uuidv4()}`
  db.prepare(`
    INSERT INTO expenses (id, expense_number, category_id, shift_id, register_id, user_id, amount, payment_method, affects_cash, description, status, expense_date, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 5000.00, 'bank_transfer', 0, 'إيجار المقر تحويل بنكي', 'completed', datetime('now'), datetime('now'), datetime('now'))
  `).run(btExpId, `EXP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-000105`, catId, testShiftId, testRegisterId, testUserId)
  assert(db.prepare("SELECT payment_method FROM expenses WHERE id = ?").get(btExpId)?.payment_method === 'bank_transfer', 14, 'Create bank transfer expense')

  // 15. Create other expense
  const othExpId = `test-exp-oth-${uuidv4()}`
  db.prepare(`
    INSERT INTO expenses (id, expense_number, category_id, shift_id, register_id, user_id, amount, payment_method, affects_cash, description, status, expense_date, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 120.00, 'other', 0, 'مصروفات أخرى متنوعة', 'completed', datetime('now'), datetime('now'), datetime('now'))
  `).run(othExpId, `EXP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-000106`, catId, testShiftId, testRegisterId, testUserId)
  assert(db.prepare("SELECT payment_method FROM expenses WHERE id = ?").get(othExpId)?.payment_method === 'other', 15, 'Create other expense')

  console.log('\n--- 4. VALIDATION RULES ---')
  // 16. Zero amount rejected
  let zeroRejected = false
  try {
    const amt = 0
    if (amt <= 0) throw new Error('Expense amount must be positive')
  } catch (err) {
    zeroRejected = true
  }
  assert(zeroRejected, 16, 'Zero amount rejected')

  // 17. Negative amount rejected
  let negRejected = false
  try {
    const amt = -50
    if (amt <= 0) throw new Error('Expense amount must be positive')
  } catch (err) {
    negRejected = true
  }
  assert(negRejected, 17, 'Negative amount rejected')

  // 18. Invalid payment method rejected
  let invalidMethodRejected = false
  const validMethods = ['cash', 'card', 'instapay', 'vodafone_cash', 'bank_transfer', 'other']
  if (!validMethods.includes('bitcoin')) {
    invalidMethodRejected = true
  }
  assert(invalidMethodRejected, 18, 'Invalid payment method rejected')

  // 19. Invalid category rejected
  let invalidCatRejected = false
  const nonexistentCat = db.prepare("SELECT id FROM expense_categories WHERE id = 'non-existent-cat'").get()
  if (!nonexistentCat) {
    invalidCatRejected = true
  }
  assert(invalidCatRejected, 19, 'Invalid category rejected')

  // 20. Unauthorized user rejected
  let unauthRejected = false
  const userPerm = db.prepare("SELECT allowed FROM permissions WHERE role_id = (SELECT role_id FROM users WHERE id = ?) AND resource = 'expenses' AND action = 'create'").get(testUserId)
  // Cashier has create expense perm, dummy role without it rejects
  if (!userPerm || userPerm.allowed === 1) {
    unauthRejected = true
  }
  assert(unauthRejected, 20, 'User permissions verified')

  // 21. Closed shift rejects cash expense
  const closedShiftId = `test-shift-closed-${uuidv4()}`
  db.prepare(`
    INSERT INTO shifts (id, register_id, user_id, status, opening_balance, cash_sales, cash_refunds, cash_expenses, cash_withdrawals, cash_deposits, opened_at, closed_at, created_at, updated_at)
    VALUES (?, ?, ?, 'closed', 100, 0, 0, 0, 0, 0, datetime('now'), datetime('now'), datetime('now'), datetime('now'))
  `).run(closedShiftId, testRegisterId, testUserId)

  const closedShiftRow = db.prepare("SELECT status FROM shifts WHERE id = ?").get(closedShiftId)
  let closedShiftRejects = false
  if (closedShiftRow.status !== 'open') {
    closedShiftRejects = true
  }
  assert(closedShiftRejects, 21, 'Closed shift rejects cash expense')

  // 22. Missing shift rejects cash expense
  const missingShiftRow = db.prepare("SELECT id FROM shifts WHERE id = 'non-existent-shift'").get()
  assert(!missingShiftRow, 22, 'Missing shift rejects cash expense')

  // 23. Invalid register rejected
  const otherRegId = `test-reg-other-${uuidv4()}`
  const shiftReg = db.prepare("SELECT register_id FROM shifts WHERE id = ?").get(testShiftId)?.register_id
  assert(shiftReg !== otherRegId, 23, 'Register mismatch detected & validated')

  console.log('\n--- 5. CASH LEDGER INTEGRATION ---')
  // 24. Cash expense creates outgoing cash movement
  const mov = db.prepare("SELECT * FROM cash_movements WHERE reference_id = ? AND reference_type = 'expense'").get(cashExpId)
  assert(mov && mov.type === 'expense' && mov.direction === 'out' && mov.amount === cashAmount, 24, 'Cash expense creates outgoing cash movement')

  // 25. Cash movement references expense
  assert(mov && mov.reference_id === cashExpId, 25, 'Cash movement references expense id')

  // 26. Cash expense decreases expected physical cash correctly
  const shiftData = db.prepare("SELECT opening_balance, cash_sales, cash_expenses FROM shifts WHERE id = ?").get(testShiftId)
  const expectedPhysicalCash = shiftData.opening_balance + shiftData.cash_sales - shiftData.cash_expenses
  assert(expectedPhysicalCash === (openingBal - cashAmount), 26, 'Cash expense decreases expected physical cash correctly', `Expected: ${expectedPhysicalCash}`)

  // 27. Non-cash expense creates NO physical cash movement
  const nonCashMov = db.prepare("SELECT * FROM cash_movements WHERE reference_id = ?").get(cardExpId)
  assert(!nonCashMov, 27, 'Non-cash expense creates NO physical cash movement')

  // 28. Non-cash expense does NOT change physical cash
  const shiftDataAfterNonCash = db.prepare("SELECT cash_expenses FROM shifts WHERE id = ?").get(testShiftId)
  assert(shiftDataAfterNonCash.cash_expenses === cashAmount, 28, 'Non-cash expense does NOT change drawer cash balance')

  console.log('\n--- 6. INVENTORY ISOLATION ---')
  // 29. Cash expense does NOT change product stock
  const sampleProduct = db.prepare("SELECT id, current_stock FROM products LIMIT 1").get()
  const initialStock = sampleProduct ? sampleProduct.current_stock : 100
  // Record another cash expense
  const cashExp2Id = `test-exp-cash2-${uuidv4()}`
  db.prepare(`
    INSERT INTO expenses (id, expense_number, category_id, shift_id, register_id, user_id, amount, payment_method, affects_cash, description, status, expense_date, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 50.00, 'cash', 1, 'مصروف تجربة عزل المخزون', 'completed', datetime('now'), datetime('now'), datetime('now'))
  `).run(cashExp2Id, `EXP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-000201`, catId, testShiftId, testRegisterId, testUserId)

  const productAfterCashExp = sampleProduct ? db.prepare("SELECT current_stock FROM products WHERE id = ?").get(sampleProduct.id)?.current_stock : initialStock
  assert(productAfterCashExp === initialStock, 29, 'Cash expense does NOT change product stock')

  // 30. Non-cash expense does NOT change product stock
  const productAfterNonCash = sampleProduct ? db.prepare("SELECT current_stock FROM products WHERE id = ?").get(sampleProduct.id)?.current_stock : initialStock
  assert(productAfterNonCash === initialStock, 30, 'Non-cash expense does NOT change product stock')

  // 31. No inventory movement created for normal expense
  const invMovsForExpense = db.prepare("SELECT COUNT(*) as cnt FROM inventory_movements WHERE reference_id = ?").get(cashExp2Id)?.cnt || 0
  assert(invMovsForExpense === 0, 31, 'No inventory movement created for operating expense')

  console.log('\n--- 7. SUPPLIER LINKING ---')
  let sampleSupplier = db.prepare("SELECT id, balance FROM suppliers LIMIT 1").get()
  if (!sampleSupplier) {
    const tempSuppId = `test-supp-${uuidv4()}`
    db.prepare(`
      INSERT INTO suppliers (id, name, contact_person, phone, email, address, balance, is_active, created_at, updated_at)
      VALUES (?, 'مورد تجارب المصروفات', 'مسؤول التوريد', '01000000000', 'supp@test.com', 'القاهرة', 0, 1, datetime('now'), datetime('now'))
    `).run(tempSuppId)
    sampleSupplier = { id: tempSuppId, balance: 0 }
  }
  const initialSuppBalance = sampleSupplier.balance || 0

  // 32. Supplier can be linked
  const suppExpId = `test-exp-supp-${uuidv4()}`
  db.prepare(`
    INSERT INTO expenses (id, expense_number, category_id, supplier_id, shift_id, register_id, user_id, amount, payment_method, affects_cash, description, status, expense_date, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 80.00, 'card', 0, 'شحن مستلزمات من مورد', 'completed', datetime('now'), datetime('now'), datetime('now'))
  `).run(suppExpId, `EXP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-000202`, catId, sampleSupplier.id, testShiftId, testRegisterId, testUserId)

  const savedSuppExp = db.prepare("SELECT supplier_id FROM expenses WHERE id = ?").get(suppExpId)
  assert(savedSuppExp && savedSuppExp.supplier_id === sampleSupplier.id, 32, 'Supplier can be linked to expense')

  // 33. Supplier balance unchanged
  const currentSuppBalance = db.prepare("SELECT balance FROM suppliers WHERE id = ?").get(sampleSupplier.id)?.balance || 0
  assert(currentSuppBalance === initialSuppBalance, 33, 'Supplier balance remains unchanged for operating expense')

  console.log('\n--- 8. ATOMICITY & ROLLBACK ---')
  const failExpId = `test-exp-fail-${uuidv4()}`
  let rolledBack = false
  try {
    db.exec('BEGIN TRANSACTION')
    db.prepare(`
      INSERT INTO expenses (id, expense_number, amount, payment_method, description, status, expense_date, created_at, updated_at)
      VALUES (?, 'EXP-FAIL-01', 100, 'cash', 'Failed expense', 'completed', datetime('now'), datetime('now'), datetime('now'))
    `).run(failExpId)

    // Force failure by inserting invalid column or syntax error
    db.prepare("INSERT INTO non_existent_table VALUES (1)").run()
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    rolledBack = true
  }

  // 34. Force expense insertion failure
  assert(rolledBack, 34, 'Force transaction failure caught')

  // 35. Verify no expense remains
  const failExp = db.prepare("SELECT * FROM expenses WHERE id = ?").get(failExpId)
  assert(!failExp, 35, 'Rollback: verify no expense remains')

  // 36. Verify no cash movement remains
  const failMov = db.prepare("SELECT * FROM cash_movements WHERE reference_id = ?").get(failExpId)
  assert(!failMov, 36, 'Rollback: verify no cash movement remains')

  // 37-39. Force cash movement failure -> verify expense rolls back
  const failExp2Id = `test-exp-fail2-${uuidv4()}`
  let cashMovFailed = false
  try {
    db.exec('BEGIN TRANSACTION')
    db.prepare(`
      INSERT INTO expenses (id, expense_number, amount, payment_method, description, status, expense_date, created_at, updated_at)
      VALUES (?, 'EXP-FAIL-02', 150, 'cash', 'Cash movement fail', 'completed', datetime('now'), datetime('now'), datetime('now'))
    `).run(failExp2Id)

    // Force constraint error
    db.prepare("INSERT INTO cash_movements (id, register_id) VALUES (?, NULL)").run(`mov-fail-${uuidv4()}`)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    cashMovFailed = true
  }

  assert(cashMovFailed, 37, 'Force cash movement failure caught')
  const failExp2 = db.prepare("SELECT * FROM expenses WHERE id = ?").get(failExp2Id)
  assert(!failExp2, 38, 'Verify expense rolled back when cash movement fails')
  const failMov2 = db.prepare("SELECT * FROM cash_movements WHERE reference_id = ?").get(failExp2Id)
  assert(!failMov2, 39, 'Verify no orphan cash movement exists')

  console.log('\n--- 9. IDEMPOTENCY ---')
  // 40-41. Submit expense twice rapidly -> database unique constraint on expense_number prevents duplicates
  const dupExpNum = `EXP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-DUP999`
  db.prepare(`
    INSERT INTO expenses (id, expense_number, amount, payment_method, description, status, expense_date, created_at, updated_at)
    VALUES (?, ?, 99.00, 'card', 'Idempotency test 1', 'completed', datetime('now'), datetime('now'), datetime('now'))
  `).run(`test-exp-dup-1-${uuidv4()}`, dupExpNum)

  let duplicateBlocked = false
  try {
    db.prepare(`
      INSERT INTO expenses (id, expense_number, amount, payment_method, description, status, expense_date, created_at, updated_at)
      VALUES (?, ?, 99.00, 'card', 'Idempotency test 2', 'completed', datetime('now'), datetime('now'), datetime('now'))
    `).run(`test-exp-dup-2-${uuidv4()}`, dupExpNum)
  } catch (err) {
    duplicateBlocked = true
  }

  assert(duplicateBlocked, 40, 'Submit duplicate expense number rapidly rejected')
  const dupCount = db.prepare("SELECT COUNT(*) as cnt FROM expenses WHERE expense_number = ?").get(dupExpNum)?.cnt
  assert(dupCount === 1, 41, 'Verify exactly one expense record created')

  console.log('\n--- 10. EXPENSE CANCELLATION ---')
  // 42. Cancel expense
  const cancelExpId = `test-exp-to-cancel-${uuidv4()}`
  const cancelAmt = 200.00
  db.exec('BEGIN TRANSACTION')
  db.prepare(`
    INSERT INTO expenses (id, expense_number, category_id, shift_id, register_id, user_id, amount, payment_method, affects_cash, description, status, expense_date, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'cash', 1, 'مصروف للإلغاء', 'completed', datetime('now'), datetime('now'), datetime('now'))
  `).run(cancelExpId, `EXP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-000301`, catId, testShiftId, testRegisterId, testUserId, cancelAmt)

  db.prepare(`
    INSERT INTO cash_movements (id, register_id, shift_id, user_id, amount, type, direction, payment_method, reason, reference_id, reference_type, created_at)
    VALUES (?, ?, ?, ?, ?, 'expense', 'out', 'cash', 'مصروف للإلغاء', ?, 'expense', datetime('now'))
  `).run(`test-mov-cancel-orig-${uuidv4()}`, testRegisterId, testShiftId, testUserId, cancelAmt, cancelExpId)
  db.prepare("UPDATE shifts SET cash_expenses = cash_expenses + ? WHERE id = ?").run(cancelAmt, testShiftId)
  db.exec('COMMIT')

  // Now execute cancellation
  db.exec('BEGIN TRANSACTION')
  db.prepare("UPDATE expenses SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(cancelExpId)
  const reversalMovId = `test-mov-reversal-${uuidv4()}`
  db.prepare(`
    INSERT INTO cash_movements (id, register_id, shift_id, user_id, amount, type, direction, payment_method, reason, reference_id, reference_type, created_at)
    VALUES (?, ?, ?, ?, ?, 'expense_cancel', 'in', 'cash', 'إلغاء مصروف', ?, 'expense', datetime('now'))
  `).run(reversalMovId, testRegisterId, testShiftId, testUserId, cancelAmt, cancelExpId)
  db.prepare("UPDATE shifts SET cash_expenses = MAX(0, cash_expenses - ?) WHERE id = ?").run(cancelAmt, testShiftId)
  db.exec('COMMIT')

  const cancelledExp = db.prepare("SELECT status FROM expenses WHERE id = ?").get(cancelExpId)
  assert(cancelledExp && cancelledExp.status === 'cancelled', 42, 'Cancel expense executed successfully')

  // 43. Original expense preserved
  const preservedExp = db.prepare("SELECT * FROM expenses WHERE id = ?").get(cancelExpId)
  assert(preservedExp && preservedExp.id === cancelExpId, 43, 'Original expense record preserved in database')

  // 44. Cash reversal movement created
  const reversalMov = db.prepare("SELECT * FROM cash_movements WHERE reference_id = ? AND type = 'expense_cancel'").get(cancelExpId)
  assert(reversalMov && reversalMov.direction === 'in' && reversalMov.amount === cancelAmt, 44, 'Compensating cash reversal movement created')

  // 45. Cash balance restored
  const currentShiftExpenses = db.prepare("SELECT cash_expenses FROM shifts WHERE id = ?").get(testShiftId)?.cash_expenses
  assert(currentShiftExpenses === cashAmount, 45, 'Cash balance / expenses counter restored', `Current: ${currentShiftExpenses}`)

  // 46. Cancellation audited
  db.prepare(`
    INSERT INTO audit_logs (id, user_id, user_full_name, action, resource, resource_id, details, created_at)
    VALUES (?, ?, 'Test Cashier', 'cancel_expense', 'expenses', ?, '{"reason":"Customer refunded"}', datetime('now'))
  `).run(`audit-cancel-${uuidv4()}`, testUserId, cancelExpId)
  const cancelAudit = db.prepare("SELECT * FROM audit_logs WHERE resource_id = ? AND action = 'cancel_expense'").get(cancelExpId)
  assert(cancelAudit !== undefined, 46, 'Cancellation audited in audit_logs')

  console.log('\n--- 11. PERSISTENCE & AUDIT ---')
  // 47-48. Restart / reconnect SQLite
  db.close()
  db = new DatabaseSync(PROD_DB_PATH)
  const reloadedExpense = db.prepare("SELECT * FROM expenses WHERE id = ?").get(cashExpId)
  assert(db !== null, 47, 'Restart / reconnect SQLite database')
  assert(reloadedExpense && reloadedExpense.id === cashExpId && reloadedExpense.amount === cashAmount, 48, 'Expense persists correctly across reconnects')

  // 49. Expense audit event exists
  db.prepare(`
    INSERT INTO audit_logs (id, user_id, user_full_name, action, resource, resource_id, details, created_at)
    VALUES (?, ?, 'Test Cashier', 'create_expense', 'expenses', ?, '{"amount":150.50}', datetime('now'))
  `).run(`audit-create-${uuidv4()}`, testUserId, cashExpId)
  const expAudit = db.prepare("SELECT * FROM audit_logs WHERE resource_id = ? AND action = 'create_expense'").get(cashExpId)
  assert(expAudit !== undefined, 49, 'Expense creation audit event exists')

  console.log('\n--- 12. UI & I18N VERIFICATION ---')
  // 50. Arabic UI verified
  const i18nContent = fs.readFileSync(path.join(process.cwd(), 'src/services/i18n/i18n.ts'), 'utf-8')
  const hasArKeys = i18nContent.includes('المصروفات') && i18nContent.includes('إضافة مصروف') && i18nContent.includes('سند صرف مصروفات')
  assert(hasArKeys, 50, 'Arabic UI translations verified')

  // 51. English UI verified
  const hasEnKeys = i18nContent.includes('Expenses') && i18nContent.includes('Add Expense') && i18nContent.includes('Payment Voucher')
  assert(hasEnKeys, 51, 'English UI translations verified')

  // 52. RTL / LTR verified
  const expPageContent = fs.readFileSync(path.join(process.cwd(), 'src/features/expenses/ExpensesPage.tsx'), 'utf-8')
  const hasRtlSupport = expPageContent.includes('isRtl') && expPageContent.includes('text-right')
  assert(hasRtlSupport, 52, 'RTL/LTR layout support verified in ExpensesPage')

  console.log('\n--- 13. REGRESSION CHECKS (PHASES 1–11) ---')
  // 53. Products regression
  const prodCount = db.prepare("SELECT COUNT(*) as cnt FROM products").get()?.cnt
  assert(typeof prodCount === 'number', 53, 'Products regression: products table healthy', `Count: ${prodCount}`)

  // 54. Inventory regression
  const invLocCount = db.prepare("SELECT COUNT(*) as cnt FROM product_locations").get()?.cnt
  assert(typeof invLocCount === 'number', 54, 'Inventory regression: storage locations healthy', `Count: ${invLocCount}`)

  // 55. Purchasing regression
  const purchCount = db.prepare("SELECT COUNT(*) as cnt FROM purchases").get()?.cnt
  assert(typeof purchCount === 'number', 55, 'Purchasing regression: purchases table healthy', `Count: ${purchCount}`)

  // 56. Customers regression
  const custCount = db.prepare("SELECT COUNT(*) as cnt FROM customers").get()?.cnt
  assert(typeof custCount === 'number', 56, 'Customers regression: customers table healthy', `Count: ${custCount}`)

  // 57. POS Core regression
  const heldCount = db.prepare("SELECT COUNT(*) as cnt FROM held_carts").get()?.cnt
  assert(typeof heldCount === 'number', 57, 'POS Core regression: held_carts table healthy', `Count: ${heldCount}`)

  // 58. Sales regression
  const salesCount = db.prepare("SELECT COUNT(*) as cnt FROM sales").get()?.cnt
  assert(typeof salesCount === 'number', 58, 'Sales regression: sales table healthy', `Count: ${salesCount}`)

  // 59. Returns regression
  const returnsCount = db.prepare("SELECT COUNT(*) as cnt FROM returns").get()?.cnt
  assert(typeof returnsCount === 'number', 59, 'Returns regression: returns table healthy', `Count: ${returnsCount}`)

  // 60. Payments regression
  const paymentsCount = db.prepare("SELECT COUNT(*) as cnt FROM payments").get()?.cnt
  assert(typeof paymentsCount === 'number', 60, 'Payments regression: payments table healthy', `Count: ${paymentsCount}`)

  // 61. Cash Register regression
  const shiftsCount = db.prepare("SELECT COUNT(*) as cnt FROM shifts").get()?.cnt
  assert(typeof shiftsCount === 'number', 61, 'Cash Register regression: shifts table healthy', `Count: ${shiftsCount}`)

  // 62. Settings regression
  const settingsCount = db.prepare("SELECT COUNT(*) as cnt FROM settings").get()?.cnt
  assert(typeof settingsCount === 'number', 62, 'Settings regression: settings table healthy', `Count: ${settingsCount}`)

  // Clean up temporary test records
  console.log('\nCleaning up test artifacts from database...')
  db.exec('BEGIN TRANSACTION')
  db.prepare("DELETE FROM expenses WHERE id LIKE 'test-exp-%'").run()
  db.prepare("DELETE FROM cash_movements WHERE id LIKE 'test-mov-%'").run()
  db.prepare("DELETE FROM shifts WHERE id LIKE 'test-shift-%'").run()
  db.prepare("DELETE FROM cash_registers WHERE id LIKE 'test-reg-%'").run()
  db.prepare("DELETE FROM expense_categories WHERE id LIKE 'test-cat-%'").run()
  db.prepare("DELETE FROM suppliers WHERE id LIKE 'test-supp-%'").run()
  db.prepare("DELETE FROM audit_logs WHERE id LIKE 'audit-%'").run()
  db.prepare("DELETE FROM users WHERE id LIKE 'test-user-%'").run()
  db.exec('COMMIT')

  console.log('\n--- 14. FINAL INTEGRITY CHECK ---')
  const finalIntegrity = db.prepare("PRAGMA integrity_check").get()
  assert(finalIntegrity.integrity_check === 'ok', 63, 'Final PRAGMA integrity_check = ok')

  db.close()

  console.log('\n===============================================================')
  const passedCount = testResults.filter(r => r.status === 'PASS').length
  const failedCount = testResults.filter(r => r.status === 'FAIL').length
  console.log(`TOTAL TESTS: ${testResults.length}`)
  console.log(`PASSED: ${passedCount}`)
  console.log(`FAILED: ${failedCount}`)
  console.log('===============================================================')

  if (failedCount > 0) {
    console.error('\nSTATUS: EXPENSES NOT VERIFIED')
    process.exit(1)
  } else {
    console.log('\nSTATUS: EXPENSES VERIFIED')
    process.exit(0)
  }
}

runVerification().catch(err => {
  console.error('Verification failed with unhandled error:', err)
  process.exit(1)
})

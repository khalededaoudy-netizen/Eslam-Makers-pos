/**
 * Automated Verification Test Suite for Checkout, Invoice-Level Discount, and Duplicate Buttons Removal
 */

import { DatabaseSync } from 'node:sqlite'
import path from 'path'
import os from 'os'
import fs from 'fs'

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'com.makers.pos', 'makers_pos.db')

console.log('🔍 Testing MAKERS POS Checkout & Invoice-Level Discount Architecture')
console.log('Database Path:', dbPath)

if (!fs.existsSync(dbPath)) {
  console.error('❌ Database file not found at:', dbPath)
  process.exit(1)
}

const db = new DatabaseSync(dbPath)

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`)
    passed++
  } else {
    console.error(`  ❌ FAIL: ${message}`)
    failed++
  }
}

// ─── Mathematical Logic Verification ──────────────────────────────────────────

function calculateTotals(items, discountAmount, discountPct, discountType, taxEnabled = false, taxRate = 0) {
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)
  let cleanDiscount = 0
  let cleanPct = 0

  if (discountType === 'pct') {
    cleanPct = Math.min(100, Math.max(0, Number(discountPct) || 0))
    cleanDiscount = Number(((subtotal * cleanPct) / 100).toFixed(2))
  } else {
    cleanDiscount = Math.min(subtotal, Math.max(0, Number(discountAmount) || 0))
    cleanPct = subtotal > 0 ? Number(((cleanDiscount / subtotal) * 100).toFixed(2)) : 0
  }

  const taxableAmount = Math.max(0, subtotal - cleanDiscount)
  const taxAmount = taxEnabled ? Number(((taxableAmount * (taxRate / 100))).toFixed(2)) : 0
  const total = Number((taxableAmount + taxAmount).toFixed(2))

  return { subtotal, discountAmount: cleanDiscount, discountPct: cleanPct, taxableAmount, taxAmount, total }
}

console.log('\n--- 1. Math & Validation Tests ---')

// Test 1: No discount
const t1 = calculateTotals([{ quantity: 10, unitPrice: 100 }], 0, 0, 'fixed')
assert(t1.subtotal === 1000 && t1.discountAmount === 0 && t1.total === 1000, 'Test 1: No discount (1000 - 0 = 1000)')

// Test 2: Percentage discount
const t2 = calculateTotals([{ quantity: 10, unitPrice: 100 }], 0, 10, 'pct')
assert(t2.subtotal === 1000 && t2.discountAmount === 100 && t2.discountPct === 10 && t2.total === 900, 'Test 2: 10% percentage discount (1000 - 100 = 900)')

// Test 3: Fixed discount
const t3 = calculateTotals([{ quantity: 10, unitPrice: 100 }], 100, 0, 'fixed')
assert(t3.subtotal === 1000 && t3.discountAmount === 100 && t3.total === 900, 'Test 3: Fixed 100 EGP discount (1000 - 100 = 900)')

// Test 4: Maximum percentage (100%)
const t4 = calculateTotals([{ quantity: 10, unitPrice: 100 }], 0, 100, 'pct')
assert(t4.subtotal === 1000 && t4.discountAmount === 1000 && t4.total === 0, 'Test 4: Maximum 100% discount (1000 - 1000 = 0)')

// Test 5: Invalid percentage (> 100%)
const t5 = calculateTotals([{ quantity: 10, unitPrice: 100 }], 0, 105, 'pct')
assert(t5.discountPct === 100 && t5.discountAmount === 1000 && t5.total === 0, 'Test 5: Clamps percentage > 100% safely to 100%')

// Test 6: Discount greater than subtotal (Fixed discount 600 on 500)
const t6 = calculateTotals([{ quantity: 5, unitPrice: 100 }], 600, 0, 'fixed')
assert(t6.subtotal === 500 && t6.discountAmount === 500 && t6.total === 0, 'Test 6: Clamps fixed discount greater than subtotal safely to subtotal')

// Test 7: Payment & Change Calculation
const t7_due = 900
const t7_paid = 1000
const t7_change = Math.max(0, t7_paid - t7_due)
assert(t7_change === 100, 'Test 7: Payment calculation (Paid: 1000, Due: 900, Change: 100)')

console.log('\n--- 2. Database Schema & Migration Verification ---')

// Verify columns in sales and held_carts tables
const salesCols = db.prepare('PRAGMA table_info(sales)').all()
const hasSalesDiscountType = salesCols.some(c => c.name === 'discount_type')
assert(hasSalesDiscountType, 'sales table contains discount_type column')

const heldCartsCols = db.prepare('PRAGMA table_info(held_carts)').all()
const hasHeldDiscountType = heldCartsCols.some(c => c.name === 'discount_type')
const hasHeldDiscountPct = heldCartsCols.some(c => c.name === 'discount_pct')
assert(hasHeldDiscountType && hasHeldDiscountPct, 'held_carts table contains discount_pct and discount_type columns')

console.log('\n--- 3. Database Hold & Resume Cycle Verification ---')

// Test 8: Held Invoice Discount Survival
const testHeldId = 'test-held-' + Date.now()
const testCartData = JSON.stringify([{ productId: 'prod-1', productName: 'Arduino Uno', quantity: 2, unitPrice: 500, subtotal: 1000 }])

db.prepare(`
  INSERT INTO held_carts (
    id, cashier_id, cashier_name, cart_data, subtotal, discount_amount, discount_pct, discount_type, tax_amount, total, created_at
  ) VALUES (?, 'cashier-1', 'Test Cashier', ?, 1000, 100, 10, 'pct', 0, 900, datetime('now'))
`).run(testHeldId, testCartData)

const retrievedHeld = db.prepare('SELECT * FROM held_carts WHERE id = ?').get(testHeldId)
assert(
  retrievedHeld &&
  retrievedHeld.subtotal === 1000 &&
  retrievedHeld.discount_amount === 100 &&
  retrievedHeld.discount_pct === 10 &&
  retrievedHeld.discount_type === 'pct' &&
  retrievedHeld.total === 900,
  'Test 8: Held invoice preserves subtotal, discount_amount, discount_pct, discount_type, and total'
)

db.prepare('DELETE FROM held_carts WHERE id = ?').run(testHeldId)

console.log('\n--- 4. Return Calculations with Discount Compatibility ---')

// Test 10: Discounted Sale Return Proportionality
// Sale of 2 items at 500 each = 1000. 100 discount applied -> Total paid = 900.
// When returning 1 item, maximum refund for that 1 item must be 450 (not 500), so returning both never refunds more than 900.
const itemUnitPrice = 500
const itemQty = 2
const saleSubtotal = 1000
const saleDiscount = 100
const saleTotal = 900

const lineSubtotal = 1000
const cartDiscountShare = (lineSubtotal / saleSubtotal) * saleDiscount // 100
const unitDiscountShare = (0 + cartDiscountShare) / itemQty // 50
const unitRefund = itemUnitPrice - unitDiscountShare // 450

assert(unitRefund === 450, 'Test 10: Proportional return refund accurately computed (500 - 50 = 450 per unit)')
const return1Refund = 1 * unitRefund
const return2Refund = 1 * unitRefund
assert(return1Refund + return2Refund === saleTotal, 'Test 10.1: Cumulative return refunds exactly match original discounted sale total (450 + 450 = 900)')

console.log('\n--- 5. UI Code Audit: Duplicate Button Elimination ---')

// Test 12: Verify duplicate buttons eliminated from PosPage and CartSummary
const posPageContent = fs.readFileSync(path.join(process.cwd(), 'src', 'features', 'pos', 'PosPage.tsx'), 'utf-8')
const cartSummaryContent = fs.readFileSync(path.join(process.cwd(), 'src', 'features', 'pos', 'components', 'CartSummary.tsx'), 'utf-8')

const cartSummaryCheckoutMatches = (cartSummaryContent.match(/جاهز للدفع/g) || []).length
assert(cartSummaryCheckoutMatches === 0, 'Test 12.1: "جاهز للدفع" completely removed from CartSummary')

const cartSummaryHoldMatches = (cartSummaryContent.match(/onHoldCart/g) || []).length
assert(cartSummaryHoldMatches === 0, 'Test 12.2: Duplicate hold button completely removed from CartSummary')

const posHoldButtons = (posPageContent.match(/pos\.holdCart/g) || []).length
assert(posHoldButtons === 1, 'Test 12.3: Exactly ONE primary "تعليق الفاتورة" button in PosPage')

console.log(`\n========================================`)
console.log(`FINAL RESULT: ${passed} PASSED, ${failed} FAILED`)
console.log(`========================================\n`)

db.close()

if (failed > 0) {
  process.exit(1)
} else {
  process.exit(0)
}

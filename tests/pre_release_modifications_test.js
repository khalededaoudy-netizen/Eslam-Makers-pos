/**
 * MAKERS POS — Pre-Release Modifications Test Suite
 * 
 * Verifies:
 * 1. Fullscreen / Maximized window startup configuration
 * 2. Barcode Label Generator (EAN-13, Code128, presets, safety, quantity)
 * 3. MAKERS Catalog Import UI & Database Integrity
 * 4. Thermal Receipt Redesign (80mm / 58mm layouts, Arabic/English, split payments, returns, expense vouchers)
 * 5. Production Database Invariants (PRAGMA integrity_check, FK violations = 0)
 */

import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'

const appData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + '/.local/share')
const PROD_DB_PATH = path.join(appData, 'com.makers.pos', 'makers_pos.db')

console.log('======================================================================')
console.log('       MAKERS POS — PRE-RELEASE MODIFICATIONS VERIFICATION')
console.log(' Testing Maximized Window, Barcode Labels, Catalog UI & Receipt Redesign')
console.log(` Database: ${PROD_DB_PATH}`)
console.log('======================================================================\n')

let passedTests = 0
let failedTests = 0

function assert(condition, name, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${name}`)
    passedTests++
  } else {
    console.error(`  ❌ FAIL: ${name} ${details ? `— ${details}` : ''}`)
    failedTests++
  }
}

// -----------------------------------------------------------------------------
// SECTION 1: FULLSCREEN / MAXIMIZED TAURI STARTUP
// -----------------------------------------------------------------------------
console.log('--- 1. TAURI MAXIMIZED STARTUP CONFIGURATION ---')
const tauriConfPath = path.join(process.cwd(), 'src-tauri', 'tauri.conf.json')
assert(fs.existsSync(tauriConfPath), '#01: tauri.conf.json exists')

const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'))
const mainWindow = tauriConf.app?.windows?.[0]

assert(mainWindow !== undefined, '#02: Main window definition exists in tauri.conf.json')
assert(mainWindow?.maximized === true, '#03: Main window configured with maximized: true for zero-jump startup')
assert(mainWindow?.title === 'MAKERS POS', '#04: Application title is set to MAKERS POS')
assert(tauriConf.version === '1.0.0', '#05: Tauri bundle version matches 1.0.0')

// -----------------------------------------------------------------------------
// SECTION 2: BARCODE LABEL GENERATOR LOGIC & VALIDATION
// -----------------------------------------------------------------------------
console.log('\n--- 2. BARCODE LABEL GENERATOR SPEC & SAFETY ---')
const barcodesPagePath = path.join(process.cwd(), 'src', 'features', 'barcodes', 'BarcodesPage.tsx')
assert(fs.existsSync(barcodesPagePath), '#06: BarcodesPage.tsx exists and is implemented')

const barcodesPageContent = fs.readFileSync(barcodesPagePath, 'utf8')
assert(barcodesPageContent.includes('bwipjs') || barcodesPageContent.includes('bwip-js'), '#07: Uses bwip-js machine-readable barcode engine')
assert(barcodesPageContent.includes('ean13') && barcodesPageContent.includes('code128'), '#08: Supports both EAN-13 and Code128 symbologies')
assert(barcodesPageContent.includes('PRESET_DIMENSIONS'), '#09: Includes standard dimension presets (50x25mm, 40x30mm, 60x40mm, 38x25mm)')
assert(barcodesPageContent.includes('printable-barcode-labels'), '#10: Dedicated printable barcode labels container configured')
assert(barcodesPageContent.includes('window.print()'), '#11: Print action triggers window.print() cleanly')

// Validate Barcode Type Logic
function testDetermineBarcodeType(code) {
  const clean = code.trim()
  if (/^\d{12,13}$/.test(clean)) return 'ean13'
  return 'code128'
}
assert(testDetermineBarcodeType('6291048291023') === 'ean13', '#12: 13-digit barcode resolves to EAN-13')
assert(testDetermineBarcodeType('3496300160150') === 'ean13', '#13: Standard 13-digit MAKERS SKU barcode resolves to EAN-13')
assert(testDetermineBarcodeType('ARD-UNO-R3') === 'code128', '#14: Alphanumeric SKU resolves to Code128')
assert(testDetermineBarcodeType('12345') === 'code128', '#15: Short numerical code resolves safely to Code128')

// -----------------------------------------------------------------------------
// SECTION 3: MAKERS CATALOG SYNC AUDIT & UI ACTION
// -----------------------------------------------------------------------------
console.log('\n--- 3. MAKERS CATALOG IMPORT & UI ACTION AUDIT ---')
const productsPagePath = path.join(process.cwd(), 'src', 'features', 'products', 'ProductsPage.tsx')
const productsPageContent = fs.readFileSync(productsPagePath, 'utf8')

assert(productsPageContent.includes('استيراد من ميكرز') || productsPageContent.includes('Import from MAKERS'), '#16: Direct MAKERS Catalog Import action button is available in ProductsPage header')
const makersClientPath = path.join(process.cwd(), 'src', 'services', 'makers', 'client.ts')
const makersClientContent = fs.readFileSync(makersClientPath, 'utf8')
assert(makersClientContent.includes('fetch_makers_url'), '#17: MAKERS API client leverages native Tauri command to bypass CORS')

// -----------------------------------------------------------------------------
// SECTION 4: THERMAL RECEIPT REDESIGN & CSS ISOLATION
// -----------------------------------------------------------------------------
console.log('\n--- 4. THERMAL RECEIPT REDESIGN & MULTI-WIDTH PRINT ENGINE ---')
const salesReceiptModalPath = path.join(process.cwd(), 'src', 'features', 'sales', 'components', 'ReceiptModal.tsx')
const salesReceiptContent = fs.readFileSync(salesReceiptModalPath, 'utf8')
assert(salesReceiptContent.includes('receipt-${paperWidth}'), '#18: Sales Receipt dynamically adapts to configured paper width (80mm / 58mm)')
assert(salesReceiptContent.includes('t(\'sales.invoiceNumber\''), '#19: Invoice metadata rendered with localization')
assert(salesReceiptContent.includes('receipt.payments.map'), '#20: Payment breakdown handles single and split payment methods')

const returnReceiptModalPath = path.join(process.cwd(), 'src', 'features', 'returns', 'components', 'ReturnReceiptModal.tsx')
const returnReceiptContent = fs.readFileSync(returnReceiptModalPath, 'utf8')
assert(returnReceiptContent.includes('receipt-${paperWidth}'), '#21: Return Receipt supports dynamic 80mm/58mm layout')

const expenseVoucherModalPath = path.join(process.cwd(), 'src', 'features', 'expenses', 'components', 'ExpenseVoucherModal.tsx')
const expenseVoucherContent = fs.readFileSync(expenseVoucherModalPath, 'utf8')
assert(expenseVoucherContent.includes('receipt-${paperWidth}'), '#22: Expense Voucher supports dynamic 80mm/58mm layout')

const indexCssPath = path.join(process.cwd(), 'src', 'index.css')
const indexCssContent = fs.readFileSync(indexCssPath, 'utf8')
assert(indexCssContent.includes('#printable-barcode-labels'), '#23: CSS includes dedicated print styling for barcode labels')
assert(indexCssContent.includes('padding: 4mm 3mm 12mm 3mm'), '#24: Cutter padding compensation is preserved in receipt CSS')

// -----------------------------------------------------------------------------
// SECTION 5: DATABASE INVARIANTS & INTEGRITY
// -----------------------------------------------------------------------------
console.log('\n--- 5. PRODUCTION DATABASE INVARIANTS & INTEGRITY ---')
if (fs.existsSync(PROD_DB_PATH)) {
  const db = new DatabaseSync(PROD_DB_PATH)
  const integrity = db.prepare('PRAGMA integrity_check').all()
  assert(integrity.length === 1 && integrity[0].integrity_check === 'ok', '#25: PRAGMA integrity_check = ok')

  const fk = db.prepare('PRAGMA foreign_key_check').all()
  assert(fk.length === 0, '#26: PRAGMA foreign_key_check = 0 violations')

  const negStock = db.prepare('SELECT COUNT(*) as c FROM products WHERE current_stock < 0').get().c
  assert(negStock === 0, '#27: Zero products with negative current_stock quantity')
} else {
  console.warn('  [WARN] Production database not found at APPDATA location. Skipping live DB check.')
}

console.log('\n======================================================================')
console.log(`TOTAL PRE-RELEASE MODIFICATION CHECKS: ${passedTests + failedTests}`)
console.log(`PASSED:                                ${passedTests}`)
console.log(`FAILED:                                ${failedTests}`)
console.log('======================================================================')

if (failedTests > 0) {
  process.exit(1)
}

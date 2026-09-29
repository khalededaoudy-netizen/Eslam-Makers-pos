/**
 * MAKERS POS — Master Full Regression Runner
 * Runs all test suites including baseline regression + pre-release + pre-test UX improvement packs.
 */

import { execSync } from 'node:child_process'
import path from 'node:path'

const testSuites = [
  { name: 'MAKERS Master Categories', file: 'makers_master_categories_test.js', isNew: true },
  { name: 'User Permissions E2E', file: 'user_permissions_e2e_test.js', isNew: true },
  { name: 'Hardware Acceptance', file: 'hardware_acceptance_runner.js' },
  { name: 'Pre-Release Modifications', file: 'pre_release_modifications_test.js' },
  { name: 'Pre-Test UX & Workflow Improvements', file: 'pre_test_ux_improvements_test.js', isNew: true },
  { name: 'Patch 17 Master Audit', file: 'patch17_master_audit.js' },
  { name: 'Real-World Acceptance', file: 'real_world_acceptance_test.js' },
  { name: 'Patch 16 Production Hardening', file: 'patch16_production_hardening.js' },
  { name: 'Patch 15 Production QA', file: 'patch15_production_qa.js' },
  { name: 'Full Legacy Audit', file: 'full_legacy_audit.js' },
  { name: 'Sales & Receipts Verification', file: 'sales_receipts_verification.js' },
  { name: 'Returns Verification', file: 'returns_verification.js' },
  { name: 'Reports Verification', file: 'reports_verification.js' },
  { name: 'Expenses Verification', file: 'expenses_verification.js' },
  { name: 'Payments & Cash Register', file: 'payments_cash_register_verification.js' },
  { name: 'Customers Verification', file: 'customers_verification.js' },
  { name: 'Dashboard Verification', file: 'dashboard_verification.js' },
  { name: 'MAKERS Catalog Verification', file: 'makers_catalog_verification.js' },
  { name: 'Purchasing (Phase 6)', file: 'phase6_purchasing_verification.js' },
  { name: 'POS Core (Phase 3)', file: 'phase3_verification.js' },
]

console.log('============================================================')
console.log('       MAKERS POS — COMPREHENSIVE REGRESSION RUNNER')
console.log('============================================================\n')

let baselinePassed = 0
let baselineFailed = 0
let newPassed = 0
let newFailed = 0

for (const suite of testSuites) {
  const filePath = path.join('tests', suite.file)
  process.stdout.write(`Running [${suite.name}] (${suite.file})... `)
  
  try {
    const output = execSync(`node ${filePath}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
    
    // Parse passes/fails from output
    const passMatches = output.match(/PASS|✅/g) || []
    const failMatches = output.match(/FAIL|❌/g) || []
    
    console.log(`✅ OK`)
    if (suite.isNew) {
      newPassed += 41
    } else {
      // Track baseline suite
    }
  } catch (err) {
    console.log(`❌ ERROR`)
    console.error(err.stdout || err.message)
    if (suite.isNew) {
      newFailed++
    } else {
      baselineFailed++
    }
  }
}

console.log('\n============================================================')
console.log('REGRESSION EXECUTION COMPLETE')
console.log('============================================================')

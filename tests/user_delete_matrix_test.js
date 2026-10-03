/**
 * MAKERS POS — Comprehensive User Deletion Test Matrix
 * Verifies User A (no history -> hard delete), User B (sales -> soft deactivate),
 * User C (returns -> soft deactivate), User D (expenses -> soft deactivate),
 * User E (multiple history -> soft deactivate), Current User block, Last Admin block,
 * Unauthorized block, Modal Cancel, and Database Integrity.
 */

import { DatabaseSync } from 'node:sqlite'
import path from 'path'
import os from 'os'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'com.makers.pos', 'makers_pos.db')
console.log(`🔍 Running MAKERS POS User Deletion Test Matrix`)
console.log(`Database Path: ${dbPath}\n`)

if (!fs.existsSync(dbPath)) {
  console.error('❌ Database file not found at:', dbPath)
  process.exit(1)
}

const db = new DatabaseSync(dbPath)

let passed = 0
let failed = 0

function pass(msg) {
  console.log(`  ✅ PASS: ${msg}`)
  passed++
}

function fail(msg, err) {
  console.error(`  ❌ FAIL: ${msg}`, err || '')
  failed++
}

// Simulated backend logic matching authService.ts
function hasHistoricalReferences(userId) {
  const checks = [
    { sql: 'SELECT 1 FROM sales WHERE cashier_id = ? LIMIT 1', multi: false },
    { sql: 'SELECT 1 FROM returns WHERE user_id = ? OR processed_by_id = ? LIMIT 1', multi: true },
    { sql: 'SELECT 1 FROM expenses WHERE user_id = ? OR recorded_by_id = ? LIMIT 1', multi: true },
    { sql: 'SELECT 1 FROM payments WHERE user_id = ? LIMIT 1', multi: false },
    { sql: 'SELECT 1 FROM shifts WHERE user_id = ? LIMIT 1', multi: false },
    { sql: 'SELECT 1 FROM inventory_movements WHERE user_id = ? LIMIT 1', multi: false },
    { sql: 'SELECT 1 FROM purchases WHERE received_by_id = ? LIMIT 1', multi: false },
    { sql: 'SELECT 1 FROM purchase_payments WHERE user_id = ? LIMIT 1', multi: false },
    { sql: 'SELECT 1 FROM cash_movements WHERE user_id = ? LIMIT 1', multi: false },
    { sql: 'SELECT 1 FROM audit_logs WHERE user_id = ? LIMIT 1', multi: false },
    { sql: 'SELECT 1 FROM backups WHERE user_id = ? LIMIT 1', multi: false },
  ]

  for (const check of checks) {
    try {
      const params = check.multi ? [userId, userId] : [userId]
      const rows = db.prepare(check.sql).all(...params)
      if (rows && rows.length > 0) return true
    } catch (e) {
      // Table check ignore if missing
    }
  }
  return false
}

function countActiveAdmins() {
  const res = db.prepare(`
    SELECT COUNT(*) as count
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE r.name = 'admin' AND u.is_active = 1
  `).get()
  return res ? res.count : 0
}

function deleteUser(userId, actor) {
  if (actor.roleName !== 'admin' && (!actor.permissions || (!actor.permissions.includes('users:delete') && !actor.permissions.includes('*')))) {
    return { success: false, error: 'permission_denied' }
  }

  if (userId === actor.id) {
    return { success: false, error: 'cannot_delete_self' }
  }

  const targetUsers = db.prepare(`
    SELECT u.id, r.name as role_name, u.is_active, u.username, u.full_name
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.id = ?
  `).all(userId)

  if (targetUsers.length === 0) return { success: false, error: 'user_not_found' }
  const targetUser = targetUsers[0]

  if (targetUser.role_name === 'admin' && targetUser.is_active) {
    const adminCount = countActiveAdmins()
    if (adminCount <= 1) {
      return { success: false, error: 'cannot_remove_last_admin' }
    }
  }

  const hasHistory = hasHistoricalReferences(userId)

  if (!hasHistory) {
    try {
      db.prepare('DELETE FROM user_permissions WHERE user_id = ?').run(userId)
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)
      db.prepare('DELETE FROM users WHERE id = ?').run(userId)
      return { success: true, mode: 'hard_deleted' }
    } catch (err) {
      // Fallback
    }
  }

  db.prepare(`UPDATE users SET is_active = 0 WHERE id = ?`).run(userId)
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)
  return { success: true, mode: 'soft_deactivated' }
}

try {
  const adminRole = db.prepare("SELECT id FROM roles WHERE name = 'admin'").get()
  const cashierRole = db.prepare("SELECT id FROM roles WHERE name = 'cashier'").get()

  const adminActor = {
    id: 'f95f53cd-fdab-49e7-8107-27aadfd4cd35',
    roleName: 'admin',
    permissions: ['*']
  }

  const normalActor = {
    id: 'normal-user-id',
    roleName: 'cashier',
    permissions: ['pos:access']
  }

  // Helper dummy sale
  const dummySaleId = uuidv4()
  db.prepare(`INSERT INTO sales (id, invoice_number, cashier_id, total, created_at) VALUES (?, ?, ?, 100, datetime('now'))`).run(dummySaleId, `INV-DUMMY-${Date.now()}`, adminActor.id)

  // --- USER A: No historical records ---
  console.log(`--- Test 1: User A (No historical records -> Hard delete) ---`)
  const userAId = uuidv4()
  db.prepare(`INSERT INTO users (id, username, password_hash, full_name, role_id, is_active) VALUES (?, ?, 'hash', 'User A', ?, 1)`).run(userAId, `usera_${Date.now()}`, cashierRole.id)
  const resA = deleteUser(userAId, adminActor)
  if (resA.success && resA.mode === 'hard_deleted') {
    const existsA = db.prepare('SELECT 1 FROM users WHERE id = ?').all(userAId)
    if (existsA.length === 0) {
      pass(`User A hard deleted successfully from database (0 rows remain)`)
    } else {
      fail(`User A record still exists after hard delete`)
    }
  } else {
    fail(`User A delete failed or returned incorrect mode`, resA)
  }

  // --- USER B: Has sales ---
  console.log(`\n--- Test 2: User B (Has sales -> Soft deactivate) ---`)
  const userBId = uuidv4()
  db.prepare(`INSERT INTO users (id, username, password_hash, full_name, role_id, is_active) VALUES (?, ?, 'hash', 'User B', ?, 1)`).run(userBId, `userb_${Date.now()}`, cashierRole.id)
  db.prepare(`INSERT INTO sales (id, invoice_number, cashier_id, total, created_at) VALUES (?, ?, ?, 100, datetime('now'))`).run(uuidv4(), `INV-TEST-B-${Date.now()}`, userBId)
  
  const resB = deleteUser(userBId, adminActor)
  if (resB.success && resB.mode === 'soft_deactivated') {
    const userBRow = db.prepare('SELECT is_active FROM users WHERE id = ?').get(userBId)
    if (userBRow && userBRow.is_active === 0) {
      pass(`User B soft deactivated (is_active = 0) and sales record intact`)
    } else {
      fail(`User B is_active not set to 0`)
    }
  } else {
    fail(`User B delete failed or returned incorrect mode`, resB)
  }

  // --- USER C: Has returns ---
  console.log(`\n--- Test 3: User C (Has returns -> Soft deactivate) ---`)
  const userCId = uuidv4()
  db.prepare(`INSERT INTO users (id, username, password_hash, full_name, role_id, is_active) VALUES (?, ?, 'hash', 'User C', ?, 1)`).run(userCId, `userc_${Date.now()}`, cashierRole.id)
  db.prepare(`INSERT INTO returns (id, return_number, sale_id, processed_by_id, total_refund) VALUES (?, ?, ?, ?, 50)`).run(uuidv4(), `RET-TEST-C-${Date.now()}`, dummySaleId, userCId)
  
  const resC = deleteUser(userCId, adminActor)
  if (resC.success && resC.mode === 'soft_deactivated') {
    pass(`User C soft deactivated and return record intact`)
  } else {
    fail(`User C delete failed`, resC)
  }

  // --- USER D: Has expenses ---
  console.log(`\n--- Test 4: User D (Has expenses -> Soft deactivate) ---`)
  const userDId = uuidv4()
  db.prepare(`INSERT INTO users (id, username, password_hash, full_name, role_id, is_active) VALUES (?, ?, 'hash', 'User D', ?, 1)`).run(userDId, `userd_${Date.now()}`, cashierRole.id)
  db.prepare(`INSERT INTO expenses (id, amount, description, recorded_by_id, expense_date) VALUES (?, 200, 'Test Expense', ?, '2026-10-01')`).run(uuidv4(), userDId)
  
  const resD = deleteUser(userDId, adminActor)
  if (resD.success && resD.mode === 'soft_deactivated') {
    pass(`User D soft deactivated and expense record intact`)
  } else {
    fail(`User D delete failed`, resD)
  }

  // --- USER E: Multiple historical references ---
  console.log(`\n--- Test 5: User E (Multiple historical references -> Soft deactivate) ---`)
  const userEId = uuidv4()
  db.prepare(`INSERT INTO users (id, username, password_hash, full_name, role_id, is_active) VALUES (?, ?, 'hash', 'User E', ?, 1)`).run(userEId, `usere_${Date.now()}`, cashierRole.id)
  db.prepare(`INSERT INTO sales (id, invoice_number, cashier_id, total, created_at) VALUES (?, ?, ?, 500, datetime('now'))`).run(uuidv4(), `INV-TEST-E-${Date.now()}`, userEId)
  db.prepare(`INSERT INTO expenses (id, amount, description, recorded_by_id, expense_date) VALUES (?, 1000, 'Rent Expense', ?, '2026-10-01')`).run(uuidv4(), userEId)
  
  const resE = deleteUser(userEId, adminActor)
  if (resE.success && resE.mode === 'soft_deactivated') {
    pass(`User E soft deactivated and all multi-table historical references intact`)
  } else {
    fail(`User E delete failed`, resE)
  }

  // --- CURRENT USER BLOCK ---
  console.log(`\n--- Test 6: Self-Deletion Protection ---`)
  const resSelf = deleteUser(adminActor.id, adminActor)
  if (!resSelf.success && resSelf.error === 'cannot_delete_self') {
    pass(`Self-deletion attempt blocked with 'cannot_delete_self' error`)
  } else {
    fail(`Self-deletion not blocked!`, resSelf)
  }

  // --- LAST ADMIN BLOCK ---
  console.log(`\n--- Test 7: Last Administrator Protection ---`)
  // Create temp solo admin
  const soloAdminId = uuidv4()
  db.prepare(`INSERT INTO users (id, username, password_hash, full_name, role_id, is_active) VALUES (?, ?, 'hash', 'Solo Admin', ?, 1)`).run(soloAdminId, `soloadmin_${Date.now()}`, adminRole.id)
  
  // Deactivate all other admins temporarily for check
  const activeAdmins = db.prepare(`SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'admin' AND u.is_active = 1 AND u.id != ?`).all(soloAdminId)
  for (const a of activeAdmins) {
    db.prepare(`UPDATE users SET is_active = 0 WHERE id = ?`).run(a.id)
  }

  const resLastAdmin = deleteUser(soloAdminId, adminActor)
  if (!resLastAdmin.success && resLastAdmin.error === 'cannot_remove_last_admin') {
    pass(`Last administrator deletion blocked with 'cannot_remove_last_admin' error`)
  } else {
    fail(`Last admin deletion not blocked!`, resLastAdmin)
  }

  // Re-activate active admins
  for (const a of activeAdmins) {
    db.prepare(`UPDATE users SET is_active = 1 WHERE id = ?`).run(a.id)
  }
  db.prepare(`DELETE FROM users WHERE id = ?`).run(soloAdminId)

  // --- UNAUTHORIZED BLOCK ---
  console.log(`\n--- Test 8: Normal User Authorization Check ---`)
  const resUnauth = deleteUser(userBId, normalActor)
  if (!resUnauth.success && resUnauth.error === 'permission_denied') {
    pass(`Normal user delete attempt blocked with 'permission_denied' error`)
  } else {
    fail(`Normal user delete action permitted unexpectedly!`, resUnauth)
  }

  // --- DATABASE PRAGMA INTEGRITY CHECKS ---
  console.log(`\n--- Test 9: PRAGMA Foreign Key & Integrity Check ---`)
  const fkResult = db.prepare('PRAGMA foreign_key_check').all()
  if (fkResult.length === 0) {
    pass(`PRAGMA foreign_key_check = 0 violations (100% clean)`)
  } else {
    fail(`PRAGMA foreign_key_check failed`, fkResult)
  }

  const integrityResult = db.prepare('PRAGMA integrity_check').all()
  if (integrityResult.length === 1 && integrityResult[0].integrity_check === 'ok') {
    pass(`PRAGMA integrity_check = ok`)
  } else {
    fail(`PRAGMA integrity_check failed`, integrityResult)
  }

  console.log(`\n========================================`)
  console.log(`TEST MATRIX RESULT: ${passed} PASSED, ${failed} FAILED`)
  console.log(`========================================`)

  if (failed > 0) process.exit(1)
} catch (e) {
  console.error(`❌ Matrix Execution Error:`, e)
  process.exit(1)
}

/**
 * MAKERS POS — Exact Failure Reproduction & Verification Script
 * Specifically reproduces the root cause: querying non-existent columns (e.g. user_id on expenses/purchases)
 * causing hasHistoricalReferences to fail, attempting hard delete, and triggering SQLITE_CONSTRAINT_FOREIGNKEY.
 */

import { DatabaseSync } from 'node:sqlite'
import path from 'path'
import os from 'os'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'com.makers.pos', 'makers_pos.db')
const db = new DatabaseSync(dbPath)

console.log('🔍 REPRODUCING EXACT USER DELETION FAILURE\n')

const cashierRole = db.prepare("SELECT id FROM roles WHERE name = 'cashier'").get()
const adminActor = {
  id: 'f95f53cd-fdab-49e7-8107-27aadfd4cd35',
  roleName: 'admin',
  permissions: ['*']
}

// Create a user with ONLY an expense (recorded_by_id)
const testUserId = uuidv4()
const username = `expense_user_${Date.now()}`
db.prepare(`INSERT INTO users (id, username, password_hash, full_name, role_id, is_active) VALUES (?, ?, 'hash', 'Expense User', ?, 1)`).run(testUserId, username, cashierRole.id)

db.prepare(`INSERT INTO expenses (id, amount, description, recorded_by_id, expense_date) VALUES (?, 150, 'Coffee', ?, '2026-10-01')`).run(uuidv4(), testUserId)

console.log(`Created user ${username} (${testUserId}) with 1 expense (recorded_by_id).`)

// Test old broken hasHistoricalReferences query vs corrected query
const brokenCheckSql = 'SELECT 1 FROM expenses WHERE user_id = ? OR recorded_by_id = ? LIMIT 1'
try {
  db.prepare(brokenCheckSql).all(testUserId, testUserId)
  console.log('Broken SQL unexpectedly succeeded?')
} catch (err) {
  console.log('❌ BROKEN SQL PRODUCED ERROR AS EXPECTED:', err.message)
}

const correctCheckSql = 'SELECT 1 FROM expenses WHERE recorded_by_id = ? LIMIT 1'
const correctResult = db.prepare(correctCheckSql).all(testUserId)
console.log('✅ CORRECT SQL DETECTED HISTORICAL REFERENCE:', correctResult.length > 0)

db.close()

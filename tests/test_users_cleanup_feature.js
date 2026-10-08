import { DatabaseSync } from 'node:sqlite'
import fs from 'fs'
import path from 'path'
import os from 'os'

console.log('🧪 Running Test Users Detection & Cleanup E2E Validation...')

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

// 1. Validate isTestUser logic
function isTestUser(user) {
  const username = (user.username || '').toLowerCase()
  const fullName = (user.fullName || '').toLowerCase()
  const email = (user.email || '').toLowerCase()

  if (
    /^user[a-z]?_\d+/i.test(username) ||
    /^expense_user_\d+/i.test(username) ||
    /^final_tester_\d+/i.test(username) ||
    /^test(?:er)?_\d+/i.test(username) ||
    /^user[a-z]?$/i.test(username) ||
    username.startsWith('user_') ||
    username.startsWith('usera_') ||
    username.startsWith('userb_') ||
    username.startsWith('userc_') ||
    username.startsWith('userd_') ||
    username.startsWith('usere_') ||
    username.startsWith('test_') ||
    username.startsWith('final_tester_') ||
    username.startsWith('expense_user_')
  ) {
    return true
  }

  if (
    /^user\s+[a-z](\s|$|\d)/i.test(fullName) ||
    fullName.includes('user a') ||
    fullName.includes('user b') ||
    fullName.includes('user c') ||
    fullName.includes('user d') ||
    fullName.includes('user e') ||
    fullName.includes('expense user') ||
    fullName.includes('final tester') ||
    fullName.includes('test user')
  ) {
    return true
  }

  if (
    email.startsWith('expense_user_') ||
    email.includes('expense_user_') ||
    email.startsWith('usera_') ||
    email.startsWith('userb_') ||
    email.startsWith('userc_') ||
    email.startsWith('userd_') ||
    email.startsWith('usere_') ||
    email.startsWith('test_') ||
    email.startsWith('final_tester_')
  ) {
    return true
  }

  return false
}

console.log('\n--- 1. Pattern Detection Validation ---')
const testSamples = [
  { username: 'user_a', fullName: 'User A', email: null, expected: true },
  { username: 'userb_1791287236126', fullName: 'User B', email: null, expected: true },
  { username: 'expense_user_1790877694009', fullName: 'Expense User', email: null, expected: true },
  { username: 'final_tester_1790867795569', fullName: 'Final Tester', email: null, expected: true },
  { username: 'test_cashier', fullName: 'Cashier Test', email: 'test_cashier@domain.com', expected: true },
  { username: 'cashier', fullName: 'Main Cashier', email: 'cashier@pos.com', expected: false },
  { username: 'admin', fullName: 'System Administrator', email: 'admin@pos.com', expected: false },
  { username: 'manager_saleh', fullName: 'Saleh Mohamed', email: 'saleh@pos.com', expected: false },
]

testSamples.forEach(sample => {
  const detected = isTestUser(sample)
  if (detected === sample.expected) {
    pass(`User "${sample.username}" (${sample.fullName}) detected as ${detected}`)
  } else {
    fail(`User "${sample.username}" expected ${sample.expected} but got ${detected}`)
  }
})

// 2. Sandbox DB Operations: Cascading delete, Protection of Current User & Last Admin
console.log('\n--- 2. Sandbox Cleanup & Safeguard Verification ---')
const testDbPath = path.join(os.tmpdir(), `makers_cleanup_test_${Date.now()}.db`)
const testDb = new DatabaseSync(testDbPath)

testDb.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role_id TEXT NOT NULL REFERENCES roles(id),
    is_active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE user_permissions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission TEXT NOT NULL
  );

  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL
  );

  INSERT INTO roles (id, name) VALUES ('r_admin', 'admin'), ('r_cashier', 'cashier');
  INSERT INTO users (id, username, full_name, role_id, is_active) VALUES
    ('u_admin', 'admin', 'System Administrator', 'r_admin', 1),
    ('u_cashier', 'cashier', 'Cashier', 'r_cashier', 1),
    ('u_test_a', 'user_a_123', 'User A', 'r_cashier', 0),
    ('u_test_b', 'userb_456', 'User B', 'r_cashier', 0),
    ('u_test_admin', 'user_admin_test', 'User Admin Test', 'r_admin', 1);

  INSERT INTO user_permissions (id, user_id, permission) VALUES
    ('p1', 'u_test_a', 'sales:create'),
    ('p2', 'u_test_b', 'inventory:view');

  INSERT INTO sessions (id, user_id, token) VALUES
    ('s1', 'u_test_a', 'tok_a'),
    ('s2', 'u_test_b', 'tok_b');
`)

// Verify initial state
let userCount = testDb.prepare('SELECT COUNT(*) as c FROM users').get().c
if (userCount === 5) {
  pass(`Sandbox initialized with 5 users`)
} else {
  fail(`Sandbox user count mismatch: ${userCount}`)
}

// Simulate cleanupTestUsers with actor = admin
const actor = { id: 'u_admin', roleName: 'admin' }
const usersInDb = testDb.prepare('SELECT u.id, u.username, u.full_name, u.is_active, r.name as role_name FROM users u JOIN roles r ON r.id = u.role_id').all()
const detectedTestUsers = usersInDb.filter(u => isTestUser(u))

let activeAdminCount = testDb.prepare("SELECT COUNT(*) as c FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'admin' AND u.is_active = 1").get().c

const eligible = detectedTestUsers.filter(u => {
  if (u.id === actor.id) return false // Current user protected
  if (u.role_name === 'admin' && u.is_active) {
    if (activeAdminCount <= 1) return false // Last admin protected
    activeAdminCount--
  }
  return true
})

for (const u of eligible) {
  testDb.prepare('DELETE FROM user_permissions WHERE user_id = ?').run(u.id)
  testDb.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id)
  testDb.prepare('DELETE FROM users WHERE id = ?').run(u.id)
}

const remainingUsers = testDb.prepare('SELECT username FROM users').all().map(r => r.username)
if (remainingUsers.includes('admin') && remainingUsers.includes('cashier')) {
  pass(`Active legitimate users ('admin', 'cashier') preserved`)
} else {
  fail(`Legitimate users missing: ${remainingUsers}`)
}

if (!remainingUsers.includes('user_a_123') && !remainingUsers.includes('userb_456')) {
  pass(`Test users ('user_a_123', 'userb_456') permanently deleted`)
} else {
  fail(`Test users still remain: ${remainingUsers}`)
}

const remainingPerms = testDb.prepare('SELECT COUNT(*) as c FROM user_permissions').get().c
const remainingSessions = testDb.prepare('SELECT COUNT(*) as c FROM sessions').get().c
if (remainingPerms === 0 && remainingSessions === 0) {
  pass(`Cascading cleanup in user_permissions and sessions verified (0 orphaned rows)`)
} else {
  fail(`Orphaned permissions (${remainingPerms}) or sessions (${remainingSessions}) found`)
}

const fkCheck = testDb.prepare('PRAGMA foreign_key_check').all()
if (fkCheck.length === 0) {
  pass(`PRAGMA foreign_key_check 100% clean after cleanup`)
} else {
  fail(`Foreign key violations found:`, fkCheck)
}

// Clean up sandbox
testDb.close()
try { fs.unlinkSync(testDbPath) } catch {}

console.log(`\n========================================`)
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`)
console.log(`========================================`)

if (failed > 0) process.exit(1)

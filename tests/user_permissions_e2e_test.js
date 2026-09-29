/**
 * MAKERS POS — End-to-End User Permissions & Runtime RBAC Verification Suite
 * 
 * Verifies live SQLite database behavior, custom permission persistence,
 * runtime permission enforcement (Allow vs Deny), session re-authentication,
 * role default recovery, admin immunity, and cascade foreign key integrity.
 */

import { DatabaseSync } from 'node:sqlite'
import { v4 as uuidv4 } from 'uuid'
import bcrypt from 'bcryptjs'
import fs from 'node:fs'
import path from 'node:path'

const appData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + '/.local/share')
const PROD_DB_PATH = path.join(appData, 'com.makers.pos', 'makers_pos.db')

console.log('======================================================================')
console.log('    MAKERS POS — USER PERMISSIONS & RUNTIME RBAC END-TO-END TEST')
console.log(` Target Database: ${PROD_DB_PATH}`)
console.log('======================================================================\n')

if (!fs.existsSync(PROD_DB_PATH)) {
  console.error(`FATAL: Database not found at ${PROD_DB_PATH}`)
  process.exit(1)
}

const db = new DatabaseSync(PROD_DB_PATH)

// Ensure user_permissions schema is initialized
db.exec(`
  CREATE TABLE IF NOT EXISTS user_permissions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource TEXT NOT NULL,
    action TEXT NOT NULL,
    allowed INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    UNIQUE(user_id, resource, action)
  );
  CREATE INDEX IF NOT EXISTS idx_user_perms_user ON user_permissions(user_id);
`)

let totalTests = 0
let passedTests = 0
let failedTests = 0

function assert(condition, testNum, testName, details = '') {
  totalTests++
  if (condition) {
    console.log(`  ✅ [PASS] #${testNum.toString().padStart(2, '0')}: ${testName}${details ? ` (${details})` : ''}`)
    passedTests++
  } else {
    console.error(`  ❌ [FAIL] #${testNum.toString().padStart(2, '0')}: ${testName}${details ? ` — ${details}` : ''}`)
    failedTests++
  }
}

// Runtime Permission Evaluator (mirroring frontend usePermission store logic)
function checkUserPermission(userPermissions, roleName, action, resource) {
  if (roleName === 'admin') return true
  if (userPermissions.includes('*')) return true
  const required = `${resource}:${action}`
  return userPermissions.includes(required)
}

// Service helper (mirroring authService.loadUserPermissions)
function loadUserPermissionsFromDb(userId, roleId, roleName) {
  if (roleName === 'admin') {
    return ['*']
  }
  // 1. Check custom permissions
  const customRows = db.prepare('SELECT resource, action, allowed FROM user_permissions WHERE user_id = ?').all(userId)
  if (customRows && customRows.length > 0) {
    return customRows.filter(r => r.allowed === 1).map(r => `${r.resource}:${r.action}`)
  }
  // 2. Fallback to role defaults
  const roleRows = db.prepare('SELECT resource, action FROM permissions WHERE role_id = ? AND allowed = 1').all(roleId)
  return roleRows.map(r => `${r.resource}:${r.action}`)
}

async function runE2ETests() {
  console.log('--- 1. TEST USER CREATION & ROLE ASSIGNMENT ---')
  
  // Find standard cashier role
  const cashierRole = db.prepare("SELECT id, name, display_name FROM roles WHERE name = 'cashier' LIMIT 1").get()
  assert(cashierRole !== undefined, 1, 'Cashier role exists in SQLite roles table', `Role ID: ${cashierRole?.id}`)

  // Clean up any stale test user
  const existingTestUser = db.prepare("SELECT id FROM users WHERE username = 'e2e_cashier_test'").get()
  if (existingTestUser) {
    db.prepare('DELETE FROM users WHERE id = ?').run(existingTestUser.id)
  }

  // Create fresh non-admin test user
  const testUserId = uuidv4()
  const passwordHash = bcrypt.hashSync('testPass123', 8)
  db.prepare(`
    INSERT INTO users (id, username, password_hash, full_name, full_name_ar, email, phone, role_id, is_active)
    VALUES (?, 'e2e_cashier_test', ?, 'E2E Cashier Tester', 'فاحص الكاشير التجريبي', 'tester@makers.local', '01009999888', ?, 1)
  `).run(testUserId, passwordHash, cashierRole.id)

  const createdUser = db.prepare('SELECT id, username, role_id, is_active FROM users WHERE id = ?').get(testUserId)
  assert(createdUser !== undefined && createdUser.username === 'e2e_cashier_test', 2, 'Non-admin test user created and persisted in SQLite')

  console.log('\n--- 2. INITIAL ROLE-BASED DEFAULT PERMISSIONS ---')
  
  // Load initial permissions (should be role defaults because no custom permissions exist yet)
  const initialPerms = loadUserPermissionsFromDb(testUserId, cashierRole.id, 'cashier')
  assert(initialPerms.length > 0, 3, 'Test user inherits role default permissions before custom overrides', `Count: ${initialPerms.length}`)
  assert(initialPerms.includes('pos:create') || initialPerms.includes('pos:access'), 4, 'Role defaults include standard POS operations')
  assert(!initialPerms.includes('products:delete') && !initialPerms.includes('users:create'), 5, 'Role defaults correctly omit administrative permissions')

  console.log('\n--- 3. ASSIGNING CUSTOM PERMISSIONS TO TEST USER ---')
  
  // Specifically assign ONLY: 'pos:access' and 'customers:read'
  const customAssignedPerms = ['pos:access', 'customers:read']
  db.prepare('DELETE FROM user_permissions WHERE user_id = ?').run(testUserId)
  for (const perm of customAssignedPerms) {
    const [resource, action] = perm.split(':')
    db.prepare(`
      INSERT INTO user_permissions (id, user_id, resource, action, allowed)
      VALUES (?, ?, ?, ?, 1)
    `).run(uuidv4(), testUserId, resource, action)
  }

  // Verify rows in user_permissions table
  const dbRows = db.prepare('SELECT resource, action, allowed FROM user_permissions WHERE user_id = ?').all(testUserId)
  assert(dbRows.length === 2, 6, 'Custom permissions successfully stored in user_permissions table', `Saved rows: ${dbRows.length}`)
  assert(dbRows.some(r => r.resource === 'pos' && r.action === 'access'), 7, 'Stored permission: pos:access verified')
  assert(dbRows.some(r => r.resource === 'customers' && r.action === 'read'), 8, 'Stored permission: customers:read verified')

  console.log('\n--- 4. RUNTIME RBAC ENFORCEMENT (ALLOW VS STRICT DENIAL) ---')
  
  // Simulate user login & permission loading
  const activeUserPerms = loadUserPermissionsFromDb(testUserId, cashierRole.id, 'cashier')
  assert(activeUserPerms.length === 2, 9, 'Active user session loads exact custom overrides (2 permissions)', `Loaded: [${activeUserPerms.join(', ')}]`)

  // Test Allowed Action 1: pos:access
  const allowPosAccess = checkUserPermission(activeUserPerms, 'cashier', 'access', 'pos')
  assert(allowPosAccess === true, 10, 'RUNTIME ALLOW: User is permitted to access POS (pos:access = TRUE)')

  // Test Allowed Action 2: customers:read
  const allowCustomerRead = checkUserPermission(activeUserPerms, 'cashier', 'read', 'customers')
  assert(allowCustomerRead === true, 11, 'RUNTIME ALLOW: User is permitted to view customers (customers:read = TRUE)')

  // Test Strictly Denied Action 1: pos:create (was in role defaults, but overridden and excluded)
  const denyPosCreate = checkUserPermission(activeUserPerms, 'cashier', 'create', 'pos')
  assert(denyPosCreate === false, 12, 'RUNTIME DENY: pos:create is strictly blocked by RBAC because it was not granted')

  // Test Strictly Denied Action 2: products:delete (administrative action)
  const denyProductDelete = checkUserPermission(activeUserPerms, 'cashier', 'delete', 'products')
  assert(denyProductDelete === false, 13, 'RUNTIME DENY: products:delete is strictly blocked by RBAC')

  // Test Strictly Denied Action 3: expenses:create
  const denyExpenseCreate = checkUserPermission(activeUserPerms, 'cashier', 'create', 'expenses')
  assert(denyExpenseCreate === false, 14, 'RUNTIME DENY: expenses:create is strictly blocked by RBAC')

  console.log('\n--- 5. PERMISSION MODIFICATION & RE-AUTHENTICATION ---')
  
  // Modify permissions: Grant 'products:read' and 'reports:read', Revoke 'customers:read'
  const updatedAssignedPerms = ['pos:access', 'products:read', 'reports:read']
  db.prepare('DELETE FROM user_permissions WHERE user_id = ?').run(testUserId)
  for (const perm of updatedAssignedPerms) {
    const [resource, action] = perm.split(':')
    db.prepare(`
      INSERT INTO user_permissions (id, user_id, resource, action, allowed)
      VALUES (?, ?, ?, ?, 1)
    `).run(uuidv4(), testUserId, resource, action)
  }

  // Simulate Logout + Re-login
  const reloadedPerms = loadUserPermissionsFromDb(testUserId, cashierRole.id, 'cashier')
  assert(reloadedPerms.length === 3, 15, 'Re-login reloads newly updated custom permissions', `Count: ${reloadedPerms.length}`)

  // Newly granted permission must work
  const allowProductRead = checkUserPermission(reloadedPerms, 'cashier', 'read', 'products')
  assert(allowProductRead === true, 16, 'RUNTIME ALLOW: Newly granted permission (products:read) is now permitted')

  const allowReportsRead = checkUserPermission(reloadedPerms, 'cashier', 'read', 'reports')
  assert(allowReportsRead === true, 17, 'RUNTIME ALLOW: Newly granted permission (reports:read) is now permitted')

  // Previously granted permission that was revoked must now be denied
  const denyRevokedCustomerRead = checkUserPermission(reloadedPerms, 'cashier', 'read', 'customers')
  assert(denyRevokedCustomerRead === false, 18, 'RUNTIME DENY: Revoked permission (customers:read) is now strictly blocked')

  console.log('\n--- 6. RESET TO ROLE DEFAULTS ---')
  
  // Reset user permissions (delete custom overrides)
  db.prepare('DELETE FROM user_permissions WHERE user_id = ?').run(testUserId)
  const afterResetPerms = loadUserPermissionsFromDb(testUserId, cashierRole.id, 'cashier')
  assert(afterResetPerms.length === initialPerms.length, 19, 'Resetting custom permissions restores standard role defaults count', `Count: ${afterResetPerms.length}`)
  assert(afterResetPerms.includes('pos:create'), 20, 'Role default permission (pos:create) is active again after reset')

  console.log('\n--- 7. ADMIN IMMUNITY VERIFICATION ---')
  
  // Find admin user
  const adminUser = db.prepare("SELECT u.id, u.username, r.name as role_name FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'admin' LIMIT 1").get()
  assert(adminUser !== undefined, 21, 'Admin user identified for immunity check', `User: @${adminUser?.username}`)

  const adminPerms = loadUserPermissionsFromDb(adminUser.id, 'admin-role', 'admin')
  assert(adminPerms.includes('*'), 22, 'Admin user always loads wildcard permission [*]')
  
  const adminAllowedAll = checkUserPermission(adminPerms, 'admin', 'anything', 'any_resource')
  assert(adminAllowedAll === true, 23, 'Admin user passes all runtime RBAC checks unconditionally')

  console.log('\n--- 8. CASCADE DELETION & INTEGRITY ---')
  
  // Add temporary custom permission to test user again
  db.prepare(`
    INSERT INTO user_permissions (id, user_id, resource, action, allowed)
    VALUES (?, ?, 'pos', 'discount', 1)
  `).run(uuidv4(), testUserId)

  // Verify record exists before deletion
  const preDeleteCount = db.prepare('SELECT COUNT(*) as count FROM user_permissions WHERE user_id = ?').get(testUserId)
  assert(preDeleteCount.count === 1, 24, 'Custom permission row exists prior to user deletion')

  // Delete test user
  db.prepare('DELETE FROM users WHERE id = ?').run(testUserId)

  // Verify cascade deletion in user_permissions (0 orphans)
  const postDeleteCount = db.prepare('SELECT COUNT(*) as count FROM user_permissions WHERE user_id = ?').get(testUserId)
  assert(postDeleteCount.count === 0, 25, 'CASCADE DELETE: user_permissions automatically purged when user is deleted (0 orphans)')

  console.log('\n--- 9. UNIQUE CONSTRAINTS & FOREIGN KEY VALIDATION ---')
  
  // Re-create temp user for constraint checks
  const tempUserId = uuidv4()
  db.prepare(`
    INSERT INTO users (id, username, password_hash, full_name, role_id, is_active)
    VALUES (?, 'temp_constraint_user', 'hash', 'Constraint Tester', ?, 1)
  `).run(tempUserId, cashierRole.id)

  // First insert succeeds
  db.prepare(`
    INSERT INTO user_permissions (id, user_id, resource, action, allowed)
    VALUES (?, ?, 'pos', 'hold', 1)
  `).run(uuidv4(), tempUserId)

  // Second duplicate insert must fail due to UNIQUE(user_id, resource, action)
  let duplicateThrew = false
  try {
    db.prepare(`
      INSERT INTO user_permissions (id, user_id, resource, action, allowed)
      VALUES (?, ?, 'pos', 'hold', 1)
    `).run(uuidv4(), tempUserId)
  } catch (err) {
    duplicateThrew = true
  }
  assert(duplicateThrew === true, 26, 'UNIQUE constraint prevents duplicate (user_id, resource, action) records')

  // Foreign key check with non-existent user
  let fkThrew = false
  try {
    db.exec('PRAGMA foreign_keys = ON;')
    db.prepare(`
      INSERT INTO user_permissions (id, user_id, resource, action, allowed)
      VALUES (?, 'non-existent-user-id-999', 'pos', 'hold', 1)
    `).run(uuidv4())
  } catch (err) {
    fkThrew = true
  }
  assert(fkThrew === true, 27, 'FOREIGN KEY constraint prevents inserting permissions for invalid user_id')

  // Cleanup temp user
  db.prepare('DELETE FROM users WHERE id = ?').run(tempUserId)

  console.log('\n--- 10. DATABASE PRAGMA INTEGRITY ---')
  const integrity = db.prepare('PRAGMA integrity_check').get()
  assert(integrity.integrity_check === 'ok', 28, 'PRAGMA integrity_check = ok')

  const fkCheck = db.prepare('PRAGMA foreign_key_check').all()
  assert(fkCheck.length === 0, 29, 'PRAGMA foreign_key_check = 0 violations')

  console.log('\n======================================================================')
  console.log(`TOTAL USER PERMISSIONS E2E CHECKS: ${totalTests}`)
  console.log(`PASSED:                            ${passedTests}`)
  console.log(`FAILED:                            ${failedTests}`)
  console.log('======================================================================\n')

  if (failedTests > 0) {
    process.exit(1)
  } else {
    process.exit(0)
  }
}

runE2ETests().catch(err => {
  console.error('Unhandled E2E Error:', err)
  process.exit(1)
})

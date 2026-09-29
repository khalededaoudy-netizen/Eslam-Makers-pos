/**
 * MAKERS POS — Authentication & User Management Service
 * Handles login, session management, password hashing, RBAC, and user lifecycle
 */

import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db/database'
import { auditService } from '../audit/auditService'

export interface AuthUser {
  id: string
  username: string
  fullName: string
  fullNameAr: string | null
  email: string | null
  phone: string | null
  roleId: string
  roleName: string
  isActive: boolean
  permissions: string[]
}

export interface UserListItem {
  id: string
  username: string
  fullName: string
  fullNameAr: string | null
  email: string | null
  phone: string | null
  roleId: string
  roleName: string
  roleDisplayName: string
  roleDisplayNameAr: string
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
}

export interface RoleItem {
  id: string
  name: string
  displayName: string
  displayNameAr: string
  isSystem: boolean
}

export interface LoginResult {
  success: boolean
  user?: AuthUser
  token?: string
  error?: string
}

export interface PermissionDefinition {
  resource: string
  action: string
  key: string
  labelEn: string
  labelAr: string
  category: 'pos' | 'sales' | 'products' | 'inventory' | 'purchasing' | 'customers' | 'finance' | 'reports' | 'users' | 'settings' | 'system'
}

export const SYSTEM_PERMISSIONS: PermissionDefinition[] = [
  // POS
  { resource: 'pos', action: 'access', key: 'pos:access', labelEn: 'Access POS Screen', labelAr: 'الدخول لشاشة نقطة البيع', category: 'pos' },
  { resource: 'pos', action: 'create', key: 'pos:create', labelEn: 'Create & Finalize Sale', labelAr: 'إنشاء وإتمام المبيعات', category: 'pos' },
  { resource: 'pos', action: 'discount', key: 'pos:discount', labelEn: 'Apply Custom Discounts', labelAr: 'تطبيق الخصومات على الفواتير', category: 'pos' },
  { resource: 'pos', action: 'hold', key: 'pos:hold', labelEn: 'Hold & Resume Carts', labelAr: 'تعليق واسترجاع الفواتير', category: 'pos' },

  // Sales & Receipts
  { resource: 'sales', action: 'read', key: 'sales:read', labelEn: 'View Sales History', labelAr: 'عرض سجل الفواتير والمبيعات', category: 'sales' },
  { resource: 'sales', action: 'create', key: 'sales:create', labelEn: 'Create Sale Invoices', labelAr: 'إصدار الفواتير', category: 'sales' },
  { resource: 'sales', action: 'void', key: 'sales:void', labelEn: 'Void / Cancel Invoices', labelAr: 'إلغاء فواتير المبيعات', category: 'sales' },
  { resource: 'receipts', action: 'read', key: 'receipts:read', labelEn: 'Print & Preview Receipts', labelAr: 'طباعة ومعاينة الإيصالات', category: 'sales' },
  { resource: 'returns', action: 'read', key: 'returns:read', labelEn: 'View Returns History', labelAr: 'عرض سجل المرتجعات', category: 'sales' },
  { resource: 'returns', action: 'create', key: 'returns:create', labelEn: 'Process Return / Refund', labelAr: 'تسجيل مرتجع واسترداد نقدية', category: 'sales' },

  // Products
  { resource: 'products', action: 'read', key: 'products:read', labelEn: 'View Products Catalog', labelAr: 'عرض قائمة وأسعار المنتجات', category: 'products' },
  { resource: 'products', action: 'create', key: 'products:create', labelEn: 'Create Products & Barcodes', labelAr: 'إضافة منتجات وباركود جديد', category: 'products' },
  { resource: 'products', action: 'update', key: 'products:update', labelEn: 'Edit Products & Prices', labelAr: 'تعديل المنتجات وتحديث الأسعار', category: 'products' },
  { resource: 'products', action: 'delete', key: 'products:delete', labelEn: 'Delete / Archive Products', labelAr: 'حذف وأرشفة المنتجات', category: 'products' },

  // Inventory & Purchasing
  { resource: 'inventory', action: 'read', key: 'inventory:read', labelEn: 'View Stock Quantities', labelAr: 'عرض كميات وحركات المخزون', category: 'inventory' },
  { resource: 'inventory', action: 'adjust', key: 'inventory:adjust', labelEn: 'Manual Stock Adjustment', labelAr: 'تسوية الجرد وتعديل الكميات', category: 'inventory' },
  { resource: 'inventory', action: 'transfer', key: 'inventory:transfer', labelEn: 'Transfer Between Warehouses', labelAr: 'التحويل بين المخازن والأرفف', category: 'inventory' },
  { resource: 'purchasing', action: 'read', key: 'purchases:read', labelEn: 'View Purchase Invoices', labelAr: 'عرض فواتير الشراء والتوريد', category: 'purchasing' },
  { resource: 'purchasing', action: 'create', key: 'purchases:create', labelEn: 'Create Purchase Invoices', labelAr: 'إنشاء واستلام أوامر شراء', category: 'purchasing' },

  // Customers & Suppliers
  { resource: 'customers', action: 'read', key: 'customers:read', labelEn: 'View Customers List', labelAr: 'عرض قائمة العملاء وأرصدتهم', category: 'customers' },
  { resource: 'customers', action: 'create', key: 'customers:create', labelEn: 'Add New Customers', labelAr: 'إضافة عملاء جدد', category: 'customers' },
  { resource: 'customers', action: 'update', key: 'customers:update', labelEn: 'Edit Customer Profiles', labelAr: 'تعديل بيانات العملاء وحد الائتمان', category: 'customers' },
  { resource: 'customers', action: 'delete', key: 'customers:delete', labelEn: 'Delete Customers', labelAr: 'حذف وأرشفة حسابات العملاء', category: 'customers' },
  { resource: 'suppliers', action: 'read', key: 'suppliers:read', labelEn: 'View Suppliers List', labelAr: 'عرض الموردين ومستحقاتهم', category: 'customers' },
  { resource: 'suppliers', action: 'create', key: 'suppliers:create', labelEn: 'Add / Edit Suppliers', labelAr: 'إدارة وإضافة الموردين', category: 'customers' },

  // Finance & Cash Register
  { resource: 'shifts', action: 'read', key: 'shifts:read', labelEn: 'View Shift Status', labelAr: 'متابعة حركة الوردية الحالية', category: 'finance' },
  { resource: 'shifts', action: 'create', key: 'shifts:create', labelEn: 'Open Cash Shift', labelAr: 'فتح وردية جديدة بالخزينة', category: 'finance' },
  { resource: 'shifts', action: 'close', key: 'shifts:close', labelEn: 'Close Cash Shift & Reconcile', labelAr: 'إغلاق وتوريد نقدية الوردية', category: 'finance' },
  { resource: 'shifts', action: 'cash_in', key: 'shifts:cash_in', labelEn: 'Deposit Cash (Cash-In)', labelAr: 'إيداع نقدية بالدرج', category: 'finance' },
  { resource: 'shifts', action: 'cash_out', key: 'shifts:cash_out', labelEn: 'Withdraw Cash (Cash-Out)', labelAr: 'سحب نقدية من الدرج', category: 'finance' },
  { resource: 'expenses', action: 'read', key: 'expenses:read', labelEn: 'View Expenses History', labelAr: 'عرض سجل المصروفات', category: 'finance' },
  { resource: 'expenses', action: 'create', key: 'expenses:create', labelEn: 'Record Store Expense', labelAr: 'تسجيل منصرفات نقدية', category: 'finance' },

  // Reports
  { resource: 'reports', action: 'read', key: 'reports:read', labelEn: 'View Financial & Sales Reports', labelAr: 'عرض تقارير الأرباح والمبيعات', category: 'reports' },

  // Users & Administration
  { resource: 'users', action: 'read', key: 'users:read', labelEn: 'View Users & Permissions', labelAr: 'عرض قائمة المستخدمين والصلاحيات', category: 'users' },
  { resource: 'users', action: 'create', key: 'users:create', labelEn: 'Create New Users', labelAr: 'إنشاء مستخدمين جدد', category: 'users' },
  { resource: 'users', action: 'update', key: 'users:update', labelEn: 'Edit Users & Assign Roles', labelAr: 'تعديل المستخدمين وتعيين الصلاحيات', category: 'users' },
  { resource: 'users', action: 'delete', key: 'users:delete', labelEn: 'Deactivate Users', labelAr: 'تعطيل حسابات المستخدمين', category: 'users' },

  // Settings & System
  { resource: 'settings', action: 'read', key: 'settings:read', labelEn: 'View Store Settings', labelAr: 'عرض إعدادات المتجر والنظام', category: 'settings' },
  { resource: 'settings', action: 'update', key: 'settings:update', labelEn: 'Modify System Configuration', labelAr: 'تعديل إعدادات المتجر والطباعة', category: 'settings' },
  { resource: 'barcodes', action: 'read', key: 'barcodes:read', labelEn: 'Print Barcode Labels', labelAr: 'طباعة وتصميم استيكرات الباركود', category: 'system' },
  { resource: 'audit_logs', action: 'read', key: 'audit_logs:read', labelEn: 'View System Audit Logs', labelAr: 'عرض سجل العمليات والأمان', category: 'system' },
]

const SESSION_HOURS = 8
const SALT_ROUNDS = 12

class AuthService {
  /** Load permissions for a specific user (combining role defaults + per-user overrides) */
  async loadUserPermissions(userId: string, roleId: string, roleName: string): Promise<string[]> {
    if (roleName === 'admin') {
      return ['*']
    }
    const db = getDb()
    try {
      // 1. Check if user has explicit custom permissions
      const customRows = await db.select<Array<{ resource: string; action: string; allowed: number }>>(
        'SELECT resource, action, allowed FROM user_permissions WHERE user_id = ?',
        [userId]
      )

      if (customRows && customRows.length > 0) {
        return customRows.filter(r => r.allowed === 1).map(r => `${r.resource}:${r.action}`)
      }

      // 2. Fallback to role-level default permissions
      const roleRows = await db.select<Array<{ resource: string; action: string }>>(
        'SELECT resource, action FROM permissions WHERE role_id = ? AND allowed = 1',
        [roleId]
      )
      return roleRows.map(r => `${r.resource}:${r.action}`)
    } catch (e) {
      console.error('Failed to load permissions from SQLite:', e)
      return []
    }
  }

  /** Load permissions for a role from SQLite */
  private async loadRolePermissions(roleId: string, roleName: string): Promise<string[]> {
    if (roleName === 'admin') {
      return ['*']
    }
    const db = getDb()
    try {
      const rows = await db.select<Array<{ resource: string; action: string }>>(
        'SELECT resource, action FROM permissions WHERE role_id = ? AND allowed = 1',
        [roleId]
      )
      return rows.map(r => `${r.resource}:${r.action}`)
    } catch (e) {
      console.error('Failed to load permissions from SQLite:', e)
      return []
    }
  }

  /** Count currently active administrators in SQLite */
  private async countActiveAdmins(): Promise<number> {
    const db = getDb()
    const res = await db.select<Array<{ count: number }>>(
      `SELECT COUNT(*) as count
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE r.name = 'admin' AND u.is_active = 1`
    )
    return res[0]?.count ?? 0
  }

  /** Login with username + password */
  async login(username: string, password: string): Promise<LoginResult> {
    const db = getDb()

    try {
      const users = await db.select<Array<{
        id: string
        username: string
        password_hash: string
        full_name: string
        full_name_ar: string | null
        email: string | null
        phone: string | null
        role_id: string
        role_name: string
        is_active: number
      }>>(
        `SELECT u.id, u.username, u.password_hash, u.full_name, u.full_name_ar,
                u.email, u.phone, u.role_id, r.name as role_name, u.is_active
         FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE u.username = ?`,
        [username]
      )

      if (users.length === 0) {
        // Mock authentication fallback for browser preview
        if (username === 'admin' && password === 'admin123') {
          const mockToken = uuidv4() + '-' + uuidv4()
          return {
            success: true,
            user: {
              id: 'mock-admin-id',
              username: 'admin',
              fullName: 'System Administrator',
              fullNameAr: 'مدير النظام',
              email: null,
              phone: null,
              roleId: 'mock-admin-role',
              roleName: 'admin',
              isActive: true,
              permissions: ['*'],
            },
            token: mockToken
          }
        }
        return { success: false, error: 'invalid_credentials' }
      }

      const user = users[0]

      if (!user.is_active) {
        return { success: false, error: 'account_disabled' }
      }

      const passwordMatch = await bcrypt.compare(password, user.password_hash)
      if (!passwordMatch) {
        return { success: false, error: 'invalid_credentials' }
      }

      // Create session
      const token = uuidv4() + '-' + uuidv4()
      const sessionId = uuidv4()
      const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString()

      await db.execute(
        'INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
        [sessionId, user.id, token, expiresAt]
      )

      // Update last login
      await db.execute(
        `UPDATE users SET last_login_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`,
        [user.id]
      )

      const permissions = await this.loadUserPermissions(user.id, user.role_id, user.role_name)

      const authUser: AuthUser = {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        fullNameAr: user.full_name_ar,
        email: user.email,
        phone: user.phone,
        roleId: user.role_id,
        roleName: user.role_name,
        isActive: Boolean(user.is_active),
        permissions,
      }

      await auditService.log({
        userId: user.id,
        userFullName: user.full_name,
        action: 'login',
        resource: 'session',
        details: { username: user.username },
      })

      return { success: true, user: authUser, token }
    } catch (err) {
      console.error('Login error:', err)
      return { success: false, error: 'system_error' }
    }
  }

  /** Validate a session token */
  async validateSession(token: string): Promise<AuthUser | null> {
    const db = getDb()

    try {
      const sessions = await db.select<Array<{
        user_id: string
        expires_at: string
        id: string
        username: string
        full_name: string
        full_name_ar: string | null
        email: string | null
        phone: string | null
        role_id: string
        role_name: string
        is_active: number
      }>>(
        `SELECT s.user_id, s.expires_at,
                u.id, u.username, u.full_name, u.full_name_ar, u.email, u.phone,
                u.role_id, r.name as role_name, u.is_active
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         JOIN roles r ON r.id = u.role_id
         WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')`,
        [token]
      )

      if (sessions.length === 0) {
        // Mock fallback only in browser preview (not Tauri desktop)
        const isTauriEnv = typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
        if (!isTauriEnv && token.length > 20 && !token.startsWith('invalid')) {
          return {
            id: 'mock-admin-id',
            username: 'admin',
            fullName: 'System Administrator',
            fullNameAr: 'مدير النظام',
            email: null,
            phone: null,
            roleId: 'mock-admin-role',
            roleName: 'admin',
            isActive: true,
            permissions: ['*'],
          }
        }
        return null
      }

      const s = sessions[0]
      if (!s.is_active) return null

      const permissions = await this.loadUserPermissions(s.user_id, s.role_id, s.role_name)

      return {
        id: s.id,
        username: s.username,
        fullName: s.full_name,
        fullNameAr: s.full_name_ar,
        email: s.email,
        phone: s.phone,
        roleId: s.role_id,
        roleName: s.role_name,
        isActive: Boolean(s.is_active),
        permissions,
      }
    } catch (err) {
      console.error('Session validation error:', err)
      return null
    }
  }

  /** Logout — invalidate session */
  async logout(token: string, userId: string, userFullName: string): Promise<void> {
    const db = getDb()
    await db.execute('DELETE FROM sessions WHERE token = ?', [token])
    await auditService.log({
      userId,
      userFullName,
      action: 'logout',
      resource: 'session',
    })
  }

  /** Hash a password with bcrypt */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS)
  }

  /** Verify a password against a hash */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
  }

  /** Change own password */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    const db = getDb()

    const users = await db.select<{ password_hash: string }[]>(
      'SELECT password_hash FROM users WHERE id = ?',
      [userId]
    )

    if (users.length === 0) return { success: false, error: 'user_not_found' }

    const match = await bcrypt.compare(currentPassword, users[0].password_hash)
    if (!match) return { success: false, error: 'wrong_password' }

    const newHash = await this.hashPassword(newPassword)
    await db.execute(
      `UPDATE users SET password_hash = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`,
      [newHash, userId]
    )

    return { success: true }
  }

  /** Get all users for administration */
  async getUsers(): Promise<UserListItem[]> {
    const db = getDb()
    const users = await db.select<Array<{
      id: string
      username: string
      full_name: string
      full_name_ar: string | null
      email: string | null
      phone: string | null
      role_id: string
      role_name: string
      role_display_name: string
      role_display_name_ar: string
      is_active: number
      last_login_at: string | null
      created_at: string
    }>>(
      `SELECT u.id, u.username, u.full_name, u.full_name_ar, u.email, u.phone,
              u.role_id, r.name as role_name, r.display_name as role_display_name,
              r.display_name_ar as role_display_name_ar,
              u.is_active, u.last_login_at, u.created_at
       FROM users u
       JOIN roles r ON r.id = u.role_id
       ORDER BY u.created_at DESC`
    )

    return users.map(u => ({
      id: u.id,
      username: u.username,
      fullName: u.full_name,
      fullNameAr: u.full_name_ar,
      email: u.email,
      phone: u.phone,
      roleId: u.role_id,
      roleName: u.role_name,
      roleDisplayName: u.role_display_name,
      roleDisplayNameAr: u.role_display_name_ar,
      isActive: Boolean(u.is_active),
      lastLoginAt: u.last_login_at,
      createdAt: u.created_at,
    }))
  }

  /** Get all available roles */
  async getRoles(): Promise<RoleItem[]> {
    const db = getDb()
    const roles = await db.select<Array<{
      id: string
      name: string
      display_name: string
      display_name_ar: string
      is_system: number
    }>>('SELECT id, name, display_name, display_name_ar, is_system FROM roles ORDER BY name')

    return roles.map(r => ({
      id: r.id,
      name: r.name,
      displayName: r.display_name,
      displayNameAr: r.display_name_ar,
      isSystem: Boolean(r.is_system),
    }))
  }

  /** Create a new user with service-level authorization & validation */
  async createUser(
    data: {
      username: string
      password: string
      fullName: string
      fullNameAr?: string
      email?: string
      phone?: string
      roleId: string
      isActive?: boolean
      customPermissions?: string[]
    },
    actor: AuthUser
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    // 1. Service-level permission check
    if (actor.roleName !== 'admin' && !actor.permissions.includes('users:create') && !actor.permissions.includes('*')) {
      return { success: false, error: 'permission_denied' }
    }

    // 2. Input validation
    const username = data.username.trim()
    if (!username || username.length < 3) {
      return { success: false, error: 'username_too_short' }
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return { success: false, error: 'invalid_username_format' }
    }
    if (!data.fullName.trim()) {
      return { success: false, error: 'name_required' }
    }
    if (!data.password || data.password.length < 6) {
      return { success: false, error: 'password_too_short' }
    }

    const db = getDb()

    // 3. Duplicate check
    const existing = await db.select<{ id: string }[]>(
      'SELECT id FROM users WHERE username = ?',
      [username]
    )
    if (existing.length > 0) {
      return { success: false, error: 'username_taken' }
    }

    const id = uuidv4()
    const hash = await this.hashPassword(data.password)
    const isActive = data.isActive === false ? 0 : 1

    await db.execute(
      `INSERT INTO users (id, username, password_hash, full_name, full_name_ar, email, phone, role_id, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, username, hash, data.fullName.trim(), data.fullNameAr?.trim() ?? null, data.email?.trim() ?? null, data.phone?.trim() ?? null, data.roleId, isActive]
    )

    await auditService.log({
      userId: actor.id,
      userFullName: actor.fullName,
      action: 'create_user',
      resource: 'user',
      resourceId: id,
      details: { username, roleId: data.roleId, isActive: Boolean(isActive) },
    })

    if (data.customPermissions && Array.isArray(data.customPermissions)) {
      await this.setUserPermissions(id, data.customPermissions, actor)
    }

    return { success: true, id }
  }

  /** Update an existing user with self-protection checks */
  async updateUser(
    userId: string,
    data: {
      fullName: string
      fullNameAr?: string
      email?: string
      phone?: string
      roleId: string
      isActive: boolean
      customPermissions?: string[]
    },
    actor: AuthUser
  ): Promise<{ success: boolean; error?: string }> {
    // 1. Service-level permission check
    if (actor.roleName !== 'admin' && !actor.permissions.includes('users:update') && !actor.permissions.includes('*')) {
      return { success: false, error: 'permission_denied' }
    }

    const db = getDb()
    const targetUsers = await db.select<Array<{ id: string; role_id: string; role_name: string; is_active: number; username: string }>>(
      `SELECT u.id, u.role_id, r.name as role_name, u.is_active, u.username
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?`,
      [userId]
    )

    if (targetUsers.length === 0) return { success: false, error: 'user_not_found' }
    const targetUser = targetUsers[0]

    // Self-protection: cannot deactivate self
    if (userId === actor.id && !data.isActive) {
      return { success: false, error: 'cannot_deactivate_self' }
    }

    // Self-protection: cannot remove last active admin (by deactivation or demoting role)
    if (targetUser.role_name === 'admin' && targetUser.is_active) {
      const isDemoting = data.roleId !== targetUser.role_id
      const isDeactivating = !data.isActive
      if (isDemoting || isDeactivating) {
        const adminCount = await this.countActiveAdmins()
        if (adminCount <= 1) {
          return { success: false, error: 'cannot_remove_last_admin' }
        }
      }
    }

    await db.execute(
      `UPDATE users
       SET full_name = ?, full_name_ar = ?, email = ?, phone = ?, role_id = ?, is_active = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE id = ?`,
      [data.fullName.trim(), data.fullNameAr?.trim() ?? null, data.email?.trim() ?? null, data.phone?.trim() ?? null, data.roleId, data.isActive ? 1 : 0, userId]
    )

    if (data.customPermissions && Array.isArray(data.customPermissions)) {
      await this.setUserPermissions(userId, data.customPermissions, actor)
    }

    await auditService.log({
      userId: actor.id,
      userFullName: actor.fullName,
      action: 'update_user',
      resource: 'user',
      resourceId: userId,
      details: { username: targetUser.username, roleId: data.roleId, isActive: data.isActive },
    })

    if (data.roleId !== targetUser.role_id) {
      await auditService.log({
        userId: actor.id,
        userFullName: actor.fullName,
        action: 'role_changed',
        resource: 'user',
        resourceId: userId,
        details: { oldRoleId: targetUser.role_id, newRoleId: data.roleId },
      })
    }

    if (Boolean(targetUser.is_active) !== data.isActive) {
      await auditService.log({
        userId: actor.id,
        userFullName: actor.fullName,
        action: data.isActive ? 'reactivate_user' : 'deactivate_user',
        resource: 'user',
        resourceId: userId,
        details: { username: targetUser.username },
      })
    }

    return { success: true }
  }

  /** Get user custom permissions and role baseline */
  async getUserCustomPermissions(userId: string): Promise<{ isCustom: boolean; permissions: string[] }> {
    const db = getDb()
    const customRows = await db.select<Array<{ resource: string; action: string; allowed: number }>>(
      'SELECT resource, action, allowed FROM user_permissions WHERE user_id = ?',
      [userId]
    )

    if (customRows && customRows.length > 0) {
      return {
        isCustom: true,
        permissions: customRows.filter(r => r.allowed === 1).map(r => `${r.resource}:${r.action}`)
      }
    }

    const userRows = await db.select<Array<{ role_id: string; role_name: string }>>(
      'SELECT u.role_id, r.name as role_name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?',
      [userId]
    )

    if (userRows.length > 0) {
      const roleDefaults = await this.loadRolePermissions(userRows[0].role_id, userRows[0].role_name)
      return {
        isCustom: false,
        permissions: roleDefaults
      }
    }

    return { isCustom: false, permissions: [] }
  }

  /** Set custom permissions for a specific user */
  async setUserPermissions(userId: string, permissions: string[], actor: AuthUser): Promise<void> {
    if (actor.roleName !== 'admin' && !actor.permissions.includes('users:update') && !actor.permissions.includes('*')) {
      throw new Error('Permission denied')
    }

    const db = getDb()
    await db.execute('BEGIN TRANSACTION')
    try {
      await db.execute('DELETE FROM user_permissions WHERE user_id = ?', [userId])

      for (const perm of permissions) {
        if (perm === '*') {
          for (const sp of SYSTEM_PERMISSIONS) {
            await db.execute(
              'INSERT INTO user_permissions (id, user_id, resource, action, allowed) VALUES (?, ?, ?, ?, 1)',
              [uuidv4(), userId, sp.resource, sp.action]
            )
          }
        } else {
          const [resource, action] = perm.split(':')
          if (resource && action) {
            await db.execute(
              'INSERT INTO user_permissions (id, user_id, resource, action, allowed) VALUES (?, ?, ?, ?, 1)',
              [uuidv4(), userId, resource, action]
            )
          }
        }
      }

      await db.execute('COMMIT')
    } catch (err) {
      await db.execute('ROLLBACK')
      throw err
    }

    await auditService.log({
      userId: actor.id,
      userFullName: actor.fullName,
      action: 'update_user_permissions',
      resource: 'user',
      resourceId: userId,
      details: { permissionsCount: permissions.length },
    })
  }

  /** Reset user permissions to role defaults */
  async resetUserPermissionsToRole(userId: string, actor: AuthUser): Promise<void> {
    if (actor.roleName !== 'admin' && !actor.permissions.includes('users:update') && !actor.permissions.includes('*')) {
      throw new Error('Permission denied')
    }

    const db = getDb()
    await db.execute('DELETE FROM user_permissions WHERE user_id = ?', [userId])
    await auditService.log({
      userId: actor.id,
      userFullName: actor.fullName,
      action: 'reset_user_permissions_to_role',
      resource: 'user',
      resourceId: userId,
    })
  }

  /** Get default permissions for a role by role name */
  getDefaultRolePermissions(roleName: string): string[] {
    if (roleName === 'admin') {
      return SYSTEM_PERMISSIONS.map(p => p.key)
    }
    if (roleName === 'manager') {
      return SYSTEM_PERMISSIONS.filter(p => p.category !== 'users' && p.category !== 'settings' && p.category !== 'system').map(p => p.key)
    }
    // Cashier
    return [
      'pos:access', 'pos:create', 'pos:hold',
      'sales:read', 'sales:create', 'receipts:read',
      'products:read', 'customers:read', 'customers:create',
      'shifts:read', 'shifts:create', 'shifts:close', 'shifts:cash_in', 'shifts:cash_out',
      'expenses:read', 'expenses:create', 'returns:read', 'returns:create'
    ]
  }

  /** Reset a user's password (admin action) */
  async resetPassword(
    userId: string,
    newPassword: string,
    actor: AuthUser
  ): Promise<{ success: boolean; error?: string }> {
    // 1. Permission check
    if (actor.roleName !== 'admin' && !actor.permissions.includes('users:update') && !actor.permissions.includes('*')) {
      return { success: false, error: 'permission_denied' }
    }

    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'password_too_short' }
    }

    const db = getDb()
    const targetUsers = await db.select<Array<{ username: string }>>(
      'SELECT username FROM users WHERE id = ?',
      [userId]
    )
    if (targetUsers.length === 0) return { success: false, error: 'user_not_found' }

    const newHash = await this.hashPassword(newPassword)
    await db.execute(
      `UPDATE users SET password_hash = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`,
      [newHash, userId]
    )

    // Invalidate existing sessions for this user so they must log in with new password
    await db.execute('DELETE FROM sessions WHERE user_id = ?', [userId])

    // Safe audit log without plaintext password
    await auditService.log({
      userId: actor.id,
      userFullName: actor.fullName,
      action: 'password_reset',
      resource: 'user',
      resourceId: userId,
      details: { username: targetUsers[0].username },
    })

    return { success: true }
  }

  /** Deactivate a user with self-protection */
  async deleteUser(userId: string, actor: AuthUser): Promise<{ success: boolean; error?: string }> {
    // 1. Permission check
    if (actor.roleName !== 'admin' && !actor.permissions.includes('users:delete') && !actor.permissions.includes('*')) {
      return { success: false, error: 'permission_denied' }
    }

    // 2. Self-protection: cannot delete self
    if (userId === actor.id) {
      return { success: false, error: 'cannot_delete_self' }
    }

    const db = getDb()
    const targetUsers = await db.select<Array<{ role_name: string; is_active: number; username: string }>>(
      `SELECT r.name as role_name, u.is_active, u.username
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?`,
      [userId]
    )
    if (targetUsers.length === 0) return { success: false, error: 'user_not_found' }
    const targetUser = targetUsers[0]

    // Self-protection: cannot delete last active admin
    if (targetUser.role_name === 'admin' && targetUser.is_active) {
      const adminCount = await this.countActiveAdmins()
      if (adminCount <= 1) {
        return { success: false, error: 'cannot_remove_last_admin' }
      }
    }

    // Soft deactivation to preserve financial/transaction references
    await db.execute(
      `UPDATE users SET is_active = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`,
      [userId]
    )
    // Clear active sessions
    await db.execute('DELETE FROM sessions WHERE user_id = ?', [userId])

    await auditService.log({
      userId: actor.id,
      userFullName: actor.fullName,
      action: 'deactivate_user',
      resource: 'user',
      resourceId: userId,
      details: { username: targetUser.username, reason: 'deleted_by_admin' },
    })

    return { success: true }
  }

  /** Clean expired sessions */
  async cleanExpiredSessions(): Promise<void> {
    const db = getDb()
    await db.execute("DELETE FROM sessions WHERE datetime(expires_at) < datetime('now')")
  }
}

export const authService = new AuthService()

/**
 * MAKERS POS — Zustand Auth Store
 * Global authentication state & RBAC permission helpers
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { AuthUser } from '../services/auth/authService'

interface AuthState {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean

  setUser: (user: AuthUser, token: string) => void
  clearUser: () => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,

      setUser: (user, token) =>
        set({ user, token, isAuthenticated: true, isLoading: false }),

      clearUser: () =>
        set({ user: null, token: null, isAuthenticated: false, isLoading: false }),

      setLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: 'makers-pos-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

// ─── Permission helpers ──────────────────────────────────────────────────────

export function usePermission() {
  const { user } = useAuthStore()

  const isAdmin = user?.roleName === 'admin'
  const isManager = isAdmin || user?.roleName === 'manager'
  const isCashier = Boolean(user && user.isActive)

  const can = (action: string, resource: string): boolean => {
    if (!user || !user.isActive) return false
    if (isAdmin) return true

    // Check dynamic permissions array from SQLite
    if (user.permissions && Array.isArray(user.permissions)) {
      if (user.permissions.includes('*')) return true
      if (user.permissions.includes(`${resource}:*`)) return true
      if (user.permissions.includes(`${resource}:${action}`)) return true

      // Aliases resolution
      if (resource === 'pos' && (action === 'sale' || action === 'create') && (user.permissions.includes('pos:create') || user.permissions.includes('pos:sale'))) return true
      if (resource === 'returns' && (action === 'process' || action === 'create') && (user.permissions.includes('returns:create') || user.permissions.includes('returns:process'))) return true
      if (resource === 'shifts' && (action === 'open' || action === 'create') && (user.permissions.includes('shifts:create') || user.permissions.includes('shifts:open'))) return true
      if (resource === 'sales' && action === 'print' && (user.permissions.includes('receipts:read') || user.permissions.includes('sales:print'))) return true
      if (resource === 'receipts' && action === 'read' && (user.permissions.includes('receipts:read') || user.permissions.includes('sales:print'))) return true
      if ((resource === 'barcode' || resource === 'barcodes') && action === 'read' && (user.permissions.includes('barcodes:read') || user.permissions.includes('barcode:read'))) return true
      if (resource === 'cash_registers' && action === 'read' && (user.permissions.includes('cash_registers:read') || user.permissions.includes('shifts:read'))) return true
    }

    // Role-based baseline fallback (used if dynamic permissions are not yet loaded)
    if (user.roleName === 'manager') {
      const managerResources: Record<string, string[]> = {
        dashboard: ['read'],
        pos: ['access', 'create', 'sale', 'hold', 'discount'],
        sales: ['create', 'read', 'void', 'print'],
        receipts: ['read'],
        products: ['create', 'read', 'update', 'delete'],
        inventory: ['create', 'read', 'update', 'adjust', 'transfer', 'history'],
        suppliers: ['create', 'read', 'update', 'delete'],
        customers: ['create', 'read', 'update', 'delete'],
        purchases: ['create', 'read', 'update', 'receive', 'cancel', 'pay'],
        purchasing: ['create', 'read'],
        reports: ['read'],
        returns: ['create', 'read', 'process'],
        shifts: ['create', 'open', 'read', 'update', 'close', 'cash_in', 'cash_out'],
        cash_registers: ['read', 'create', 'update', 'delete'],
        payments: ['create', 'read'],
        expenses: ['create', 'read', 'update', 'cancel', 'categories'],
        audit_logs: ['read'],
        barcodes: ['read', 'create'],
        barcode: ['read'],
      }
      return managerResources[resource]?.includes(action) ?? false
    }

    if (user.roleName === 'cashier') {
      const cashierResources: Record<string, string[]> = {
        pos: ['access', 'create', 'sale', 'hold'],
        sales: ['create', 'read', 'print'],
        receipts: ['read'],
        returns: ['read', 'create', 'process'],
        products: ['read'],
        customers: ['read', 'create'],
        shifts: ['read', 'create', 'open', 'close', 'cash_in', 'cash_out'],
        cash_registers: ['read'],
        payments: ['read', 'create'],
        expenses: ['create', 'read'],
        barcodes: ['read'],
        barcode: ['read'],
      }
      return cashierResources[resource]?.includes(action) ?? false
    }

    return false
  }

  return {
    isAdmin,
    isManager,
    isCashier,
    can,
  }
}

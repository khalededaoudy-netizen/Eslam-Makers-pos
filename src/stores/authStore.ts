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
    }

    // Role-based baseline fallback
    if (user.roleName === 'manager') {
      const managerResources: Record<string, string[]> = {
        dashboard: ['read'],
        pos: ['access', 'create'],
        products: ['create', 'read', 'update', 'delete'],
        inventory: ['create', 'read', 'update'],
        suppliers: ['create', 'read', 'update'],
        customers: ['create', 'read', 'update'],
        purchases: ['create', 'read'],
        reports: ['read'],
        returns: ['create', 'read'],
        shifts: ['create', 'read', 'update'],
        expenses: ['create', 'read', 'update', 'cancel', 'categories'],
        audit_logs: ['read'],
        barcodes: ['read'],
      }
      return managerResources[resource]?.includes(action) ?? false
    }

    if (user.roleName === 'cashier') {
      const cashierResources: Record<string, string[]> = {
        pos: ['access', 'create'],
        sales: ['create', 'read'],
        products: ['read'],
        customers: ['read', 'create'],
        shifts: ['create', 'read'],
        expenses: ['create', 'read'],
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

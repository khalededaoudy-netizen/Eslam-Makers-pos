import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard, ShoppingCart, Package, Archive, ShoppingBag,
  Truck, Users, Receipt, RefreshCw, Wallet, TrendingDown, BarChart3,
  UserCog, Settings, Scan, ClipboardList, ChevronLeft, ChevronRight,
  LogOut, Zap, Bell, User, Award
} from 'lucide-react'
import { useAuthStore, usePermission } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { authService } from '@/services/auth/authService'

const navGroups = [
  {
    label: 'nav.dashboard',
    items: [
      { key: 'dashboard', label: 'nav.dashboard', icon: LayoutDashboard, path: '/', permission: { resource: 'dashboard', action: 'read' } },
    ]
  },
  {
    label: 'pos.title',
    items: [
      { key: 'pos', label: 'nav.pos', icon: ShoppingCart, path: '/pos', permission: { resource: 'pos', action: 'access' } },
      { key: 'sales', label: 'nav.sales', icon: Receipt, path: '/sales', permission: { resource: 'sales', action: 'read' } },
      { key: 'returns', label: 'nav.returns', icon: RefreshCw, path: '/returns', permission: { resource: 'returns', action: 'read' } },
    ]
  },
  {
    label: 'products.title',
    items: [
      { key: 'products', label: 'nav.products', icon: Package, path: '/products', permission: { resource: 'products', action: 'read' } },
      { key: 'categories', label: 'products.categories', icon: Package, path: '/products/categories', permission: { resource: 'products', action: 'update' } },
      { key: 'brands', label: 'brands.title', icon: Award, path: '/products/brands', permission: { resource: 'products', action: 'update' } },
      { key: 'attributes', label: 'products.attributes', icon: Package, path: '/products/attributes', permission: { resource: 'products', action: 'update' } },
      { key: 'units', label: 'products.units', icon: Package, path: '/products/units', permission: { resource: 'products', action: 'update' } },
      { key: 'inventory', label: 'nav.inventory', icon: Archive, path: '/inventory', permission: { resource: 'inventory', action: 'read' } },
      { key: 'barcodes', label: 'nav.barcodes', icon: Scan, path: '/barcodes', permission: { resource: 'barcodes', action: 'create' } },
    ]
  },
  {
    label: 'purchases.title',
    items: [
      { key: 'purchases', label: 'nav.purchases', icon: ShoppingBag, path: '/purchases', permission: { resource: 'purchases', action: 'read' } },
      { key: 'suppliers', label: 'nav.suppliers', icon: Truck, path: '/suppliers', permission: { resource: 'suppliers', action: 'read' } },
      { key: 'customers', label: 'nav.customers', icon: Users, path: '/customers', permission: { resource: 'customers', action: 'read' } },
    ]
  },
  {
    label: 'nav.cashRegister',
    items: [
      { key: 'cash-register', label: 'nav.cashRegister', icon: Wallet, path: '/cash-register', permission: { resource: 'shifts', action: 'read' } },
      { key: 'expenses', label: 'nav.expenses', icon: TrendingDown, path: '/expenses', permission: { resource: 'expenses', action: 'read' } },
    ]
  },
  {
    label: 'nav.reports',
    items: [
      { key: 'reports', label: 'nav.reports', icon: BarChart3, path: '/reports', permission: { resource: 'reports', action: 'read' } },
      { key: 'audit', label: 'nav.audit', icon: ClipboardList, path: '/audit', permission: { resource: 'audit_logs', action: 'read' } },
    ]
  },
  {
    label: 'nav.admin',
    items: [
      { key: 'users', label: 'nav.users', icon: UserCog, path: '/users', permission: { resource: 'users', action: 'read' } },
      { key: 'settings', label: 'nav.settings', icon: Settings, path: '/settings', permission: { resource: 'settings', action: 'read' } },
    ]
  },
]

interface SidebarProps {
  collapsed: boolean
  onCollapse: (v: boolean) => void
}

const allNavPaths = navGroups.flatMap(g => g.items.map(i => i.path))

export function Sidebar({ collapsed, onCollapse }: SidebarProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const { user, token, clearUser } = useAuthStore()
  const { language } = useSettingsStore()
  const { can, isAdmin } = usePermission()

  const isRTL = language === 'ar'

  const handleLogout = async () => {
    if (token && user) {
      await authService.logout(token, user.id, user.fullName)
    }
    clearUser()
  }

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    if (location.pathname === path) return true
    return (
      location.pathname.startsWith(`${path}/`) &&
      !allNavPaths.some(
        p => p !== path && p.startsWith(path) && (location.pathname === p || location.pathname.startsWith(`${p}/`))
      )
    )
  }

  const canAccess = (permission: { resource: string; action: string } | null) => {
    if (!permission) return true
    if (isAdmin) return true
    return can(permission.action, permission.resource)
  }

  const CollapseIcon = collapsed
    ? (isRTL ? ChevronLeft : ChevronRight)
    : (isRTL ? ChevronRight : ChevronLeft)

  return (
    <aside
      className={`sidebar flex flex-col h-screen bg-sidebar text-sidebar-foreground border-e border-sidebar-border transition-all duration-300 ease-in-out relative ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 p-4 border-b border-sidebar-border ${collapsed ? 'justify-center' : ''}`}>
        <div className="flex-shrink-0 flex items-center justify-center">
          <img src="/logo.png" alt="MAKERS" className="w-9 h-9 object-contain" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in min-w-0">
            <p className="font-bold text-sidebar-foreground text-sm leading-none">{t('app.name')}</p>
            <p className="text-[10px] text-muted-foreground truncate mt-0.5 leading-none">
              {isRTL ? 'مكونات إلكترونية' : 'Electronics Store'}
            </p>
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => onCollapse(!collapsed)}
        className="absolute -end-3 top-12 z-10 w-6 h-6 rounded-full bg-card border border-border
                   flex items-center justify-center text-muted-foreground hover:text-foreground
                   hover:bg-secondary transition-all shadow-md"
        title={collapsed ? 'Expand' : 'Collapse'}
      >
        <CollapseIcon className="w-3 h-3" />
      </button>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter(item => canAccess(item.permission))
          if (visibleItems.length === 0) return null

          return (
            <div key={group.label} className="mb-1">
              {!collapsed && (
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-3 pt-3 pb-1.5">
                  {t(group.label)}
                </p>
              )}
              {visibleItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.path)

                return (
                  <Link
                    key={item.key}
                    to={item.path}
                    title={collapsed ? t(item.label) : undefined}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm
                                transition-all duration-150 group relative
                                ${active
                                  ? 'bg-primary/15 text-primary font-medium'
                                  : 'text-muted-foreground hover:bg-sidebar-hover hover:text-sidebar-foreground'
                                }
                                ${collapsed ? 'justify-center' : ''}`}
                  >
                    {/* Active indicator */}
                    {active && (
                      <span className="absolute inset-y-1 start-0 w-0.5 bg-primary rounded-e-full" />
                    )}

                    <Icon className={`w-4.5 h-4.5 flex-shrink-0 ${active ? 'text-primary' : ''}`} />

                    {!collapsed && (
                      <span className="truncate animate-fade-in">{t(item.label)}</span>
                    )}

                    {/* Tooltip for collapsed */}
                    {collapsed && (
                      <div className="absolute start-full ms-2 px-2 py-1 bg-popover border border-border
                                      rounded-md text-xs text-popover-foreground whitespace-nowrap
                                      opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none
                                      shadow-lg z-50">
                        {t(item.label)}
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* User */}
      <div className={`border-t border-sidebar-border p-3 ${collapsed ? 'flex justify-center' : ''}`}>
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-sidebar-foreground">
                {language === 'ar' ? (user?.fullNameAr ?? user?.fullName) : user?.fullName}
              </p>
              <p className="text-xs text-muted-foreground capitalize">{user?.roleName}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title={t('auth.logout')}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title={t('auth.logout')}
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  )
}

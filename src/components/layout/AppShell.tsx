import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { useSettingsStore } from '@/stores/settingsStore'
import { usePermission } from '@/stores/authStore'

// Lazy-loaded pages for performance
const DashboardPage    = React.lazy(() => import('@/features/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })))
const PosPage          = React.lazy(() => import('@/features/pos/PosPage').then(m => ({ default: m.PosPage })))
const ProductsPage     = React.lazy(() => import('@/features/products/ProductsPage').then(m => ({ default: m.ProductsPage })))
const CategoriesPage   = React.lazy(() => import('@/features/products/CategoriesPage').then(m => ({ default: m.CategoriesPage })))
const BrandsPage       = React.lazy(() => import('@/features/products/BrandsPage').then(m => ({ default: m.BrandsPage })))
const UnitsPage        = React.lazy(() => import('@/features/products/UnitsPage').then(m => ({ default: m.UnitsPage })))
const AttributesPage   = React.lazy(() => import('@/features/products/AttributesPage').then(m => ({ default: m.AttributesPage })))
const InventoryPage    = React.lazy(() => import('@/features/inventory/InventoryPage').then(m => ({ default: m.InventoryPage })))
const PurchasesPage    = React.lazy(() => import('@/features/purchases/PurchasesPage').then(m => ({ default: m.PurchasesPage })))
const SuppliersPage    = React.lazy(() => import('@/features/suppliers/SuppliersPage').then(m => ({ default: m.SuppliersPage })))
const CustomersPage    = React.lazy(() => import('@/features/customers/CustomersPage').then(m => ({ default: m.CustomersPage })))
const SalesPage        = React.lazy(() => import('@/features/sales/SalesPage').then(m => ({ default: m.SalesPage })))
const ReturnsPage      = React.lazy(() => import('@/features/returns/ReturnsPage').then(m => ({ default: m.ReturnsPage })))
const CashRegisterPage = React.lazy(() => import('@/features/cash-register/CashRegisterPage').then(m => ({ default: m.CashRegisterPage })))
const ExpensesPage     = React.lazy(() => import('@/features/expenses/ExpensesPage').then(m => ({ default: m.ExpensesPage })))
const ReportsPage      = React.lazy(() => import('@/features/reports/ReportsPage').then(m => ({ default: m.ReportsPage })))
const UsersPage        = React.lazy(() => import('@/features/users/UsersPage').then(m => ({ default: m.UsersPage })))
const SettingsPage     = React.lazy(() => import('@/features/settings/SettingsPage').then(m => ({ default: m.SettingsPage })))
const BarcodesPage     = React.lazy(() => import('@/features/barcodes/BarcodesPage').then(m => ({ default: m.BarcodesPage })))
const AuditPage        = React.lazy(() => import('@/features/audit/AuditPage').then(m => ({ default: m.AuditPage })))

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">جاري التحميل...</p>
      </div>
    </div>
  )
}

function HomeDispatcher() {
  const { can, isAdmin } = usePermission()
  if (isAdmin || can('read', 'dashboard')) {
    return <DashboardPage />
  }
  if (can('access', 'pos') || can('create', 'pos') || can('sale', 'pos')) {
    return <Navigate to="/pos" replace />
  }
  if (can('read', 'products')) {
    return <Navigate to="/products" replace />
  }
  return <Navigate to="/pos" replace />
}

export function AppShell() {
  const navigate = useNavigate()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { language } = useSettingsStore()

  useEffect(() => {
    (window as any).__navigate = navigate
  }, [navigate])

  return (
    <div className={`flex h-screen overflow-hidden bg-background ${language === 'ar' ? 'rtl' : 'ltr'}`}>
      <Sidebar collapsed={sidebarCollapsed} onCollapse={setSidebarCollapsed} />

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <React.Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/"                    element={<HomeDispatcher />} />
              <Route path="/pos"                 element={<ProtectedRoute resource="pos" action="access"><PosPage /></ProtectedRoute>} />
              <Route path="/products"            element={<ProtectedRoute resource="products" action="read"><ProductsPage /></ProtectedRoute>} />
              <Route path="/products/categories" element={<ProtectedRoute resource="products" action="update"><CategoriesPage /></ProtectedRoute>} />
              <Route path="/products/brands"     element={<ProtectedRoute resource="products" action="update"><BrandsPage /></ProtectedRoute>} />
              <Route path="/products/units"      element={<ProtectedRoute resource="products" action="update"><UnitsPage /></ProtectedRoute>} />
              <Route path="/products/attributes" element={<ProtectedRoute resource="products" action="update"><AttributesPage /></ProtectedRoute>} />
              <Route path="/inventory/*"         element={<ProtectedRoute resource="inventory" action="read"><InventoryPage /></ProtectedRoute>} />
              <Route path="/purchases/*"         element={<ProtectedRoute resource="purchases" action="read"><PurchasesPage /></ProtectedRoute>} />
              <Route path="/suppliers/*"         element={<ProtectedRoute resource="suppliers" action="read"><SuppliersPage /></ProtectedRoute>} />
              <Route path="/customers/*"         element={<ProtectedRoute resource="customers" action="read"><CustomersPage /></ProtectedRoute>} />
              <Route path="/sales/*"             element={<ProtectedRoute resource="sales" action="read"><SalesPage /></ProtectedRoute>} />
              <Route path="/returns/*"           element={<ProtectedRoute resource="returns" action="read"><ReturnsPage /></ProtectedRoute>} />
              <Route path="/cash-register"       element={<ProtectedRoute resource="shifts" action="read"><CashRegisterPage /></ProtectedRoute>} />
              <Route path="/expenses/*"          element={<ProtectedRoute resource="expenses" action="read"><ExpensesPage /></ProtectedRoute>} />
              <Route path="/reports/*"           element={<ProtectedRoute resource="reports" action="read"><ReportsPage /></ProtectedRoute>} />
              <Route path="/users/*"             element={<ProtectedRoute resource="users" action="read"><UsersPage /></ProtectedRoute>} />
              <Route path="/settings/*"          element={<ProtectedRoute resource="settings" action="read"><SettingsPage /></ProtectedRoute>} />
              <Route path="/barcodes/*"          element={<ProtectedRoute resource="barcodes" action="create"><BarcodesPage /></ProtectedRoute>} />
              <Route path="/audit"               element={<ProtectedRoute resource="audit_logs" action="read"><AuditPage /></ProtectedRoute>} />
              <Route path="*"                    element={<Navigate to="/" replace />} />
            </Routes>
          </React.Suspense>
        </div>
      </main>
    </div>
  )
}

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Archive,
  Search,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  ArrowRightLeft,
  History,
  AlertTriangle,
  PackageCheck,
  PackageX,
  Boxes,
  DollarSign,
  MapPin,
  Filter,
  Layers,
} from 'lucide-react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useAuthStore, usePermission } from '@/stores/authStore'
import { formatCurrency, formatDate } from '@/lib/formatters'
import {
  inventoryService,
  InventoryOverview,
  ProductInventoryRow,
  InventoryMovementRecord,
  StorageLocation,
} from '@/services/inventory/inventoryService'
import { productService, CategoryItem } from '@/services/products/productService'
import { StockInModal } from './components/StockInModal'
import { StockOutModal } from './components/StockOutModal'
import { StockAdjustmentModal } from './components/StockAdjustmentModal'
import { StockTransferModal } from './components/StockTransferModal'
import { StockHistoryModal } from './components/StockHistoryModal'
import { LocationsModal } from './components/LocationsModal'

type InventoryTab = 'products' | 'movements'

export function InventoryPage() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const { language, currencySymbol } = useSettingsStore()
  const { can, isAdmin } = usePermission()
  const isAr = language === 'ar'

  const canMutate = isAdmin || can('update', 'inventory') || can('create', 'inventory') || can('adjust', 'inventory')

  const [activeTab, setActiveTab] = useState<InventoryTab>('products')
  const [overview, setOverview] = useState<InventoryOverview>({
    totalProducts: 0,
    totalUnits: 0,
    totalStockValue: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
  })

  // Product Inventory Table State
  const [products, setProducts] = useState<ProductInventoryRow[]>([])
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all')
  const [search, setSearch] = useState('')
  const [loadingProducts, setLoadingProducts] = useState(true)

  // Movements Log State
  const [movements, setMovements] = useState<InventoryMovementRecord[]>([])
  const [movementTypeFilter, setMovementTypeFilter] = useState('')
  const [loadingMovements, setLoadingMovements] = useState(false)

  // Modals State
  const [stockInProduct, setStockInProduct] = useState<any | null>(null)
  const [stockOutProduct, setStockOutProduct] = useState<any | null>(null)
  const [adjustProduct, setAdjustProduct] = useState<any | null>(null)
  const [transferProduct, setTransferProduct] = useState<any | null>(null)
  const [historyProduct, setHistoryProduct] = useState<any | null>(null)
  const [isLocationsModalOpen, setIsLocationsModalOpen] = useState(false)

  useEffect(() => {
    loadLookups()
    loadOverview()
    loadProducts()
  }, [])

  useEffect(() => {
    if (activeTab === 'movements') {
      loadMovements()
    }
  }, [activeTab, movementTypeFilter])

  async function loadLookups() {
    try {
      const cats = await productService.getCategories()
      setCategories(cats)
    } catch (err) {
      console.error('Failed to load categories', err)
    }
  }

  async function loadOverview() {
    try {
      const ov = await inventoryService.getInventoryOverview()
      setOverview(ov)
    } catch (err) {
      console.error('Failed to load inventory overview', err)
    }
  }

  async function loadProducts(
    q = search,
    catId = selectedCategory,
    status = statusFilter
  ) {
    setLoadingProducts(true)
    try {
      const rows = await inventoryService.getInventoryProducts({
        search: q,
        categoryId: catId || undefined,
        statusFilter: status,
      })
      setProducts(rows)
    } catch (err) {
      console.error('Failed to load inventory products', err)
    } finally {
      setLoadingProducts(false)
    }
  }

  async function loadMovements() {
    setLoadingMovements(true)
    try {
      const records = await inventoryService.getMovements({
        type: movementTypeFilter || undefined,
        limit: 150,
      })
      setMovements(records)
    } catch (err) {
      console.error('Failed to load movement log', err)
    } finally {
      setLoadingMovements(false)
    }
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearch(val)
    loadProducts(val, selectedCategory, statusFilter)
  }

  const handleCategoryChange = (catId: string) => {
    setSelectedCategory(catId)
    loadProducts(search, catId, statusFilter)
  }

  const handleStatusFilter = (status: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock') => {
    setStatusFilter(status)
    loadProducts(search, selectedCategory, status)
  }

  const handleOperationSuccess = () => {
    setStockInProduct(null)
    setStockOutProduct(null)
    setAdjustProduct(null)
    setTransferProduct(null)
    loadOverview()
    loadProducts()
    if (activeTab === 'movements') loadMovements()
  }

  const getStatusBadge = (status: 'in_stock' | 'low_stock' | 'out_of_stock') => {
    switch (status) {
      case 'in_stock':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <PackageCheck className="w-3 h-3" />
            {t('inventory.inStock', 'متوفر')}
          </span>
        )
      case 'low_stock':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse">
            <AlertTriangle className="w-3 h-3" />
            {t('inventory.lowStock', 'مخزون منخفض')}
          </span>
        )
      case 'out_of_stock':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <PackageX className="w-3 h-3" />
            {t('inventory.outOfStock', 'نافذ')}
          </span>
        )
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
            <Archive className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{t('inventory.title', 'إدارة المخزون والمستودعات')}</h1>
            <p className="text-xs text-muted-foreground">{t('inventory.subtitle', 'متابعة الأرصدة، الحركات، التسويات، وأماكن التخزين')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLocationsModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-muted text-muted-foreground hover:text-foreground rounded-lg text-xs font-medium border border-border transition-colors"
          >
            <MapPin className="w-3.5 h-3.5 text-primary" />
            {t('inventory.manageLocations', 'أماكن التخزين')}
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-5 gap-3 border-b border-border bg-card/30">
        <div className="p-3.5 rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs">{t('inventory.totalProducts', 'إجمالي الأصناف')}</span>
            <Boxes className="w-4 h-4 text-primary" />
          </div>
          <p className="text-xl font-bold font-mono text-foreground">{overview.totalProducts}</p>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs">{t('inventory.totalUnits', 'إجمالي القطع')}</span>
            <Archive className="w-4 h-4 text-sky-500" />
          </div>
          <p className="text-xl font-bold font-mono text-foreground">{overview.totalUnits.toLocaleString()}</p>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs">{t('inventory.totalStockValue', 'قيمة المخزون (بالتكلفة)')}</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl font-bold font-mono text-emerald-500">
            {formatCurrency(overview.totalStockValue, currencySymbol)}
          </p>
        </div>

        <div
          onClick={() => handleStatusFilter('low_stock')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            statusFilter === 'low_stock'
              ? 'bg-amber-500/15 border-amber-500/40 shadow-sm'
              : 'border-border bg-card hover:border-amber-500/30'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium text-amber-500">{t('inventory.lowStock', 'مخزون منخفض')}</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl font-bold font-mono text-amber-500">{overview.lowStockCount}</p>
        </div>

        <div
          onClick={() => handleStatusFilter('out_of_stock')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            statusFilter === 'out_of_stock'
              ? 'bg-rose-500/15 border-rose-500/40 shadow-sm'
              : 'border-border bg-card hover:border-rose-500/30'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium text-rose-500">{t('inventory.outOfStock', 'نافذ من المخزون')}</span>
            <PackageX className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-xl font-bold font-mono text-rose-500">{overview.outOfStockCount}</p>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="px-6 pt-3 border-b border-border flex items-center gap-4 bg-muted/10">
        <button
          onClick={() => setActiveTab('products')}
          className={`pb-2.5 text-xs font-semibold flex items-center gap-1.5 transition-colors border-b-2 ${
            activeTab === 'products'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          {t('inventory.tabStockList', 'جدول أرصدة المنتجات')}
        </button>

        <button
          onClick={() => setActiveTab('movements')}
          className={`pb-2.5 text-xs font-semibold flex items-center gap-1.5 transition-colors border-b-2 ${
            activeTab === 'movements'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          {t('inventory.tabMovements', 'سجل الحركات العام (Movement Log)')}
        </button>
      </div>

      {/* Tab 1: Products Inventory Table */}
      {activeTab === 'products' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Filters Bar */}
          <div className="px-6 py-3 border-b border-border flex flex-wrap items-center gap-3 bg-muted/5">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={handleSearchChange}
                placeholder={t('inventory.searchPlaceholder', 'بحث بالاسم، الكود SKU، الباركود، مكان الدرج...')}
                className="w-full h-9 ps-9 pe-4 rounded-lg bg-input border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="h-9 px-3 rounded-lg bg-input border border-border text-xs text-foreground focus:ring-2 focus:ring-ring"
            >
              <option value="">{t('products.allCategories', 'كل التصنيفات')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {isAr ? c.name_ar : c.name_en || c.name_ar}
                </option>
              ))}
            </select>

            {/* Status Filter Pills */}
            <div className="flex items-center rounded-lg border border-border bg-input p-0.5">
              <button
                onClick={() => handleStatusFilter('all')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('common.all', 'الكل')}
              </button>
              <button
                onClick={() => handleStatusFilter('in_stock')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  statusFilter === 'in_stock'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('inventory.inStock', 'متوفر')}
              </button>
              <button
                onClick={() => handleStatusFilter('low_stock')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  statusFilter === 'low_stock'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('inventory.lowStock', 'منخفض')}
              </button>
              <button
                onClick={() => handleStatusFilter('out_of_stock')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  statusFilter === 'out_of_stock'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('inventory.outOfStock', 'نافذ')}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {loadingProducts ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <Archive className="w-12 h-12 opacity-30 mb-2" />
                <p className="text-sm">{t('common.noData', 'لا توجد منتجات مطابقة')}</p>
              </div>
            ) : (
              <table className="w-full data-table">
                <thead>
                  <tr>
                    <th className="text-start">{t('common.sku', 'الكود')}</th>
                    <th className="text-start">{t('products.productName', 'اسم المنتج')}</th>
                    <th className="text-start">{t('common.category', 'التصنيف')}</th>
                    <th className="text-start">{t('common.location', 'مكان الدرج')}</th>
                    <th className="text-end">{t('inventory.currentStock', 'المخزون')}</th>
                    <th className="text-end">{t('products.minStock', 'الحد الأدنى')}</th>
                    <th className="text-end">{t('inventory.stockValue', 'قيمة المخزون')}</th>
                    <th className="text-center">{t('common.status', 'الحالة')}</th>
                    <th className="text-center">{t('common.actions', 'إجراءات المخزون')}</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td className="font-mono text-xs font-medium text-foreground">
                        {p.sku}
                      </td>
                      <td>
                        <div>
                          <p className="font-medium text-sm text-foreground">{isAr ? p.name_ar : p.name_en}</p>
                          <p className="text-[11px] text-muted-foreground">{isAr ? p.name_en : p.name_ar}</p>
                        </div>
                      </td>
                      <td className="text-xs text-muted-foreground">{p.category_name || '—'}</td>
                      <td>
                        {p.drawer_location ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-mono font-medium border border-primary/20">
                            📦 {p.drawer_location}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40 text-xs">—</span>
                        )}
                      </td>
                      <td className="text-end font-mono">
                        <span className={`text-sm font-bold ${
                          p.status === 'out_of_stock'
                            ? 'text-rose-500'
                            : p.status === 'low_stock'
                            ? 'text-amber-500'
                            : 'text-foreground'
                        }`}>
                          {p.current_stock} {p.unit_symbol}
                        </span>
                      </td>
                      <td className="text-end font-mono text-xs text-muted-foreground">
                        {p.min_stock > 0 ? `${p.min_stock} ${p.unit_symbol}` : '—'}
                      </td>
                      <td className="text-end font-mono text-xs text-muted-foreground">
                        {formatCurrency(p.stock_value, currencySymbol)}
                      </td>
                      <td className="text-center">
                        {getStatusBadge(p.status)}
                      </td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {canMutate && (
                            <>
                              <button
                                onClick={() => setStockInProduct(p)}
                                title={t('inventory.stockIn', 'إدخال مخزون')}
                                className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors"
                              >
                                <ArrowDownRight className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => setStockOutProduct(p)}
                                title={t('inventory.stockOut', 'إخراج مخزون')}
                                className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 transition-colors"
                              >
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => setAdjustProduct(p)}
                                title={t('inventory.adjustment', 'تسوية جرد')}
                                className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => setTransferProduct(p)}
                                title={t('inventory.transferStock', 'تحويل مكان')}
                                className="p-1.5 rounded-lg bg-sky-500/10 text-sky-600 hover:bg-sky-500/20 transition-colors"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          <button
                            onClick={() => setHistoryProduct(p)}
                            title={t('inventory.stockHistory', 'سجل الحركات')}
                            className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Chronological Movement Log */}
      {activeTab === 'movements' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Movement Type Filter */}
          <div className="px-6 py-3 border-b border-border flex items-center justify-between bg-muted/5">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select
                value={movementTypeFilter}
                onChange={(e) => setMovementTypeFilter(e.target.value)}
                className="h-9 px-3 rounded-lg bg-input border border-border text-xs focus:ring-2 focus:ring-primary"
              >
                <option value="">{t('inventory.allTypes', 'كل أنواع الحركات')}</option>
                <option value="opening">{t('inventory.types.opening', 'رصيد افتتاحي')}</option>
                <option value="manual_in">{t('inventory.types.manual_in', 'إدخال مخزون')}</option>
                <option value="manual_out">{t('inventory.types.manual_out', 'إخراج مخزون')}</option>
                <option value="adjustment">{t('inventory.types.adjustment', 'تسوية جرد')}</option>
                <option value="transfer_in">{t('inventory.types.transfer_in', 'تحويل وارد')}</option>
                <option value="transfer_out">{t('inventory.types.transfer_out', 'تحويل صادر')}</option>
                <option value="purchase">{t('inventory.types.purchase', 'شراء')}</option>
                <option value="sale">{t('inventory.types.sale', 'بيع')}</option>
                <option value="damage">{t('inventory.types.damage', 'تالف')}</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground">{movements.length} حركة مسجلة</p>
          </div>

          <div className="flex-1 overflow-auto">
            {loadingMovements ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : movements.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <History className="w-12 h-12 opacity-30 mb-2" />
                <p className="text-sm">{t('common.noData', 'لا توجد حركات مسجلة')}</p>
              </div>
            ) : (
              <table className="w-full data-table">
                <thead>
                  <tr>
                    <th className="text-start">{t('common.date', 'التاريخ')}</th>
                    <th className="text-start">{t('products.productName', 'المنتج')}</th>
                    <th className="text-start">{t('inventory.type', 'النوع')}</th>
                    <th className="text-end">{t('common.quantity', 'الكمية')}</th>
                    <th className="text-end">{t('inventory.before', 'قبل')}</th>
                    <th className="text-end">{t('inventory.after', 'بعد')}</th>
                    <th className="text-start">{t('common.location', 'المكان')}</th>
                    <th className="text-start">{t('inventory.reason', 'البيان')}</th>
                    <th className="text-start">{t('inventory.user', 'المستخدم')}</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <td className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {formatDate(m.created_at, true)}
                      </td>
                      <td>
                        <p className="text-xs font-medium text-foreground">{m.product_name_ar || m.product_name_en}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{m.product_sku}</p>
                      </td>
                      <td>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted border border-border text-foreground">
                          {t(`inventory.types.${m.type}`, m.type)}
                        </span>
                      </td>
                      <td className="text-end font-mono">
                        <span className={`text-xs font-bold ${
                          m.quantity > 0 ? 'text-emerald-500' : m.quantity < 0 ? 'text-rose-500' : 'text-foreground'
                        }`}>
                          {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                        </span>
                      </td>
                      <td className="text-end font-mono text-xs text-muted-foreground">{m.stock_before}</td>
                      <td className="text-end font-mono text-xs font-semibold text-foreground">{m.stock_after}</td>
                      <td className="text-xs text-muted-foreground">{m.location_name || '—'}</td>
                      <td className="text-xs text-foreground">
                        <p className="font-medium">{m.reason || '—'}</p>
                        {m.notes && <p className="text-[10px] text-muted-foreground italic">{m.notes}</p>}
                      </td>
                      <td className="text-xs text-muted-foreground">{m.user_name || 'System'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {stockInProduct && (
        <StockInModal
          product={stockInProduct}
          onClose={() => setStockInProduct(null)}
          onSuccess={handleOperationSuccess}
        />
      )}

      {stockOutProduct && (
        <StockOutModal
          product={stockOutProduct}
          onClose={() => setStockOutProduct(null)}
          onSuccess={handleOperationSuccess}
        />
      )}

      {adjustProduct && (
        <StockAdjustmentModal
          product={adjustProduct}
          onClose={() => setAdjustProduct(null)}
          onSuccess={handleOperationSuccess}
        />
      )}

      {transferProduct && (
        <StockTransferModal
          product={transferProduct}
          onClose={() => setTransferProduct(null)}
          onSuccess={handleOperationSuccess}
        />
      )}

      {historyProduct && (
        <StockHistoryModal
          product={historyProduct}
          onClose={() => setHistoryProduct(null)}
        />
      )}

      {isLocationsModalOpen && (
        <LocationsModal
          onClose={() => setIsLocationsModalOpen(false)}
          onUpdated={() => {
            loadOverview()
            loadProducts()
          }}
        />
      )}
    </div>
  )
}

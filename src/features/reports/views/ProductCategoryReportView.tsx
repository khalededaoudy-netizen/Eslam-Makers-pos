import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Package,
  Layers,
  TrendingUp,
} from 'lucide-react'
import {
  ReportDateRange,
  ProductPerformanceRow,
  CategoryPerformanceRow,
} from '../types'
import { reportsService } from '../reportsService'
import { ReportTable, ColumnDef } from '../components/ReportTable'

interface ProductCategoryReportViewProps {
  dateRange: ReportDateRange
  formatCurrency: (val: number) => string
}

export function ProductCategoryReportView({ dateRange, formatCurrency }: ProductCategoryReportViewProps) {
  const { t } = useTranslation()

  const [products, setProducts] = useState<ProductPerformanceRow[]>([])
  const [categories, setCategories] = useState<CategoryPerformanceRow[]>([])
  const [subTab, setSubTab] = useState<'products' | 'categories'>('products')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const prods = await reportsService.getProductPerformance({
        range: dateRange,
        search,
      })
      setProducts(prods)

      const cats = await reportsService.getCategoryPerformance(dateRange)
      setCategories(cats)
    } catch (err) {
      console.error('Failed to load product/category report:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [dateRange, search])

  const productColumns: ColumnDef<ProductPerformanceRow>[] = [
    {
      key: 'nameAr',
      header: 'المنتج',
      render: r => (
        <div>
          <span className="font-bold text-foreground block">{r.nameAr}</span>
          <span className="text-[10px] text-muted-foreground font-mono">{r.sku}</span>
        </div>
      ),
    },
    {
      key: 'categoryNameAr',
      header: 'الفئة',
      render: r => r.categoryNameAr || '—',
    },
    {
      key: 'quantitySold',
      header: 'الكمية المباعة',
      align: 'center',
      render: r => <span className="font-mono font-bold">{r.quantitySold}</span>,
    },
    {
      key: 'revenue',
      header: 'الإيرادات',
      align: 'right',
      render: r => <span className="font-mono font-bold">{formatCurrency(r.revenue)}</span>,
    },
    {
      key: 'cost',
      header: 'التكلفة',
      align: 'right',
      render: r => <span className="font-mono text-muted-foreground">{formatCurrency(r.cost)}</span>,
    },
    {
      key: 'profit',
      header: 'الربح المحقق',
      align: 'right',
      render: r => <span className="font-mono font-bold text-emerald-500">{formatCurrency(r.profit)}</span>,
    },
    {
      key: 'marginPct',
      header: 'هامش الربح',
      align: 'center',
      render: r => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500">
          {r.marginPct}%
        </span>
      ),
    },
  ]

  const categoryColumns: ColumnDef<CategoryPerformanceRow>[] = [
    {
      key: 'nameAr',
      header: 'الفئة',
      render: r => <span className="font-bold text-foreground">{r.nameAr}</span>,
    },
    {
      key: 'productCount',
      header: 'عدد الأصناف المباعة',
      align: 'center',
      render: r => <span className="font-mono font-bold">{r.productCount}</span>,
    },
    {
      key: 'quantitySold',
      header: 'إجمالي الوحدات المباعة',
      align: 'center',
      render: r => <span className="font-mono font-bold">{r.quantitySold}</span>,
    },
    {
      key: 'revenue',
      header: 'الإيرادات',
      align: 'right',
      render: r => <span className="font-mono font-bold">{formatCurrency(r.revenue)}</span>,
    },
    {
      key: 'cost',
      header: 'التكلفة',
      align: 'right',
      render: r => <span className="font-mono text-muted-foreground">{formatCurrency(r.cost)}</span>,
    },
    {
      key: 'profit',
      header: 'الربح المحقق',
      align: 'right',
      render: r => <span className="font-mono font-bold text-emerald-500">{formatCurrency(r.profit)}</span>,
    },
    {
      key: 'marginPct',
      header: 'هامش الربح',
      align: 'center',
      render: r => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500">
          {r.marginPct}%
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          onClick={() => setSubTab('products')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            subTab === 'products'
              ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
              : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          أداء مبيعات المنتجات
        </button>
        <button
          onClick={() => setSubTab('categories')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            subTab === 'categories'
              ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
              : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          أداء مبيعات الفئات
        </button>
      </div>

      {subTab === 'products' && (
        <ReportTable
          columns={productColumns}
          data={products}
          loading={loading}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="بحث باسم المنتج أو كود SKU..."
          emptyMessage="لا توجد مبيعات للمنتجات في الفترة المحددة"
        />
      )}

      {subTab === 'categories' && (
        <ReportTable
          columns={categoryColumns}
          data={categories}
          loading={loading}
          emptyMessage="لا توجد مبيعات للفئات في الفترة المحددة"
        />
      )}
    </div>
  )
}

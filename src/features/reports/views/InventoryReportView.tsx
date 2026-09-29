import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Package,
  Layers,
  AlertTriangle,
  XCircle,
  MapPin,
} from 'lucide-react'
import {
  ReportDateRange,
  InventoryStockReport,
  StockMovementRow,
} from '../types'
import { reportsService } from '../reportsService'
import { ReportKpiGrid, KpiCardItem } from '../components/ReportKpiGrid'
import { ReportTable, ColumnDef } from '../components/ReportTable'

interface InventoryReportViewProps {
  dateRange: ReportDateRange
  formatCurrency: (val: number) => string
}

export function InventoryReportView({ dateRange, formatCurrency }: InventoryReportViewProps) {
  const { t } = useTranslation()

  const [stockReport, setStockReport] = useState<InventoryStockReport | null>(null)
  const [movements, setMovements] = useState<StockMovementRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const stock = await reportsService.getInventoryStockReport()
      setStockReport(stock)

      const movs = await reportsService.getStockMovements({
        range: dateRange,
        search,
        page,
        pageSize: 15,
      })
      setMovements(movs.rows)
      setTotalCount(movs.totalCount)
    } catch (err) {
      console.error('Failed to load inventory report:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [dateRange, page, search])

  const kpis: KpiCardItem[] = stockReport
    ? [
        {
          id: 'cost_val',
          label: t('reports.inventoryCostValue'),
          value: formatCurrency(stockReport.inventoryCostValue),
          icon: Package,
          color: 'primary',
        },
        {
          id: 'retail_val',
          label: t('reports.inventoryRetailValue'),
          value: formatCurrency(stockReport.inventoryRetailValue),
          icon: Layers,
          color: 'emerald',
        },
        {
          id: 'low_stock',
          label: t('reports.lowStockItems'),
          value: stockReport.lowStockCount,
          icon: AlertTriangle,
          color: 'amber',
        },
        {
          id: 'out_of_stock',
          label: t('reports.outOfStockItems'),
          value: stockReport.outOfStockCount,
          icon: XCircle,
          color: 'rose',
        },
      ]
    : []

  const columns: ColumnDef<StockMovementRow>[] = [
    {
      key: 'date',
      header: 'التاريخ والوقت',
      render: r => <span className="font-mono text-muted-foreground">{r.date.slice(0, 19).replace('T', ' ')}</span>,
    },
    {
      key: 'productNameAr',
      header: 'المنتج',
      render: r => (
        <div>
          <span className="font-bold text-foreground block">{r.productNameAr}</span>
          <span className="text-[10px] text-muted-foreground font-mono">{r.sku}</span>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'نوع الحركة',
      align: 'center',
      render: r => {
        const typeMap: Record<string, { label: string; color: string }> = {
          sale: { label: 'بيع', color: 'bg-rose-500/10 text-rose-500' },
          return: { label: 'مرتجع', color: 'bg-emerald-500/10 text-emerald-500' },
          purchase: { label: 'شراء', color: 'bg-indigo-500/10 text-indigo-500' },
          adjustment: { label: 'تسوية', color: 'bg-amber-500/10 text-amber-500' },
          transfer_in: { label: 'تحويل وارد', color: 'bg-cyan-500/10 text-cyan-500' },
          transfer_out: { label: 'تحويل صادر', color: 'bg-purple-500/10 text-purple-500' },
        }
        const meta = typeMap[r.type] || { label: r.type, color: 'bg-muted text-muted-foreground' }
        return (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${meta.color}`}>
            {meta.label}
          </span>
        )
      },
    },
    {
      key: 'quantity',
      header: 'الكمية',
      align: 'center',
      render: r => <span className="font-mono font-bold">{r.quantity}</span>,
    },
    {
      key: 'stockBefore',
      header: 'قبل',
      align: 'center',
      render: r => <span className="font-mono text-muted-foreground">{r.stockBefore}</span>,
    },
    {
      key: 'stockAfter',
      header: 'بعد',
      align: 'center',
      render: r => <span className="font-mono font-bold text-foreground">{r.stockAfter}</span>,
    },
    {
      key: 'userName',
      header: 'المستخدم',
      render: r => r.userName || '—',
    },
    {
      key: 'reason',
      header: 'السبب / الملاحظات',
      render: r => <span className="text-muted-foreground truncate max-w-xs block">{r.reason || '—'}</span>,
    },
  ]

  return (
    <div className="space-y-6">
      {stockReport && <ReportKpiGrid items={kpis} />}

      {/* Stock by location */}
      {stockReport && stockReport.byLocation.length > 0 && (
        <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-sm space-y-3">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5" />
            المخزون حسب الموقع / الدرج
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {stockReport.byLocation.map((loc, i) => (
              <div key={i} className="p-3 bg-muted/40 rounded-xl border border-border/40 space-y-1">
                <div className="flex justify-between items-center text-muted-foreground text-[11px]">
                  <span className="font-bold text-foreground">{loc.location}</span>
                  <span>{loc.productCount} صنف</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-mono text-muted-foreground">{loc.quantity} وحدة</span>
                  <span className="font-mono font-bold text-primary">{formatCurrency(loc.stockValue)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ReportTable
        columns={columns}
        data={movements}
        loading={loading}
        totalCount={totalCount}
        page={page}
        pageSize={15}
        onPageChange={setPage}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="بحث باسم المنتج أو كود SKU أو السبب..."
      />
    </div>
  )
}

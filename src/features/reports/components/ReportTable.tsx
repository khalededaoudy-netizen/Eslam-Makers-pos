import React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Search, Inbox } from 'lucide-react'

export interface ColumnDef<T> {
  key: string
  header: string
  align?: 'left' | 'right' | 'center'
  render?: (row: T) => React.ReactNode
}

interface ReportTableProps<T> {
  columns: ColumnDef<T>[]
  data: T[]
  loading?: boolean
  totalCount?: number
  page?: number
  pageSize?: number
  onPageChange?: (newPage: number) => void
  searchValue?: string
  onSearchChange?: (val: string) => void
  searchPlaceholder?: string
  emptyMessage?: string
}

export function ReportTable<T extends { id?: string | number }>({
  columns,
  data,
  loading = false,
  totalCount,
  page = 1,
  pageSize = 20,
  onPageChange,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  emptyMessage,
}: ReportTableProps<T>) {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'ar'

  const totalPages = totalCount ? Math.ceil(totalCount / pageSize) : 1

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
      {/* Search Header if enabled */}
      {onSearchChange !== undefined && (
        <div className="p-3 border-b border-border bg-muted/20 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className={`w-4 h-4 text-muted-foreground absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-3' : 'left-3'}`} />
            <input
              type="text"
              value={searchValue || ''}
              onChange={e => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder || t('reports.searchPlaceholder')}
              className={`w-full bg-background border border-border rounded-xl py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary ${
                isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'
              }`}
            />
          </div>
          {totalCount !== undefined && (
            <span className="text-xs text-muted-foreground font-mono font-medium">
              {totalCount} {t('common.results')}
            </span>
          )}
        </div>
      )}

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-start border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
              {columns.map(col => {
                const alignClass =
                  col.align === 'center'
                    ? 'text-center'
                    : col.align === 'right'
                    ? isRtl ? 'text-left' : 'text-right'
                    : isRtl ? 'text-right' : 'text-left'

                return (
                  <th key={col.key} className={`px-4 py-3 whitespace-nowrap ${alignClass}`}>
                    {col.header}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-muted-foreground">
                  <div className="inline-flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    <span>{t('common.loading')}...</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Inbox className="w-8 h-8 opacity-30" />
                    <span>{emptyMessage || t('reports.noData')}</span>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr key={(row as any).id || idx} className="hover:bg-accent/40 transition-colors">
                  {columns.map(col => {
                    const alignClass =
                      col.align === 'center'
                        ? 'text-center'
                        : col.align === 'right'
                        ? isRtl ? 'text-left' : 'text-right'
                        : isRtl ? 'text-right' : 'text-left'

                    return (
                      <td key={col.key} className={`px-4 py-3 whitespace-nowrap text-foreground ${alignClass}`}>
                        {col.render ? col.render(row) : (row as any)[col.key] ?? '—'}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {onPageChange && totalPages > 1 && (
        <div className="p-3 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {t('common.showing')} {data.length} {t('common.of')} {totalCount || 0}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1 || loading}
              className="p-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-accent disabled:opacity-40 transition-colors"
            >
              {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
            <span className="font-mono font-medium px-2">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages || loading}
              className="p-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-accent disabled:opacity-40 transition-colors"
            >
              {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

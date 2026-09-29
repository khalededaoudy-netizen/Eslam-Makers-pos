import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Calendar,
  RefreshCw,
  Download,
  Printer,
  ChevronDown,
} from 'lucide-react'
import { ReportDateRange, ReportDatePreset } from '../types'
import { getDateRangeFromPreset } from '../reportUtils'

interface ReportHeaderProps {
  title: string
  subtitle?: string
  dateRange: ReportDateRange
  onDateRangeChange: (range: ReportDateRange) => void
  onRefresh: () => void
  onExportCsv?: () => void
  onPrint?: () => void
  loading?: boolean
}

export function ReportHeader({
  title,
  subtitle,
  dateRange,
  onDateRangeChange,
  onRefresh,
  onExportCsv,
  onPrint,
  loading = false,
}: ReportHeaderProps) {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'ar'

  const presets: Array<{ id: ReportDatePreset; labelAr: string; labelEn: string }> = [
    { id: 'today', labelAr: 'اليوم', labelEn: 'Today' },
    { id: 'yesterday', labelAr: 'أمس', labelEn: 'Yesterday' },
    { id: 'last7days', labelAr: 'آخر 7 أيام', labelEn: 'Last 7 Days' },
    { id: 'last30days', labelAr: 'آخر 30 يوم', labelEn: 'Last 30 Days' },
    { id: 'thisMonth', labelAr: 'هذا الشهر', labelEn: 'This Month' },
    { id: 'lastMonth', labelAr: 'الشهر السابق', labelEn: 'Last Month' },
  ]

  const handlePresetSelect = (preset: ReportDatePreset) => {
    const next = getDateRangeFromPreset(preset)
    onDateRangeChange(next)
  }

  const handleCustomDateChange = (startStr: string, endStr: string) => {
    if (!startStr || !endStr) return
    const next = getDateRangeFromPreset('custom', startStr, endStr)
    onDateRangeChange(next)
  }

  return (
    <div className="p-4 md:p-6 border-b border-border bg-card/20 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-foreground tracking-tight">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {onExportCsv && (
            <button
              onClick={onExportCsv}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card text-foreground hover:bg-accent text-xs font-semibold transition-colors disabled:opacity-50 shadow-sm"
              title={t('reports.exportCsv')}
            >
              <Download className="w-3.5 h-3.5 text-primary" />
              <span>{t('reports.exportCsv')}</span>
            </button>
          )}

          {onPrint && (
            <button
              onClick={onPrint}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card text-foreground hover:bg-accent text-xs font-semibold transition-colors disabled:opacity-50 shadow-sm"
              title={t('reports.print')}
            >
              <Printer className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{t('reports.print')}</span>
            </button>
          )}

          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card text-foreground hover:bg-accent text-xs font-semibold transition-colors disabled:opacity-50 shadow-sm"
            title={t('reports.refresh')}
          >
            <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t('reports.refresh')}</span>
          </button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <div className="flex items-center gap-1.5 p-1 bg-background/80 border border-border rounded-xl shadow-inner flex-wrap">
          {presets.map(p => {
            const isSelected = dateRange.preset === p.id
            return (
              <button
                key={p.id}
                onClick={() => handlePresetSelect(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                {isRtl ? p.labelAr : p.labelEn}
              </button>
            )
          })}
        </div>

        {/* Custom date range inputs */}
        <div className="flex items-center gap-2 bg-background/80 border border-border rounded-xl px-3 py-1 text-xs shadow-inner">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <input
            type="date"
            className="bg-transparent border-none text-foreground text-xs focus:outline-none"
            value={dateRange.startDate.slice(0, 10)}
            onChange={e => handleCustomDateChange(e.target.value, dateRange.endDate.slice(0, 10))}
          />
          <span className="text-muted-foreground font-mono">→</span>
          <input
            type="date"
            className="bg-transparent border-none text-foreground text-xs focus:outline-none"
            value={dateRange.endDate.slice(0, 10)}
            onChange={e => handleCustomDateChange(dateRange.startDate.slice(0, 10), e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}

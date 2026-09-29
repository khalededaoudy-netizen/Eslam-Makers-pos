/**
 * MAKERS POS — Dashboard Date Range Filter Component
 */

import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Calendar, ChevronDown, Check } from 'lucide-react'
import { DateRangePreset, DashboardDateRange } from '../types'
import { dashboardService } from '../dashboardService'

interface DateRangeFilterProps {
  currentRange: DashboardDateRange
  onRangeChange: (range: DashboardDateRange) => void
}

const PRESETS: Array<{ id: DateRangePreset; key: string }> = [
  { id: 'today', key: 'dashboard.dateFilter.today' },
  { id: 'yesterday', key: 'dashboard.dateFilter.yesterday' },
  { id: 'last7days', key: 'dashboard.dateFilter.last7days' },
  { id: 'last30days', key: 'dashboard.dateFilter.last30days' },
  { id: 'thisMonth', key: 'dashboard.dateFilter.thisMonth' },
  { id: 'lastMonth', key: 'dashboard.dateFilter.lastMonth' },
  { id: 'custom', key: 'dashboard.dateFilter.custom' },
]

export function DateRangeFilter({ currentRange, onRangeChange }: DateRangeFilterProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [customStart, setCustomStart] = useState(currentRange.startDate.slice(0, 10))
  const [customEnd, setCustomEnd] = useState(currentRange.endDate.slice(0, 10))

  const handleSelectPreset = (preset: DateRangePreset) => {
    if (preset === 'custom') {
      const range = dashboardService.getDateRangeFromPreset('custom', customStart, customEnd)
      onRangeChange(range)
    } else {
      const range = dashboardService.getDateRangeFromPreset(preset)
      onRangeChange(range)
      setIsOpen(false)
    }
  }

  const handleApplyCustom = () => {
    const range = dashboardService.getDateRangeFromPreset('custom', customStart, customEnd)
    onRangeChange(range)
    setIsOpen(false)
  }

  const activePresetObj = PRESETS.find(p => p.id === currentRange.preset) || PRESETS[0]

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="px-3.5 py-2 rounded-xl border border-border bg-card hover:bg-muted/60 text-foreground text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
      >
        <Calendar className="w-3.5 h-3.5 text-primary" />
        <span>{t(activePresetObj.key)}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-border bg-card shadow-2xl p-2 z-40 animate-in fade-in zoom-in-95 duration-150">
            <div className="space-y-1">
              {PRESETS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPreset(p.id)}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-colors ${
                    currentRange.preset === p.id
                      ? 'bg-primary/10 text-primary font-bold'
                      : 'hover:bg-muted text-foreground'
                  }`}
                >
                  <span>{t(p.key)}</span>
                  {currentRange.preset === p.id && <Check className="w-3.5 h-3.5 text-primary" />}
                </button>
              ))}
            </div>

            {currentRange.preset === 'custom' && (
              <div className="p-2 border-t border-border mt-2 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground mb-1">
                      {t('common.from', 'من')}
                    </label>
                    <input
                      type="date"
                      value={customStart}
                      onChange={e => setCustomStart(e.target.value)}
                      className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground mb-1">
                      {t('common.to', 'إلى')}
                    </label>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={e => setCustomEnd(e.target.value)}
                      className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-xs"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleApplyCustom}
                  className="w-full py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:bg-primary/90 transition-all"
                >
                  {t('common.apply', 'تطبيق')}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

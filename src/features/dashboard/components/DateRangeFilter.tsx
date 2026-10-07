/**
 * MAKERS POS — Modern Dashboard Date Range Selector
 * Quick pills for [Today, This Week, This Month, This Year] + [Custom Dropdown]
 */

import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Calendar, ChevronDown, Check, SlidersHorizontal } from 'lucide-react'
import { DateRangePreset, DashboardDateRange } from '../types'
import { dashboardService } from '../dashboardService'

interface DateRangeFilterProps {
  currentRange: DashboardDateRange
  onRangeChange: (range: DashboardDateRange) => void
}

const QUICK_PILLS: Array<{ id: DateRangePreset; labelAr: string; labelEn: string }> = [
  { id: 'today', labelAr: 'اليوم', labelEn: 'Today' },
  { id: 'thisWeek', labelAr: 'الأسبوع', labelEn: 'This Week' },
  { id: 'thisMonth', labelAr: 'الشهر', labelEn: 'This Month' },
  { id: 'thisYear', labelAr: 'السنة', labelEn: 'This Year' },
]

const MORE_PRESETS: Array<{ id: DateRangePreset; labelAr: string; labelEn: string }> = [
  { id: 'yesterday', labelAr: 'أمس', labelEn: 'Yesterday' },
  { id: 'last7days', labelAr: 'آخر 7 أيام', labelEn: 'Last 7 Days' },
  { id: 'last30days', labelAr: 'آخر 30 يوم', labelEn: 'Last 30 Days' },
  { id: 'lastMonth', labelAr: 'الشهر الماضي', labelEn: 'Last Month' },
  { id: 'custom', labelAr: 'فترة مخصصة', labelEn: 'Custom Range' },
]

export function DateRangeFilter({ currentRange, onRangeChange }: DateRangeFilterProps) {
  const { i18n } = useTranslation()
  const isArabic = i18n.language !== 'en'
  const [isOpen, setIsOpen] = useState(false)
  const [customStart, setCustomStart] = useState(currentRange.startDate.slice(0, 10))
  const [customEnd, setCustomEnd] = useState(currentRange.endDate.slice(0, 10))

  const handleSelectPreset = (preset: DateRangePreset) => {
    localStorage.setItem('makers_pos_dashboard_preset', preset)
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
    localStorage.setItem('makers_pos_dashboard_preset', 'custom')
    const range = dashboardService.getDateRangeFromPreset('custom', customStart, customEnd)
    onRangeChange(range)
    setIsOpen(false)
  }

  const isQuickSelected = QUICK_PILLS.some(p => p.id === currentRange.preset)
  const morePreset = MORE_PRESETS.find(p => p.id === currentRange.preset)

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Quick Pills */}
      <div className="flex items-center p-1 rounded-xl bg-card border border-border shadow-sm">
        {QUICK_PILLS.map(p => {
          const isActive = currentRange.preset === p.id
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelectPreset(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              {isArabic ? p.labelAr : p.labelEn}
            </button>
          )
        })}
      </div>

      {/* Custom & More Presets Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all ${
            !isQuickSelected
              ? 'border-primary/50 bg-primary/10 text-primary'
              : 'border-border bg-card hover:bg-muted/60 text-muted-foreground hover:text-foreground'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>
            {!isQuickSelected && morePreset
              ? (isArabic ? morePreset.labelAr : morePreset.labelEn)
              : (isArabic ? 'مخصص' : 'Custom')}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
            <div className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-72 rounded-2xl border border-border bg-card shadow-2xl p-2.5 z-40 animate-in fade-in zoom-in-95 duration-150">
              <div className="space-y-1 mb-2">
                {MORE_PRESETS.map(p => (
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
                    <span>{isArabic ? p.labelAr : p.labelEn}</span>
                    {currentRange.preset === p.id && <Check className="w-3.5 h-3.5 text-primary" />}
                  </button>
                ))}
              </div>

              {/* Custom Date Pickers */}
              <div className="p-2.5 border-t border-border space-y-2.5 bg-muted/30 rounded-xl">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
                  <span>{isArabic ? 'تحديد فترة مخصصة' : 'Custom Interval'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground mb-1">
                      {isArabic ? 'من' : 'From'}
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
                      {isArabic ? 'إلى' : 'To'}
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
                  {isArabic ? 'تطبيق الفترة' : 'Apply Range'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

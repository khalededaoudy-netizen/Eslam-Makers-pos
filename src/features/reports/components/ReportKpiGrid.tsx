import React from 'react'
import { LucideIcon } from 'lucide-react'

export interface KpiCardItem {
  id: string
  label: string
  value: string | number
  subValue?: string
  icon: LucideIcon
  color?: 'primary' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'cyan'
}

interface ReportKpiGridProps {
  items: KpiCardItem[]
}

export function ReportKpiGrid({ items }: ReportKpiGridProps) {
  const colorMap = {
    primary: 'bg-primary/10 text-primary border-primary/20',
    emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    rose: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    indigo: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map(kpi => {
        const Icon = kpi.icon
        const colorClass = colorMap[kpi.color || 'primary']

        return (
          <div
            key={kpi.id}
            className="p-4 rounded-2xl bg-card border border-border/60 shadow-sm flex items-center justify-between gap-4 transition-all hover:border-border"
          >
            <div className="space-y-1 overflow-hidden">
              <span className="text-xs font-semibold text-muted-foreground block truncate">
                {kpi.label}
              </span>
              <div className="text-xl font-black text-foreground tracking-tight truncate">
                {kpi.value}
              </div>
              {kpi.subValue && (
                <span className="text-[11px] text-muted-foreground block truncate">
                  {kpi.subValue}
                </span>
              )}
            </div>
            <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${colorClass}`}>
              <Icon className="w-5 h-5" />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * MAKERS POS — Dashboard KPI Card Component
 */

import React from 'react'
import { LucideIcon } from 'lucide-react'

interface KpiCardProps {
  title: string
  value: string
  subtitle?: string
  icon: LucideIcon
  colorClass?: string
  bgClass?: string
  borderClass?: string
}

export function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  colorClass = 'text-primary',
  bgClass = 'bg-primary/10',
  borderClass = 'border-border',
}: KpiCardProps) {
  return (
    <div className={`p-4 rounded-2xl border ${borderClass} bg-card shadow-sm space-y-1.5 transition-all hover:shadow-md`}>
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs font-semibold">{title}</span>
        <div className={`p-2 rounded-xl ${bgClass} ${colorClass}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className={`text-2xl font-black tracking-tight ${colorClass}`}>
        {value}
      </p>
      {subtitle && (
        <p className="text-[11px] text-muted-foreground">
          {subtitle}
        </p>
      )}
    </div>
  )
}

/**
 * MAKERS POS — Enhanced Dashboard KPI Card Component
 * Supports trend indicator, mini SVG sparkline, and navigation link.
 */

import React from 'react'
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { KpiTrend } from '../types'

interface KpiCardProps {
  title: string
  value: string
  subtitle?: string
  icon: LucideIcon
  colorClass?: string
  bgClass?: string
  borderClass?: string
  trend?: KpiTrend
  trendLabel?: string
  sparklineData?: number[]
  sparklineColor?: string
  to?: string
  isExpense?: boolean
}

export function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  colorClass = 'text-primary',
  bgClass = 'bg-primary/10',
  borderClass = 'border-border',
  trend,
  trendLabel,
  sparklineData,
  sparklineColor = '#3b82f6',
  to,
  isExpense = false,
}: KpiCardProps) {
  const navigate = useNavigate()

  const handleClick = () => {
    if (to) {
      navigate(to)
    }
  }

  // Generate SVG path for 7-day sparkline
  const renderSparkline = () => {
    if (!sparklineData || sparklineData.length < 2) return null

    const width = 80
    const height = 28
    const min = Math.min(...sparklineData)
    const max = Math.max(...sparklineData)
    const range = max - min || 1

    const points = sparklineData.map((val, idx) => {
      const x = (idx / (sparklineData.length - 1)) * width
      const y = height - ((val - min) / range) * (height - 6) - 3
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })

    const pathD = `M ${points.join(' L ')}`
    const areaD = `${pathD} L ${width},${height} L 0,${height} Z`

    return (
      <div className="w-20 h-7 overflow-hidden shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={sparklineColor} stopOpacity={0.25} />
              <stop offset="100%" stopColor={sparklineColor} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <path d={areaD} fill={`url(#grad-${title})`} />
          <path
            d={pathD}
            fill="none"
            stroke={sparklineColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    )
  }

  // Trend badge formatting
  const renderTrendBadge = () => {
    if (!trend || trend.percent == null) return null

    // For expenses, going down is good (green), going up is bad (red)
    const isGood = isExpense ? !trend.isUp : trend.isUp
    const hasChange = trend.percent > 0

    if (!hasChange) {
      return (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground px-1.5 py-0.5 rounded-md bg-muted/60">
          <Minus className="w-2.5 h-2.5" />
          <span>0%</span>
        </span>
      )
    }

    return (
      <span
        className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md transition-colors ${
          isGood
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
        }`}
        title={trendLabel}
      >
        {trend.isUp ? (
          <TrendingUp className="w-2.5 h-2.5" />
        ) : (
          <TrendingDown className="w-2.5 h-2.5" />
        )}
        <span>
          {trend.isUp ? '+' : '-'}
          {trend.percent}%
        </span>
      </span>
    )
  }

  return (
    <div
      onClick={handleClick}
      className={`group relative p-4 rounded-2xl border ${borderClass} bg-card shadow-sm space-y-2 transition-all duration-200 ${
        to ? 'cursor-pointer hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
          {title}
        </span>
        <div className={`p-2 rounded-xl ${bgClass} ${colorClass} transition-transform group-hover:scale-105`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      {/* Main KPI Value */}
      <p className={`text-2xl font-black tracking-tight ${colorClass}`}>
        {value}
      </p>

      {/* Footer: Trend + Sparkline + Subtitle */}
      <div className="flex items-end justify-between gap-2 pt-0.5">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {renderTrendBadge()}
            {trendLabel && (
              <span className="text-[10px] text-muted-foreground truncate">
                {trendLabel}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-[11px] text-muted-foreground truncate">
              {subtitle}
            </p>
          )}
        </div>

        {/* Mini Sparkline */}
        {renderSparkline()}
      </div>
    </div>
  )
}

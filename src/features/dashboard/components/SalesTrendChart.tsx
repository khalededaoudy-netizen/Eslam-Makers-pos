/**
 * MAKERS POS — Advanced Sales Trend Chart Component
 * Supports Area / Line / Bar views, previous period dashed line comparison, and PNG export.
 */

import React, { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { Download, BarChart2, TrendingUp, Layers } from 'lucide-react'
import html2canvas from 'html2canvas'
import { SalesTrendPoint } from '../types'
import { useSettingsStore } from '@/stores/settingsStore'

interface SalesTrendChartProps {
  data: SalesTrendPoint[]
}

type ChartType = 'area' | 'line' | 'bar'

export function SalesTrendChart({ data }: SalesTrendChartProps) {
  const { i18n } = useTranslation()
  const isArabic = i18n.language !== 'en'
  const currencySymbol = useSettingsStore(s => s.currencySymbol) || 'EGP'
  const [chartType, setChartType] = useState<ChartType>('area')
  const [showComparison, setShowComparison] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const chartRef = useRef<HTMLDivElement>(null)

  const formatCurrency = (val: number) => {
    return `${val.toLocaleString(isArabic ? 'ar-EG' : 'en-US')} ${currencySymbol}`
  }

  const handleExportPng = async () => {
    if (!chartRef.current) return
    setIsExporting(true)
    try {
      const canvas = await html2canvas(chartRef.current, {
        scale: 2,
        backgroundColor: '#121212',
      })
      const link = document.createElement('a')
      link.download = `sales-trend-${new Date().toISOString().slice(0, 10)}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (err) {
      console.warn('Failed to export chart as PNG:', err)
    } finally {
      setIsExporting(false)
    }
  }

  const hasData = data && data.length > 0
  const hasPrevious = data.some(d => d.previousSales != null && d.previousSales > 0)

  return (
    <div ref={chartRef} className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
      {/* Chart Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-foreground">
            {isArabic ? 'تحليل مسار المبيعات والأرباح' : 'Sales & Revenue Trend'}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isArabic ? 'مقارنة المبيعات الحالية مع الفترة السابقة والأرباح' : 'Current sales compared to previous period & margin'}
          </p>
        </div>

        {/* View toggles & Export */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Comparison toggle */}
          {hasPrevious && (
            <button
              type="button"
              onClick={() => setShowComparison(!showComparison)}
              className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all ${
                showComparison
                  ? 'bg-primary/10 border-primary/40 text-primary'
                  : 'bg-muted/40 border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {isArabic ? 'مقارنة بالفترة السابقة' : 'Compare Prev'}
            </button>
          )}

          {/* Chart Type Selector */}
          <div className="flex items-center p-1 rounded-xl bg-muted/50 border border-border">
            <button
              type="button"
              onClick={() => setChartType('area')}
              className={`p-1.5 rounded-lg transition-all ${
                chartType === 'area' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
              title={isArabic ? 'مساحة' : 'Area'}
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setChartType('line')}
              className={`p-1.5 rounded-lg transition-all ${
                chartType === 'line' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
              title={isArabic ? 'خط' : 'Line'}
            >
              <TrendingUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setChartType('bar')}
              className={`p-1.5 rounded-lg transition-all ${
                chartType === 'bar' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
              title={isArabic ? 'أعمدة' : 'Bar'}
            >
              <BarChart2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Export PNG Button */}
          <button
            type="button"
            onClick={handleExportPng}
            disabled={isExporting || !hasData}
            className="p-2 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-sm"
            title={isArabic ? 'تصدير كصورة PNG' : 'Export PNG'}
          >
            <Download className={`w-3.5 h-3.5 ${isExporting ? 'animate-bounce' : ''}`} />
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      {!hasData ? (
        <div className="p-6 rounded-xl border border-border/40 bg-muted/20 h-64 flex items-center justify-center text-muted-foreground text-xs font-semibold">
          {isArabic ? 'لا توجد بيانات للفترة المحددة' : 'No data available for selected range'}
        </div>
      ) : (
        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'area' ? (
              <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(150, 150, 150, 0.12)" vertical={false} />
                <XAxis dataKey="label" stroke="#888" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${v}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(23, 23, 23, 0.95)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                  }}
                  formatter={(val: any, name: any) => [
                    formatCurrency(Number(val) || 0),
                    name === 'sales'
                      ? (isArabic ? 'المبيعات' : 'Sales')
                      : name === 'profit'
                      ? (isArabic ? 'الأرباح' : 'Profit')
                      : name === 'previousSales'
                      ? (isArabic ? 'الفترة السابقة' : 'Previous Period')
                      : name,
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  formatter={value =>
                    value === 'sales'
                      ? (isArabic ? 'المبيعات الحالية' : 'Current Sales')
                      : value === 'profit'
                      ? (isArabic ? 'الأرباح' : 'Profit')
                      : value === 'previousSales'
                      ? (isArabic ? 'الفترة السابقة' : 'Previous Period')
                      : value
                  }
                />
                <Area type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={2.5} fill="url(#salesGrad)" />
                <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fill="url(#profitGrad)" />
                {showComparison && hasPrevious && (
                  <Area
                    type="monotone"
                    dataKey="previousSales"
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    strokeWidth={1.75}
                    fill="none"
                  />
                )}
              </AreaChart>
            ) : chartType === 'line' ? (
              <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(150, 150, 150, 0.12)" vertical={false} />
                <XAxis dataKey="label" stroke="#888" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${v}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(23, 23, 23, 0.95)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                  formatter={(val: any, name: any) => [
                    formatCurrency(Number(val) || 0),
                    name === 'sales'
                      ? (isArabic ? 'المبيعات' : 'Sales')
                      : name === 'profit'
                      ? (isArabic ? 'الأرباح' : 'Profit')
                      : name === 'previousSales'
                      ? (isArabic ? 'الفترة السابقة' : 'Previous Period')
                      : name,
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  formatter={value =>
                    value === 'sales'
                      ? (isArabic ? 'المبيعات الحالية' : 'Current Sales')
                      : value === 'profit'
                      ? (isArabic ? 'الأرباح' : 'Profit')
                      : value === 'previousSales'
                      ? (isArabic ? 'الفترة السابقة' : 'Previous Period')
                      : value
                  }
                />
                <Line type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} dot={{ r: 2.5 }} />
                {showComparison && hasPrevious && (
                  <Line
                    type="monotone"
                    dataKey="previousSales"
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    strokeWidth={1.75}
                    dot={false}
                  />
                )}
              </LineChart>
            ) : (
              <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(150, 150, 150, 0.12)" vertical={false} />
                <XAxis dataKey="label" stroke="#888" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${v}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(23, 23, 23, 0.95)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                  formatter={(val: any, name: any) => [
                    formatCurrency(Number(val) || 0),
                    name === 'sales'
                      ? (isArabic ? 'المبيعات' : 'Sales')
                      : name === 'profit'
                      ? (isArabic ? 'الأرباح' : 'Profit')
                      : name === 'previousSales'
                      ? (isArabic ? 'الفترة السابقة' : 'Previous Period')
                      : name,
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  formatter={value =>
                    value === 'sales'
                      ? (isArabic ? 'المبيعات الحالية' : 'Current Sales')
                      : value === 'profit'
                      ? (isArabic ? 'الأرباح' : 'Profit')
                      : value === 'previousSales'
                      ? (isArabic ? 'الفترة السابقة' : 'Previous Period')
                      : value
                  }
                />
                <Bar dataKey="sales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

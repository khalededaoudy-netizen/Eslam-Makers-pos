/**
 * MAKERS POS — Alerts Card Component ("تنبيهات مهمة")
 * Highlights out of stock, low stock, customer debts, outdated backups, and shift status.
 */

import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Bell,
  AlertOctagon,
  AlertTriangle,
  Coins,
  HardDrive,
  Clock,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react'
import { DashboardAlert } from '../types'

interface AlertsCardProps {
  alerts: DashboardAlert[]
}

export function AlertsCard({ alerts }: AlertsCardProps) {
  const navigate = useNavigate()
  const { i18n } = useTranslation()
  const isArabic = i18n.language !== 'en'

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'out_of_stock':
        return <AlertOctagon className="w-4 h-4 text-rose-500" />
      case 'low_stock':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />
      case 'overdue_debt':
        return <Coins className="w-4 h-4 text-orange-500" />
      case 'old_backup':
        return <HardDrive className="w-4 h-4 text-blue-500" />
      case 'no_shift':
        return <Clock className="w-4 h-4 text-purple-500" />
      case 'all_good':
      default:
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
    }
  }

  const getAlertBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
      case 'warning':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
      case 'info':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
      case 'success':
      default:
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
    }
  }

  return (
    <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-rose-500/10 text-rose-500 rounded-xl">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">
              {isArabic ? 'تنبيهات هامة للمتجر' : 'Critical Store Alerts'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isArabic ? 'مؤشرات النواقص والديون وحالة النظام' : 'Stock alerts, customer debt balances, and system health'}
            </p>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-2.5">
        {alerts.map(alert => (
          <div
            key={alert.id}
            onClick={() => navigate(alert.route)}
            className={`p-3.5 rounded-xl border ${getAlertBadge(
              alert.severity
            )} flex items-center justify-between gap-3 cursor-pointer hover:shadow-sm hover:scale-[1.01] transition-all`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="shrink-0 p-1.5 rounded-lg bg-card shadow-xs">
                {getAlertIcon(alert.type)}
              </div>
              <div className="min-w-0 truncate">
                <p className="text-xs font-bold truncate">
                  {isArabic ? alert.titleAr : alert.titleEn}
                </p>
                {(alert.subtitleAr || alert.subtitleEn) && (
                  <p className="text-[11px] opacity-80 truncate mt-0.5">
                    {isArabic ? alert.subtitleAr : alert.subtitleEn}
                  </p>
                )}
              </div>
            </div>

            <div className="shrink-0 opacity-60">
              {isArabic ? (
                <ChevronLeft className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * MAKERS POS — Quick Actions Row Component
 * 6 quick operational shortcuts for cashier and manager.
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ShoppingCart,
  PackagePlus,
  FileSpreadsheet,
  BarChart3,
  HardDriveDownload,
  RotateCw,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import { autoBackupService } from '@/services/db/autoBackupService'

interface QuickActionsRowProps {
  onOpenSmartImport: () => void
  onToggleShift: () => void
  isShiftOpen: boolean
  onToast?: (message: string, type?: 'success' | 'error') => void
}

export function QuickActionsRow({
  onOpenSmartImport,
  onToggleShift,
  isShiftOpen,
  onToast,
}: QuickActionsRowProps) {
  const navigate = useNavigate()
  const { i18n } = useTranslation()
  const isArabic = i18n.language !== 'en'
  const [backingUp, setBackingUp] = useState(false)
  const [backupSuccess, setBackupSuccess] = useState(false)

  const handleBackup = async () => {
    if (backingUp) return
    setBackingUp(true)
    try {
      const res = await autoBackupService.createBackup()
      if (res.success) {
        setBackupSuccess(true)
        if (onToast) {
          onToast(isArabic ? 'تم إنشاء النسخة الاحتياطية بنجاح' : 'Backup created successfully', 'success')
        }
        setTimeout(() => setBackupSuccess(false), 3000)
      } else {
        if (onToast) {
          onToast(isArabic ? 'تعذر إنشاء النسخة الاحتياطية' : 'Failed to create backup', 'error')
        }
      }
    } catch (err: any) {
      console.error('Quick backup failed:', err)
      if (onToast) {
        onToast(err?.message || (isArabic ? 'خطأ أثناء النسخ الاحتياطي' : 'Backup error'), 'error')
      }
    } finally {
      setBackingUp(false)
    }
  }

  const actions = [
    {
      id: 'pos',
      label: isArabic ? 'نقطة البيع' : 'Point of Sale',
      desc: isArabic ? 'فتح الكاشير' : 'Open Register',
      icon: ShoppingCart,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20',
      action: () => navigate('/pos'),
    },
    {
      id: 'add_product',
      label: isArabic ? 'إضافة منتج' : 'New Product',
      desc: isArabic ? 'تسجيل صنف' : 'Add Catalog Item',
      icon: PackagePlus,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20',
      action: () => navigate('/products?action=new'),
    },
    {
      id: 'smart_import',
      label: isArabic ? 'استيراد Excel' : 'Smart Import',
      desc: isArabic ? 'مطابقة MAKERS' : 'Excel Auto-fill',
      icon: FileSpreadsheet,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/20',
      action: onOpenSmartImport,
    },
    {
      id: 'today_report',
      label: isArabic ? 'تقرير اليوم' : 'Daily Report',
      desc: isArabic ? 'ملخص الأرباح' : 'Today Analytics',
      icon: BarChart3,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/20',
      action: () => navigate('/reports?date=today'),
    },
    {
      id: 'backup',
      label: isArabic ? 'نسخة احتياطية' : 'Quick Backup',
      desc: backupSuccess
        ? (isArabic ? 'تم بنجاح ✓' : 'Completed ✓')
        : (isArabic ? 'حفظ فوري' : 'Snapshot now'),
      icon: backupSuccess ? CheckCircle2 : HardDriveDownload,
      color: backupSuccess ? 'text-emerald-500' : 'text-sky-500',
      bg: backupSuccess
        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600'
        : 'bg-sky-500/10 hover:bg-sky-500/20 border-sky-500/20',
      action: handleBackup,
      loading: backingUp,
    },
    {
      id: 'shift',
      label: isShiftOpen
        ? (isArabic ? 'إغلاق وردية' : 'Close Shift')
        : (isArabic ? 'فتح وردية' : 'Open Shift'),
      desc: isShiftOpen
        ? (isArabic ? 'جرد الدرج' : 'Reconcile Drawer')
        : (isArabic ? 'بدء العمل' : 'Start Cash Session'),
      icon: RotateCw,
      color: isShiftOpen ? 'text-rose-500' : 'text-teal-500',
      bg: isShiftOpen
        ? 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/20'
        : 'bg-teal-500/10 hover:bg-teal-500/20 border-teal-500/20',
      action: onToggleShift,
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
      {actions.map(act => {
        const Icon = act.icon
        return (
          <button
            key={act.id}
            type="button"
            onClick={act.action}
            disabled={act.loading}
            className={`p-3.5 rounded-2xl border ${act.bg} shadow-sm transition-all duration-200 flex items-center gap-3 text-start hover:-translate-y-0.5 hover:shadow-md active:translate-y-0`}
          >
            <div className={`p-2.5 rounded-xl bg-card border border-border shadow-xs ${act.color} shrink-0`}>
              {act.loading ? (
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              ) : (
                <Icon className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground truncate">{act.label}</p>
              <p className="text-[10px] text-muted-foreground truncate">{act.desc}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}

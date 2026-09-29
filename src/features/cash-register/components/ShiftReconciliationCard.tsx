import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Wallet,
  Banknote,
  Clock,
  User,
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  CreditCard,
  Zap,
  Smartphone,
  Building,
  Lock,
  Play,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { Shift, ShiftReconciliation } from '../types'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { PAYMENT_METHODS } from '@/features/payments/types'

interface ShiftReconciliationCardProps {
  shift: Shift | null
  reconciliation: ShiftReconciliation | null
  canOpen?: boolean
  canClose?: boolean
  canCashIn?: boolean
  canCashOut?: boolean
  onOpenShift: () => void
  onCloseShift: () => void
  onCashIn: () => void
  onCashOut: () => void
}

export function ShiftReconciliationCard({
  shift,
  reconciliation,
  canOpen = false,
  canClose = false,
  canCashIn = false,
  canCashOut = false,
  onOpenShift,
  onCloseShift,
  onCashIn,
  onCashOut,
}: ShiftReconciliationCardProps) {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language !== 'en'

  if (!shift || !reconciliation) {
    return (
      <div className="p-8 rounded-2xl border border-border bg-card shadow-sm text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-500">
          <Wallet className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-foreground">
            {t('cashRegister.noOpenShift', 'لا توجد وردية مفتوحة حالياً')}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {t('cashRegister.noOpenShiftDesc', 'افتح وردية جديدة لبدء تسجيل حركات الخزينة واستقبال المبيعات عبر نقطة البيع.')}
          </p>
        </div>
        {canOpen && (
          <button
            type="button"
            onClick={onOpenShift}
            className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-all shadow-md inline-flex items-center gap-2"
          >
            <Play className="w-4 h-4 fill-primary-foreground" />
            <span>{t('cashRegister.openShift', 'فتح وردية الآن')}</span>
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-6">
      {/* Top Banner: Shift Meta & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
            <Wallet className="w-6 h-6" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-foreground">
                {shift.register_name || t('cashRegister.mainRegister', 'الخزينة الرئيسية')}
              </span>
              <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/20 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>{t('common.active', 'وردية نشطة')}</span>
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                <span>{shift.user_full_name || 'الكاشير'}</span>
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>بدأت في: {formatDate(shift.opened_at)}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {canCashIn && (
            <button
              type="button"
              onClick={onCashIn}
              className="px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <ArrowDownRight className="w-3.5 h-3.5" />
              <span>{t('cashRegister.cashIn', 'إيداع (Cash In)')}</span>
            </button>
          )}

          {canCashOut && (
            <button
              type="button"
              onClick={onCashOut}
              className="px-3 py-2 rounded-xl bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>{t('cashRegister.cashOut', 'سحب (Cash Out)')}</span>
            </button>
          )}

          {canClose && (
            <button
              type="button"
              onClick={onCloseShift}
              className="px-4 py-2 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{t('cashRegister.closeShift', 'إغلاق الوردية')}</span>
            </button>
          )}
        </div>
      </div>

      {/* 5 Physical Cash Flow Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl bg-muted/30 border border-border space-y-1">
          <span className="text-[11px] text-muted-foreground font-medium">
            {t('cashRegister.openingBalance', 'الرصيد الافتتاحي')}
          </span>
          <div className="text-lg font-bold font-mono text-foreground">
            {formatCurrency(reconciliation.openingBalance)}
          </div>
          <span className="text-[10px] text-muted-foreground">عهدة بدء الوردية</span>
        </div>

        <div className="p-3.5 rounded-xl bg-muted/30 border border-border space-y-1">
          <span className="text-[11px] text-muted-foreground font-medium">
            {t('cashRegister.cashInTotal', 'إجمالي الإيداعات (Cash In)')}
          </span>
          <div className="text-lg font-bold font-mono text-emerald-500">
            +{formatCurrency(reconciliation.totalCashIn)}
          </div>
          <span className="text-[10px] text-muted-foreground">تغذية نقدية يدوية</span>
        </div>

        <div className="p-3.5 rounded-xl bg-muted/30 border border-border space-y-1">
          <span className="text-[11px] text-muted-foreground font-medium">
            {t('cashRegister.cashSalesTotal', 'مبيعات الكاش (POS Cash)')}
          </span>
          <div className="text-lg font-bold font-mono text-emerald-500">
            +{formatCurrency(reconciliation.totalCashSales)}
          </div>
          <span className="text-[10px] text-muted-foreground">نقدية مبيعات الكاشير</span>
        </div>

        <div className="p-3.5 rounded-xl bg-muted/30 border border-border space-y-1">
          <span className="text-[11px] text-muted-foreground font-medium">
            {t('cashRegister.cashOutTotal', 'إجمالي المسحوبات (Cash Out)')}
          </span>
          <div className="text-lg font-bold font-mono text-amber-500">
            -{formatCurrency(reconciliation.totalCashOut)}
          </div>
          <span className="text-[10px] text-muted-foreground">مصروفات وسحوبات</span>
        </div>

        <div className="p-3.5 rounded-xl bg-primary/10 border-2 border-primary/30 space-y-1">
          <span className="text-[11px] text-primary font-bold uppercase">
            {t('cashRegister.expectedCash', 'النقدية المتوقعة بالدرج')}
          </span>
          <div className="text-xl font-bold font-mono text-primary">
            {formatCurrency(reconciliation.expectedPhysicalCash)}
          </div>
          <span className="text-[10px] text-muted-foreground">الرصيد الفعلي المطلوب</span>
        </div>
      </div>

      {/* Non-Cash / Electronic Payments Breakdown */}
      <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <span className="text-xs font-bold text-foreground">
            {t('cashRegister.electronicPayments', 'المقبوضات الإلكترونية والبنكية (غير محتسبة بالدرج)')}
          </span>
          <span className="text-xs font-mono font-bold text-foreground">
            إجمالي كافة المدفوعات: {formatCurrency(reconciliation.totalAllPayments)}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="p-2.5 rounded-lg bg-card border border-border space-y-0.5">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Banknote className="w-3 h-3 text-emerald-500" />
              <span>نقداً (كاش)</span>
            </span>
            <div className="font-mono font-bold">{formatCurrency(reconciliation.paymentsByMethod.cash || 0)}</div>
          </div>

          <div className="p-2.5 rounded-lg bg-card border border-border space-y-0.5">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Smartphone className="w-3 h-3 text-purple-500" />
              <span>إنستاباي</span>
            </span>
            <div className="font-mono font-bold">{formatCurrency(reconciliation.paymentsByMethod.instapay || 0)}</div>
          </div>

          <div className="p-2.5 rounded-lg bg-card border border-border space-y-0.5">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Wallet className="w-3 h-3 text-rose-500" />
              <span>محفظة إلكترونية</span>
            </span>
            <div className="font-mono font-bold">{formatCurrency(reconciliation.paymentsByMethod.wallet || 0)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

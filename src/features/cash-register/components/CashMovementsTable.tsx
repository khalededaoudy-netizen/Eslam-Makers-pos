import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowDownRight,
  ArrowUpRight,
  Receipt,
  FileText,
  User,
  Clock,
  Layers,
} from 'lucide-react'
import { CashMovement, CashMovementType } from '../types'
import { formatCurrency, formatDate } from '@/lib/formatters'

interface CashMovementsTableProps {
  movements: CashMovement[]
  loading?: boolean
}

const TYPE_CONFIG: Record<CashMovementType, { ar: string; en: string; color: string }> = {
  opening: {
    ar: 'افتتاح الوردية',
    en: 'Shift Opening',
    color: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  },
  sale_cash: {
    ar: 'مبيعات نقدية',
    en: 'POS Cash Sale',
    color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  },
  cash_in: {
    ar: 'إيداع نقدية',
    en: 'Cash In / Deposit',
    color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  },
  cash_out: {
    ar: 'سحب نقدية',
    en: 'Cash Out / Withdrawal',
    color: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  },
  refund: {
    ar: 'استرداد نقدي',
    en: 'Cash Refund',
    color: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  },
  closing: {
    ar: 'إغلاق الوردية',
    en: 'Shift Closing',
    color: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
  },
  adjustment: {
    ar: 'تسوية نقدية',
    en: 'Cash Adjustment',
    color: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  },
}

export function CashMovementsTable({
  movements,
  loading = false,
}: CashMovementsTableProps) {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language !== 'en'

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
      <div className="px-5 py-3.5 border-b border-border bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">
            {t('cashRegister.movementLedger', 'دفتر حركة النقدية والخزينة')}
          </h3>
          <span className="px-2 py-0.5 text-xs font-mono font-bold bg-primary/10 text-primary rounded-full">
            {movements.length}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-start">
          <thead>
            <tr className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
              <th className="px-4 py-3 text-start">{t('common.time', 'الوقت والتاريخ')}</th>
              <th className="px-4 py-3 text-start">{t('cashRegister.movementType', 'نوع الحركة')}</th>
              <th className="px-4 py-3 text-start">{t('cashRegister.reason', 'البيان / السبب')}</th>
              <th className="px-4 py-3 text-start">{t('common.user', 'المستخدم')}</th>
              <th className="px-4 py-3 text-end">{t('common.amount', 'المبلغ')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  {t('common.loading', 'جاري التحميل...')}
                </td>
              </tr>
            ) : movements.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground space-y-1">
                  <Receipt className="w-8 h-8 mx-auto opacity-25 mb-1" />
                  <p>{t('cashRegister.noMovements', 'لا توجد حركات نقدية مسجلة')}</p>
                </td>
              </tr>
            ) : (
              movements.map(m => {
                const conf = TYPE_CONFIG[m.type] || TYPE_CONFIG.adjustment
                const isIncoming = m.direction === 'in'
                return (
                  <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-muted-foreground whitespace-nowrap">
                      {formatDate(m.created_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold inline-flex items-center gap-1 ${conf.color}`}>
                        {isIncoming ? (
                          <ArrowDownRight className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <ArrowUpRight className="w-3 h-3 text-amber-500" />
                        )}
                        <span>{isArabic ? conf.ar : conf.en}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-foreground">{m.reason || '—'}</div>
                      {m.notes && <div className="text-[11px] text-muted-foreground italic">{m.notes}</div>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {m.user_full_name || '—'}
                    </td>
                    <td className="px-4 py-3 text-end font-mono font-bold text-sm whitespace-nowrap">
                      <span className={isIncoming ? 'text-emerald-500' : 'text-amber-500'}>
                        {isIncoming ? '+' : '-'}{formatCurrency(m.amount)}
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

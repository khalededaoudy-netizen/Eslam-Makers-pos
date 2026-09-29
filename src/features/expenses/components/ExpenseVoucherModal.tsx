/**
 * MAKERS POS — Expense Voucher Printable Modal
 */

import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Printer, X, TrendingDown, Loader2, Building2 } from 'lucide-react'
import { expenseService } from '../expenseService'
import { ExpenseVoucherData } from '../types'
import { useSettingsStore } from '@/stores/settingsStore'

interface ExpenseVoucherModalProps {
  expenseId: string | null
  isOpen: boolean
  onClose: () => void
}

export function ExpenseVoucherModal({
  expenseId,
  isOpen,
  onClose,
}: ExpenseVoucherModalProps) {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'ar'
  const currencySymbol = useSettingsStore(s => s.currencySymbol) || 'EGP'
  const paperWidth = useSettingsStore(s => s.receiptPaperWidth) || '80mm'

  const [voucher, setVoucher] = useState<ExpenseVoucherData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !expenseId) {
      setVoucher(null)
      return
    }

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await expenseService.buildVoucherData(expenseId)
        setVoucher(data)
      } catch (err: any) {
        setError(err?.message || 'Failed to generate voucher data')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [isOpen, expenseId])

  if (!isOpen) return null

  const handlePrint = () => {
    window.print()
  }

  const formatCurrency = (val: number) => {
    return `${val.toLocaleString(isRtl ? 'ar-EG' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${currencySymbol}`
  }

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'cash':
        return isRtl ? 'نقداً (من الخزينة)' : 'Cash (Drawer)'
      case 'card':
        return isRtl ? 'بطاقة بنكية' : 'Card'
      case 'instapay':
        return isRtl ? 'إنستاباي (InstaPay)' : 'InstaPay'
      case 'vodafone_cash':
        return isRtl ? 'فودافون كاش' : 'Vodafone Cash'
      case 'bank_transfer':
        return isRtl ? 'تحويل بنكي' : 'Bank Transfer'
      default:
        return method
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Top Bar (Screen only, Hidden on Print) */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40 no-print">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">
              {t('expenses.voucherTitle')}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={loading || !voucher}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:bg-primary/90 flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>{t('expenses.printVoucher')}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Voucher Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground text-sm no-print">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span>{t('common.loading')}...</span>
            </div>
          ) : error || !voucher ? (
            <div className="p-4 bg-rose-500/10 text-rose-500 rounded-xl text-sm text-center no-print">
              {error || 'Voucher not found'}
            </div>
          ) : (
            <div id="printable-receipt" className={`bg-background border border-border/80 rounded-2xl p-6 shadow-sm space-y-6 text-foreground print:border-none print:shadow-none print:p-0 receipt-${paperWidth}`}>
              {/* Voucher Header */}
              <div className="text-center pb-4 border-b border-border/60 space-y-1">
                <h1 className="text-xl font-black tracking-tight">{voucher.storeName}</h1>
                {(voucher.storePhone || voucher.storeAddress) && (
                  <p className="text-xs text-muted-foreground">
                    {[voucher.storePhone, voucher.storeAddress].filter(Boolean).join(' • ')}
                  </p>
                )}
                <div className="inline-block mt-2 px-4 py-1 rounded-full bg-muted font-bold text-xs uppercase tracking-wider">
                  {t('expenses.voucherTitle')}
                </div>
              </div>

              {/* Top Info */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">{t('expenses.expenseNumber')}:</span>{' '}
                  <span className="font-bold">{voucher.expenseNumber}</span>
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground">{t('expenses.date')}:</span>{' '}
                  <span className="font-bold">
                    {new Date(voucher.date).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}
                  </span>
                </div>
              </div>

              {/* Main Voucher Body Table */}
              <div className="border border-border/60 rounded-xl overflow-hidden text-xs">
                <div className="grid grid-cols-3 bg-muted/40 p-2.5 font-bold border-b border-border/60">
                  <span className="col-span-2">{t('expenses.description')}</span>
                  <span className="text-right">{t('expenses.amount')}</span>
                </div>
                <div className="p-3 grid grid-cols-3 items-center">
                  <div className="col-span-2 space-y-1">
                    <p className="font-bold text-sm">{voucher.description}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t('expenses.category')}: {voucher.categoryName}
                      {voucher.reference ? ` • ${t('expenses.reference')}: ${voucher.reference}` : ''}
                    </p>
                  </div>
                  <div className="text-right font-black text-base text-rose-600 dark:text-rose-400">
                    {formatCurrency(voucher.amount)}
                  </div>
                </div>
              </div>

              {/* Extra Details */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-muted/20 p-3 rounded-xl">
                <div>
                  <span className="text-muted-foreground">{t('expenses.paymentMethod')}:</span>{' '}
                  <span className="font-semibold">{getMethodLabel(voucher.paymentMethod)}</span>
                </div>
                {voucher.supplierName && (
                  <div>
                    <span className="text-muted-foreground">{t('expenses.supplier')}:</span>{' '}
                    <span className="font-semibold">{voucher.supplierName}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">{t('expenses.recordedBy')}:</span>{' '}
                  <span className="font-semibold">{voucher.userName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('expenses.status')}:</span>{' '}
                  <span
                    className={`font-bold ${voucher.status === 'cancelled' ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                  >
                    {voucher.status === 'cancelled'
                      ? t('expenses.statusCancelled')
                      : t('expenses.statusCompleted')}
                  </span>
                </div>
              </div>

              {/* Notes */}
              {voucher.notes && (
                <div className="text-xs text-muted-foreground border-t border-border/40 pt-2">
                  <span className="font-semibold">{t('expenses.notes')}:</span> {voucher.notes}
                </div>
              )}

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-8 text-xs border-t border-dashed border-border/80">
                <div className="text-center space-y-8">
                  <p className="font-semibold text-muted-foreground">
                    {t('expenses.voucherSignature')}
                  </p>
                  <div className="border-b border-muted-foreground/40 w-3/4 mx-auto" />
                </div>
                <div className="text-center space-y-8">
                  <p className="font-semibold text-muted-foreground">
                    {t('expenses.voucherReceiverSignature')}
                  </p>
                  <div className="border-b border-muted-foreground/40 w-3/4 mx-auto" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

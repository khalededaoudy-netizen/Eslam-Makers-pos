/**
 * MAKERS POS — Customer Account Statement Modal (كشف حساب العميل)
 * Shows complete chronological financial ledger (sales, payments, returns, balances),
 * with printing, WhatsApp sharing, CSV export, and instant debt settlement payment recording.
 */

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  X,
  FileText,
  Printer,
  MessageSquare,
  Download,
  CreditCard,
  User,
  Phone,
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  Loader2,
  RefreshCw,
  ShoppingBag,
  RotateCcw,
} from 'lucide-react'
import {
  customerDebtService,
  CustomerStatement,
  StatementEntry,
} from '@/services/customers/customerDebtService'
import { Customer } from '@/services/customers/types'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { useSettingsStore } from '@/stores/settingsStore'
import { RecordPaymentModal } from './RecordPaymentModal'

interface CustomerStatementModalProps {
  isOpen: boolean
  onClose: () => void
  customerId: string | null
  onPaymentRecorded?: () => void
}

export function CustomerStatementModal({
  isOpen,
  onClose,
  customerId,
  onPaymentRecorded,
}: CustomerStatementModalProps) {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language !== 'en'
  const { currencySymbol, storeName, storePhone, storeAddress } = useSettingsStore()

  const [statement, setStatement] = useState<CustomerStatement | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false)

  const loadStatement = async () => {
    if (!customerId) return
    setLoading(true)
    try {
      const data = await customerDebtService.getCustomerStatement(customerId)
      setStatement(data)
    } catch (err) {
      console.error('Failed to load customer statement:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && customerId) {
      loadStatement()
    }
  }, [isOpen, customerId])

  if (!isOpen || !customerId) return null

  // Print Statement Handler
  const handlePrint = () => {
    window.print()
  }

  // Export CSV Handler
  const handleExportCSV = () => {
    if (!statement) return
    const headers = [
      isArabic ? 'التاريخ' : 'Date',
      isArabic ? 'المرجع' : 'Reference',
      isArabic ? 'البيان' : 'Description',
      isArabic ? 'مدين' : 'Debit',
      isArabic ? 'دائن' : 'Credit',
      isArabic ? 'الرصيد' : 'Balance',
      isArabic ? 'ملاحظات' : 'Notes',
    ]

    const rows = statement.entries.map((e) => [
      formatDate(e.date, true),
      e.referenceNumber,
      e.description,
      e.debit || 0,
      e.credit || 0,
      e.runningBalance,
      e.notes || '',
    ])

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Statement_${statement.customer.customer_code}_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Send WhatsApp Summary
  const handleWhatsApp = () => {
    if (!statement || !statement.customer.phone) return
    let cleanPhone = statement.customer.phone.replace(/[^0-9]/g, '')
    if (cleanPhone.startsWith('01')) {
      cleanPhone = '2' + cleanPhone
    }

    const text = isArabic
      ? `مرحباً ${statement.customer.name}،\nمرفق ملخص كشف الحساب الخاص بكم لدى ${storeName || 'مايكرز'}:\n- إجمالي المشتريات (مدين): ${formatCurrency(statement.totalDebit)}\n- إجمالي المدفوعات (دائن): ${formatCurrency(statement.totalCredit)}\n- الرصيد الحالي المستحق: ${formatCurrency(statement.currentBalance)}\nشكراً لتعاملكم معنا!`
      : `Dear ${statement.customer.name},\nHere is your account statement from ${storeName || 'MAKERS'}:\n- Total Debits: ${formatCurrency(statement.totalDebit)}\n- Total Credits: ${formatCurrency(statement.totalCredit)}\n- Current Balance Due: ${formatCurrency(statement.currentBalance)}\nThank you!`

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  const customer = statement?.customer

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in select-none">
        <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {isArabic ? 'كشف حساب عميل (تفصيلي)' : 'Customer Account Statement'}
                </h3>
                {customer && (
                  <p className="text-xs text-muted-foreground">
                    {customer.name} — {customer.customer_code}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadStatement}
                disabled={loading}
                title={isArabic ? 'تحديث البيانات' : 'Refresh'}
                className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Statement Body */}
          <div className="p-6 overflow-y-auto space-y-5 flex-1 print:p-0">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="text-xs">{isArabic ? 'جاري تحميل كشف الحساب...' : 'Loading statement...'}</span>
              </div>
            ) : statement ? (
              <>
                {/* Customer Metrics & Balance Card */}
                <div className="p-4 rounded-xl border border-border bg-muted/30 grid grid-cols-1 sm:grid-cols-4 gap-4 text-center sm:text-start">
                  <div>
                    <span className="text-[11px] text-muted-foreground block">
                      {isArabic ? 'اسم العميل' : 'Customer Name'}
                    </span>
                    <span className="font-bold text-sm text-foreground block truncate">
                      {statement.customer.name}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono" dir="ltr">
                      {statement.customer.phone || '—'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-muted-foreground block">
                      {isArabic ? 'إجمالي المشتريات (مدين)' : 'Total Debits'}
                    </span>
                    <span className="font-bold font-mono text-base text-foreground">
                      {formatCurrency(statement.totalDebit)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-muted-foreground block">
                      {isArabic ? 'إجمالي المدفوعات (دائن)' : 'Total Credits'}
                    </span>
                    <span className="font-bold font-mono text-base text-emerald-500">
                      {formatCurrency(statement.totalCredit)}
                    </span>
                  </div>

                  <div className="sm:border-s sm:border-border sm:ps-4">
                    <span className="text-[11px] text-muted-foreground block font-semibold">
                      {isArabic ? 'الرصيد الحالي المستحق' : 'Current Balance'}
                    </span>
                    <span
                      className={`font-bold font-mono text-lg block ${
                        statement.currentBalance > 0 ? 'text-amber-500' : 'text-emerald-500'
                      }`}
                    >
                      {formatCurrency(statement.currentBalance)}
                    </span>
                    {statement.customer.credit_limit > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        {isArabic ? 'الحد:' : 'Limit:'} {formatCurrency(statement.customer.credit_limit)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Ledger Transactions Table */}
                <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
                  <div className="overflow-x-auto max-h-[460px]">
                    <table className="w-full text-xs text-start">
                      <thead className="bg-muted/70 text-muted-foreground font-semibold sticky top-0 z-10 border-b border-border">
                        <tr>
                          <th className="py-2.5 px-3 text-start">{isArabic ? 'التاريخ' : 'Date'}</th>
                          <th className="py-2.5 px-3 text-start">{isArabic ? 'البيان' : 'Description'}</th>
                          <th className="py-2.5 px-3 text-start">{isArabic ? 'المرجع' : 'Reference'}</th>
                          <th className="py-2.5 px-3 text-end text-rose-500">{isArabic ? 'مدين (+)' : 'Debit (+)'}</th>
                          <th className="py-2.5 px-3 text-end text-emerald-500">{isArabic ? 'دائن (-)' : 'Credit (-)'}</th>
                          <th className="py-2.5 px-3 text-end">{isArabic ? 'الرصيد' : 'Balance'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {statement.entries.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-muted-foreground text-xs">
                              {isArabic ? 'لا توجد حركات مالية مسجلة لهذا العميل' : 'No transactions recorded for this customer'}
                            </td>
                          </tr>
                        ) : (
                          statement.entries.map((entry) => (
                            <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                              <td className="py-2.5 px-3 font-mono text-muted-foreground whitespace-nowrap">
                                {formatDate(entry.date, true)}
                              </td>
                              <td className="py-2.5 px-3 font-medium text-foreground">
                                <div className="flex items-center gap-1.5">
                                  {entry.type === 'sale' && (
                                    <ShoppingBag className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                  )}
                                  {entry.type === 'payment' && (
                                    <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                  )}
                                  {entry.type === 'return' && (
                                    <RotateCcw className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                  )}
                                  <span>{entry.description}</span>
                                </div>
                                {entry.notes && (
                                  <span className="text-[10px] text-muted-foreground block">
                                    {entry.notes}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-muted-foreground">
                                {entry.referenceNumber}
                              </td>
                              <td className="py-2.5 px-3 text-end font-mono font-semibold text-foreground">
                                {entry.debit > 0 ? formatCurrency(entry.debit) : '—'}
                              </td>
                              <td className="py-2.5 px-3 text-end font-mono font-semibold text-emerald-500">
                                {entry.credit > 0 ? formatCurrency(entry.credit) : '—'}
                              </td>
                              <td className="py-2.5 px-3 text-end font-mono font-bold text-foreground">
                                {formatCurrency(entry.runningBalance)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Footer Summary */}
                  <div className="bg-muted/40 p-3 border-t border-border flex flex-wrap items-center justify-between gap-4 text-xs font-semibold">
                    <span>
                      {isArabic ? 'إجمالي عدد العمليات:' : 'Transactions:'}{' '}
                      <span className="font-mono">{statement.entries.length}</span>
                    </span>
                    <div className="flex items-center gap-5">
                      <span>
                        {isArabic ? 'مدين:' : 'Debit:'}{' '}
                        <span className="font-mono font-bold text-foreground">
                          {formatCurrency(statement.totalDebit)}
                        </span>
                      </span>
                      <span>
                        {isArabic ? 'دائن:' : 'Credit:'}{' '}
                        <span className="font-mono font-bold text-emerald-500">
                          {formatCurrency(statement.totalCredit)}
                        </span>
                      </span>
                      <span className="border-s border-border ps-4">
                        {isArabic ? 'الرصيد النهائي:' : 'Balance:'}{' '}
                        <span
                          className={`font-mono font-bold text-sm ${
                            statement.currentBalance > 0 ? 'text-amber-500' : 'text-emerald-500'
                          }`}
                        >
                          {formatCurrency(statement.currentBalance)}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-border bg-card flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                disabled={loading || !statement}
                className="px-3.5 py-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{isArabic ? 'طباعة كشف الحساب' : 'Print Statement'}</span>
              </button>

              <button
                type="button"
                onClick={handleWhatsApp}
                disabled={loading || !statement || !statement.customer.phone}
                className="px-3.5 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{isArabic ? 'إرسال على واتساب' : 'WhatsApp'}</span>
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                disabled={loading || !statement}
                className="px-3.5 py-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isArabic ? 'تصدير كشف (Excel/CSV)' : 'Export CSV'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {customer && customer.balance > 0 && (
                <button
                  type="button"
                  onClick={() => setIsRecordPaymentOpen(true)}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-colors"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'تسجيل دفعة سداد' : 'Record Payment'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-border bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold"
              >
                {isArabic ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Record Payment Sub-Modal */}
      {isRecordPaymentOpen && customer && (
        <RecordPaymentModal
          isOpen={isRecordPaymentOpen}
          customer={customer}
          onClose={() => setIsRecordPaymentOpen(false)}
          onSuccess={() => {
            setIsRecordPaymentOpen(false)
            loadStatement()
            onPaymentRecorded?.()
          }}
        />
      )}
    </>
  )
}

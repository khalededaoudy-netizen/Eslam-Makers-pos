/**
 * MAKERS POS — Excel Product Import Modal
 * Multi-step wizard: Upload -> Preview -> Validation Summary -> Import Valid Rows
 */

import React, { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
  Loader2,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  FileCheck,
} from 'lucide-react'
import { excelProductService, ExcelImportSummary, ExcelImportRow } from '@/services/products/excelProductService'
import { useAuthStore } from '@/stores/authStore'

interface ExcelImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImportComplete: () => void
}

export function ExcelImportModal({
  isOpen,
  onClose,
  onImportComplete,
}: ExcelImportModalProps) {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language !== 'en'
  const { user } = useAuthStore()

  const [step, setStep] = useState<'upload' | 'preview' | 'complete'>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [summary, setSummary] = useState<ExcelImportSummary | null>(null)
  const [importedCount, setImportedCount] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  if (!isOpen) return null

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSelectedFile(file)
    setParsing(true)
    setErrorMessage(null)
    try {
      const res = await excelProductService.parseAndValidateExcel(file)
      setSummary(res)
      setStep('preview')
    } catch (err: any) {
      setErrorMessage(err.message || (isAr ? 'فشل في قراءة ملف الإكسيل' : 'Failed to read Excel file'))
    } finally {
      setParsing(false)
    }
  }

  const handleConfirmImport = async () => {
    if (!summary || !user) return

    setImporting(true)
    setErrorMessage(null)
    try {
      const validRows = summary.rows.filter((r) => r.isValid)
      const count = await excelProductService.commitValidRows(validRows, {
        id: user.id,
        fullName: user.fullName || 'Admin',
      })
      setImportedCount(count)
      setStep('complete')
      onImportComplete()
    } catch (err: any) {
      setErrorMessage(err.message || (isAr ? 'فشل في استيراد المنتجات' : 'Import failed'))
    } finally {
      setImporting(false)
    }
  }

  const handleReset = () => {
    setSelectedFile(null)
    setSummary(null)
    setStep('upload')
    setImportedCount(0)
    setErrorMessage(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-500">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                {isAr ? 'استيراد المنتجات من ملف Excel (.xlsx)' : 'Import Products from Excel (.xlsx)'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isAr ? 'إضافة وتحديث المنتجات وقوائم الأسعار والمخزون دفعة واحدة' : 'Bulk create products and inventory from Excel'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-semibold flex items-center justify-between shrink-0 animate-fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="p-0.5 hover:bg-destructive/20 rounded">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-6">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border hover:border-primary/60 rounded-2xl p-10 text-center cursor-pointer transition-colors bg-muted/10 hover:bg-primary/5 flex flex-col items-center justify-center gap-3"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {parsing ? (
                  <>
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <p className="text-sm font-semibold text-foreground">
                      {isAr ? 'جاري قراءة الملف والتحقق من البيانات...' : 'Parsing and validating Excel rows...'}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                      <Upload className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        {isAr ? 'انقر لاختيار ملف Excel أو اسحبه هنا' : 'Click to select Excel file or drag & drop'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {isAr ? 'الملفات المدعومة: .xlsx (Microsoft Excel)' : 'Supported format: .xlsx (Excel Workbook)'}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Template / Instructions */}
              <div className="p-4 bg-muted/40 rounded-xl border border-border/60 text-xs text-muted-foreground space-y-1.5">
                <p className="font-bold text-foreground">
                  {isAr ? 'الأعمدة المتوقعة في الملف:' : 'Expected Column Headers:'}
                </p>
                <p className="text-[11px] font-mono leading-relaxed">
                  الاسم بالعربية, الاسم بالإنجليزية, كود الصنف (SKU), الباركود, التصنيف, الماركة, الوحدة, سعر الشراء, سعر البيع, المخزون الحالي, حد الطلب
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Validation Preview */}
          {step === 'preview' && summary && (
            <div className="space-y-5">
              {/* Summary Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-muted/40 rounded-xl border border-border text-center">
                  <p className="text-xs text-muted-foreground">{isAr ? 'إجمالي الصفوف' : 'Total Rows'}</p>
                  <p className="text-lg font-bold font-mono text-foreground mt-0.5">{summary.totalRows}</p>
                </div>
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
                  <p className="text-xs text-emerald-600 font-semibold">{isAr ? 'صفوف صالحة' : 'Valid Rows'}</p>
                  <p className="text-lg font-bold font-mono text-emerald-600 mt-0.5">{summary.validCount}</p>
                </div>
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center">
                  <p className="text-xs text-amber-600 font-semibold">{isAr ? 'تنبيهات / مكرر' : 'Duplicates / Alerts'}</p>
                  <p className="text-lg font-bold font-mono text-amber-600 mt-0.5">{summary.duplicateCount || summary.warningCount}</p>
                </div>
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-center">
                  <p className="text-xs text-rose-600 font-semibold">{isAr ? 'أخطاء تمنع الاستيراد' : 'Errors'}</p>
                  <p className="text-lg font-bold font-mono text-rose-600 mt-0.5">{summary.errorCount}</p>
                </div>
              </div>

              {/* Rows Preview Table */}
              <div className="border border-border rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-xs text-start">
                  <thead className="bg-muted/60 text-muted-foreground border-b border-border sticky top-0">
                    <tr>
                      <th className="p-2.5 text-center w-12">#</th>
                      <th className="p-2.5 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                      <th className="p-2.5 text-start">{isAr ? 'اسم المنتج' : 'Product Name'}</th>
                      <th className="p-2.5 text-start">SKU</th>
                      <th className="p-2.5 text-end">{isAr ? 'سعر البيع' : 'Selling Price'}</th>
                      <th className="p-2.5 text-center">{isAr ? 'المخزون' : 'Stock'}</th>
                      <th className="p-2.5 text-start">{isAr ? 'الملاحظات' : 'Notes'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {summary.rows.map((r) => (
                      <tr key={r.rowNumber} className={r.isValid ? 'hover:bg-muted/20' : 'bg-rose-500/5'}>
                        <td className="p-2.5 text-center font-mono text-muted-foreground">{r.rowNumber}</td>
                        <td className="p-2.5">
                          {r.isValid ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {isAr ? 'صالح' : 'Valid'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-600 font-bold text-[11px]">
                              <XCircle className="w-3.5 h-3.5" />
                              {isAr ? 'خطأ' : 'Error'}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 font-semibold text-foreground">{r.nameAr || r.nameEn}</td>
                        <td className="p-2.5 font-mono text-muted-foreground">{r.sku}</td>
                        <td className="p-2.5 text-end font-mono font-bold text-foreground">{r.sellingPrice.toFixed(2)}</td>
                        <td className="p-2.5 text-center font-mono font-bold text-foreground">{r.initialStock}</td>
                        <td className="p-2.5 text-muted-foreground">
                          {r.errors.length > 0 ? (
                            <span className="text-rose-500 text-[11px] font-semibold">{r.errors.join(' | ')}</span>
                          ) : r.warnings.length > 0 ? (
                            <span className="text-amber-500 text-[11px]">{r.warnings.join(' | ')}</span>
                          ) : (
                            <span className="text-emerald-500 text-[11px]">{isAr ? 'جاهز للاستيراد' : 'Ready'}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Step 3: Complete */}
          {step === 'complete' && (
            <div className="py-8 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/25 flex items-center justify-center mx-auto">
                <FileCheck className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-foreground">
                {isAr ? 'تم استيراد المنتجات بنجاح!' : 'Products Imported Successfully!'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isAr
                  ? `تمت إضافة (${importedCount}) منتج جديد إلى قاعدة بيانات المتجر وحفظ المخزون وقوائم الأسعار.`
                  : `Successfully imported (${importedCount}) products into the database.`}
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-border bg-card flex items-center justify-between gap-3 shrink-0">
          {step === 'upload' && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold"
            >
              {t('common.cancel', 'إلغاء')}
            </button>
          )}

          {step === 'preview' && (
            <>
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 rounded-xl border border-border bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold"
              >
                {isAr ? 'اختيار ملف آخر' : 'Choose another file'}
              </button>

              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={!summary || summary.validCount === 0 || importing}
                className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{isAr ? 'جاري الاستيراد...' : 'Importing...'}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isAr ? `استيراد (${summary?.validCount || 0}) منتج صالح` : `Import (${summary?.validCount || 0}) Valid Products`}</span>
                  </>
                )}
              </button>
            </>
          )}

          {step === 'complete' && (
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-all shadow-sm ms-auto"
            >
              {t('common.done', 'تم')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

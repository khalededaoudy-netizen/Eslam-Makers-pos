import React, { useState, useRef, useId } from 'react'
import { useTranslation } from 'react-i18next'
import * as XLSX from 'xlsx'
import {
  X,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Download,
  Search,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Info,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import {
  importFromExcel,
  SmartImportResult,
  SmartImportRow,
} from '@/services/products/smartImportService'

interface SmartImportModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function SmartImportModal({ isOpen, onClose, onSuccess }: SmartImportModalProps) {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === 'ar'
  const { user } = useAuthStore()

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewRows, setPreviewRows] = useState<SmartImportRow[]>([])
  const [totalRowsCount, setTotalRowsCount] = useState<number>(0)
  const [parsingError, setParsingError] = useState<string | null>(null)

  const [isImporting, setIsImporting] = useState<boolean>(false)
  const [progress, setProgress] = useState<{ current: number; total: number; currentItem: string }>({
    current: 0,
    total: 0,
    currentItem: '',
  })
  const [results, setResults] = useState<SmartImportResult[] | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileInputId = useId()

  if (!isOpen) return null

  const handleFileChange = async (file: File) => {
    setSelectedFile(file)
    setParsingError(null)
    setResults(null)
    setPreviewRows([])
    setTotalRowsCount(0)

    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer)
      if (!wb.SheetNames.length) {
        throw new Error(isAr ? 'الملف لا يحتوي على أوراق عمل' : 'Workbook contains no sheets')
      }
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 })
      const dataRows = rows.slice(1).filter((r) => r && (r[0] !== undefined && r[0] !== null && String(r[0]).trim() !== ''))

      if (dataRows.length === 0) {
        throw new Error(isAr ? 'لم يتم العثور على أي صفوف بيانات في الملف' : 'No data rows found in the sheet')
      }

      setTotalRowsCount(dataRows.length)
      const preview: SmartImportRow[] = dataRows.slice(0, 5).map((r, i) => ({
        rowNumber: i + 2,
        productName: String(r[0] || '').trim(),
        quantity: Number(r[1]) || 0,
        sellingPrice: Number(r[2]) || 0,
      }))
      setPreviewRows(preview)
    } catch (err: any) {
      setParsingError(err?.message || (isAr ? 'فشل قراءة ملف Excel' : 'Failed to parse Excel file'))
      setSelectedFile(null)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0])
    }
  }

  const handleStartImport = async () => {
    if (!selectedFile) return
    setIsImporting(true)
    setProgress({ current: 0, total: totalRowsCount, currentItem: '' })

    try {
      const res = await importFromExcel(
        selectedFile,
        user?.id || 'admin',
        (current, total, item) => {
          setProgress({ current, total, currentItem: item })
        }
      )
      setResults(res)
      if (onSuccess) {
        onSuccess()
      }
    } catch (err: any) {
      setParsingError(err?.message || (isAr ? 'حدث خطأ أثناء الاستيراد' : 'Import error occurred'))
    } finally {
      setIsImporting(false)
    }
  }

  const handleExportResults = () => {
    if (!results || results.length === 0) return

    const exportData = results.map((r) => ({
      'رقم الصف (Row)': r.rowNumber,
      'اسم المنتج (Product Name)': r.productName,
      'الحالة (Status)':
        r.status === 'success'
          ? 'نجح'
          : r.status === 'duplicate'
          ? 'موجود مسبقاً'
          : r.status === 'not_found'
          ? 'غير موجود في MAKERS'
          : 'خطأ',
      'كود المنتج (SKU)': r.sku || '',
      'ملاحظات / خطأ (Details)': r.error || '',
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(exportData)
    XLSX.utils.book_append_sheet(wb, ws, 'نتائج الاستيراد')
    XLSX.writeFile(wb, `smart_import_results_${Date.now()}.xlsx`)
  }

  const handleRetryFailed = async () => {
    if (!results) return
    const failedRows = results.filter((r) => r.status === 'error' || r.status === 'not_found')
    if (failedRows.length === 0) return

    // Generate a new temporary file array from failed rows and restart
    const newSheetData = [
      ['اسم المنتج (Product Name)', 'الكمية (Qty)', 'سعر البيع (Selling Price)'],
      ...failedRows.map((r) => [r.productName, 1, 10.0]),
    ]
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(newSheetData)
    XLSX.utils.book_append_sheet(wb, ws, 'المنتجات')
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const retryBlob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const retryFile = new File([retryBlob], 'retry_failed_products.xlsx')

    await handleFileChange(retryFile)
  }

  const handleDownloadTemplate = () => {
    const link = document.createElement('a')
    link.href = '/templates/products_import_template.xlsx'
    link.download = 'products_import_template.xlsx'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Counts
  const successCount = results ? results.filter((r) => r.status === 'success').length : 0
  const duplicateCount = results ? results.filter((r) => r.status === 'duplicate').length : 0
  const notFoundCount = results ? results.filter((r) => r.status === 'not_found').length : 0
  const errorCount = results ? results.filter((r) => r.status === 'error').length : 0

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <span>{t('smartImport.title', 'استيراد ذكي من Excel (مع البحث التلقائي في MAKERS)')}</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('smartImport.priceNote', 'السعر اللي تكتبه هو اللي هيتسجل — مش سعر الموقع (سعر الموقع كمرجع فقط)')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isImporting}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Important Price Rule Callout */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-start gap-3 text-xs leading-relaxed">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">
                {isAr ? 'قاعدة التسعير والمخزون الصارمة:' : 'Strict Pricing & Stock Rule:'}
              </p>
              <p>
                {isAr
                  ? 'سعر البيع (العمود C) والكمية (العمود B) المسجلين في ملف Excel هما المصدر النهائي. يتم جلب الصور والـ SKU والتصنيفات والمواصفات من موقع MAKERS، بينما يبقى سعر الموقع في حقل منفصل للمقارنة فقط ولا يُباع به.'
                  : 'Your Excel selling price (Col C) and quantity (Col B) are the ultimate source of truth. SKUs, images, descriptions, and categories are auto-fetched from MAKERS, while the website price is kept separately for reference only.'}
              </p>
            </div>
          </div>

          {/* Upload Area (when no file or not yet importing/result) */}
          {!results && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                  selectedFile
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-muted/30'
                }`}
              >
                <input
                  id={fileInputId}
                  aria-label={t('smartImport.dropzone', 'اسحب ملف Excel هنا أو اضغط للاختيار')}
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileChange(e.target.files[0])
                    }
                  }}
                />
                <div className="p-3.5 rounded-2xl bg-muted text-primary">
                  <FileSpreadsheet className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {selectedFile
                      ? selectedFile.name
                      : t('smartImport.dropzone', 'اسحب ملف Excel هنا أو اضغط للاختيار')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedFile
                      ? `${(selectedFile.size / 1024).toFixed(1)} KB — ${totalRowsCount} ${isAr ? 'منتج جاهز للاستيراد' : 'products found'}`
                      : isAr
                      ? 'الملف يحتوي على 3 أعمدة فقط: (اسم المنتج، الكمية، سعر البيع)'
                      : 'Accepts .xlsx (3 columns: Product Name, Qty, Selling Price)'}
                  </p>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDownloadTemplate()
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5 text-primary" />
                    <span>{t('smartImport.downloadTemplate', 'تحميل قالب Excel')}</span>
                  </button>
                </div>
              </div>

              {parsingError && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{parsingError}</span>
                </div>
              )}

              {/* Preview First 5 Rows */}
              {previewRows.length > 0 && !isImporting && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                    <span>{t('smartImport.preview', 'معاينة أول 5 صفوف')}</span>
                    <span className="text-muted-foreground">
                      {isAr ? `إجمالي الصفوف: ${totalRowsCount}` : `Total rows: ${totalRowsCount}`}
                    </span>
                  </div>
                  <div className="border border-border rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-xs text-start border-collapse">
                      <thead className="bg-muted/50 border-b border-border">
                        <tr>
                          <th className="p-2.5 text-start font-semibold">#</th>
                          <th className="p-2.5 text-start font-semibold">
                            {isAr ? 'اسم المنتج' : 'Product Name'}
                          </th>
                          <th className="p-2.5 text-center font-semibold">
                            {isAr ? 'الكمية' : 'Qty'}
                          </th>
                          <th className="p-2.5 text-end font-semibold">
                            {isAr ? 'سعر البيع الخاص بك' : 'Selling Price'}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {previewRows.map((row) => (
                          <tr key={row.rowNumber} className="hover:bg-muted/20">
                            <td className="p-2.5 text-muted-foreground">{row.rowNumber}</td>
                            <td className="p-2.5 font-medium text-foreground">{row.productName}</td>
                            <td className="p-2.5 text-center font-semibold text-primary">{row.quantity}</td>
                            <td className="p-2.5 text-end font-bold text-emerald-600">
                              {row.sellingPrice.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Progress Bar during Import */}
          {isImporting && (
            <div className="space-y-3 py-4">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-2 text-primary">
                  <Search className="w-4 h-4 animate-spin" />
                  {t('smartImport.searching', 'جاري البحث والمطابقة في MAKERS...')}
                </span>
                <span className="text-muted-foreground">
                  {progress.current} {t('smartImport.of', 'من')} {progress.total} (
                  {progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%)
                </span>
              </div>

              {/* Progress Track */}
              <div className="w-full h-3 bg-muted rounded-full overflow-hidden border border-border">
                <div
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{
                    width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                  }}
                />
              </div>

              {progress.currentItem && (
                <p className="text-xs text-muted-foreground truncate">
                  <span className="font-semibold text-foreground">{t('smartImport.current', 'الحالي')}:</span>{' '}
                  {progress.currentItem}
                </p>
              )}
            </div>
          )}

          {/* Results View */}
          {results && (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t('smartImport.statusSuccess', 'نجح')}
                  </p>
                  <p className="text-xl font-bold text-emerald-600 mt-0.5">{successCount}</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t('smartImport.statusDuplicate', 'موجود مسبقاً')}
                  </p>
                  <p className="text-xl font-bold text-amber-500 mt-0.5">{duplicateCount}</p>
                </div>
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t('smartImport.statusNotFound', 'غير موجود في MAKERS')}
                  </p>
                  <p className="text-xl font-bold text-rose-500 mt-0.5">{notFoundCount}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-500/10 border border-slate-500/20 text-center">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t('smartImport.statusError', 'خطأ')}
                  </p>
                  <p className="text-xl font-bold text-slate-500 mt-0.5">{errorCount}</p>
                </div>
              </div>

              {/* Results Table */}
              <div className="border border-border rounded-xl overflow-hidden max-h-[320px] overflow-y-auto">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-muted/60 border-b border-border sticky top-0">
                    <tr>
                      <th className="p-2.5 text-start font-semibold">#</th>
                      <th className="p-2.5 text-start font-semibold">
                        {isAr ? 'اسم المنتج' : 'Product Name'}
                      </th>
                      <th className="p-2.5 text-center font-semibold">
                        {isAr ? 'الحالة' : 'Status'}
                      </th>
                      <th className="p-2.5 text-start font-semibold">SKU</th>
                      <th className="p-2.5 text-start font-semibold">
                        {isAr ? 'البيان / الخطأ' : 'Details'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {results.map((r) => (
                      <tr key={r.rowNumber} className="hover:bg-muted/10">
                        <td className="p-2.5 text-muted-foreground">{r.rowNumber}</td>
                        <td className="p-2.5 font-medium text-foreground max-w-[200px] truncate" title={r.productName}>
                          {r.productName}
                        </td>
                        <td className="p-2.5 text-center">
                          {r.status === 'success' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" />
                              {t('smartImport.statusSuccess', 'نجح')}
                            </span>
                          )}
                          {r.status === 'duplicate' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                              <AlertTriangle className="w-3 h-3" />
                              {t('smartImport.statusDuplicate', 'موجود مسبقاً')}
                            </span>
                          )}
                          {r.status === 'not_found' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                              <AlertCircle className="w-3 h-3" />
                              {t('smartImport.statusNotFound', 'مش موجود')}
                            </span>
                          )}
                          {r.status === 'error' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-500 border border-slate-500/20">
                              <AlertCircle className="w-3 h-3" />
                              {t('smartImport.statusError', 'خطأ')}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 font-mono text-muted-foreground text-[11px]">
                          {r.sku || '—'}
                        </td>
                        <td className="p-2.5 text-muted-foreground text-[11px] max-w-[180px] truncate" title={r.error || ''}>
                          {r.error || (r.status === 'success' ? (isAr ? 'تمت الإضافة بنجاح' : 'Created successfully') : '—')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-border shrink-0 bg-muted/20 flex items-center justify-between flex-wrap gap-2">
          {!results ? (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={isImporting}
                className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all disabled:opacity-50"
              >
                {t('common.cancel', 'إلغاء')}
              </button>
              <button
                type="button"
                onClick={handleStartImport}
                disabled={!selectedFile || isImporting || totalRowsCount === 0}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all shadow-md disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                <span>
                  {isImporting
                    ? t('common.loading', 'جاري الاستيراد...')
                    : t('smartImport.startImport', 'بدء الاستيراد')}
                </span>
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportResults}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-semibold transition-all"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{t('smartImport.exportResults', 'تصدير النتائج كـ Excel')}</span>
                </button>

                {(notFoundCount > 0 || errorCount > 0) && (
                  <button
                    type="button"
                    onClick={handleRetryFailed}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 border border-amber-500/30 text-xs font-semibold transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t('smartImport.retryFailed', 'إعادة المحاولة للفاشلين')}</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all"
              >
                {t('common.close', 'إغلاق')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

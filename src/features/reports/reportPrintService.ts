/**
 * MAKERS POS — Report Print & Export Service
 * Manages A4-formatted printing, PDF document generation, and WhatsApp report sharing.
 */

import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import {
  copyBlobToClipboard,
  getWhatsAppUrl,
  openExternalUrl,
  canvasToBlob,
} from '@/services/whatsapp/whatsappService'
import makersLogo from '@/assets/logo.png'

export interface ReportPrintOptions {
  reportType: string
  reportTitle: string
  dateFrom: string
  dateTo: string
  data?: any
  storeName: string
  storeLogo?: string
  isArabic?: boolean
}

/**
 * Builds standard print header HTML with store branding and report metadata
 */
function buildReportHTML(options: ReportPrintOptions): string {
  const isAr = options.isArabic !== false
  const logoSrc = options.storeLogo || makersLogo

  return `
    <div class="report-print-header" style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 14px;">
      ${logoSrc ? `<img src="${logoSrc}" alt="Logo" class="logo" style="max-height: 48px; margin: 0 auto 8px auto; display: block;" />` : ''}
      <div class="report-title" style="font-size: 20px; font-weight: bold; margin-bottom: 4px; color: #000;">
        ${options.reportTitle}
      </div>
      <div class="report-period" style="font-size: 13px; color: #333; margin-bottom: 4px;">
        ${isAr ? `الفترة: من ${options.dateFrom} إلى ${options.dateTo}` : `Period: ${options.dateFrom} to ${options.dateTo}`}
      </div>
      <div class="report-generated" style="font-size: 11px; color: #666;">
        ${options.storeName} • ${isAr ? 'تم الإنشاء:' : 'Generated:'} ${new Date().toLocaleString(isAr ? 'ar-EG' : 'en-US')}
      </div>
    </div>
  `
}

/**
 * Triggers standard browser/system print dialog with A4 portrait styling
 */
export async function printReportA4(
  reportElement: HTMLElement,
  options: ReportPrintOptions
): Promise<void> {
  const wrapper = document.createElement('div')
  wrapper.id = 'printable-report'
  wrapper.dir = options.isArabic !== false ? 'rtl' : 'ltr'
  wrapper.innerHTML = buildReportHTML(options)

  const contentClone = reportElement.cloneNode(true) as HTMLElement
  wrapper.appendChild(contentClone)

  document.body.classList.add('printing-report')
  document.body.appendChild(wrapper)

  try {
    await new Promise(r => setTimeout(r, 250))
    window.print()
  } finally {
    document.body.classList.remove('printing-report')
    if (document.body.contains(wrapper)) {
      document.body.removeChild(wrapper)
    }
  }
}

/**
 * Generates and downloads high-resolution A4 multi-page PDF document
 */
export async function downloadReportPDF(
  reportElement: HTMLElement,
  options: ReportPrintOptions
): Promise<void> {
  const isAr = options.isArabic !== false
  const wrapper = document.createElement('div')
  wrapper.id = 'printable-report'
  wrapper.style.cssText = `
    position: fixed;
    left: -9999px;
    top: 0;
    width: 800px;
    background: #ffffff;
    color: #000000;
    padding: 32px;
    direction: ${isAr ? 'rtl' : 'ltr'};
    font-family: 'Cairo', 'Segoe UI', Arial, sans-serif;
    box-sizing: border-box;
  `
  wrapper.innerHTML = buildReportHTML(options)

  const contentClone = reportElement.cloneNode(true) as HTMLElement
  wrapper.appendChild(contentClone)
  document.body.appendChild(wrapper)

  try {
    const canvas = await html2canvas(wrapper, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
      allowTaint: true,
    })

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    const imgData = canvas.toDataURL('image/png')
    const pdfWidth = 210 // mm
    const pageHeight = 297 // mm
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width

    let heightLeft = pdfHeight
    let position = 0

    // First page
    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight)
    heightLeft -= pageHeight

    // Subsequent pages
    while (heightLeft > 0) {
      position -= pageHeight
      pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight)
      heightLeft -= pageHeight
    }

    const cleanDateFrom = options.dateFrom.slice(0, 10)
    const cleanDateTo = options.dateTo.slice(0, 10)
    const filename = `report_${options.reportType}_${cleanDateFrom}_to_${cleanDateTo}.pdf`
    pdf.save(filename)
  } finally {
    if (document.body.contains(wrapper)) {
      document.body.removeChild(wrapper)
    }
  }
}

/**
 * Captures report snapshot, copies image to clipboard, and opens WhatsApp
 */
export async function shareReportViaWhatsApp(
  reportElement: HTMLElement,
  options: ReportPrintOptions,
  recipientPhone?: string
): Promise<{ success: boolean; message: string }> {
  const isAr = options.isArabic !== false
  const wrapper = document.createElement('div')
  wrapper.id = 'printable-report'
  wrapper.style.cssText = `
    position: fixed;
    left: -9999px;
    top: 0;
    width: 800px;
    background: #ffffff;
    color: #000000;
    padding: 32px;
    direction: ${isAr ? 'rtl' : 'ltr'};
    font-family: 'Cairo', 'Segoe UI', Arial, sans-serif;
    box-sizing: border-box;
  `
  wrapper.innerHTML = buildReportHTML(options)

  const contentClone = reportElement.cloneNode(true) as HTMLElement
  wrapper.appendChild(contentClone)
  document.body.appendChild(wrapper)

  try {
    const canvas = await html2canvas(wrapper, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
      allowTaint: true,
    })

    const blob = await canvasToBlob(canvas)
    const copied = await copyBlobToClipboard(blob)

    const dateStr = new Date().toLocaleString(isAr ? 'ar-EG' : 'en-US')
    const messageLines = [
      `📊 *${options.reportTitle}*`,
      `🏢 ${options.storeName}`,
      `📅 الفترة: من ${options.dateFrom.slice(0, 10)} إلى ${options.dateTo.slice(0, 10)}`,
      `⏱ تاريخ الإنشاء: ${dateStr}`,
      '',
      isAr
        ? '(تم نسخ صورة التقرير للحافظة — يمكنك الضغط على Ctrl+V للصقها في المحادثة مباشرة)'
        : '(Report image copied to clipboard — press Ctrl+V to paste into chat)',
    ]

    const encodedMessage = encodeURIComponent(messageLines.join('\n'))
    const whatsAppUrl = getWhatsAppUrl(recipientPhone, encodedMessage)
    await openExternalUrl(whatsAppUrl)

    return {
      success: true,
      message: isAr
        ? 'تم فتح واتساب ونسخ صورة التقرير للحافظة (Ctrl+V للصق)'
        : 'Opened WhatsApp and copied report image to clipboard (Ctrl+V to paste)',
    }
  } finally {
    if (document.body.contains(wrapper)) {
      document.body.removeChild(wrapper)
    }
  }
}

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
  storeName: string
  storeLogo?: string
  phone?: string
  address?: string
  data?: any
  isArabic?: boolean
}

/**
 * Common stylesheet to force crisp light-mode theme, Cairo Arabic font, and table styling
 */
function appendReportStyles(wrapper: HTMLElement): void {
  const styleEl = document.createElement('style')
  styleEl.textContent = `
    #pdf-report-wrapper, #printable-report {
      --background: 0 0% 100% !important;
      --foreground: 0 0% 10% !important;
      --card: 0 0% 100% !important;
      --card-foreground: 0 0% 10% !important;
      --popover: 0 0% 100% !important;
      --popover-foreground: 0 0% 10% !important;
      --muted: 0 0% 96% !important;
      --muted-foreground: 0 0% 40% !important;
      --border: 0 0% 88% !important;
      font-family: 'Cairo', 'Noto Sans Arabic', Arial, sans-serif !important;
      direction: rtl !important;
      unicode-bidi: embed !important;
      text-align: right !important;
    }
    #pdf-report-wrapper *, #printable-report * {
      box-sizing: border-box !important;
      font-family: 'Cairo', 'Noto Sans Arabic', Arial, sans-serif !important;
    }
    #pdf-report-wrapper .bg-card, #printable-report .bg-card,
    #pdf-report-wrapper [class*="bg-card"], #printable-report [class*="bg-card"] {
      background-color: #ffffff !important;
      color: #0f172a !important;
      border: 1px solid #e2e8f0 !important;
    }
    #pdf-report-wrapper .text-muted-foreground, #printable-report .text-muted-foreground {
      color: #64748b !important;
    }
    #pdf-report-wrapper .text-foreground, #printable-report .text-foreground {
      color: #0f172a !important;
    }
    #pdf-report-wrapper .border-border, #printable-report .border-border {
      border-color: #e2e8f0 !important;
    }
    #pdf-report-wrapper table, #printable-report table {
      width: 100% !important;
      border-collapse: collapse !important;
      margin: 12px 0 !important;
      direction: rtl !important;
    }
    #pdf-report-wrapper th, #printable-report th {
      background-color: #f1f5f9 !important;
      color: #0f172a !important;
      border: 1px solid #cbd5e1 !important;
      padding: 8px 10px !important;
      font-weight: bold !important;
      text-align: right !important;
    }
    #pdf-report-wrapper td, #printable-report td {
      border: 1px solid #e2e8f0 !important;
      color: #0f172a !important;
      padding: 8px 10px !important;
      text-align: right !important;
    }
  `
  wrapper.appendChild(styleEl)
}

/**
 * Builds header element with logo, store information, and report metadata
 */
function createReportHeader(options: ReportPrintOptions): HTMLElement {
  const header = document.createElement('div')
  header.className = 'report-print-header'
  header.style.cssText = `
    text-align: center;
    padding-bottom: 20px;
    margin-bottom: 20px;
    border-bottom: 2px solid #000000;
    direction: rtl;
    unicode-bidi: embed;
  `

  const logoSrc = options.storeLogo || makersLogo

  header.innerHTML = `
    ${logoSrc ? `<img src="${logoSrc}" alt="Logo" class="logo" style="max-height: 52px; margin: 0 auto 8px auto; display: block;" />` : ''}
    <div style="font-size: 22px; font-weight: bold; margin-bottom: 6px; color: #000000;">${options.storeName}</div>
    ${options.phone || options.address ? `
      <div style="font-size: 11px; color: #555555; margin-bottom: 8px;">
        ${options.phone || ''} ${options.address ? ' • ' + options.address : ''}
      </div>
    ` : ''}
    <div style="font-size: 18px; font-weight: bold; margin-top: 10px; color: #000000;">${options.reportTitle}</div>
    <div style="font-size: 12px; color: #333333; margin-top: 6px;">
      الفترة: من ${options.dateFrom} إلى ${options.dateTo}
    </div>
    <div style="font-size: 10px; color: #777777; margin-top: 4px;">
      تاريخ الطباعة: ${new Date().toLocaleString('ar-EG', { dateStyle: 'full', timeStyle: 'short' })}
    </div>
  `
  return header
}

/**
 * Builds footer element with generation timestamp and system watermark
 */
function createReportFooter(): HTMLElement {
  const footer = document.createElement('div')
  footer.className = 'report-print-footer'
  footer.style.cssText = `
    text-align: center;
    padding-top: 16px;
    margin-top: 24px;
    border-top: 1px solid #cccccc;
    font-size: 10px;
    color: #666666;
    direction: rtl;
    unicode-bidi: embed;
  `
  footer.innerHTML = `
    MAKERS POS — تقرير مُولّد آلياً • ${new Date().toLocaleString('ar-EG')}
  `
  return footer
}

/**
 * Clones content, removes non-printable elements, and forces light mode
 */
function prepareContentClone(reportElement: HTMLElement): HTMLElement {
  const contentClone = reportElement.cloneNode(true) as HTMLElement

  // Strip out interactive buttons, inputs, selects, pagination controls
  contentClone.querySelectorAll('button, input, select, [role="button"], .no-print').forEach(el => el.remove())

  // Force light mode and RTL layout
  contentClone.style.cssText = `
    background: #ffffff !important;
    color: #000000 !important;
    direction: rtl !important;
    unicode-bidi: embed !important;
    text-align: right !important;
    width: 100% !important;
  `

  contentClone.querySelectorAll('*').forEach((el: any) => {
    if (el.style) {
      if (el.style.backgroundColor?.includes('rgb(0, 0, 0)') || el.style.backgroundColor?.includes('#000')) {
        el.style.backgroundColor = '#ffffff'
      }
      if (el.style.color?.includes('rgb(255') || el.style.color?.includes('rgb(200')) {
        el.style.color = '#000000'
      }
    }
  })

  return contentClone
}

/**
 * Generates and downloads high-resolution A4 multi-page PDF document
 */
export async function downloadReportPDF(
  reportElement: HTMLElement,
  options: ReportPrintOptions
): Promise<void> {
  // 1. Create off-screen container with standard A4 width (794px @ 96 DPI)
  const wrapper = document.createElement('div')
  wrapper.id = 'pdf-report-wrapper'
  wrapper.setAttribute('dir', 'rtl')
  wrapper.style.cssText = `
    position: fixed;
    left: -10000px;
    top: 0;
    width: 794px;
    padding: 40px 30px;
    background: #ffffff;
    color: #000000;
    font-family: 'Cairo', 'Noto Sans Arabic', Arial, sans-serif;
    font-size: 12px;
    line-height: 1.6;
    direction: rtl;
    unicode-bidi: embed;
    box-sizing: border-box;
    z-index: 99999;
  `

  appendReportStyles(wrapper)
  wrapper.appendChild(createReportHeader(options))
  wrapper.appendChild(prepareContentClone(reportElement))
  wrapper.appendChild(createReportFooter())

  document.body.appendChild(wrapper)

  try {
    // Wait for fonts to be ready
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready
    }
    await new Promise(r => setTimeout(r, 300))

    // Capture as canvas
    const canvas = await html2canvas(wrapper, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
      allowTaint: true,
      width: wrapper.scrollWidth,
      height: wrapper.scrollHeight,
      windowWidth: wrapper.scrollWidth,
      windowHeight: wrapper.scrollHeight,
    })

    // Create PDF (A4)
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    })

    const pageWidth = 210   // A4 mm
    const pageHeight = 297  // A4 mm
    const imgWidth = pageWidth
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    const imgData = canvas.toDataURL('image/png')

    // Multi-page handling
    let heightLeft = imgHeight
    let position = 0

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight

    while (heightLeft > 0) {
      position = heightLeft - imgHeight
      pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
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
 * Triggers standard browser/system print dialog with A4 portrait styling
 */
export async function printReportA4(
  reportElement: HTMLElement,
  options: ReportPrintOptions
): Promise<void> {
  const wrapper = document.createElement('div')
  wrapper.id = 'printable-report'
  wrapper.setAttribute('dir', 'rtl')
  wrapper.style.cssText = `
    direction: rtl;
    unicode-bidi: embed;
    font-family: 'Cairo', 'Noto Sans Arabic', Arial, sans-serif;
    background: #ffffff;
    color: #000000;
  `

  appendReportStyles(wrapper)
  wrapper.appendChild(createReportHeader(options))
  wrapper.appendChild(prepareContentClone(reportElement))
  wrapper.appendChild(createReportFooter())

  document.body.classList.add('printing-report')
  document.body.appendChild(wrapper)

  try {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready
    }
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
 * Captures report snapshot, copies image to clipboard, and opens WhatsApp
 */
export async function shareReportViaWhatsApp(
  reportElement: HTMLElement,
  options: ReportPrintOptions,
  recipientPhone?: string
): Promise<{ success: boolean; message: string }> {
  const wrapper = document.createElement('div')
  wrapper.id = 'printable-report'
  wrapper.setAttribute('dir', 'rtl')
  wrapper.style.cssText = `
    position: fixed;
    left: -10000px;
    top: 0;
    width: 794px;
    padding: 40px 30px;
    background: #ffffff;
    color: #000000;
    font-family: 'Cairo', 'Noto Sans Arabic', Arial, sans-serif;
    direction: rtl;
    unicode-bidi: embed;
    box-sizing: border-box;
    z-index: 99999;
  `

  appendReportStyles(wrapper)
  wrapper.appendChild(createReportHeader(options))
  wrapper.appendChild(prepareContentClone(reportElement))
  wrapper.appendChild(createReportFooter())

  document.body.appendChild(wrapper)

  try {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready
    }
    await new Promise(r => setTimeout(r, 300))

    const canvas = await html2canvas(wrapper, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
      allowTaint: true,
      width: wrapper.scrollWidth,
      height: wrapper.scrollHeight,
      windowWidth: wrapper.scrollWidth,
      windowHeight: wrapper.scrollHeight,
    })

    const blob = await canvasToBlob(canvas)
    await copyBlobToClipboard(blob)

    const dateStr = new Date().toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })
    const messageLines = [
      `📊 *${options.reportTitle}*`,
      `🏢 ${options.storeName}`,
      `📅 الفترة: من ${options.dateFrom.slice(0, 10)} إلى ${options.dateTo.slice(0, 10)}`,
      `⏱ تاريخ الإنشاء: ${dateStr}`,
      '',
      '(تم نسخ صورة التقرير الكامل للحافظة — اضغط Ctrl+V للصقها في المحادثة مباشرة)',
    ]

    const encodedMessage = encodeURIComponent(messageLines.join('\n'))
    const whatsAppUrl = getWhatsAppUrl(recipientPhone, encodedMessage)
    await openExternalUrl(whatsAppUrl)

    return {
      success: true,
      message: 'تم فتح واتساب ونسخ صورة التقرير للحافظة (Ctrl+V للصق)',
    }
  } finally {
    if (document.body.contains(wrapper)) {
      document.body.removeChild(wrapper)
    }
  }
}

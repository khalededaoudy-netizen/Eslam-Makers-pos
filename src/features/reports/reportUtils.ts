/**
 * MAKERS POS — Report Utilities
 * Export (CSV with UTF-8 BOM for Arabic) and Printing utilities
 */

import { ReportDateRange, ReportDatePreset } from './types'

export function getDateRangeFromPreset(preset: ReportDatePreset, customStart?: string, customEnd?: string): ReportDateRange {
  const now = new Date()

  if (preset === 'custom' && customStart && customEnd) {
    const start = new Date(customStart)
    start.setHours(0, 0, 0, 0)
    const end = new Date(customEnd)
    end.setHours(23, 59, 59, 999)
    return {
      preset: 'custom',
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    }
  }

  const start = new Date(now)
  const end = new Date(now)

  switch (preset) {
    case 'today': {
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      break
    }
    case 'yesterday': {
      start.setDate(start.getDate() - 1)
      start.setHours(0, 0, 0, 0)
      end.setDate(end.getDate() - 1)
      end.setHours(23, 59, 59, 999)
      break
    }
    case 'last7days': {
      start.setDate(start.getDate() - 6)
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      break
    }
    case 'last30days': {
      start.setDate(start.getDate() - 29)
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      break
    }
    case 'thisMonth': {
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      break
    }
    case 'lastMonth': {
      start.setMonth(start.getMonth() - 1)
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
      end.setDate(0)
      end.setHours(23, 59, 59, 999)
      break
    }
    default: {
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
    }
  }

  return {
    preset,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  }
}

/**
 * Exports data to CSV file with UTF-8 BOM
 */
export function exportToCSV(filename: string, headers: string[], rows: (string | number)[][]): void {
  const escapeCsv = (val: string | number) => {
    if (val === null || val === undefined) return '""'
    const str = String(val).replace(/"/g, '""')
    return `"${str}"`
  }

  const csvContent = [
    headers.map(escapeCsv).join(','),
    ...rows.map(row => row.map(escapeCsv).join(','))
  ].join('\r\n')

  // UTF-8 BOM
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Print standard report view with printable HTML
 */
export function printReport(title: string, dateRangeText: string, headers: string[], rows: (string | number)[][], isRtl = true): void {
  const printWindow = window.open('', '_blank')
  if (!printWindow) return

  const dir = isRtl ? 'rtl' : 'ltr'
  const align = isRtl ? 'right' : 'left'

  const html = `
    <!DOCTYPE html>
    <html dir="${dir}" lang="${isRtl ? 'ar' : 'en'}">
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        body {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 24px;
          color: #111827;
          direction: ${dir};
          text-align: ${align};
        }
        .header {
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 16px;
          margin-bottom: 20px;
        }
        .header h1 {
          margin: 0 0 8px 0;
          font-size: 20px;
          font-weight: 700;
        }
        .header .meta {
          font-size: 12px;
          color: #6b7280;
          display: flex;
          gap: 20px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        th, td {
          border: 1px solid #e5e7eb;
          padding: 8px 12px;
          text-align: ${align};
        }
        th {
          background-color: #f9fafb;
          font-weight: 600;
        }
        tr:nth-child(even) {
          background-color: #fcfcfd;
        }
        .footer {
          margin-top: 24px;
          font-size: 11px;
          color: #9ca3af;
          border-top: 1px solid #e5e7eb;
          padding-top: 12px;
          display: flex;
          justify-content: space-between;
        }
        @media print {
          body { padding: 0; }
          button { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${title}</h1>
        <div class="meta">
          <span><strong>MAKERS POS</strong></span>
          <span>الفترة: ${dateRangeText}</span>
          <span>تاريخ الطباعة: ${new Date().toLocaleString(isRtl ? 'ar-EG' : 'en-US')}</span>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            ${headers.map(h => `<th>${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `<tr>${row.map(c => `<td>${c ?? '—'}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
      <div class="footer">
        <span>MAKERS POS — نظام إدارة نقاط البيع والمخزون</span>
        <span>صفحة 1 من 1</span>
      </div>
      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `

  printWindow.document.write(html)
  printWindow.document.close()
}

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ClipboardList } from 'lucide-react'
import { auditService } from '@/services/audit/auditService'
import { formatDate } from '@/lib/formatters'
interface AuditLog { id: string; user_full_name: string | null; action: string; resource: string | null; details: string | null; created_at: string }
export function AuditPage() {
  const { t } = useTranslation()
  const [logs, setLogs] = useState<AuditLog[]>([])
  useEffect(() => { auditService.query({ limit: 100 }).then(setLogs as any).catch(console.error) }, [])
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-border"><h1 className="text-xl font-bold">{t('audit.title')}</h1></div>
      <div className="flex-1 overflow-auto">
        <table className="w-full data-table">
          <thead><tr><th className="text-start">{t('common.time')}</th><th className="text-start">{t('audit.user')}</th><th className="text-start">{t('audit.action')}</th><th className="text-start">{t('audit.resource')}</th><th className="text-start">{t('audit.details')}</th></tr></thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id}>
                <td className="text-xs text-muted-foreground">{formatDate(l.created_at, true)}</td>
                <td className="text-sm">{l.user_full_name ?? '—'}</td>
                <td><span className="badge status-info text-xs">{t('audit.actions.' + l.action, l.action)}</span></td>
                <td className="text-sm text-muted-foreground">{l.resource ?? '—'}</td>
                <td className="text-xs text-muted-foreground font-mono max-w-xs truncate">{l.details ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

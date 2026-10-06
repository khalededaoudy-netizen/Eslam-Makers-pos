/**
 * MAKERS POS — Logger Service
 * Structured logging with memory buffering for diagnostics and remote troubleshooting.
 */

export interface LogEntry {
  id: string
  level: 'info' | 'warn' | 'error'
  message: string
  context?: Record<string, unknown>
  timestamp: string
}

const MAX_BUFFERED_LOGS = 200

class LoggerService {
  private logs: LogEntry[] = []

  private addEntry(level: 'info' | 'warn' | 'error', message: string, context?: Record<string, unknown>): LogEntry {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
    }

    this.logs.unshift(entry)
    if (this.logs.length > MAX_BUFFERED_LOGS) {
      this.logs.length = MAX_BUFFERED_LOGS
    }

    const formattedContext = context ? ` ${JSON.stringify(context)}` : ''
    const logLine = `[${entry.timestamp}] ${message}${formattedContext}`

    if (level === 'error') {
      console.error(`[${entry.timestamp}] [ERROR] ${message}${formattedContext}`)
    } else if (level === 'warn') {
      console.warn(`[${entry.timestamp}] [WARN] ${message}${formattedContext}`)
    } else {
      console.log(`[${entry.timestamp}] [INFO] ${message}${formattedContext}`)
    }

    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      import('@tauri-apps/api/core').then(({ invoke, isTauri }) => {
        if (isTauri()) {
          const dateStr = entry.timestamp.slice(0, 10)
          invoke('append_app_log', {
            level,
            message: logLine,
            date: dateStr,
          }).catch(() => {})
        }
      }).catch(() => {})
    }

    return entry
  }

  info(message: string, context?: Record<string, unknown>) {
    return this.addEntry('info', message, context)
  }

  warn(message: string, context?: Record<string, unknown>) {
    return this.addEntry('warn', message, context)
  }

  error(message: string, context?: Record<string, unknown>) {
    return this.addEntry('error', message, context)
  }

  getLogs(): LogEntry[] {
    return [...this.logs]
  }

  clearLogs(): void {
    this.logs = []
  }

  exportLogsAsJson(): string {
    return JSON.stringify(this.logs, null, 2)
  }
}

export const logger = new LoggerService()

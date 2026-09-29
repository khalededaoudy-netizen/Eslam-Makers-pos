import React, { useEffect, useRef } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/services/i18n/i18n'
import { LoginPage } from '@/features/auth/LoginPage'
import { AppShell } from '@/components/layout/AppShell'
import { useAuthStore } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { initDatabase, seedInitialData } from '@/services/db/database'
import { authService } from '@/services/auth/authService'
import { settingsService } from '@/services/settings/settingsService'
import { Zap } from 'lucide-react'

function AppBootstrap() {
  const { isAuthenticated, token, setUser, clearUser, isLoading, setLoading } = useAuthStore()
  const { language, theme, setLanguage, setTheme } = useSettingsStore()
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    // Apply stored theme and language initially
    document.documentElement.lang = language
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.classList.toggle('light', theme === 'light')

    async function boot() {
      try {
        // Initialize database
        await initDatabase()

        // Seed admin on first run with default password
        const defaultHash = await authService.hashPassword('admin123')
        await seedInitialData(defaultHash)

        // Initialize and load authoritative settings from SQLite
        await settingsService.initSettings()
        await useSettingsStore.getState().loadFromDb()

        // Validate existing session if any
        if (token) {
          const user = await authService.validateSession(token)
          if (user) {
            setUser(user, token)
          } else {
            clearUser()
          }
        }

        // Clean expired sessions periodically
        await authService.cleanExpiredSessions()
      } catch (err) {
        console.error('App boot error:', err)
        clearUser()
      } finally {
        setLoading(false)
      }
    }

    boot()
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center animate-pulse-ring">
            <Zap className="w-8 h-8 text-primary" />
          </div>
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-primary/60 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <p className="text-sm text-muted-foreground">MAKERS POS</p>
        </div>
      </div>
    )
  }

  return isAuthenticated ? <AppShell /> : <LoginPage />
}

export default function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <BrowserRouter>
        <AppBootstrap />
      </BrowserRouter>
    </I18nextProvider>
  )
}

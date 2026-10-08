import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Zap, Eye, EyeOff, Loader2, Linkedin } from 'lucide-react'
import { authService } from '@/services/auth/authService'
import { useAuthStore } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { openExternalUrl, DEVELOPER_LINKEDIN_URL } from '@/lib/openUrl'

export function LoginPage() {
  const { t } = useTranslation()
  const { setUser, setLoading } = useAuthStore()
  const { language, setLanguage } = useSettingsStore()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) return

    setIsSubmitting(true)
    setError('')

    const result = await authService.login(username.trim(), password)

    if (result.success && result.user && result.token) {
      setUser(result.user, result.token)
    } else {
      setError(t(`auth.errors.${result.error}`, t('auth.errors.system_error')))
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    setLoading(false)
  }, [setLoading])

  const toggleLanguage = () => {
    setLanguage(language === 'ar' ? 'en' : 'ar')
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -start-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -end-40 w-96 h-96 rounded-full bg-accent/5 blur-3xl" />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--border)) 1px, transparent 1px),
              linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo & Brand */}
        <div className="text-center mb-8 animate-fade-in">
          <img src="/logo.png" alt="MAKERS" className="h-16 mx-auto mb-4 object-contain" />
          <h1 className="text-3xl font-bold gradient-text mb-1">
            {t('app.name')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('app.subtitle')}
          </p>
        </div>

        {/* Login Card */}
        <div className="glass rounded-2xl p-8 shadow-2xl animate-fade-in">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-foreground">{t('auth.login')}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t('auth.welcomeSub')}</p>
          </div>

          <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="login-username">
                {t('auth.username')}
              </label>
              <input
                id="login-username"
                type="text"
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-input border border-border text-foreground
                           placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring
                           focus:border-transparent transition-all duration-150 text-sm"
                placeholder={t('auth.username')}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                autoFocus
                disabled={isSubmitting}
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="login-password">
                {t('auth.password')}
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 px-3 pe-10 rounded-lg bg-input border border-border text-foreground
                             placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring
                             focus:border-transparent transition-all duration-150 text-sm"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm animate-fade-in">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || !username.trim() || !password.trim()}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold
                         rounded-lg transition-all duration-150 flex items-center justify-center gap-2
                         disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('auth.loggingIn')}
                </>
              ) : (
                t('auth.loginButton')
              )}
            </button>
          </form>
        </div>

        {/* Language toggle */}
        <div className="text-center mt-4">
          <button
            onClick={toggleLanguage}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {language === 'ar' ? 'English' : 'العربية'}
          </button>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 space-y-1.5">
          <p className="text-xs text-muted-foreground">
            MAKERS POS v1.0 — {t('app.subtitle')}
          </p>
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/80 flex-wrap">
            <span>{t('auth.developerCredit')}</span>
            <span className="text-muted-foreground/40">·</span>
            <a
              href={DEVELOPER_LINKEDIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault()
                openExternalUrl(DEVELOPER_LINKEDIN_URL)
              }}
              className="inline-flex items-center gap-1 text-primary hover:text-primary/80 hover:underline font-medium transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded px-0.5"
              aria-label={`${t('auth.linkedin')} - Khaled Eldaoudy`}
            >
              <Linkedin className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t('auth.linkedin')}</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

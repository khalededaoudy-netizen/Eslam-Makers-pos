import React from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ShieldAlert, ArrowLeft, ArrowRight, Home, ShoppingCart } from 'lucide-react'
import { useAuthStore, usePermission } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'

interface ProtectedRouteProps {
  resource: string
  action?: string
  children: React.ReactNode
}

export function ProtectedRoute({ resource, action = 'read', children }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore()
  const { can, isAdmin } = usePermission()
  const { language } = useSettingsStore()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const isRTL = language === 'ar'

  if (!isAuthenticated || !user) {
    return <Navigate to="/" replace />
  }

  const hasAccess = isAdmin || can(action, resource)

  if (!hasAccess) {
    // Default fallback route for users without dashboard access (e.g. cashiers)
    const fallbackRoute = can('access', 'pos') || can('create', 'pos') ? '/pos' : '/'

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
        <div className="w-20 h-20 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mb-6 shadow-lg shadow-destructive/5">
          <ShieldAlert className="w-10 h-10 text-destructive animate-pulse" />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">
          {t('rbac.accessDenied', '403 — غير مصرح بالوصول')}
        </h1>

        <p className="text-muted-foreground max-w-md mb-6 text-sm leading-relaxed">
          {t(
            'rbac.noPermissionMessage',
            'عذراً، ليس لديك الصلاحيات الكافية للوصول إلى هذه الصفحة أو تنفيذ هذه العملية. يرجى التواصل مع مسؤول النظام إذا كنت تعتقد أن هذا خطأ.'
          )}
        </p>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-foreground transition-colors flex items-center gap-2 text-sm font-medium"
          >
            {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            {t('common.back', 'رجوع')}
          </button>

          <button
            onClick={() => navigate(fallbackRoute)}
            className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors flex items-center gap-2 text-sm font-medium shadow-sm"
          >
            {fallbackRoute === '/pos' ? (
              <>
                <ShoppingCart className="w-4 h-4" />
                {t('nav.pos', 'نقطة البيع')}
              </>
            ) : (
              <>
                <Home className="w-4 h-4" />
                {t('nav.dashboard', 'لوحة التحكم')}
              </>
            )}
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

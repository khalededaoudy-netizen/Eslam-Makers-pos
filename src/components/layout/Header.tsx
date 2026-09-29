import React from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Globe, Sun, Moon } from 'lucide-react'
import { useSettingsStore, Language, Theme } from '@/stores/settingsStore'
import { useAuthStore } from '@/stores/authStore'

const routeTitles: Record<string, { labelKey: string; defaultLabel: string }> = {
  '/': { labelKey: 'nav.dashboard', defaultLabel: 'لوحة التحكم' },
  '/pos': { labelKey: 'nav.pos', defaultLabel: 'نقطة البيع' },
  '/sales': { labelKey: 'nav.sales', defaultLabel: 'المبيعات' },
  '/returns': { labelKey: 'nav.returns', defaultLabel: 'المرتجعات' },
  '/products': { labelKey: 'nav.products', defaultLabel: 'المنتجات' },
  '/products/categories': { labelKey: 'products.categories', defaultLabel: 'التصنيفات' },
  '/products/brands': { labelKey: 'brands.title', defaultLabel: 'العلامات التجارية' },
  '/products/attributes': { labelKey: 'products.attributes', defaultLabel: 'الخصائص' },
  '/products/units': { labelKey: 'products.units', defaultLabel: 'الوحدات' },
  '/inventory': { labelKey: 'nav.inventory', defaultLabel: 'المخزون' },
  '/purchases': { labelKey: 'nav.purchases', defaultLabel: 'المشتريات' },
  '/suppliers': { labelKey: 'nav.suppliers', defaultLabel: 'الموردين' },
  '/customers': { labelKey: 'nav.customers', defaultLabel: 'العملاء' },
  '/cash-register': { labelKey: 'nav.cashRegister', defaultLabel: 'الخزينة والورديات' },
  '/expenses': { labelKey: 'nav.expenses', defaultLabel: 'المصروفات' },
  '/reports': { labelKey: 'nav.reports', defaultLabel: 'التقارير' },
  '/users': { labelKey: 'nav.users', defaultLabel: 'المستخدمين' },
  '/settings': { labelKey: 'nav.settings', defaultLabel: 'الإعدادات' },
  '/barcodes': { labelKey: 'nav.barcodes', defaultLabel: 'استيكرات الباركود' },
  '/audit': { labelKey: 'nav.audit', defaultLabel: 'سجل العمليات' },
}

export function Header() {
  const { t } = useTranslation()
  const location = useLocation()
  const { language, theme, setLanguage, setTheme, storeName, storeNameAr } = useSettingsStore()
  const { user } = useAuthStore()

  const currentPath = location.pathname
  const matchedRoute = routeTitles[currentPath] ||
    Object.entries(routeTitles).find(([path]) => path !== '/' && currentPath.startsWith(path))?.[1]

  const pageTitle = matchedRoute ? t(matchedRoute.labelKey, matchedRoute.defaultLabel) : ''

  const handleToggleLanguage = async () => {
    const nextLang: Language = language === 'ar' ? 'en' : 'ar'
    await setLanguage(nextLang, user)
  }

  const handleToggleTheme = async () => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark'
    await setTheme(nextTheme, user)
  }

  const isRTL = language === 'ar'

  return (
    <header className="h-12 border-b border-border bg-card/75 backdrop-blur-md px-5 flex items-center justify-between shrink-0 z-20 select-none">
      {/* Start side: Page Context & Store Name */}
      <div className="flex items-center gap-3 min-w-0">
        <h2 className="text-sm font-semibold text-foreground truncate">
          {pageTitle}
        </h2>
        <span className="hidden sm:inline-block text-xs text-muted-foreground/40">•</span>
        <span className="hidden sm:inline-block text-xs text-muted-foreground truncate font-medium">
          {isRTL ? (storeNameAr || storeName) : storeName}
        </span>
      </div>

      {/* End side: Language & Theme Toggles */}
      <div className="flex items-center gap-2">
        {/* Language Toggle */}
        <button
          type="button"
          onClick={handleToggleLanguage}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-all duration-150 text-xs font-medium shadow-sm active:scale-95"
          title={language === 'ar' ? 'Switch to English' : 'التحويل إلى العربية'}
          aria-label="Toggle language"
        >
          <Globe className="w-3.5 h-3.5 text-primary shrink-0" />
          <span>{language === 'ar' ? 'English' : 'عربي'}</span>
        </button>

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={handleToggleTheme}
          className="flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-all duration-150 shadow-sm active:scale-95"
          title={theme === 'dark' ? t('settings.light', 'الوضع الفاتح') : t('settings.dark', 'الوضع الداكن')}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400 transition-transform duration-200 hover:rotate-45" />
          ) : (
            <Moon className="w-4 h-4 text-primary transition-transform duration-200 hover:-rotate-12" />
          )}
        </button>
      </div>
    </header>
  )
}

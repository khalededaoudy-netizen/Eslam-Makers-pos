import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  TrendingUp,
  DollarSign,
  RotateCcw,
  Receipt,
  ShoppingBag,
  Package,
  Users,
  Building2,
  Wallet,
  CreditCard,
  Layers,
} from 'lucide-react'
import { ReportSection } from '../types'

interface ReportSidebarProps {
  activeSection: ReportSection
  onSelectSection: (section: ReportSection) => void
}

export function ReportSidebar({ activeSection, onSelectSection }: ReportSidebarProps) {
  const { t } = useTranslation()

  const sections: Array<{ id: ReportSection; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'overview', label: t('reports.overview'), icon: LayoutDashboard },
    { id: 'sales', label: t('reports.sales'), icon: TrendingUp },
    { id: 'profit', label: t('reports.profit'), icon: DollarSign },
    { id: 'returns', label: t('reports.returns'), icon: RotateCcw },
    { id: 'expenses', label: t('reports.expenses'), icon: Receipt },
    { id: 'purchases', label: t('reports.purchases'), icon: ShoppingBag },
    { id: 'inventory', label: t('reports.inventory'), icon: Package },
    { id: 'customers', label: t('reports.customers'), icon: Users },
    { id: 'suppliers', label: t('reports.suppliers'), icon: Building2 },
    { id: 'cash_shifts', label: t('reports.cashShifts'), icon: Wallet },
    { id: 'payments', label: t('reports.payments'), icon: CreditCard },
    { id: 'products_categories', label: t('reports.productsCategories'), icon: Layers },
  ]

  return (
    <aside className="w-64 border-e border-border bg-card/40 flex flex-col shrink-0">
      <div className="p-4 border-b border-border">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {t('reports.title')}
        </h2>
      </div>
      <nav className="p-2 space-y-1 flex-1 overflow-y-auto">
        {sections.map(sec => {
          const Icon = sec.icon
          const isActive = activeSection === sec.id
          return (
            <button
              key={sec.id}
              onClick={() => onSelectSection(sec.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
              <span className="truncate text-start">{sec.label}</span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}

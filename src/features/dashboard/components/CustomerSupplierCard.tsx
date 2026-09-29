/**
 * MAKERS POS — Customer & Supplier Overview Card
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { Users, Building2, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CustomerSummary, SupplierSummary } from '../types'

interface CustomerSupplierCardProps {
  customers: CustomerSummary
  suppliers: SupplierSummary
}

export function CustomerSupplierCard({ customers, suppliers }: CustomerSupplierCardProps) {
  const { t, i18n } = useTranslation()
  const isRtl = i18n.language === 'ar'

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Customers Card */}
      <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">{t('dashboard.customersSummary')}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {customers.totalCustomers} {isRtl ? 'عميل مسجل' : 'customers'}
              </p>
            </div>
          </div>

          <Link
            to="/customers"
            className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
          >
            <span>{t('dashboard.viewAll')}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl border border-border bg-background/50 space-y-0.5">
            <span className="text-[11px] text-muted-foreground font-medium">
              {t('dashboard.activeCustomers')}
            </span>
            <p className="font-bold text-foreground text-sm">{customers.activeCustomers}</p>
          </div>

          <div className="p-3 rounded-xl border border-border bg-background/50 space-y-0.5">
            <span className="text-[11px] text-muted-foreground font-medium">
              {t('dashboard.newCustomers')}
            </span>
            <p className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
              +{customers.newCustomersInPeriod}
            </p>
          </div>
        </div>
      </div>

      {/* Suppliers Card */}
      <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">{t('dashboard.suppliersSummary')}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {suppliers.totalSuppliers} {isRtl ? 'مورد مسجل' : 'suppliers'}
              </p>
            </div>
          </div>

          <Link
            to="/suppliers"
            className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
          >
            <span>{t('dashboard.viewAll')}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl border border-border bg-background/50 space-y-0.5">
            <span className="text-[11px] text-muted-foreground font-medium">
              {t('dashboard.activeSuppliers')}
            </span>
            <p className="font-bold text-foreground text-sm">{suppliers.activeSuppliers}</p>
          </div>

          <div className="p-3 rounded-xl border border-border bg-background/50 space-y-0.5">
            <span className="text-[11px] text-muted-foreground font-medium">
              {t('dashboard.suppliersWithBalance')}
            </span>
            <p className="font-bold text-amber-600 dark:text-amber-400 text-sm">
              {suppliers.suppliersWithBalance}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Wallet,
  Play,
  Lock,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  Store,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { useAuthStore, usePermission } from '@/stores/authStore'
import { cashRegisterService } from './cashRegisterService'
import {
  CashRegister,
  Shift,
  CashMovement,
  ShiftReconciliation,
  OpenShiftInput,
  CloseShiftInput,
  CreateCashMovementInput,
} from './types'
import { ShiftReconciliationCard } from './components/ShiftReconciliationCard'
import { OpenShiftModal } from './components/OpenShiftModal'
import { CloseShiftModal } from './components/CloseShiftModal'
import { CashMovementModal } from './components/CashMovementModal'
import { CashMovementsTable } from './components/CashMovementsTable'

export function CashRegisterPage() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const { can, isAdmin } = usePermission()

  const [registers, setRegisters] = useState<CashRegister[]>([])
  const [activeShift, setActiveShift] = useState<Shift | null>(null)
  const [reconciliation, setReconciliation] = useState<ShiftReconciliation | null>(null)
  const [movements, setMovements] = useState<CashMovement[]>([])
  const [loading, setLoading] = useState(true)

  // Modals state
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false)
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false)
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false)
  const [movementDirection, setMovementDirection] = useState<'in' | 'out'>('in')

  // RBAC Permissions
  const canOpen = isAdmin || can('create', 'shifts')
  const canClose = isAdmin || can('close', 'shifts')
  const canCashIn = isAdmin || can('cash_in', 'shifts')
  const canCashOut = isAdmin || can('cash_out', 'shifts')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const regList = await cashRegisterService.getCashRegisters()
      setRegisters(regList)

      const currentShift = await cashRegisterService.getActiveShift(user?.id)
      setActiveShift(currentShift)

      if (currentShift) {
        const [recon, movList] = await Promise.all([
          cashRegisterService.getShiftReconciliation(currentShift.id),
          cashRegisterService.getCashMovements({ shiftId: currentShift.id }),
        ])
        setReconciliation(recon)
        setMovements(movList)
      } else {
        setReconciliation(null)
        const recentMovements = await cashRegisterService.getCashMovements({ limit: 50 })
        setMovements(recentMovements)
      }
    } catch (err) {
      console.error('Failed to load cash register data:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Shift Handlers
  const handleOpenShift = async (input: OpenShiftInput) => {
    if (!user) return
    await cashRegisterService.openShift(input, {
      id: user.id,
      fullName: user.fullName,
      role: user.roleName,
    })
    await loadData()
  }

  const handleCloseShift = async (input: CloseShiftInput) => {
    if (!user) return
    await cashRegisterService.closeShift(input, {
      id: user.id,
      fullName: user.fullName,
      role: user.roleName,
    })
    await loadData()
  }

  const handleRecordMovement = async (input: CreateCashMovementInput) => {
    if (!user) return
    await cashRegisterService.recordCashMovement(input, {
      id: user.id,
      fullName: user.fullName,
      role: user.roleName,
    })
    await loadData()
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-card/50 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            <span>{t('nav.cashRegister', 'الخزينة والورديات')}</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t(
              'cashRegister.subtitle',
              'إدارة ورديات الكاشير، رصيد الدرج، الإيداعات والمسحوبات والمطابقة المالية'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadData()}
            className="p-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={t('common.refresh', 'تحديث')}
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {!activeShift && canOpen && (
            <button
              type="button"
              onClick={() => setIsOpenShiftModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm"
            >
              <Play className="w-4 h-4 fill-primary-foreground" />
              <span>{t('cashRegister.openShift', 'فتح وردية جديدة')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Active Shift / Reconciliation Card */}
        <ShiftReconciliationCard
          shift={activeShift}
          reconciliation={reconciliation}
          canOpen={canOpen}
          canClose={canClose}
          canCashIn={canCashIn}
          canCashOut={canCashOut}
          onOpenShift={() => setIsOpenShiftModalOpen(true)}
          onCloseShift={() => setIsCloseShiftModalOpen(true)}
          onCashIn={() => {
            setMovementDirection('in')
            setIsMovementModalOpen(true)
          }}
          onCashOut={() => {
            setMovementDirection('out')
            setIsMovementModalOpen(true)
          }}
        />

        {/* Movements Ledger Table */}
        <CashMovementsTable movements={movements} loading={loading} />
      </div>

      {/* Open Shift Modal */}
      <OpenShiftModal
        isOpen={isOpenShiftModalOpen}
        onClose={() => setIsOpenShiftModalOpen(false)}
        registers={registers}
        onOpenShift={handleOpenShift}
      />

      {/* Close Shift Modal */}
      {activeShift && reconciliation && (
        <CloseShiftModal
          isOpen={isCloseShiftModalOpen}
          onClose={() => setIsCloseShiftModalOpen(false)}
          shiftId={activeShift.id}
          expectedCash={reconciliation.expectedPhysicalCash}
          onCloseShift={handleCloseShift}
        />
      )}

      {/* Cash In / Out Movement Modal */}
      {activeShift && (
        <CashMovementModal
          isOpen={isMovementModalOpen}
          onClose={() => setIsMovementModalOpen(false)}
          shiftId={activeShift.id}
          registerId={activeShift.register_id}
          defaultDirection={movementDirection}
          onSubmitMovement={handleRecordMovement}
        />
      )}
    </div>
  )
}

/**
 * MAKERS POS — Cash Register & Shift Types
 */

import { PaymentMethodType } from '@/features/payments/types'

export type ShiftStatus = 'open' | 'closed'

export type CashMovementType =
  | 'opening'
  | 'sale_cash'
  | 'cash_in'
  | 'cash_out'
  | 'refund'
  | 'closing'
  | 'adjustment'

export interface CashRegister {
  id: string
  name: string
  name_ar: string | null
  code: string | null
  is_active: number
  created_at: string
  updated_at: string
}

export interface Shift {
  id: string
  register_id: string
  user_id: string
  status: ShiftStatus
  opening_balance: number
  closing_balance: number | null
  expected_balance: number | null
  difference: number | null
  cash_sales: number
  cash_refunds: number
  cash_expenses: number
  cash_withdrawals: number
  cash_deposits: number
  notes: string | null
  opened_at: string
  closed_at: string | null
  created_at: string
  updated_at: string
  // Joins
  register_name?: string
  user_full_name?: string
}

export interface CashMovement {
  id: string
  register_id: string
  shift_id: string
  user_id: string
  amount: number
  type: CashMovementType
  direction: 'in' | 'out'
  reason: string | null
  reference_id: string | null
  reference_type: string | null
  notes: string | null
  created_at: string
  // Joins
  user_full_name?: string
  register_name?: string
}

export interface ShiftReconciliation {
  shiftId: string
  status: ShiftStatus
  openedAt: string
  closedAt: string | null
  openingBalance: number
  totalCashIn: number
  totalCashSales: number
  totalCashOut: number
  totalCashRefunds: number
  expectedPhysicalCash: number
  actualCashCounted: number | null
  difference: number | null
  paymentsByMethod: Record<PaymentMethodType, number>
  totalAllPayments: number
}

export interface OpenShiftInput {
  registerId: string
  openingBalance: number
  notes?: string | null
}

export interface CloseShiftInput {
  shiftId: string
  actualCash: number
  notes?: string | null
}

export interface CreateCashMovementInput {
  shiftId: string
  registerId: string
  amount: number
  type: 'cash_in' | 'cash_out' | 'adjustment'
  direction: 'in' | 'out'
  reason: string
  notes?: string | null
}

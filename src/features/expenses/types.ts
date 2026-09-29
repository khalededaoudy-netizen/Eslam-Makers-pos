/**
 * MAKERS POS — Expenses Types
 */

import { PaymentMethodType } from '@/features/payments/types'

export type ExpenseStatus = 'completed' | 'cancelled'

export interface ExpenseCategory {
  id: string
  name?: string | null
  nameAr: string
  nameEn: string
  icon?: string | null
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export interface Expense {
  id: string
  expenseNumber: string
  categoryId?: string | null
  categoryNameAr?: string | null
  categoryNameEn?: string | null
  categoryName?: string | null
  supplierId?: string | null
  supplierName?: string | null
  shiftId?: string | null
  registerId?: string | null
  registerName?: string | null
  userId: string
  userName?: string | null
  amount: number
  paymentMethod: PaymentMethodType
  affectsCash: boolean
  description: string
  reference?: string | null
  notes?: string | null
  status: ExpenseStatus
  expenseDate: string
  receiptPath?: string | null
  createdAt: string
  updatedAt?: string
}

export interface CreateExpenseInput {
  categoryId?: string
  supplierId?: string
  amount: number
  paymentMethod: PaymentMethodType
  description: string
  reference?: string
  notes?: string
  expenseDate?: string
  shiftId?: string
  registerId?: string
}

export interface UpdateExpenseInput {
  categoryId?: string
  supplierId?: string
  description?: string
  reference?: string
  notes?: string
}

export interface CreateExpenseCategoryInput {
  nameAr: string
  nameEn: string
  name?: string
  icon?: string
}

export interface UpdateExpenseCategoryInput {
  nameAr?: string
  nameEn?: string
  name?: string
  icon?: string
  isActive?: boolean
}

export interface ExpenseFilter {
  search?: string
  categoryId?: string
  supplierId?: string
  paymentMethod?: PaymentMethodType | 'all'
  status?: ExpenseStatus | 'all'
  startDate?: string
  endDate?: string
  shiftId?: string
  page?: number
  limit?: number
}

export interface ExpenseSummary {
  totalExpenses: number
  cashExpenses: number
  nonCashExpenses: number
  todayExpenses: number
  currentShiftExpenses: number
  expenseCount: number
}

export interface ExpenseVoucherData {
  storeName: string
  storePhone?: string
  storeAddress?: string
  expenseNumber: string
  date: string
  categoryName: string
  description: string
  amount: number
  paymentMethod: string
  reference?: string
  supplierName?: string
  userName: string
  shiftId?: string
  registerName?: string
  notes?: string
  status: ExpenseStatus
}

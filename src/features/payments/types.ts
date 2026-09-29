/**
 * MAKERS POS — Payment Types & Definitions
 */

export type PaymentMethodType =
  | 'cash'
  | 'instapay'
  | 'wallet'

export interface PaymentMethodConfig {
  id: PaymentMethodType
  nameAr: string
  nameEn: string
  isPhysicalCash: boolean
  icon: string
  color: string
}

export const PAYMENT_METHODS: Record<PaymentMethodType, PaymentMethodConfig> = {
  cash: {
    id: 'cash',
    nameAr: 'نقداً (كاش)',
    nameEn: 'Cash',
    isPhysicalCash: true,
    icon: 'banknote',
    color: 'emerald',
  },
  instapay: {
    id: 'instapay',
    nameAr: 'إنستاباي (InstaPay)',
    nameEn: 'InstaPay',
    isPhysicalCash: false,
    icon: 'smartphone',
    color: 'purple',
  },
  wallet: {
    id: 'wallet',
    nameAr: 'محفظة إلكترونية',
    nameEn: 'E-Wallet',
    isPhysicalCash: false,
    icon: 'wallet',
    color: 'rose',
  },
}

export interface PaymentRecord {
  id: string
  sale_id?: string | null
  shift_id: string
  register_id?: string | null
  user_id: string
  customer_id?: string | null
  method: PaymentMethodType
  amount: number
  reference?: string | null
  notes?: string | null
  created_at: string
}

export interface CreatePaymentInput {
  saleId?: string | null
  shiftId: string
  registerId?: string | null
  userId: string
  customerId?: string | null
  method: PaymentMethodType
  amount: number
  reference?: string | null
  notes?: string | null
}

export interface SplitPaymentInput {
  saleId?: string | null
  shiftId: string
  registerId?: string | null
  userId: string
  customerId?: string | null
  payments: Array<{
    method: PaymentMethodType
    amount: number
    reference?: string | null
    notes?: string | null
  }>
}

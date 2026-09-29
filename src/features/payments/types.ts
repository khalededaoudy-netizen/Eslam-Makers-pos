/**
 * MAKERS POS — Payment Types & Definitions
 */

export type PaymentMethodType =
  | 'cash'
  | 'card'
  | 'instapay'
  | 'vodafone_cash'
  | 'bank_transfer'
  | 'other'

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
  card: {
    id: 'card',
    nameAr: 'بطاقة بنكية / فيزا',
    nameEn: 'Credit / Debit Card',
    isPhysicalCash: false,
    icon: 'credit-card',
    color: 'blue',
  },
  instapay: {
    id: 'instapay',
    nameAr: 'إنستاباي (InstaPay)',
    nameEn: 'InstaPay',
    isPhysicalCash: false,
    icon: 'zap',
    color: 'purple',
  },
  vodafone_cash: {
    id: 'vodafone_cash',
    nameAr: 'فودافون كاش / محافظ إلكترونية',
    nameEn: 'Vodafone Cash / Wallets',
    isPhysicalCash: false,
    icon: 'smartphone',
    color: 'rose',
  },
  bank_transfer: {
    id: 'bank_transfer',
    nameAr: 'تحويل بنكي مباشر',
    nameEn: 'Bank Transfer',
    isPhysicalCash: false,
    icon: 'building',
    color: 'amber',
  },
  other: {
    id: 'other',
    nameAr: 'طريقة دفع أخرى',
    nameEn: 'Other Payment Method',
    isPhysicalCash: false,
    icon: 'more-horizontal',
    color: 'slate',
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

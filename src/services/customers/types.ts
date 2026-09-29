/**
 * MAKERS POS — Customer Types & Interfaces
 */

export type CustomerType = 'individual' | 'company' | 'student' | 'lab' | 'vip'

export interface Customer {
  id: string
  customer_code: string
  name: string
  phone: string | null
  phone2: string | null
  whatsapp: string | null
  email: string | null
  address: string | null
  notes: string | null
  customer_type: CustomerType
  credit_limit: number
  balance: number
  is_active: number
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface CustomerListItem extends Customer {
  sales_count?: number
  last_sale_at?: string | null
}

export interface CreateCustomerInput {
  customer_code?: string
  name: string
  phone?: string | null
  phone2?: string | null
  whatsapp?: string | null
  email?: string | null
  address?: string | null
  notes?: string | null
  customer_type?: CustomerType
  credit_limit?: number
}

export interface UpdateCustomerInput {
  name?: string
  phone?: string | null
  phone2?: string | null
  whatsapp?: string | null
  email?: string | null
  address?: string | null
  notes?: string | null
  customer_type?: CustomerType
  credit_limit?: number
}

export interface DuplicateCustomerMatch {
  isDuplicate: boolean
  matchedField: 'phone' | 'whatsapp' | 'email' | 'code' | null
  matchedCustomer: Customer | null
}

export interface CustomerFilterOptions {
  search?: string
  status?: 'all' | 'active' | 'archived'
  customerType?: CustomerType | 'all'
  hasBalance?: boolean
  limit?: number
  offset?: number
}

export interface CustomerOverview {
  totalCustomers: number
  activeCustomers: number
  archivedCustomers: number
  totalReceivables: number
  withBalanceCount: number
}

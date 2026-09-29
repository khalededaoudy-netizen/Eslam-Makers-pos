/**
 * MAKERS POS — Complete SQLite Database Schema
 * Using Drizzle ORM syntax for type-safe queries
 *
 * All timestamps stored as ISO-8601 strings (SQLite TEXT).
 * Foreign keys enforced via SQLite PRAGMA foreign_keys = ON.
 */

import { sql } from 'drizzle-orm'
import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/sqlite-core'

// ─── Helpers ────────────────────────────────────────────────────────────────

const timestamps = {
  createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`),
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. USERS & ROLES
// ─────────────────────────────────────────────────────────────────────────────

export const roles = sqliteTable('roles', {
  id:          text('id').primaryKey(),
  name:        text('name').notNull().unique(),          // admin | manager | cashier
  displayName: text('display_name').notNull(),
  displayNameAr: text('display_name_ar').notNull(),
  isSystem:    integer('is_system', { mode: 'boolean' }).notNull().default(false),
  ...timestamps,
})

export const permissions = sqliteTable('permissions', {
  id:       text('id').primaryKey(),
  roleId:   text('role_id').notNull().references(() => roles.id),
  resource: text('resource').notNull(),                 // products | sales | users | ...
  action:   text('action').notNull(),                   // create | read | update | delete
  allowed:  integer('allowed', { mode: 'boolean' }).notNull().default(true),
}, (t) => ({
  roleResourceAction: uniqueIndex('perm_role_resource_action').on(t.roleId, t.resource, t.action),
}))

export const users = sqliteTable('users', {
  id:           text('id').primaryKey(),
  username:     text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  fullName:     text('full_name').notNull(),
  fullNameAr:   text('full_name_ar'),
  email:        text('email'),
  phone:        text('phone'),
  roleId:       text('role_id').notNull().references(() => roles.id),
  isActive:     integer('is_active', { mode: 'boolean' }).notNull().default(true),
  lastLoginAt:  text('last_login_at'),
  avatarPath:   text('avatar_path'),
  ...timestamps,
})

export const sessions = sqliteTable('sessions', {
  id:        text('id').primaryKey(),
  userId:    text('user_id').notNull().references(() => users.id),
  token:     text('token').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`),
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

export const settings = sqliteTable('settings', {
  key:         text('key').primaryKey(),
  value:       text('value'),
  category:    text('category').notNull().default('general'),
  description: text('description'),
  updatedAt:   text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`),
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. PRODUCTS
// ─────────────────────────────────────────────────────────────────────────────

export const productCategories = sqliteTable('product_categories', {
  id:          text('id').primaryKey(),
  nameAr:      text('name_ar').notNull(),
  nameEn:      text('name_en').notNull(),
  parentId:    text('parent_id'),                       // self-reference for hierarchy
  description: text('description'),
  color:       text('color'),                           // hex color for UI
  icon:        text('icon'),                            // lucide icon name
  isActive:    integer('is_active', { mode: 'boolean' }).notNull().default(true),
  sortOrder:   integer('sort_order').notNull().default(0),
  ...timestamps,
})

export const productUnits = sqliteTable('product_units', {
  id:          text('id').primaryKey(),
  nameAr:      text('name_ar').notNull(),
  nameEn:      text('name_en').notNull(),
  symbol:      text('symbol').notNull(),                // pcs, m, kg, ...
  allowDecimal: integer('allow_decimal', { mode: 'boolean' }).notNull().default(false),
  isActive:    integer('is_active', { mode: 'boolean' }).notNull().default(true),
  ...timestamps,
})

export const brands = sqliteTable('brands', {
  id:       text('id').primaryKey(),
  name:     text('name').notNull().unique(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  ...timestamps,
})

export const products = sqliteTable('products', {
  id:             text('id').primaryKey(),
  sku:            text('sku').notNull().unique(),
  nameAr:         text('name_ar').notNull(),
  nameEn:         text('name_en').notNull(),
  description:    text('description'),
  descriptionAr:  text('description_ar'),
  categoryId:     text('category_id').references(() => productCategories.id),
  unitId:         text('unit_id').notNull().references(() => productUnits.id),
  brandId:        text('brand_id').references(() => brands.id),
  defaultSupplierId: text('default_supplier_id'),       // FK added after suppliers table
  purchasePrice:  real('purchase_price').notNull().default(0),
  sellingPrice:   real('selling_price').notNull().default(0),
  currentStock:   real('current_stock').notNull().default(0),
  minStock:       real('min_stock').notNull().default(0),
  imagePath:      text('image_path'),
  isActive:       integer('is_active', { mode: 'boolean' }).notNull().default(true),
  drawerLocation:    text('drawer_location'),
  footprintPackage:  text('footprint_package'),
  datasheetUrl:      text('datasheet_url'),
  // External source metadata (e.g. MAKERS Electronics website)
  sourceType:        text('source_type').notNull().default('LOCAL'), // LOCAL | MAKERS_WEBSITE
  externalProductId: text('external_product_id'),
  externalSku:       text('external_sku'),
  externalUrl:       text('external_url'),
  websitePrice:      real('website_price'),
  lastSyncedAt:      text('last_synced_at'),
  notes:          text('notes'),
  ...timestamps,
}, (t) => ({
  skuIdx:         index('products_sku_idx').on(t.sku),
  categoryIdx:    index('products_category_idx').on(t.categoryId),
  activeIdx:      index('products_active_idx').on(t.isActive),
  extProdIdIdx:   index('products_ext_prod_id_idx').on(t.externalProductId),
  extSkuIdx:      index('products_ext_sku_idx').on(t.externalSku),
}))

/** Multiple barcodes per product (manufacturer + store-generated) */
export const productBarcodes = sqliteTable('product_barcodes', {
  id:        text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  barcode:   text('barcode').notNull().unique(),
  type:      text('type').notNull().default('code128'),  // code128 | ean13 | qr
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  isPrinted: integer('is_printed', { mode: 'boolean' }).notNull().default(false),
  source:    text('source').notNull().default('manual'), // manual | auto | manufacturer
  ...timestamps,
}, (t) => ({
  barcodeIdx:  index('barcodes_barcode_idx').on(t.barcode),
  productIdx:  index('barcodes_product_idx').on(t.productId),
}))

/** Dynamic attribute definitions (Resistance, Voltage, Color, etc.) */
export const productAttributeDefs = sqliteTable('product_attribute_defs', {
  id:          text('id').primaryKey(),
  nameAr:      text('name_ar').notNull(),
  nameEn:      text('name_en').notNull(),
  unit:        text('unit'),                             // Ω, V, A, mm, ...
  categoryId:  text('category_id'),                     // optional per-category scope
  dataType:    text('data_type').notNull().default('text'), // text | number | boolean
  sortOrder:   integer('sort_order').notNull().default(0),
  ...timestamps,
})

export const productAttributeValues = sqliteTable('product_attribute_values', {
  id:          text('id').primaryKey(),
  productId:   text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  attributeId: text('attribute_id').notNull().references(() => productAttributeDefs.id),
  value:       text('value').notNull(),
}, (t) => ({
  productAttr: uniqueIndex('product_attr_unique').on(t.productId, t.attributeId),
}))

/** Saved barcode label templates */
export const barcodeLabels = sqliteTable('barcode_labels', {
  id:          text('id').primaryKey(),
  name:        text('name').notNull(),
  productId:   text('product_id').references(() => products.id),
  config:      text('config').notNull(),                 // JSON: width, height, fields, copies
  printedAt:   text('printed_at'),
  printCount:  integer('print_count').notNull().default(0),
  ...timestamps,
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. SUPPLIERS & CUSTOMERS
// ─────────────────────────────────────────────────────────────────────────────

export const suppliers = sqliteTable('suppliers', {
  id:         text('id').primaryKey(),
  name:       text('name').notNull(),
  phone:      text('phone'),
  phone2:     text('phone2'),
  email:      text('email'),
  address:    text('address'),
  taxNumber:  text('tax_number'),
  notes:      text('notes'),
  balance:    real('balance').notNull().default(0),      // debt/credit
  isActive:   integer('is_active', { mode: 'boolean' }).notNull().default(true),
  ...timestamps,
})

// Add FK from products to suppliers (circular, done after suppliers)
// In actual migration: ALTER TABLE products ADD COLUMN default_supplier_id
// References suppliers(id) — handled in migration

export const customers = sqliteTable('customers', {
  id:          text('id').primaryKey(),
  name:        text('name').notNull(),
  phone:       text('phone'),
  phone2:      text('phone2'),
  email:       text('email'),
  address:     text('address'),
  notes:       text('notes'),
  balance:     real('balance').notNull().default(0),
  isActive:    integer('is_active', { mode: 'boolean' }).notNull().default(true),
  ...timestamps,
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. INVENTORY MOVEMENTS
// ─────────────────────────────────────────────────────────────────────────────
// 5. INVENTORY & LOCATIONS
// ─────────────────────────────────────────────────────────────────────────────

export const storageLocations = sqliteTable('storage_locations', {
  id:          text('id').primaryKey(),
  name:        text('name').notNull(),
  nameAr:      text('name_ar'),
  code:        text('code').unique(),
  description: text('description'),
  isActive:    integer('is_active', { mode: 'boolean' }).notNull().default(true),
  ...timestamps,
})

export const productLocations = sqliteTable('product_locations', {
  id:          text('id').primaryKey(),
  productId:   text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  locationId:  text('location_id').notNull().references(() => storageLocations.id),
  quantity:    real('quantity').notNull().default(0),
  drawerBin:   text('drawer_bin'),
  ...timestamps,
}, (t) => ({
  prodLocUnique: uniqueIndex('product_loc_unique').on(t.productId, t.locationId),
}))

export const inventoryMovements = sqliteTable('inventory_movements', {
  id:          text('id').primaryKey(),
  productId:   text('product_id').notNull().references(() => products.id),
  locationId:  text('location_id').references(() => storageLocations.id),
  type:        text('type').notNull(),
  // Types: opening | manual_in | manual_out | adjustment | transfer_in | transfer_out | purchase | sale | sale_return | purchase_return | damage | correction
  quantity:    real('quantity').notNull(),               // positive = in, negative = out
  stockBefore: real('stock_before').notNull(),
  stockAfter:  real('stock_after').notNull(),
  referenceId:   text('reference_id'),                  // sale_id | purchase_id | transfer_id
  referenceType: text('reference_type'),                // sale | purchase | transfer | adjustment
  reason:      text('reason'),
  notes:       text('notes'),
  userId:      text('user_id').references(() => users.id),
  createdAt:   text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`),
}, (t) => ({
  productIdx: index('inv_mov_product_idx').on(t.productId),
  typeIdx:    index('inv_mov_type_idx').on(t.type),
  dateIdx:    index('inv_mov_date_idx').on(t.createdAt),
}))

// ─────────────────────────────────────────────────────────────────────────────
// 6. CASH REGISTER & SHIFTS
// ─────────────────────────────────────────────────────────────────────────────

export const cashRegisters = sqliteTable('cash_registers', {
  id:       text('id').primaryKey(),
  name:     text('name').notNull(),
  nameAr:   text('name_ar'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  ...timestamps,
})

export const shifts = sqliteTable('shifts', {
  id:               text('id').primaryKey(),
  registerId:       text('register_id').references(() => cashRegisters.id),
  userId:           text('user_id').notNull().references(() => users.id),
  status:           text('status').notNull().default('open'),  // open | closed
  openingBalance:   real('opening_balance').notNull().default(0),
  closingBalance:   real('closing_balance'),
  expectedBalance:  real('expected_balance'),
  difference:       real('difference'),
  cashSales:        real('cash_sales').notNull().default(0),
  cashRefunds:      real('cash_refunds').notNull().default(0),
  cashExpenses:     real('cash_expenses').notNull().default(0),
  cashWithdrawals:  real('cash_withdrawals').notNull().default(0),
  cashDeposits:     real('cash_deposits').notNull().default(0),
  notes:            text('notes'),
  openedAt:         text('opened_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`),
  closedAt:         text('closed_at'),
  ...timestamps,
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. SALES
// ─────────────────────────────────────────────────────────────────────────────

export const sales = sqliteTable('sales', {
  id:           text('id').primaryKey(),
  invoiceNumber: text('invoice_number').notNull().unique(),
  shiftId:      text('shift_id').references(() => shifts.id),
  cashierId:    text('cashier_id').notNull().references(() => users.id),
  customerId:   text('customer_id').references(() => customers.id),
  status:       text('status').notNull().default('completed'),
  // Statuses: completed | cancelled | returned | partially_returned
  subtotal:     real('subtotal').notNull().default(0),
  discountAmount: real('discount_amount').notNull().default(0),
  discountPct:  real('discount_pct').notNull().default(0),
  taxAmount:    real('tax_amount').notNull().default(0),
  total:        real('total').notNull().default(0),
  paidAmount:   real('paid_amount').notNull().default(0),
  changeAmount: real('change_amount').notNull().default(0),
  notes:        text('notes'),
  createdAt:    text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`),
  updatedAt:    text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`),
}, (t) => ({
  invoiceIdx: index('sales_invoice_idx').on(t.invoiceNumber),
  dateIdx:    index('sales_date_idx').on(t.createdAt),
  cashierIdx: index('sales_cashier_idx').on(t.cashierId),
}))

export const saleItems = sqliteTable('sale_items', {
  id:            text('id').primaryKey(),
  saleId:        text('sale_id').notNull().references(() => sales.id, { onDelete: 'cascade' }),
  productId:     text('product_id').notNull().references(() => products.id),
  productName:   text('product_name').notNull(),         // snapshot at time of sale
  productSku:    text('product_sku').notNull(),
  quantity:      real('quantity').notNull(),
  unitPrice:     real('unit_price').notNull(),            // selling price at time of sale
  costPrice:     real('cost_price').notNull(),            // PURCHASE price at time of sale (for profit)
  discountAmount: real('discount_amount').notNull().default(0),
  discountPct:   real('discount_pct').notNull().default(0),
  subtotal:      real('subtotal').notNull(),
  profit:        real('profit').notNull().default(0),    // (unitPrice - costPrice) * qty
}, (t) => ({
  saleIdx:    index('sale_items_sale_idx').on(t.saleId),
  productIdx: index('sale_items_product_idx').on(t.productId),
}))

export const payments = sqliteTable('payments', {
  id:         text('id').primaryKey(),
  saleId:     text('sale_id').notNull().references(() => sales.id, { onDelete: 'cascade' }),
  method:     text('method').notNull(),                  // cash | card | transfer | other
  amount:     real('amount').notNull(),
  reference:  text('reference'),                         // card approval, transfer ref
  notes:      text('notes'),
  createdAt:  text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`),
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. RETURNS
// ─────────────────────────────────────────────────────────────────────────────

export const returns = sqliteTable('returns', {
  id:            text('id').primaryKey(),
  returnNumber:  text('return_number').notNull().unique(),
  saleId:        text('sale_id').notNull().references(() => sales.id),
  processedById: text('processed_by_id').notNull().references(() => users.id),
  reason:        text('reason'),
  totalRefund:   real('total_refund').notNull().default(0),
  refundMethod:  text('refund_method').notNull().default('cash'),
  status:        text('status').notNull().default('completed'), // completed | pending
  notes:         text('notes'),
  createdAt:     text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`),
})

export const returnItems = sqliteTable('return_items', {
  id:         text('id').primaryKey(),
  returnId:   text('return_id').notNull().references(() => returns.id, { onDelete: 'cascade' }),
  saleItemId: text('sale_item_id').notNull().references(() => saleItems.id),
  productId:  text('product_id').notNull().references(() => products.id),
  quantity:   real('quantity').notNull(),
  unitPrice:  real('unit_price').notNull(),
  subtotal:   real('subtotal').notNull(),
  reason:     text('reason'),
})

// ─────────────────────────────────────────────────────────────────────────────
// 9. PURCHASES
// ─────────────────────────────────────────────────────────────────────────────

export const purchases = sqliteTable('purchases', {
  id:             text('id').primaryKey(),
  purchaseNumber: text('purchase_number').notNull().unique(),
  supplierId:     text('supplier_id').references(() => suppliers.id),
  receivedById:   text('received_by_id').references(() => users.id),
  status:         text('status').notNull().default('completed'),
  // Statuses: ordered | received | partial | completed | cancelled
  subtotal:       real('subtotal').notNull().default(0),
  discountAmount: real('discount_amount').notNull().default(0),
  total:          real('total').notNull().default(0),
  paidAmount:     real('paid_amount').notNull().default(0),
  balance:        real('balance').notNull().default(0),   // still owed to supplier
  paymentStatus:  text('payment_status').notNull().default('unpaid'), // paid | partial | unpaid
  invoiceRef:     text('invoice_ref'),                   // supplier's invoice number
  notes:          text('notes'),
  purchasedAt:    text('purchased_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`),
  ...timestamps,
})

export const purchaseItems = sqliteTable('purchase_items', {
  id:            text('id').primaryKey(),
  purchaseId:    text('purchase_id').notNull().references(() => purchases.id, { onDelete: 'cascade' }),
  productId:     text('product_id').notNull().references(() => products.id),
  quantity:      real('quantity').notNull(),
  unitCost:      real('unit_cost').notNull(),
  subtotal:      real('subtotal').notNull(),
  receivedQty:   real('received_qty').notNull().default(0),
}, (t) => ({
  purchaseIdx: index('purchase_items_purchase_idx').on(t.purchaseId),
  productIdx:  index('purchase_items_product_idx').on(t.productId),
}))

// ─────────────────────────────────────────────────────────────────────────────
// 10. EXPENSES
// ─────────────────────────────────────────────────────────────────────────────

export const expenseCategories = sqliteTable('expense_categories', {
  id:       text('id').primaryKey(),
  name:     text('name'),
  nameAr:   text('name_ar').notNull(),
  nameEn:   text('name_en').notNull(),
  icon:     text('icon'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  ...timestamps,
})

export const expenses = sqliteTable('expenses', {
  id:            text('id').primaryKey(),
  expenseNumber: text('expense_number'),
  categoryId:    text('category_id').references(() => expenseCategories.id),
  supplierId:    text('supplier_id').references(() => suppliers.id),
  shiftId:       text('shift_id').references(() => shifts.id),
  registerId:    text('register_id').references(() => cashRegisters.id),
  userId:        text('user_id').references(() => users.id),
  amount:        real('amount').notNull(),
  description:   text('description').notNull(),
  paymentMethod: text('payment_method').notNull().default('cash'),
  affectsCash:   integer('affects_cash', { mode: 'boolean' }).notNull().default(true),
  reference:     text('reference'),
  notes:         text('notes'),
  status:        text('status').notNull().default('completed'),
  recordedById:  text('recorded_by_id').references(() => users.id),
  receiptPath:   text('receipt_path'),
  expenseDate:   text('expense_date').notNull(),
  ...timestamps,
})

// ─────────────────────────────────────────────────────────────────────────────
// 11. AUDIT LOG
// ─────────────────────────────────────────────────────────────────────────────

export const auditLogs = sqliteTable('audit_logs', {
  id:          text('id').primaryKey(),
  userId:      text('user_id').references(() => users.id),
  userFullName: text('user_full_name'),                  // snapshot (user may be deleted)
  action:      text('action').notNull(),                 // login | sale | price_change | ...
  resource:    text('resource'),                         // product | user | sale | ...
  resourceId:  text('resource_id'),
  details:     text('details'),                         // JSON with before/after values
  ipAddress:   text('ip_address'),
  createdAt:   text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`),
}, (t) => ({
  userIdx:   index('audit_user_idx').on(t.userId),
  actionIdx: index('audit_action_idx').on(t.action),
  dateIdx:   index('audit_date_idx').on(t.createdAt),
}))

// ─────────────────────────────────────────────────────────────────────────────
// 12. BACKUPS
// ─────────────────────────────────────────────────────────────────────────────

export const backups = sqliteTable('backups', {
  id:        text('id').primaryKey(),
  filename:  text('filename').notNull(),
  filePath:  text('file_path').notNull(),
  sizeBytes: integer('size_bytes'),
  type:      text('type').notNull().default('manual'),   // manual | auto | export
  userId:    text('user_id').references(() => users.id),
  notes:     text('notes'),
  createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`),
})

// ─────────────────────────────────────────────────────────────────────────────
// 13. FUTURE-READY: KITS / BOMs
// ─────────────────────────────────────────────────────────────────────────────

export const kits = sqliteTable('kits', {
  id:          text('id').primaryKey(),
  nameAr:      text('name_ar').notNull(),
  nameEn:      text('name_en').notNull(),
  sku:         text('sku').notNull().unique(),
  sellingPrice: real('selling_price').notNull().default(0),
  description: text('description'),
  isActive:    integer('is_active', { mode: 'boolean' }).notNull().default(true),
  ...timestamps,
})

export const kitItems = sqliteTable('kit_items', {
  id:        text('id').primaryKey(),
  kitId:     text('kit_id').notNull().references(() => kits.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull().references(() => products.id),
  quantity:  real('quantity').notNull().default(1),
  notes:     text('notes'),
})

// ─────────────────────────────────────────────────────────────────────────────
// TYPE EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export type Role = typeof roles.$inferSelect
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Session = typeof sessions.$inferSelect
export type Setting = typeof settings.$inferSelect

export type ProductCategory = typeof productCategories.$inferSelect
export type ProductUnit = typeof productUnits.$inferSelect
export type Brand = typeof brands.$inferSelect
export type Product = typeof products.$inferSelect
export type NewProduct = typeof products.$inferInsert
export type ProductBarcode = typeof productBarcodes.$inferSelect
export type ProductAttributeDef = typeof productAttributeDefs.$inferSelect
export type ProductAttributeValue = typeof productAttributeValues.$inferSelect

export type Supplier = typeof suppliers.$inferSelect
export type Customer = typeof customers.$inferSelect
export type InventoryMovement = typeof inventoryMovements.$inferSelect
export type Shift = typeof shifts.$inferSelect
export type CashRegister = typeof cashRegisters.$inferSelect

export type Sale = typeof sales.$inferSelect
export type NewSale = typeof sales.$inferInsert
export type SaleItem = typeof saleItems.$inferSelect
export type Payment = typeof payments.$inferSelect

export type Return = typeof returns.$inferSelect
export type ReturnItem = typeof returnItems.$inferSelect

export type Purchase = typeof purchases.$inferSelect
export type PurchaseItem = typeof purchaseItems.$inferSelect

export type ExpenseCategory = typeof expenseCategories.$inferSelect
export type Expense = typeof expenses.$inferSelect

export type AuditLog = typeof auditLogs.$inferSelect
export type Backup = typeof backups.$inferSelect

export type Kit = typeof kits.$inferSelect
export type KitItem = typeof kitItems.$inferSelect

/**
 * MAKERS POS — Database Service
 * Manages SQLite connection and migrations via Tauri SQL plugin
 */

import Database from '@tauri-apps/plugin-sql'
import { isTauri } from '@tauri-apps/api/core'
import { v4 as uuidv4 } from 'uuid'
import { MAKERS_MASTER_CATEGORIES, normalizeCategoryName } from '../categories/makersCategories'

let db: any = null

export interface AppDatabase {
  execute(query: string, bindValues?: unknown[]): Promise<{ lastInsertId: number; rowsAffected: number }>;
  select<T>(query: string, bindValues?: unknown[]): Promise<T>;
}

class MockDB implements AppDatabase {
  async execute(query: string, bindValues?: unknown[]) { 
    console.log('[MockDB execute]', query); 
    return { lastInsertId: 1, rowsAffected: 1 }; 
  }
  async select<T>(query: string, bindValues?: unknown[]): Promise<T> { 
    console.log('[MockDB select]', query); 
    return [] as unknown as T; 
  }
}

/** Initialize the database connection and run migrations */
export async function initDatabase(): Promise<void> {
  if (isTauri() || (typeof window !== 'undefined' && '__TAURI__' in window)) {
    db = await Database.load('sqlite:makers_pos.db')
    await runMigrations()
  } else {
    console.warn('⚠️ Running in browser preview without Tauri. Using in-memory MockDB.');
    db = new MockDB()
  }
}

export function getDb(): AppDatabase {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.')
  return db as AppDatabase
}

// ─── Migration System ────────────────────────────────────────────────────────

const migrations: Array<{ version: number; sql: string }> = [] // Populated below

async function runMigrations() {
  const d = getDb()

  // Create migrations tracking table
  await d.execute(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version   INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    )
  `)

  // Enable foreign keys
  await d.execute('PRAGMA foreign_keys = ON')

  // Apply WAL mode for better performance
  await d.execute('PRAGMA journal_mode = WAL')
  await d.execute('PRAGMA synchronous = NORMAL')
  await d.execute('PRAGMA cache_size = -64000') // 64MB cache

  const applied = await d.select<{ version: number }[]>('SELECT version FROM _migrations ORDER BY version')
  const appliedVersions = new Set(applied.map(r => r.version))

  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) {
      console.log(`Applying migration v${migration.version}...`)
      // Split on statement separator and execute each
      const statements = migration.sql
        .split('---STATEMENT---')
        .map(s => s.trim())
        .filter(Boolean)

      for (const stmt of statements) {
        await d.execute(stmt)
      }

      await d.execute('INSERT INTO _migrations (version) VALUES (?)', [migration.version])
      console.log(`Migration v${migration.version} applied.`)
    }
  }
}

// ─── Migration 001: Initial Schema ──────────────────────────────────────────

const MIGRATION_001 = `
CREATE TABLE IF NOT EXISTS roles (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  display_name_ar TEXT NOT NULL,
  is_system     INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)
---STATEMENT---
CREATE TABLE IF NOT EXISTS permissions (
  id       TEXT PRIMARY KEY,
  role_id  TEXT NOT NULL REFERENCES roles(id),
  resource TEXT NOT NULL,
  action   TEXT NOT NULL,
  allowed  INTEGER NOT NULL DEFAULT 1,
  UNIQUE(role_id, resource, action)
)
---STATEMENT---
CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  username       TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  full_name      TEXT NOT NULL,
  full_name_ar   TEXT,
  email          TEXT,
  phone          TEXT,
  role_id        TEXT NOT NULL REFERENCES roles(id),
  is_active      INTEGER NOT NULL DEFAULT 1,
  last_login_at  TEXT,
  avatar_path    TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)
---STATEMENT---
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  token      TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)
---STATEMENT---
CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT,
  category    TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)
---STATEMENT---
CREATE TABLE IF NOT EXISTS product_categories (
  id          TEXT PRIMARY KEY,
  name_ar     TEXT NOT NULL,
  name_en     TEXT NOT NULL,
  parent_id   TEXT,
  description TEXT,
  color       TEXT,
  icon        TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)
---STATEMENT---
CREATE TABLE IF NOT EXISTS product_units (
  id            TEXT PRIMARY KEY,
  name_ar       TEXT NOT NULL,
  name_en       TEXT NOT NULL,
  symbol        TEXT NOT NULL,
  allow_decimal INTEGER NOT NULL DEFAULT 0,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)
---STATEMENT---
CREATE TABLE IF NOT EXISTS brands (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)
---STATEMENT---
CREATE TABLE IF NOT EXISTS suppliers (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  phone       TEXT,
  phone2      TEXT,
  email       TEXT,
  address     TEXT,
  tax_number  TEXT,
  notes       TEXT,
  balance     REAL NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)
---STATEMENT---
CREATE TABLE IF NOT EXISTS customers (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  phone      TEXT,
  phone2     TEXT,
  email      TEXT,
  address    TEXT,
  notes      TEXT,
  balance    REAL NOT NULL DEFAULT 0,
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)
---STATEMENT---
CREATE TABLE IF NOT EXISTS products (
  id                   TEXT PRIMARY KEY,
  sku                  TEXT NOT NULL UNIQUE,
  name_ar              TEXT NOT NULL,
  name_en              TEXT NOT NULL,
  description          TEXT,
  description_ar       TEXT,
  category_id          TEXT REFERENCES product_categories(id),
  unit_id              TEXT NOT NULL REFERENCES product_units(id),
  brand_id             TEXT REFERENCES brands(id),
  default_supplier_id  TEXT REFERENCES suppliers(id),
  purchase_price       REAL NOT NULL DEFAULT 0,
  selling_price        REAL NOT NULL DEFAULT 0,
  current_stock        REAL NOT NULL DEFAULT 0,
  min_stock            REAL NOT NULL DEFAULT 0,
  image_path           TEXT,
  is_active            INTEGER NOT NULL DEFAULT 1,
  notes                TEXT,
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)
---STATEMENT---
CREATE INDEX IF NOT EXISTS products_sku_idx ON products(sku)
---STATEMENT---
CREATE INDEX IF NOT EXISTS products_category_idx ON products(category_id)
---STATEMENT---
CREATE TABLE IF NOT EXISTS product_barcodes (
  id         TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  barcode    TEXT NOT NULL UNIQUE,
  type       TEXT NOT NULL DEFAULT 'code128',
  is_default INTEGER NOT NULL DEFAULT 0,
  is_printed INTEGER NOT NULL DEFAULT 0,
  source     TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)
---STATEMENT---
CREATE INDEX IF NOT EXISTS barcodes_barcode_idx ON product_barcodes(barcode)
---STATEMENT---
CREATE INDEX IF NOT EXISTS barcodes_product_idx ON product_barcodes(product_id)
---STATEMENT---
CREATE TABLE IF NOT EXISTS product_attribute_defs (
  id         TEXT PRIMARY KEY,
  name_ar    TEXT NOT NULL,
  name_en    TEXT NOT NULL,
  unit       TEXT,
  category_id TEXT,
  data_type  TEXT NOT NULL DEFAULT 'text',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)
---STATEMENT---
CREATE TABLE IF NOT EXISTS product_attribute_values (
  id           TEXT PRIMARY KEY,
  product_id   TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  attribute_id TEXT NOT NULL REFERENCES product_attribute_defs(id),
  value        TEXT NOT NULL,
  UNIQUE(product_id, attribute_id)
)
---STATEMENT---
CREATE TABLE IF NOT EXISTS barcode_labels (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  product_id  TEXT REFERENCES products(id),
  config      TEXT NOT NULL,
  printed_at  TEXT,
  print_count INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)
---STATEMENT---
CREATE TABLE IF NOT EXISTS inventory_movements (
  id             TEXT PRIMARY KEY,
  product_id     TEXT NOT NULL REFERENCES products(id),
  type           TEXT NOT NULL,
  quantity       REAL NOT NULL,
  stock_before   REAL NOT NULL,
  stock_after    REAL NOT NULL,
  reference_id   TEXT,
  reference_type TEXT,
  reason         TEXT,
  user_id        TEXT REFERENCES users(id),
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)
---STATEMENT---
CREATE INDEX IF NOT EXISTS inv_mov_product_idx ON inventory_movements(product_id)
---STATEMENT---
CREATE INDEX IF NOT EXISTS inv_mov_type_idx ON inventory_movements(type)
---STATEMENT---
CREATE INDEX IF NOT EXISTS inv_mov_date_idx ON inventory_movements(created_at)
---STATEMENT---
CREATE TABLE IF NOT EXISTS cash_registers (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  name_ar    TEXT,
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)
---STATEMENT---
CREATE TABLE IF NOT EXISTS shifts (
  id               TEXT PRIMARY KEY,
  register_id      TEXT REFERENCES cash_registers(id),
  user_id          TEXT NOT NULL REFERENCES users(id),
  status           TEXT NOT NULL DEFAULT 'open',
  opening_balance  REAL NOT NULL DEFAULT 0,
  closing_balance  REAL,
  expected_balance REAL,
  difference       REAL,
  cash_sales       REAL NOT NULL DEFAULT 0,
  cash_refunds     REAL NOT NULL DEFAULT 0,
  cash_expenses    REAL NOT NULL DEFAULT 0,
  cash_withdrawals REAL NOT NULL DEFAULT 0,
  cash_deposits    REAL NOT NULL DEFAULT 0,
  notes            TEXT,
  opened_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  closed_at        TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)
---STATEMENT---
CREATE TABLE IF NOT EXISTS sales (
  id             TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  shift_id       TEXT REFERENCES shifts(id),
  cashier_id     TEXT NOT NULL REFERENCES users(id),
  customer_id    TEXT REFERENCES customers(id),
  status         TEXT NOT NULL DEFAULT 'completed',
  subtotal       REAL NOT NULL DEFAULT 0,
  discount_amount REAL NOT NULL DEFAULT 0,
  discount_pct   REAL NOT NULL DEFAULT 0,
  tax_amount     REAL NOT NULL DEFAULT 0,
  total          REAL NOT NULL DEFAULT 0,
  paid_amount    REAL NOT NULL DEFAULT 0,
  change_amount  REAL NOT NULL DEFAULT 0,
  notes          TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)
---STATEMENT---
CREATE INDEX IF NOT EXISTS sales_invoice_idx ON sales(invoice_number)
---STATEMENT---
CREATE INDEX IF NOT EXISTS sales_date_idx ON sales(created_at)
---STATEMENT---
CREATE INDEX IF NOT EXISTS sales_cashier_idx ON sales(cashier_id)
---STATEMENT---
CREATE TABLE IF NOT EXISTS sale_items (
  id              TEXT PRIMARY KEY,
  sale_id         TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id      TEXT NOT NULL REFERENCES products(id),
  product_name    TEXT NOT NULL,
  product_sku     TEXT NOT NULL,
  quantity        REAL NOT NULL,
  unit_price      REAL NOT NULL,
  cost_price      REAL NOT NULL,
  discount_amount REAL NOT NULL DEFAULT 0,
  discount_pct    REAL NOT NULL DEFAULT 0,
  subtotal        REAL NOT NULL,
  profit          REAL NOT NULL DEFAULT 0
)
---STATEMENT---
CREATE INDEX IF NOT EXISTS sale_items_sale_idx ON sale_items(sale_id)
---STATEMENT---
CREATE INDEX IF NOT EXISTS sale_items_product_idx ON sale_items(product_id)
---STATEMENT---
CREATE TABLE IF NOT EXISTS payments (
  id         TEXT PRIMARY KEY,
  sale_id    TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  method     TEXT NOT NULL,
  amount     REAL NOT NULL,
  reference  TEXT,
  notes      TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)
---STATEMENT---
CREATE TABLE IF NOT EXISTS returns (
  id             TEXT PRIMARY KEY,
  return_number  TEXT NOT NULL UNIQUE,
  sale_id        TEXT NOT NULL REFERENCES sales(id),
  processed_by_id TEXT NOT NULL REFERENCES users(id),
  reason         TEXT,
  total_refund   REAL NOT NULL DEFAULT 0,
  refund_method  TEXT NOT NULL DEFAULT 'cash',
  status         TEXT NOT NULL DEFAULT 'completed',
  notes          TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)
---STATEMENT---
CREATE TABLE IF NOT EXISTS return_items (
  id           TEXT PRIMARY KEY,
  return_id    TEXT NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  sale_item_id TEXT NOT NULL REFERENCES sale_items(id),
  product_id   TEXT NOT NULL REFERENCES products(id),
  quantity     REAL NOT NULL,
  unit_price   REAL NOT NULL,
  subtotal     REAL NOT NULL,
  reason       TEXT
)
---STATEMENT---
CREATE TABLE IF NOT EXISTS purchases (
  id              TEXT PRIMARY KEY,
  purchase_number TEXT NOT NULL UNIQUE,
  supplier_id     TEXT REFERENCES suppliers(id),
  received_by_id  TEXT REFERENCES users(id),
  status          TEXT NOT NULL DEFAULT 'completed',
  subtotal        REAL NOT NULL DEFAULT 0,
  discount_amount REAL NOT NULL DEFAULT 0,
  total           REAL NOT NULL DEFAULT 0,
  paid_amount     REAL NOT NULL DEFAULT 0,
  balance         REAL NOT NULL DEFAULT 0,
  payment_status  TEXT NOT NULL DEFAULT 'unpaid',
  invoice_ref     TEXT,
  notes           TEXT,
  purchased_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)
---STATEMENT---
CREATE TABLE IF NOT EXISTS purchase_items (
  id           TEXT PRIMARY KEY,
  purchase_id  TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id   TEXT NOT NULL REFERENCES products(id),
  quantity     REAL NOT NULL,
  unit_cost    REAL NOT NULL,
  subtotal     REAL NOT NULL,
  received_qty REAL NOT NULL DEFAULT 0
)
---STATEMENT---
CREATE TABLE IF NOT EXISTS expense_categories (
  id         TEXT PRIMARY KEY,
  name_ar    TEXT NOT NULL,
  name_en    TEXT NOT NULL,
  icon       TEXT,
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)
---STATEMENT---
CREATE TABLE IF NOT EXISTS expenses (
  id             TEXT PRIMARY KEY,
  category_id    TEXT REFERENCES expense_categories(id),
  shift_id       TEXT REFERENCES shifts(id),
  amount         REAL NOT NULL,
  description    TEXT NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  affects_cash   INTEGER NOT NULL DEFAULT 1,
  recorded_by_id TEXT REFERENCES users(id),
  receipt_path   TEXT,
  expense_date   TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)
---STATEMENT---
CREATE TABLE IF NOT EXISTS audit_logs (
  id             TEXT PRIMARY KEY,
  user_id        TEXT REFERENCES users(id),
  user_full_name TEXT,
  action         TEXT NOT NULL,
  resource       TEXT,
  resource_id    TEXT,
  details        TEXT,
  ip_address     TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)
---STATEMENT---
CREATE INDEX IF NOT EXISTS audit_user_idx ON audit_logs(user_id)
---STATEMENT---
CREATE INDEX IF NOT EXISTS audit_action_idx ON audit_logs(action)
---STATEMENT---
CREATE INDEX IF NOT EXISTS audit_date_idx ON audit_logs(created_at)
---STATEMENT---
CREATE TABLE IF NOT EXISTS backups (
  id         TEXT PRIMARY KEY,
  filename   TEXT NOT NULL,
  file_path  TEXT NOT NULL,
  size_bytes INTEGER,
  type       TEXT NOT NULL DEFAULT 'manual',
  user_id    TEXT REFERENCES users(id),
  notes      TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)
---STATEMENT---
CREATE TABLE IF NOT EXISTS kits (
  id            TEXT PRIMARY KEY,
  name_ar       TEXT NOT NULL,
  name_en       TEXT NOT NULL,
  sku           TEXT NOT NULL UNIQUE,
  selling_price REAL NOT NULL DEFAULT 0,
  description   TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)
---STATEMENT---
CREATE TABLE IF NOT EXISTS kit_items (
  id         TEXT PRIMARY KEY,
  kit_id     TEXT NOT NULL REFERENCES kits(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity   REAL NOT NULL DEFAULT 1,
  notes      TEXT
)
`

migrations.push({ version: 1, sql: MIGRATION_001 })

// ─── Migration 002: Electronics Inventory Fields ─────────────────────────────

const MIGRATION_002 = `
ALTER TABLE products ADD COLUMN drawer_location TEXT
---STATEMENT---
ALTER TABLE products ADD COLUMN footprint_package TEXT
---STATEMENT---
ALTER TABLE products ADD COLUMN datasheet_url TEXT
`

migrations.push({ version: 2, sql: MIGRATION_002 })

// ─── Migration 003: External Catalog Integration (MAKERS Website) ───────────

const MIGRATION_003 = `
ALTER TABLE products ADD COLUMN source_type TEXT DEFAULT 'LOCAL'
---STATEMENT---
ALTER TABLE products ADD COLUMN external_product_id TEXT
---STATEMENT---
ALTER TABLE products ADD COLUMN external_sku TEXT
---STATEMENT---
ALTER TABLE products ADD COLUMN external_url TEXT
---STATEMENT---
ALTER TABLE products ADD COLUMN website_price REAL
---STATEMENT---
ALTER TABLE products ADD COLUMN last_synced_at TEXT
---STATEMENT---
CREATE INDEX IF NOT EXISTS products_ext_prod_id_idx ON products(external_product_id)
---STATEMENT---
CREATE INDEX IF NOT EXISTS products_ext_sku_idx ON products(external_sku)
`

migrations.push({ version: 3, sql: MIGRATION_003 })

// ─── Migration 004: Storage Locations & Advanced Inventory Movements ─────────

const MIGRATION_004 = `
CREATE TABLE IF NOT EXISTS storage_locations (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  name_ar     TEXT,
  code        TEXT UNIQUE,
  description TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)
---STATEMENT---
CREATE TABLE IF NOT EXISTS product_locations (
  id          TEXT PRIMARY KEY,
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  location_id TEXT NOT NULL REFERENCES storage_locations(id),
  quantity    REAL NOT NULL DEFAULT 0,
  drawer_bin  TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE(product_id, location_id)
)
---STATEMENT---
ALTER TABLE inventory_movements ADD COLUMN location_id TEXT
---STATEMENT---
ALTER TABLE inventory_movements ADD COLUMN notes TEXT
---STATEMENT---
CREATE INDEX IF NOT EXISTS inv_mov_loc_idx ON inventory_movements(location_id)
---STATEMENT---
CREATE INDEX IF NOT EXISTS prod_loc_prod_idx ON product_locations(product_id)
---STATEMENT---
CREATE INDEX IF NOT EXISTS prod_loc_loc_idx ON product_locations(location_id)
`

migrations.push({ version: 4, sql: MIGRATION_004 })

// ─── Migration 005: Suppliers & Purchasing Enhancement ───────────────────────

const MIGRATION_005 = `
ALTER TABLE suppliers ADD COLUMN whatsapp TEXT
---STATEMENT---
ALTER TABLE suppliers ADD COLUMN archived_at TEXT
---STATEMENT---
ALTER TABLE purchases ADD COLUMN location_id TEXT REFERENCES storage_locations(id)
---STATEMENT---
ALTER TABLE purchases ADD COLUMN tax_amount REAL DEFAULT 0
---STATEMENT---
ALTER TABLE purchases ADD COLUMN received_at TEXT
---STATEMENT---
CREATE TABLE IF NOT EXISTS purchase_payments (
  id             TEXT PRIMARY KEY,
  purchase_id    TEXT REFERENCES purchases(id) ON DELETE CASCADE,
  supplier_id    TEXT NOT NULL REFERENCES suppliers(id),
  user_id        TEXT REFERENCES users(id),
  amount         REAL NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  reference      TEXT,
  notes          TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)
---STATEMENT---
CREATE INDEX IF NOT EXISTS suppliers_name_idx ON suppliers(name)
---STATEMENT---
CREATE INDEX IF NOT EXISTS suppliers_phone_idx ON suppliers(phone)
---STATEMENT---
CREATE INDEX IF NOT EXISTS purchases_supplier_idx ON purchases(supplier_id)
---STATEMENT---
CREATE INDEX IF NOT EXISTS purchases_status_idx ON purchases(status)
---STATEMENT---
CREATE INDEX IF NOT EXISTS purchases_date_idx ON purchases(purchased_at)
---STATEMENT---
CREATE INDEX IF NOT EXISTS purchase_items_purch_idx ON purchase_items(purchase_id)
---STATEMENT---
CREATE INDEX IF NOT EXISTS purchase_items_prod_idx ON purchase_items(product_id)
---STATEMENT---
CREATE INDEX IF NOT EXISTS purchase_payments_purch_idx ON purchase_payments(purchase_id)
---STATEMENT---
CREATE INDEX IF NOT EXISTS purchase_payments_supp_idx ON purchase_payments(supplier_id)
`

migrations.push({ version: 5, sql: MIGRATION_005 })

// ─── Migration 006: Customers Enhancement ────────────────────────────────────

const MIGRATION_006 = `
ALTER TABLE customers ADD COLUMN customer_code TEXT
---STATEMENT---
ALTER TABLE customers ADD COLUMN whatsapp TEXT
---STATEMENT---
ALTER TABLE customers ADD COLUMN customer_type TEXT DEFAULT 'individual'
---STATEMENT---
ALTER TABLE customers ADD COLUMN credit_limit REAL DEFAULT 0
---STATEMENT---
ALTER TABLE customers ADD COLUMN archived_at TEXT
---STATEMENT---
CREATE UNIQUE INDEX IF NOT EXISTS customers_code_idx ON customers(customer_code)
---STATEMENT---
CREATE INDEX IF NOT EXISTS customers_name_idx ON customers(name)
---STATEMENT---
CREATE INDEX IF NOT EXISTS customers_phone_idx ON customers(phone)
---STATEMENT---
CREATE INDEX IF NOT EXISTS customers_active_idx ON customers(is_active)
`

migrations.push({ version: 6, sql: MIGRATION_006 })

// ─── Migration 007: POS Held Carts ───────────────────────────────────────────

const MIGRATION_007 = `
CREATE TABLE IF NOT EXISTS held_carts (
  id              TEXT PRIMARY KEY,
  cashier_id      TEXT NOT NULL,
  cashier_name    TEXT,
  customer_id     TEXT,
  customer_name   TEXT,
  cart_data       TEXT NOT NULL,
  subtotal        REAL NOT NULL DEFAULT 0,
  discount_amount REAL NOT NULL DEFAULT 0,
  tax_amount      REAL NOT NULL DEFAULT 0,
  total           REAL NOT NULL DEFAULT 0,
  notes           TEXT,
  held_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)
---STATEMENT---
CREATE INDEX IF NOT EXISTS held_carts_cashier_idx ON held_carts(cashier_id)
---STATEMENT---
CREATE INDEX IF NOT EXISTS held_carts_customer_idx ON held_carts(customer_id)
---STATEMENT---
CREATE INDEX IF NOT EXISTS held_carts_held_at_idx ON held_carts(held_at)
`

migrations.push({ version: 7, sql: MIGRATION_007 })

// ─── Migration 008: Cash Movements & Payments Enhancement ─────────────────────

const MIGRATION_008 = `
CREATE TABLE IF NOT EXISTS cash_movements (
  id             TEXT PRIMARY KEY,
  register_id    TEXT NOT NULL REFERENCES cash_registers(id),
  shift_id       TEXT NOT NULL REFERENCES shifts(id),
  user_id        TEXT NOT NULL REFERENCES users(id),
  amount         REAL NOT NULL,
  type           TEXT NOT NULL,
  direction      TEXT NOT NULL,
  payment_method TEXT DEFAULT 'cash',
  reason         TEXT,
  reference_id   TEXT,
  reference_type TEXT,
  notes          TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)
---STATEMENT---
CREATE INDEX IF NOT EXISTS cash_mov_shift_idx ON cash_movements(shift_id)
---STATEMENT---
CREATE INDEX IF NOT EXISTS cash_mov_register_idx ON cash_movements(register_id)
---STATEMENT---
CREATE INDEX IF NOT EXISTS cash_mov_type_idx ON cash_movements(type)
---STATEMENT---
CREATE INDEX IF NOT EXISTS cash_mov_date_idx ON cash_movements(created_at)
---STATEMENT---
CREATE TABLE IF NOT EXISTS payments_v8 (
  id          TEXT PRIMARY KEY,
  sale_id     TEXT REFERENCES sales(id) ON DELETE CASCADE,
  shift_id    TEXT REFERENCES shifts(id),
  register_id TEXT REFERENCES cash_registers(id),
  user_id     TEXT REFERENCES users(id),
  customer_id TEXT REFERENCES customers(id),
  method      TEXT NOT NULL,
  amount      REAL NOT NULL,
  reference   TEXT,
  notes       TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)
---STATEMENT---
INSERT INTO payments_v8 (id, sale_id, method, amount, reference, notes, created_at)
  SELECT id, sale_id, method, amount, reference, notes, created_at FROM payments
---STATEMENT---
DROP TABLE payments
---STATEMENT---
ALTER TABLE payments_v8 RENAME TO payments
---STATEMENT---
CREATE INDEX IF NOT EXISTS payments_sale_idx ON payments(sale_id)
---STATEMENT---
CREATE INDEX IF NOT EXISTS payments_shift_idx ON payments(shift_id)
---STATEMENT---
CREATE INDEX IF NOT EXISTS payments_register_idx ON payments(register_id)
---STATEMENT---
CREATE INDEX IF NOT EXISTS payments_method_idx ON payments(method)
`

migrations.push({ version: 8, sql: MIGRATION_008 })

// ─── Migration 009: Sales & Receipts Enhancement ─────────────────────────────

const MIGRATION_009 = `
ALTER TABLE sales ADD COLUMN register_id TEXT REFERENCES cash_registers(id)
---STATEMENT---
ALTER TABLE sale_items ADD COLUMN barcode TEXT
---STATEMENT---
CREATE INDEX IF NOT EXISTS sales_shift_idx ON sales(shift_id)
---STATEMENT---
CREATE INDEX IF NOT EXISTS sales_customer_idx ON sales(customer_id)
---STATEMENT---
CREATE INDEX IF NOT EXISTS sales_register_idx ON sales(register_id)
`

migrations.push({ version: 9, sql: MIGRATION_009 })

// ─── Migration 010: Returns & Refunds Enhancement ───────────────────────────

const MIGRATION_010 = `
ALTER TABLE returns ADD COLUMN shift_id TEXT REFERENCES shifts(id)
---STATEMENT---
ALTER TABLE returns ADD COLUMN register_id TEXT REFERENCES cash_registers(id)
---STATEMENT---
ALTER TABLE returns ADD COLUMN customer_id TEXT REFERENCES customers(id)
---STATEMENT---
ALTER TABLE returns ADD COLUMN user_id TEXT REFERENCES users(id)
---STATEMENT---
ALTER TABLE returns ADD COLUMN subtotal REAL NOT NULL DEFAULT 0
---STATEMENT---
ALTER TABLE returns ADD COLUMN discount_amount REAL NOT NULL DEFAULT 0
---STATEMENT---
ALTER TABLE returns ADD COLUMN tax_amount REAL NOT NULL DEFAULT 0
---STATEMENT---
ALTER TABLE returns ADD COLUMN total_amount REAL NOT NULL DEFAULT 0
---STATEMENT---
ALTER TABLE returns ADD COLUMN refund_amount REAL NOT NULL DEFAULT 0
---STATEMENT---
ALTER TABLE returns ADD COLUMN updated_at TEXT
---STATEMENT---
ALTER TABLE return_items ADD COLUMN product_name TEXT
---STATEMENT---
ALTER TABLE return_items ADD COLUMN product_sku TEXT
---STATEMENT---
ALTER TABLE return_items ADD COLUMN barcode TEXT
---STATEMENT---
ALTER TABLE return_items ADD COLUMN discount_amount REAL NOT NULL DEFAULT 0
---STATEMENT---
ALTER TABLE return_items ADD COLUMN tax_amount REAL NOT NULL DEFAULT 0
---STATEMENT---
ALTER TABLE return_items ADD COLUMN line_total REAL NOT NULL DEFAULT 0
---STATEMENT---
ALTER TABLE return_items ADD COLUMN condition TEXT NOT NULL DEFAULT 'resellable'
---STATEMENT---
ALTER TABLE return_items ADD COLUMN created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
---STATEMENT---
ALTER TABLE payments ADD COLUMN return_id TEXT REFERENCES returns(id) ON DELETE CASCADE
---STATEMENT---
CREATE INDEX IF NOT EXISTS returns_sale_idx ON returns(sale_id)
---STATEMENT---
CREATE INDEX IF NOT EXISTS returns_num_idx ON returns(return_number)
---STATEMENT---
CREATE INDEX IF NOT EXISTS returns_shift_idx ON returns(shift_id)
---STATEMENT---
CREATE INDEX IF NOT EXISTS returns_customer_idx ON returns(customer_id)
---STATEMENT---
CREATE INDEX IF NOT EXISTS return_items_return_idx ON return_items(return_id)
---STATEMENT---
CREATE INDEX IF NOT EXISTS return_items_sale_item_idx ON return_items(sale_item_id)
---STATEMENT---
CREATE INDEX IF NOT EXISTS payments_return_idx ON payments(return_id)
`

migrations.push({ version: 10, sql: MIGRATION_010 })

// ─── Migration 011: Expenses Enhancement ─────────────────────────────────────

const MIGRATION_011 = `
ALTER TABLE expenses ADD COLUMN expense_number TEXT
---STATEMENT---
ALTER TABLE expenses ADD COLUMN supplier_id TEXT REFERENCES suppliers(id)
---STATEMENT---
ALTER TABLE expenses ADD COLUMN register_id TEXT REFERENCES cash_registers(id)
---STATEMENT---
ALTER TABLE expenses ADD COLUMN user_id TEXT REFERENCES users(id)
---STATEMENT---
ALTER TABLE expenses ADD COLUMN reference TEXT
---STATEMENT---
ALTER TABLE expenses ADD COLUMN notes TEXT
---STATEMENT---
ALTER TABLE expenses ADD COLUMN status TEXT NOT NULL DEFAULT 'completed'
---STATEMENT---
ALTER TABLE expense_categories ADD COLUMN name TEXT
---STATEMENT---
CREATE UNIQUE INDEX IF NOT EXISTS expenses_number_idx ON expenses(expense_number)
---STATEMENT---
CREATE INDEX IF NOT EXISTS expenses_shift_idx ON expenses(shift_id)
---STATEMENT---
CREATE INDEX IF NOT EXISTS expenses_category_idx ON expenses(category_id)
---STATEMENT---
CREATE INDEX IF NOT EXISTS expenses_supplier_idx ON expenses(supplier_id)
---STATEMENT---
CREATE INDEX IF NOT EXISTS expenses_user_idx ON expenses(user_id)
---STATEMENT---
CREATE INDEX IF NOT EXISTS expenses_register_idx ON expenses(register_id)
---STATEMENT---
CREATE INDEX IF NOT EXISTS expenses_date_idx ON expenses(expense_date)
---STATEMENT---
CREATE INDEX IF NOT EXISTS expenses_status_idx ON expenses(status)
`

migrations.push({ version: 11, sql: MIGRATION_011 })

// ─── Migration 012: Per-User Custom Permissions Matrix ───────────────────────

const MIGRATION_012 = `
CREATE TABLE IF NOT EXISTS user_permissions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource   TEXT NOT NULL,
  action     TEXT NOT NULL,
  allowed    INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE(user_id, resource, action)
)
---STATEMENT---
CREATE INDEX IF NOT EXISTS user_permissions_user_idx ON user_permissions(user_id)
`

migrations.push({ version: 12, sql: MIGRATION_012 })

// ─── Seed Data: Insert after initial migration ───────────────────────────────

export async function seedInitialData(adminPasswordHash: string): Promise<void> {
  const d = getDb()

  // 1. Seed Roles idempotently
  const existingRoles = await d.select<{ id: string; name: string }[]>('SELECT id, name FROM roles')
  const roleMap = new Map(existingRoles.map(r => [r.name, r.id]))

  const rolesToEnsure = [
    { name: 'admin', displayName: 'Administrator', displayNameAr: 'مدير النظام' },
    { name: 'manager', displayName: 'Manager', displayNameAr: 'مدير' },
    { name: 'cashier', displayName: 'Cashier', displayNameAr: 'كاشير' },
  ]

  for (const r of rolesToEnsure) {
    if (!roleMap.has(r.name)) {
      const id = uuidv4()
      await d.execute(
        `INSERT INTO roles (id, name, display_name, display_name_ar, is_system) VALUES (?, ?, ?, ?, 1)`,
        [id, r.name, r.displayName, r.displayNameAr]
      )
      roleMap.set(r.name, id)
    }
  }

  // Reload actual roles
  const roles = await d.select<{ id: string; name: string }[]>('SELECT id, name FROM roles')
  const adminRoleId = roles.find(r => r.name === 'admin')?.id

  // 2. Seed Admin User idempotently
  const existingAdmin = await d.select<{ id: string }[]>('SELECT id FROM users WHERE username = ?', ['admin'])
  if (existingAdmin.length === 0 && adminRoleId) {
    const adminUserId = uuidv4()
    await d.execute(
      `INSERT INTO users (id, username, password_hash, full_name, full_name_ar, role_id)
       VALUES (?, 'admin', ?, 'System Administrator', 'مدير النظام', ?)`,
      [adminUserId, adminPasswordHash, adminRoleId]
    )
  }

  // 3. Seed Granular Permissions for Roles
  await ensureDefaultPermissions(d, roles)

  // 4. Seed Default Units idempotently
  const existingUnits = await d.select<{ id: string; symbol: string; name_en: string }[]>('SELECT id, symbol, name_en FROM product_units')
  const unitSymbols = new Set(existingUnits.map(u => (u.symbol || '').toLowerCase().trim()))
  const unitNames = new Set(existingUnits.map(u => (u.name_en || '').toLowerCase().trim()))

  const units = [
    { nameAr: 'قطعة', nameEn: 'Piece', symbol: 'pcs', allowDecimal: 0 },
    { nameAr: 'متر', nameEn: 'Meter', symbol: 'm', allowDecimal: 1 },
    { nameAr: 'حزمة', nameEn: 'Pack', symbol: 'pk', allowDecimal: 0 },
    { nameAr: 'طقم', nameEn: 'Set', symbol: 'set', allowDecimal: 0 },
    { nameAr: 'لفة', nameEn: 'Roll', symbol: 'roll', allowDecimal: 0 },
    { nameAr: 'علبة', nameEn: 'Box', symbol: 'box', allowDecimal: 0 },
    { nameAr: 'زوج', nameEn: 'Pair', symbol: 'pr', allowDecimal: 0 },
    { nameAr: 'جرام', nameEn: 'Gram', symbol: 'g', allowDecimal: 1 },
    { nameAr: 'كيلوجرام', nameEn: 'Kilogram', symbol: 'kg', allowDecimal: 1 },
  ]

  for (const u of units) {
    if (!unitSymbols.has(u.symbol.toLowerCase().trim()) && !unitNames.has(u.nameEn.toLowerCase().trim())) {
      await d.execute(
        `INSERT INTO product_units (id, name_ar, name_en, symbol, allow_decimal)
         VALUES (?, ?, ?, ?, ?)`,
        [uuidv4(), u.nameAr, u.nameEn, u.symbol, u.allowDecimal]
      )
      unitSymbols.add(u.symbol.toLowerCase().trim())
    }
  }

  // 5. Seed Official MAKERS 35 Master Categories idempotently
  const existingCats = await d.select<{ id: string; name_ar: string; name_en: string }[]>('SELECT id, name_ar, name_en FROM product_categories')

  for (const master of MAKERS_MASTER_CATEGORIES) {
    const normEn = normalizeCategoryName(master.name_en)
    const normAr = normalizeCategoryName(master.name_ar)

    const match = existingCats.find(e => {
      const eNormEn = normalizeCategoryName(e.name_en)
      const eNormAr = normalizeCategoryName(e.name_ar)
      return eNormEn === normEn || eNormAr === normAr
    })

    if (!match) {
      const id = uuidv4()
      await d.execute(
        `INSERT INTO product_categories (id, name_ar, name_en, parent_id, description, color, icon, is_active, sort_order)
         VALUES (?, ?, ?, NULL, ?, ?, ?, 1, ?)`,
        [id, master.name_ar, master.name_en, master.description || 'MAKERS Master Category', master.color, master.icon, master.sort_order]
      )
      existingCats.push({ id, name_ar: master.name_ar, name_en: master.name_en })
    }
  }

  // 6. Seed Default Settings idempotently
  const defaultSettings = [
    ['store_name', 'MAKERS', 'general'],
    ['store_name_ar', 'ميكرز', 'general'],
    ['store_subtitle', 'Electronics Components & Makers Store', 'general'],
    ['store_subtitle_ar', 'مكونات إلكترونية ومتجر المبدعين', 'general'],
    ['store_phone', '', 'general'],
    ['store_address', '', 'general'],
    ['store_address_ar', '', 'general'],
    ['currency', 'EGP', 'general'],
    ['currency_symbol', 'ج.م', 'general'],
    ['language', 'ar', 'general'],
    ['theme', 'dark', 'general'],
    ['receipt_width', '80', 'printer'],
    ['printer_port', '', 'printer'],
    ['auto_open_drawer', '1', 'hardware'],
    ['tax_enabled', '0', 'financial'],
    ['tax_rate', '14', 'financial'],
    ['allow_negative_stock', '0', 'inventory'],
    ['auto_backup', '1', 'backup'],
    ['backup_path', '', 'backup'],
    ['backup_interval_hours', '24', 'backup'],
    ['low_stock_alert', '1', 'inventory'],
    ['invoice_prefix', 'INV', 'sales'],
    ['purchase_prefix', 'PUR', 'purchases'],
    ['return_prefix', 'RET', 'returns'],
  ]

  for (const [key, value, category] of defaultSettings) {
    await d.execute(
      'INSERT OR IGNORE INTO settings (key, value, category) VALUES (?, ?, ?)',
      [key, value, category]
    )
  }

  // 7. Seed Expense Categories idempotently
  const existingExpCats = await d.select<{ id: string; name_en: string; name_ar: string }[]>('SELECT id, name_en, name_ar FROM expense_categories')
  const expCatNamesEn = new Set(existingExpCats.map(e => (e.name_en || '').toLowerCase().trim()))

  const expCats = [
    { nameAr: 'كهرباء', nameEn: 'Electricity', icon: 'zap' },
    { nameAr: 'مواصلات', nameEn: 'Transportation', icon: 'truck' },
    { nameAr: 'صيانة', nameEn: 'Maintenance', icon: 'wrench' },
    { nameAr: 'مستلزمات', nameEn: 'Supplies', icon: 'package' },
    { nameAr: 'شحن وتوصيل', nameEn: 'Shipping', icon: 'package-2' },
    { nameAr: 'رواتب', nameEn: 'Salaries', icon: 'users' },
    { nameAr: 'إيجار', nameEn: 'Rent', icon: 'building' },
    { nameAr: 'متفرقات', nameEn: 'Miscellaneous', icon: 'more-horizontal' },
  ]

  for (const ec of expCats) {
    if (!expCatNamesEn.has(ec.nameEn.toLowerCase().trim())) {
      await d.execute(
        `INSERT INTO expense_categories (id, name_ar, name_en, icon) VALUES (?, ?, ?, ?)`,
        [uuidv4(), ec.nameAr, ec.nameEn, ec.icon]
      )
      expCatNamesEn.add(ec.nameEn.toLowerCase().trim())
    }
  }

  // 8. Seed Default Cash Register idempotently
  const existingRegisters = await d.select<{ id: string; name: string }[]>('SELECT id, name FROM cash_registers')
  if (existingRegisters.length === 0) {
    await d.execute(
      `INSERT INTO cash_registers (id, name, name_ar) VALUES (?, 'Main Register', 'الكاشير الرئيسي')`,
      [uuidv4()]
    )
  }

  // 9. Seed Default Attribute Definitions idempotently
  const existingAttrDefs = await d.select<{ id: string; name_en: string }[]>('SELECT id, name_en FROM product_attribute_defs')
  const attrNamesEn = new Set(existingAttrDefs.map(a => (a.name_en || '').toLowerCase().trim()))

  const attrDefs = [
    { nameAr: 'المقاومة', nameEn: 'Resistance', unit: 'Ω', dataType: 'text' },
    { nameAr: 'السعة', nameEn: 'Capacitance', unit: 'F', dataType: 'text' },
    { nameAr: 'الجهد', nameEn: 'Voltage', unit: 'V', dataType: 'text' },
    { nameAr: 'التيار', nameEn: 'Current', unit: 'A', dataType: 'text' },
    { nameAr: 'القدرة', nameEn: 'Power', unit: 'W', dataType: 'text' },
    { nameAr: 'اللون', nameEn: 'Color', unit: '', dataType: 'text' },
    { nameAr: 'الحجم', nameEn: 'Size', unit: 'mm', dataType: 'text' },
    { nameAr: 'التغليف', nameEn: 'Package', unit: '', dataType: 'text' },
    { nameAr: 'التردد', nameEn: 'Frequency', unit: 'Hz', dataType: 'text' },
    { nameAr: 'الطول', nameEn: 'Length', unit: 'mm', dataType: 'text' },
    { nameAr: 'القطر', nameEn: 'Diameter', unit: 'mm', dataType: 'text' },
    { nameAr: 'نوع الموصل', nameEn: 'Connector Type', unit: '', dataType: 'text' },
    { nameAr: 'عدد الأرجل', nameEn: 'Pin Count', unit: '', dataType: 'number' },
    { nameAr: 'رقم قطعة المُصنِّع', nameEn: 'MPN', unit: '', dataType: 'text' },
    { nameAr: 'التسامح', nameEn: 'Tolerance', unit: '%', dataType: 'text' },
  ]

  for (const attr of attrDefs) {
    if (!attrNamesEn.has(attr.nameEn.toLowerCase().trim())) {
      await d.execute(
        `INSERT INTO product_attribute_defs (id, name_ar, name_en, unit, data_type) VALUES (?, ?, ?, ?, ?)`,
        [uuidv4(), attr.nameAr, attr.nameEn, attr.unit, attr.dataType]
      )
      attrNamesEn.add(attr.nameEn.toLowerCase().trim())
    }
  }

  // 10. Seed Default Storage Locations idempotently
  const existingLocations = await d.select<{ id: string; code: string; name: string }[]>('SELECT id, code, name FROM storage_locations')
  const locCodes = new Set(existingLocations.map(l => (l.code || '').toLowerCase().trim()))

  const defaultLocations = [
    { name: 'Main Store', nameAr: 'المحل الرئيسي', code: 'MAIN', description: 'Storefront and showroom displays' },
    { name: 'Main Warehouse', nameAr: 'المخزن الرئيسي', code: 'WH1', description: 'Back inventory warehouse' },
  ]

  for (const loc of defaultLocations) {
    if (!locCodes.has(loc.code.toLowerCase().trim())) {
      await d.execute(
        `INSERT INTO storage_locations (id, name, name_ar, code, description) VALUES (?, ?, ?, ?, ?)`,
        [uuidv4(), loc.name, loc.nameAr, loc.code, loc.description]
      )
      locCodes.add(loc.code.toLowerCase().trim())
    }
  }

  console.log('✅ Seed data applied idempotently.')
}

async function ensureDefaultPermissions(d: AppDatabase, roles: Array<{ id: string; name: string }>) {
  const adminRole = roles.find(r => r.name === 'admin')
  const managerRole = roles.find(r => r.name === 'manager')
  const cashierRole = roles.find(r => r.name === 'cashier')

  const allResources = [
    { resource: 'dashboard', actions: ['read'] },
    { resource: 'pos', actions: ['access', 'create', 'discount', 'hold'] },
    { resource: 'products', actions: ['read', 'create', 'update', 'delete'] },
    { resource: 'inventory', actions: ['read', 'create', 'update', 'adjust', 'transfer', 'history'] },
    { resource: 'purchases', actions: ['read', 'create', 'update', 'receive', 'cancel', 'pay'] },
    { resource: 'suppliers', actions: ['read', 'create', 'update', 'delete'] },
    { resource: 'customers', actions: ['read', 'create', 'update', 'delete'] },
    { resource: 'sales', actions: ['read', 'create', 'void'] },
    { resource: 'receipts', actions: ['read'] },
    { resource: 'returns', actions: ['read', 'create'] },
    { resource: 'shifts', actions: ['read', 'create', 'update', 'close', 'cash_in', 'cash_out'] },
    { resource: 'cash_registers', actions: ['read', 'create', 'update', 'delete'] },
    { resource: 'payments', actions: ['read', 'create'] },
    { resource: 'expenses', actions: ['read', 'create', 'update', 'cancel', 'categories'] },
    { resource: 'reports', actions: ['read'] },
    { resource: 'users', actions: ['read', 'create', 'update', 'delete'] },
    { resource: 'settings', actions: ['read', 'update'] },
    { resource: 'audit_logs', actions: ['read'] },
    { resource: 'barcodes', actions: ['read'] },
  ]

  // Manager: Everything except users and settings
  const managerResources = allResources.filter(r => !['users', 'settings'].includes(r.resource))

  // Cashier: POS, sales, receipts, products read, customers read/create, shifts read/create/close/cash_in/cash_out, payments read/create, expenses read/create
  const cashierPermissions = [
    { resource: 'pos', action: 'access' },
    { resource: 'pos', action: 'create' },
    { resource: 'pos', action: 'hold' },
    { resource: 'sales', action: 'read' },
    { resource: 'sales', action: 'create' },
    { resource: 'receipts', action: 'read' },
    { resource: 'products', action: 'read' },
    { resource: 'customers', action: 'read' },
    { resource: 'customers', action: 'create' },
    { resource: 'shifts', action: 'read' },
    { resource: 'shifts', action: 'create' },
    { resource: 'shifts', action: 'close' },
    { resource: 'shifts', action: 'cash_in' },
    { resource: 'shifts', action: 'cash_out' },
    { resource: 'cash_registers', action: 'read' },
    { resource: 'payments', action: 'read' },
    { resource: 'payments', action: 'create' },
    { resource: 'returns', action: 'read' },
    { resource: 'returns', action: 'create' },
    { resource: 'expenses', action: 'read' },
    { resource: 'expenses', action: 'create' },
  ]

  // Seed Admin Permissions
  if (adminRole) {
    for (const item of allResources) {
      for (const action of item.actions) {
        await d.execute(
          `INSERT OR IGNORE INTO permissions (id, role_id, resource, action, allowed) VALUES (?, ?, ?, ?, 1)`,
          [uuidv4(), adminRole.id, item.resource, action]
        )
      }
    }
  }

  // Seed Manager Permissions
  if (managerRole) {
    for (const item of managerResources) {
      for (const action of item.actions) {
        await d.execute(
          `INSERT OR IGNORE INTO permissions (id, role_id, resource, action, allowed) VALUES (?, ?, ?, ?, 1)`,
          [uuidv4(), managerRole.id, item.resource, action]
        )
      }
    }
  }

  // Seed Cashier Permissions
  if (cashierRole) {
    for (const item of cashierPermissions) {
      await d.execute(
        `INSERT OR IGNORE INTO permissions (id, role_id, resource, action, allowed) VALUES (?, ?, ?, ?, 1)`,
        [uuidv4(), cashierRole.id, item.resource, item.action]
      )
    }
  }
}

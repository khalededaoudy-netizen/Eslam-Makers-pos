import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import fs from 'node:fs'

const appData = process.env.APPDATA || ''
const dbPath = path.join(appData, 'com.makers.pos', 'makers_pos.db')

console.log('Database Path:', dbPath)
console.log('Exists:', fs.existsSync(dbPath))

if (!fs.existsSync(dbPath)) {
  console.error('Database does not exist at path.')
  process.exit(1)
}

const db = new DatabaseSync(dbPath)

const tables = [
  'product_categories',
  'product_units',
  'expense_categories',
  'cash_registers',
  'product_attribute_defs',
  'storage_locations',
  'roles',
  'users',
  'products',
]

for (const t of tables) {
  try {
    const row = db.prepare(`SELECT count(*) as count FROM ${t}`).get()
    console.log(`${t} count:`, row.count)
  } catch (e) {
    console.log(`${t} error:`, e.message)
  }
}

// Group duplicate categories
const dupCats = db.prepare(`
  SELECT name_en, name_ar, count(*) as cnt 
  FROM product_categories 
  GROUP BY name_en 
  HAVING cnt > 1 
  ORDER BY cnt DESC
`).all()

console.log('--- Duplicate Categories Details ---')
console.log('Duplicate groups count:', dupCats.length)
for (const d of dupCats) {
  console.log(`- ${d.name_en} (${d.name_ar}): ${d.cnt} occurrences`)
}

console.log('Total category rows:', allCats.length)
console.log('Products count:', prodCount.cnt)

console.log('Duplicate units count:', dupUnits.length)
for (const u of dupUnits) {
  console.log(`- Unit ${u.symbol} (${u.name_en}): ${u.cnt}`)
}

console.log('Duplicate expense categories count:', dupExp.length)
for (const e of dupExp) {
  console.log(`- Expense ${e.name_en}: ${e.cnt}`)
}

const regCount = db.prepare('SELECT count(*) as count FROM cash_registers').get()
console.log('Cash registers count:', regCount.count)


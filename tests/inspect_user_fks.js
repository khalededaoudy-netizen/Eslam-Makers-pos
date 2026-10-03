import { DatabaseSync } from 'node:sqlite'
import path from 'path'
import os from 'os'

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'com.makers.pos', 'makers_pos.db')
const db = new DatabaseSync(dbPath)

console.log('--- ALL TABLES IN DATABASE ---')
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
for (const t of tables) {
  const fks = db.prepare(`PRAGMA foreign_key_list("${t.name}")`).all()
  const userFks = fks.filter(f => f.table === 'users')
  if (userFks.length > 0) {
    console.log(`Table: ${t.name}`, userFks)
  }
}

console.log('\n--- COLUMNS IN ALL TABLES WITH user/cashier/by/actor ---')
for (const t of tables) {
  const cols = db.prepare(`PRAGMA table_info("${t.name}")`).all()
  const matchingCols = cols.filter(c => /user|cashier|employee|actor|creator|created_by|updated_by|performed_by|approved_by/i.test(c.name))
  if (matchingCols.length > 0) {
    console.log(`Table: ${t.name} -> Columns:`, matchingCols.map(c => c.name))
  }
}

console.log('\n--- USERS IN DB ---')
const users = db.prepare("SELECT u.id, u.username, u.full_name, u.is_active, r.name as role FROM users u JOIN roles r ON r.id = u.role_id").all()
console.table(users)

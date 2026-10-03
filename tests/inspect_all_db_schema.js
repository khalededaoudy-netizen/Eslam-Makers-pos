import { DatabaseSync } from 'node:sqlite'
import path from 'path'
import os from 'os'

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'com.makers.pos', 'makers_pos.db')
const db = new DatabaseSync(dbPath)

console.log('=== COMPLETE DATABASE SCHEMA AUDIT ===\n')

console.log('--- 1. ALL TABLES AND COLUMNS ---')
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
for (const t of tables) {
  const cols = db.prepare(`PRAGMA table_info("${t.name}")`).all()
  console.log(`Table: ${t.name}`)
  cols.forEach(c => console.log(`  - ${c.name} (${c.type})`))
}

console.log('\n--- 2. ALL FOREIGN KEYS ---')
for (const t of tables) {
  const fks = db.prepare(`PRAGMA foreign_key_list("${t.name}")`).all()
  if (fks.length > 0) {
    console.log(`Table: ${t.name} FKs:`)
    fks.forEach(f => console.log(`  - ${f.from} -> ${f.table}(${f.to}) [ON UPDATE ${f.on_update}, ON DELETE ${f.on_delete}]`))
  }
}

console.log('\n--- 3. ALL TRIGGERS ---')
const triggers = db.prepare("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='trigger'").all()
if (triggers.length === 0) {
  console.log('No triggers found.')
} else {
  triggers.forEach(tr => console.log(`Trigger ${tr.name} on ${tr.tbl_name}:\n${tr.sql}`))
}

console.log('\n--- 4. AUDIT EVERY USER IN DB FOR REFERENCES ---')
const users = db.prepare("SELECT u.id, u.username, u.full_name, u.is_active, r.name as role FROM users u JOIN roles r ON r.id = u.role_id").all()

for (const u of users) {
  console.log(`\nUser: ${u.username} (ID: ${u.id}, Active: ${u.is_active}, Role: ${u.role})`)
  let totalRefs = 0
  for (const t of tables) {
    if (t.name === 'users') continue
    const cols = db.prepare(`PRAGMA table_info("${t.name}")`).all()
    for (const c of cols) {
      if (c.name.includes('user') || c.name.includes('cashier') || c.name.includes('by') || c.name === 'employee_id') {
        try {
          const countRow = db.prepare(`SELECT COUNT(*) as cnt FROM "${t.name}" WHERE "${c.name}" = ?`).get(u.id)
          if (countRow && countRow.cnt > 0) {
            console.log(`  - Table "${t.name}" column "${c.name}": ${countRow.cnt} reference(s)`)
            totalRefs += countRow.cnt
          }
        } catch (e) {
          // Column type mismatch or error
        }
      }
    }
  }
  if (totalRefs === 0) {
    console.log(`  - ZERO references across all tables (Candidate for Hard Delete)`)
  } else {
    console.log(`  - TOTAL REFERENCES: ${totalRefs} (Must Soft Deactivate)`)
  }
}

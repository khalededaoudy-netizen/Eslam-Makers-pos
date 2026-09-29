/**
 * MAKERS POS — Hardware Acceptance & Release Binary Verification Runner
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execSync } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'

console.log('============================================================')
console.log('MAKERS POS v1.0.0 — FINAL HARDWARE ACCEPTANCE VERIFICATION')
console.log('============================================================\n')

// 1. Release Binary Integrity Check
console.log('--- 1. RELEASE EXECUTABLE VERIFICATION ---')
const exePath = path.join(process.cwd(), 'MAKERS-POS-v1.0.0', 'MAKERS POS.exe')
if (!fs.existsSync(exePath)) {
  console.error(`FATAL: Release binary not found at ${exePath}`)
  process.exit(1)
}

const data = fs.readFileSync(exePath)
const size = data.length
const hash = crypto.createHash('sha256').update(data).digest('hex').toUpperCase()

console.log(`File:   ${exePath}`)
console.log(`Size:   ${size} bytes`)
console.log(`SHA256: ${hash}`)

const EXPECTED_SIZE = 15414784
const EXPECTED_HASH = '7BA250FE3F464A2BB4A12C23373ACB9B98DD86E76CB2B8715EA1B6C876CDE455'

if (size === EXPECTED_SIZE && hash === EXPECTED_HASH) {
  console.log('✅ RELEASE BINARY: 100% MATCH VERIFIED\n')
} else {
  console.error(`❌ RELEASE BINARY MISMATCH: Size(${size} vs ${EXPECTED_SIZE}), Hash(${hash} vs ${EXPECTED_HASH})\n`)
  process.exit(1)
}

// 2. Windows Printer Detection
console.log('--- 2. DETECTING THERMAL PRINTERS IN WINDOWS SPOOLER ---')
try {
  const printerInfo = execSync('powershell -NoProfile -Command "Get-CimInstance -ClassName Win32_Printer | Select-Object Name, DriverName, PortName, PrinterStatus | Format-Table -AutoSize | Out-String"', { stdio: 'pipe' }).toString()
  console.log(printerInfo)
} catch (e) {
  console.log('Printer query notice:', e.message)
}

// 3. Scanner / HID Device Detection
console.log('--- 3. DETECTING BARCODE SCANNER / HID INTERFACES ---')
try {
  const hidInfo = execSync('powershell -NoProfile -Command "Get-CimInstance -ClassName Win32_PnPEntity | Where-Object { $_.PNPClass -eq \'HIDClass\' -or $_.PNPClass -eq \'Keyboard\' } | Select-Object -First 6 Name, Manufacturer, Status | Format-Table -AutoSize | Out-String"', { stdio: 'pipe' }).toString()
  console.log(hidInfo)
} catch (e) {
  console.log('HID query notice:', e.message)
}

// 4. Production Database Forensics
console.log('--- 4. DATABASE INTEGRITY INVARIANTS ---')
const appData = process.env.APPDATA || path.join(process.env.HOME || '', 'AppData', 'Roaming')
const dbPath = path.join(appData, 'com.makers.pos', 'makers_pos.db')

if (fs.existsSync(dbPath)) {
  const db = new DatabaseSync(dbPath)
  const integrity = db.prepare('PRAGMA integrity_check').all()
  console.log('PRAGMA integrity_check:', integrity[0]?.integrity_check)
  
  const fk = db.prepare('PRAGMA foreign_key_check').all()
  console.log('PRAGMA foreign_key_check violations count:', fk.length)

  const negStock = db.prepare('SELECT COUNT(*) as c FROM products WHERE current_stock < 0').get().c
  console.log('Negative stock violations count:', negStock)
} else {
  console.log('Database at path:', dbPath, 'not found')
}

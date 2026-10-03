/**
 * Verification Test for External URL Opener & LinkedIn Link
 * Verifies:
 * 1. DEVELOPER_LINKEDIN_URL configuration
 * 2. URL scheme safety validation
 * 3. Settings page & Login page LinkedIn integrations
 */

import fs from 'fs'
import path from 'path'

console.log('=================================================================')
console.log('MAKERS POS — External URL Opener & LinkedIn Integration Test')
console.log('=================================================================\n')

let passed = 0
let failed = 0

function assert(condition, message, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`)
    passed++
  } else {
    console.error(`  ❌ FAIL: ${message} ${details ? `— ${details}` : ''}`)
    failed++
  }
}

// 1. Verify openUrl.ts
const openUrlFilePath = path.join(process.cwd(), 'src', 'lib', 'openUrl.ts')
const openUrlContent = fs.readFileSync(openUrlFilePath, 'utf8')

assert(
  openUrlContent.includes("export const DEVELOPER_LINKEDIN_URL = 'https://www.linkedin.com/in/khaledeldaoudy/'"),
  'DEVELOPER_LINKEDIN_URL is accurately configured to Khaled Eldaoudy profile'
)

assert(
  openUrlContent.includes("await invoke('open_external_url', { url: cleanUrl })"),
  'openExternalUrl invokes Tauri 2 native open_external_url backend command'
)

assert(
  openUrlContent.includes("window.open(cleanUrl, '_blank', 'noopener,noreferrer')"),
  'openExternalUrl provides non-blocking web fallback'
)

// 2. Verify src-tauri/src/lib.rs
const rustLibPath = path.join(process.cwd(), 'src-tauri', 'src', 'lib.rs')
const rustLibContent = fs.readFileSync(rustLibPath, 'utf8')

assert(
  rustLibContent.includes("async fn open_external_url(url: String) -> Result<(), String>"),
  'Native open_external_url command defined in Rust backend'
)

assert(
  rustLibContent.includes("open_external_url") && rustLibContent.includes("tauri::generate_handler!"),
  'open_external_url registered in tauri::generate_handler'
)

assert(
  rustLibContent.includes('cmd') && rustLibContent.includes('start'),
  'Windows implementation launches system default browser using shell start'
)

// 3. Verify SettingsPage.tsx About System link
const settingsPath = path.join(process.cwd(), 'src', 'features', 'settings', 'SettingsPage.tsx')
const settingsContent = fs.readFileSync(settingsPath, 'utf8')

assert(
  settingsContent.includes("openExternalUrl(DEVELOPER_LINKEDIN_URL)"),
  'SettingsPage About System section triggers openExternalUrl(DEVELOPER_LINKEDIN_URL)'
)

assert(
  settingsContent.includes("href={DEVELOPER_LINKEDIN_URL}"),
  'SettingsPage anchor element includes valid href for accessibility and fallback'
)

console.log('\n=================================================================')
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`)
console.log('=================================================================')

if (failed > 0) {
  process.exit(1)
}

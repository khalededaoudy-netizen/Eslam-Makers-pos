import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const releaseDir = path.resolve('MAKERS_POS_v1.0.0_Windows_Release')
const rootRel = path.resolve('MAKERS-POS-v1.0.0')

const installerDir = path.join(releaseDir, 'Installer')
const portableDir = path.join(releaseDir, 'Portable')

fs.mkdirSync(installerDir, { recursive: true })
fs.mkdirSync(portableDir, { recursive: true })
fs.mkdirSync(rootRel, { recursive: true })

const nsisSource = path.resolve('src-tauri/target/release/bundle/nsis/MAKERS POS_1.0.0_x64-setup.exe')
const msiSource = path.resolve('src-tauri/target/release/bundle/msi/MAKERS POS_1.0.0_x64_en-US.msi')
const exeSource = path.resolve('src-tauri/target/release/MAKERS POS.exe')

// Copy binaries
fs.copyFileSync(nsisSource, path.join(installerDir, 'MAKERS POS_1.0.0_x64-setup.exe'))
fs.copyFileSync(msiSource, path.join(installerDir, 'MAKERS POS_1.0.0_x64_en-US.msi'))
fs.copyFileSync(exeSource, path.join(portableDir, 'MAKERS POS.exe'))

fs.copyFileSync(nsisSource, path.join(rootRel, 'MAKERS POS_1.0.0_x64-setup.exe'))
fs.copyFileSync(msiSource, path.join(rootRel, 'MAKERS POS_1.0.0_x64_en-US.msi'))
fs.copyFileSync(exeSource, path.join(rootRel, 'MAKERS POS.exe'))

function hashFile(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase()
}

const nsisHash = hashFile(path.join(installerDir, 'MAKERS POS_1.0.0_x64-setup.exe'))
const msiHash = hashFile(path.join(installerDir, 'MAKERS POS_1.0.0_x64_en-US.msi'))
const exeHash = hashFile(path.join(portableDir, 'MAKERS POS.exe'))

const nsisSize = fs.statSync(path.join(installerDir, 'MAKERS POS_1.0.0_x64-setup.exe')).size
const msiSize = fs.statSync(path.join(installerDir, 'MAKERS POS_1.0.0_x64_en-US.msi')).size
const exeSize = fs.statSync(path.join(portableDir, 'MAKERS POS.exe')).size

const checksumsTxt = [
  '================================================================================',
  'MAKERS POS v1.0.0 — OFFICIAL RELEASE CHECKSUMS (SHA-256)',
  `Generated: ${new Date().toISOString().split('T')[0]}`,
  '================================================================================',
  '',
  'File:   MAKERS POS_1.0.0_x64_en-US.msi (Windows MSI Production Installer)',
  `Size:   ${msiSize.toLocaleString()} bytes (${(msiSize / (1024*1024)).toFixed(2)} MB)`,
  `SHA256: ${msiHash}`,
  '--------------------------------------------------------------------------------',
  'File:   MAKERS POS_1.0.0_x64-setup.exe (Windows NSIS Setup Installer)',
  `Size:   ${nsisSize.toLocaleString()} bytes (${(nsisSize / (1024*1024)).toFixed(2)} MB)`,
  `SHA256: ${nsisHash}`,
  '--------------------------------------------------------------------------------',
  'File:   MAKERS POS.exe (Standalone Direct Executable)',
  `Size:   ${exeSize.toLocaleString()} bytes (${(exeSize / (1024*1024)).toFixed(2)} MB)`,
  `SHA256: ${exeHash}`,
  '================================================================================',
  ''
].join('\n')

const sha256Sums = [
  `${nsisHash.toLowerCase()} *MAKERS POS_1.0.0_x64-setup.exe`,
  `${msiHash.toLowerCase()} *MAKERS POS_1.0.0_x64_en-US.msi`,
  `${exeHash.toLowerCase()} *MAKERS POS.exe`,
  ''
].join('\n')

fs.writeFileSync(path.join(releaseDir, 'CHECKSUMS.txt'), checksumsTxt)
fs.writeFileSync(path.join(releaseDir, 'SHA256SUMS.txt'), sha256Sums)
fs.writeFileSync(path.join(rootRel, 'CHECKSUMS.txt'), checksumsTxt)
fs.writeFileSync(path.join(rootRel, 'SHA256SUMS.txt'), sha256Sums)

// Copy text docs
const docs = ['README.txt', 'INSTALLATION.txt', 'RECOVERY.txt', 'CHANGELOG.txt']
for (const doc of docs) {
  if (fs.existsSync(path.join(rootRel, doc))) {
    fs.copyFileSync(path.join(rootRel, doc), path.join(releaseDir, doc))
  }
}

console.log('✅ Packaging complete. Checksums and documentation updated in both directories.')

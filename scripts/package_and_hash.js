import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const targetDir = path.resolve('MAKERS-POS-v1.0.0')
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true })
}

const nsisSource = path.resolve('src-tauri/target/release/bundle/nsis/MAKERS POS_1.0.0_x64-setup.exe')
const msiSource = path.resolve('src-tauri/target/release/bundle/msi/MAKERS POS_1.0.0_x64_en-US.msi')
const exeSource = path.resolve('src-tauri/target/release/MAKERS POS.exe')

const nsisDest = path.join(targetDir, 'MAKERS POS_1.0.0_x64-setup.exe')
const msiDest = path.join(targetDir, 'MAKERS POS_1.0.0_x64_en-US.msi')
const exeDest = path.join(targetDir, 'MAKERS POS.exe')

fs.copyFileSync(nsisSource, nsisDest)
fs.copyFileSync(msiSource, msiDest)
fs.copyFileSync(exeSource, exeDest)

console.log('Copied all 3 artifacts to:', targetDir)

function getSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath)
  const hashSum = crypto.createHash('sha256')
  hashSum.update(fileBuffer)
  return hashSum.digest('hex')
}

const artifacts = [nsisDest, msiDest, exeDest]
const results = []

for (const art of artifacts) {
  const stat = fs.statSync(art)
  const sha = getSha256(art)
  const res = {
    file: path.basename(art),
    path: art,
    size: stat.size,
    sizeFormatted: (stat.size / (1024 * 1024)).toFixed(2) + ' MB',
    sha256: sha,
  }
  results.push(res)
  console.log('--------------------------------------------------')
  console.log('File:', res.file)
  console.log('Path:', res.path)
  console.log('Size:', res.size, 'bytes', `(${res.sizeFormatted})`)
  console.log('SHA256:', res.sha256)
}

// Write checksum file
const checksumContent = results.map(r => `${r.sha256}  ${r.file}`).join('\n') + '\n'
fs.writeFileSync(path.join(targetDir, 'SHA256SUMS.txt'), checksumContent)
console.log('\nWrote checksums to:', path.join(targetDir, 'SHA256SUMS.txt'))

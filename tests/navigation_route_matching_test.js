/**
 * MAKERS POS — Navigation Route Matching Test
 * 
 * Verifies that navigation items in Sidebar never activate simultaneously when on subroutes.
 */

const navPaths = [
  '/',
  '/pos',
  '/products',
  '/products/categories',
  '/products/brands',
  '/products/attributes',
  '/products/units',
  '/inventory',
  '/barcodes',
  '/purchases',
  '/suppliers',
  '/customers',
  '/cash-register',
  '/expenses',
  '/reports',
  '/audit',
  '/users',
  '/settings',
]

function checkIsActive(currentLocation, itemPath) {
  if (itemPath === '/') return currentLocation === '/'
  if (currentLocation === itemPath) return true
  return (
    currentLocation.startsWith(`${itemPath}/`) &&
    !navPaths.some(
      p => p !== itemPath && p.startsWith(itemPath) && (currentLocation === p || currentLocation.startsWith(`${p}/`))
    )
  )
}

const testCases = [
  {
    location: '/products',
    expectedActive: ['/products'],
  },
  {
    location: '/products/categories',
    expectedActive: ['/products/categories'],
  },
  {
    location: '/products/brands',
    expectedActive: ['/products/brands'],
  },
  {
    location: '/products/attributes',
    expectedActive: ['/products/attributes'],
  },
  {
    location: '/products/units',
    expectedActive: ['/products/units'],
  },
  {
    location: '/products/new',
    expectedActive: ['/products'], // subroute of /products that is not a sibling nav
  },
  {
    location: '/products/123/edit',
    expectedActive: ['/products'],
  },
  {
    location: '/inventory',
    expectedActive: ['/inventory'],
  },
  {
    location: '/',
    expectedActive: ['/'],
  },
]

let passed = 0
let failed = 0

console.log('===============================================================')
console.log('MAKERS POS — Navigation Route Matching Verification Suite')
console.log('===============================================================\n')

for (const tc of testCases) {
  const activePaths = navPaths.filter(p => checkIsActive(tc.location, p))
  const isMatch = activePaths.length === tc.expectedActive.length && activePaths.every(p => tc.expectedActive.includes(p))

  if (isMatch) {
    console.log(`✅ [PASS] Location: "${tc.location}" -> Active: [${activePaths.join(', ')}]`)
    passed++
  } else {
    console.error(`❌ [FAIL] Location: "${tc.location}" -> Expected [${tc.expectedActive.join(', ')}], Got [${activePaths.join(', ')}]`)
    failed++
  }
}

console.log(`\nTOTAL: ${testCases.length} | PASSED: ${passed} | FAILED: ${failed}`)

if (failed > 0) {
  process.exit(1)
}

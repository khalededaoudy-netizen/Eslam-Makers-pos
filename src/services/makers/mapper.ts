/**
 * MAKERS Website Mapper & Utilities
 * Decodes HTML entities, parses WooCommerce pricing, extracts specifications
 */

import { MakersApiProduct, MakersMappedProduct } from './types'

/** Decode common HTML entities from WordPress / WooCommerce */
export function decodeHtmlEntities(text: string): string {
  if (!text) return ''
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8216;/g, '‘')
    .replace(/&#8217;/g, '’')
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&#215;/g, '×')
    .replace(/&times;/g, '×')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .trim()
}

/** Strip HTML tags to return plain text */
export function stripHtml(html: string): string {
  if (!html) return ''
  const decoded = decodeHtmlEntities(html)
  return decoded
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim()
}

/** Parse price from WooCommerce Store API minor units */
export function parseWebsitePrice(prices?: { price?: string; currency_minor_unit?: number }): number {
  if (!prices || !prices.price) return 0
  const rawNum = parseFloat(prices.price)
  if (isNaN(rawNum)) return 0
  const minorUnits = typeof prices.currency_minor_unit === 'number' ? prices.currency_minor_unit : 2
  return rawNum / Math.pow(10, minorUnits)
}

/** Heuristic pattern matching for common electronics component packages */
const PACKAGE_PATTERNS = [
  /\b(DIP-?\d+)\b/i,
  /\b(SOP-?\d+)\b/i,
  /\b(SOIC-?\d+)\b/i,
  /\b(SSOP-?\d+)\b/i,
  /\b(TSSOP-?\d+)\b/i,
  /\b(TO-?(?:92|126|220|247|252|263)[A-Z]?)\b/i,
  /\b(SOT-?(?:23|223|89))\b/i,
  /\b(QFP-?\d+|TQFP-?\d+|LQFP-?\d+|QFN-?\d+)\b/i,
  /\b(0402|0603|0805|1206|1210|2512)\b/,
  /\b(SMD|SMT)\b/i,
  /\b(Through\s*Hole|THT)\b/i,
  /\b(\d+(?:[x×*]\d+)?\s*mm)\b/i,
]

export function extractFootprintPackage(name: string, description: string): string | null {
  const combined = `${name} ${description}`
  for (const pattern of PACKAGE_PATTERNS) {
    const match = combined.match(pattern)
    if (match) {
      return match[1].toUpperCase()
    }
  }
  return null
}

/** Extract datasheet URL if mentioned in description or links */
export function extractDatasheetUrl(descriptionHtml: string): string | null {
  if (!descriptionHtml) return null
  const pdfMatch = descriptionHtml.match(/href=["'](https?:\/\/[^"']+\.pdf)["']/i)
  if (pdfMatch) return pdfMatch[1]
  const datasheetMatch = descriptionHtml.match(/href=["'](https?:\/\/[^"']*(?:datasheet)[^"']*)["']/i)
  if (datasheetMatch) return datasheetMatch[1]
  return null
}

/** Convert direct makerselectronics uploads to Photon CDN URL to bypass anti-bot 403 challenge */
export function toMakersCdnUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return ''
  let trimmed = url.trim()
  if (!trimmed) return ''

  if (trimmed.startsWith('https://makerselectronics.com/wp-content/uploads/')) {
    return trimmed.replace('https://makerselectronics.com/', 'https://i0.wp.com/makerselectronics.com/')
  }
  if (trimmed.startsWith('https://www.makerselectronics.com/wp-content/uploads/')) {
    return trimmed.replace('https://www.makerselectronics.com/', 'https://i0.wp.com/makerselectronics.com/')
  }
  if (trimmed.startsWith('http://makerselectronics.com/wp-content/uploads/')) {
    return trimmed.replace('http://makerselectronics.com/', 'https://i0.wp.com/makerselectronics.com/')
  }
  if (trimmed.startsWith('http://www.makerselectronics.com/wp-content/uploads/')) {
    return trimmed.replace('http://www.makerselectronics.com/', 'https://i0.wp.com/makerselectronics.com/')
  }
  // Relative WordPress upload path
  if (trimmed.startsWith('/wp-content/uploads/')) {
    return `https://i0.wp.com/makerselectronics.com${trimmed}`
  }
  return trimmed
}

/** Validate if an image URL/path is usable and not empty or a dummy string */
export function isValidImageUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false
  const trimmed = url.trim()
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed === 'NaN' || trimmed === '[object Object]') {
    return false
  }
  // Check for HTTP/HTTPS URL, asset protocol, data URL, or valid absolute file path
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('asset://') ||
    trimmed.startsWith('/wp-content/uploads/')
  ) {
    return true
  }
  // Windows absolute path (e.g. C:\...) or Unix absolute path
  if (/^[a-zA-Z]:[\\\/]/.test(trimmed) || trimmed.startsWith('/')) {
    return true
  }
  return false
}

/**
 * Map raw WooCommerce product to clean MAKERS POS product
 */
export function mapMakersProduct(raw: MakersApiProduct): MakersMappedProduct {
  const cleanName = decodeHtmlEntities(raw.name || '')
  const plainShortDesc = stripHtml(raw.short_description || '')
  const plainDesc = stripHtml(raw.description || '')
  const websitePrice = parseWebsitePrice(raw.prices)
  const currency = raw.prices?.currency_code || 'EGP'

  const categories = Array.isArray(raw.categories)
    ? raw.categories.map(c => decodeHtmlEntities(c.name)).filter(Boolean)
    : []

  const tags = Array.isArray(raw.tags)
    ? raw.tags.map(t => decodeHtmlEntities(t.name)).filter(Boolean)
    : []

  // Extract all images from WooCommerce images array
  const extractedImages: string[] = []

  if (Array.isArray(raw.images)) {
    for (const item of raw.images) {
      const img = item as any
      if (typeof img === 'string' && isValidImageUrl(img)) {
        extractedImages.push(toMakersCdnUrl(img))
      } else if (img && typeof img === 'object') {
        const candidate = img.src || img.source_url || img.url || img.thumbnail || ''
        if (isValidImageUrl(candidate)) {
          extractedImages.push(toMakersCdnUrl(String(candidate)))
        }
      }
    }
  }

  // Also check single image field or featured_image if images array was empty
  if (extractedImages.length === 0) {
    const singleImg = (raw as any).image || (raw as any).featured_image
    if (typeof singleImg === 'string' && isValidImageUrl(singleImg)) {
      extractedImages.push(toMakersCdnUrl(singleImg))
    } else if (singleImg && typeof singleImg === 'object') {
      const candidate = singleImg.src || singleImg.source_url || singleImg.url || singleImg.thumbnail || ''
      if (isValidImageUrl(candidate)) {
        extractedImages.push(toMakersCdnUrl(String(candidate)))
      }
    }
  }

  const imageUrl = extractedImages.length > 0 ? extractedImages[0] : null
  const footprintPackage = extractFootprintPackage(cleanName, plainDesc)
  const datasheetUrl = extractDatasheetUrl(raw.description || '')

  return {
    id: raw.id,
    name: cleanName,
    sku: raw.sku ? raw.sku.trim() : '',
    websitePrice,
    formattedPrice: `${websitePrice.toFixed(2)} ${currency}`,
    currency,
    isInStock: raw.is_in_stock ?? true,
    permalink: raw.permalink || '',
    imageUrl,
    images: extractedImages,
    categories,
    tags,
    shortDescription: plainShortDesc,
    description: plainDesc,
    footprintPackage,
    datasheetUrl,
  }
}


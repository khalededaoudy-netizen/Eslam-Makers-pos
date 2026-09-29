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

  const images = Array.isArray(raw.images) ? raw.images.map(img => img.src).filter(Boolean) : []
  const imageUrl = images.length > 0 ? images[0] : null
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
    images,
    categories,
    tags,
    shortDescription: plainShortDesc,
    description: plainDesc,
    footprintPackage,
    datasheetUrl,
  }
}


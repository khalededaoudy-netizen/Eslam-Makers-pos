/**
 * MAKERS Website Integration — Types & Interfaces
 * Represents public WooCommerce Store API structures and mapped POS products
 */

export interface MakersApiImage {
  id: number
  src: string
  thumbnail?: string
  name?: string
  alt?: string
}

export interface MakersApiCategory {
  id: number
  name: string
  slug: string
  link?: string
}

export interface MakersApiTag {
  id: number
  name: string
  slug: string
  link?: string
}

export interface MakersApiPrices {
  price: string
  regular_price: string
  sale_price: string
  currency_code: string
  currency_symbol: string
  currency_minor_unit: number
  currency_prefix: string
  currency_suffix: string
}

export interface MakersApiProduct {
  id: number
  name: string
  slug: string
  permalink: string
  sku: string
  description: string
  short_description: string
  prices: MakersApiPrices
  images: MakersApiImage[]
  categories: MakersApiCategory[]
  tags: MakersApiTag[]
  is_in_stock: boolean
  is_purchasable: boolean
  attributes: Array<{
    id: number
    name: string
    taxonomy?: string
    has_variations?: boolean
    terms: Array<{ id: number; name: string; slug: string }>
  }>
}

export interface MakersSearchResult {
  products: MakersMappedProduct[]
  total: number
  totalPages: number
  currentPage: number
}

export interface MakersMappedProduct {
  id: number
  name: string
  sku: string
  websitePrice: number
  formattedPrice: string
  currency: string
  isInStock: boolean
  permalink: string
  imageUrl: string | null
  categories: string[]
  tags: string[]
  shortDescription: string
  description: string
  footprintPackage: string | null
  datasheetUrl: string | null
}

export type DuplicateMatchReason = 'website_id' | 'website_sku' | 'barcode' | 'sku'

export interface DuplicateCheckResult {
  isDuplicate: boolean
  matchedProduct: {
    id: string
    sku: string
    name_ar: string
    name_en: string
    current_stock: number
    selling_price: number
    purchase_price: number
    drawer_location?: string | null
    category_id?: string | null
  } | null
  matchReason: DuplicateMatchReason | null
}

export interface SaveImportedProductPayload {
  // Website metadata
  external_product_id: string
  external_sku: string
  external_url: string
  website_price: number
  
  // Product info
  name_en: string
  name_ar: string
  sku: string
  description: string
  image_path?: string | null
  category_id?: string | null
  new_category_name?: string | null
  unit_id: string
  
  // Electronics specs
  drawer_location?: string | null
  footprint_package?: string | null
  datasheet_url?: string | null
  
  // Local store & commercial data
  purchase_price: number
  selling_price: number
  initial_quantity: number
  min_stock: number
  default_supplier_id?: string | null
  notes?: string | null
}

/**
 * MAKERS Website Client
 * Read-only public HTTP client for makerselectronics.com WooCommerce Store API
 * Supports both native Tauri command execution (bypassing CORS) and fallback fetch.
 */

import { MakersApiProduct } from './types'

const MAKERS_BASE_URL = 'https://makerselectronics.com/wp-json/wc/store/v1'
const DEFAULT_TIMEOUT_MS = 15000

export type MakersErrorCode = 
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'NOT_FOUND'
  | 'INVALID_RESPONSE'
  | 'RATE_LIMITED'
  | 'EMPTY_QUERY'

export class MakersError extends Error {
  constructor(
    message: string,
    public readonly code: MakersErrorCode,
    public readonly httpStatus?: number
  ) {
    super(message)
    this.name = 'MakersError'
  }
}

export interface FetchProductsResponse {
  products: MakersApiProduct[]
  total: number
  totalPages: number
}

/** Check if running inside Tauri environment */
function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
}

/**
 * Execute raw GET request against MAKERS API
 */
async function fetchMakersRaw(url: string, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<any> {
  // 1. Try Native Tauri Command (handles CORS, custom headers, zero WebView limitations)
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const jsonStr = await invoke<string>('fetch_makers_url', { url })
      try {
        return JSON.parse(jsonStr)
      } catch (parseErr) {
        throw new MakersError('MAKERS returned an unexpected response format.', 'INVALID_RESPONSE')
      }
    } catch (tauriErr: any) {
      if (tauriErr instanceof MakersError) {
        throw tauriErr
      }
      const rawMsg = tauriErr?.message || String(tauriErr)
      
      if (rawMsg.includes('HTTP Error 429')) {
        throw new MakersError('Too many requests. Please wait a moment and try again.', 'RATE_LIMITED', 429)
      }
      if (rawMsg.includes('HTTP Error 404')) {
        throw new MakersError('Product not found on MAKERS website.', 'NOT_FOUND', 404)
      }
      if (rawMsg.includes('HTTP Error 5')) {
        throw new MakersError('MAKERS website server is temporarily unavailable.', 'NETWORK_ERROR', 500)
      }
      if (rawMsg.includes('timed out') || rawMsg.includes('timeout') || rawMsg.includes('os error 10060')) {
        throw new MakersError('Connection to MAKERS website timed out.', 'TIMEOUT')
      }
      if (rawMsg.includes('Network error') || rawMsg.includes('dns error') || rawMsg.includes('connection refused')) {
        throw new MakersError('Unable to connect to MAKERS website. Please check internet connection.', 'NETWORK_ERROR')
      }
      throw new MakersError(rawMsg || 'Unable to connect to MAKERS website.', 'NETWORK_ERROR')
    }
  }

  // 2. Fallback for browser / testing environments
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (response.status === 429) {
      throw new MakersError('Too many requests. Please wait a moment and try again.', 'RATE_LIMITED', 429)
    }

    if (response.status === 404) {
      throw new MakersError('Product not found on MAKERS website.', 'NOT_FOUND', 404)
    }

    if (!response.ok) {
      throw new MakersError(`Website returned HTTP ${response.status}`, 'INVALID_RESPONSE', response.status)
    }

    const data = await response.json()
    return data
  } catch (err: any) {
    clearTimeout(timeoutId)
    if (err.name === 'AbortError') {
      throw new MakersError('Connection to MAKERS website timed out.', 'TIMEOUT')
    }
    if (err instanceof MakersError) {
      throw err
    }
    throw new MakersError(
      err.message || 'Unable to connect to MAKERS website. Please check internet connection.',
      'NETWORK_ERROR'
    )
  }
}

/**
 * Fetch products from MAKERS public WooCommerce Store API
 */
export async function fetchMakersProducts(
  searchTerm: string,
  page = 1,
  perPage = 20,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<FetchProductsResponse> {
  const cleanSearch = searchTerm.trim()
  const url = new URL(`${MAKERS_BASE_URL}/products`)
  if (cleanSearch) {
    url.searchParams.set('search', cleanSearch)
  }
  url.searchParams.set('page', page.toString())
  url.searchParams.set('per_page', perPage.toString())

  const data = await fetchMakersRaw(url.toString(), timeoutMs)

  if (!Array.isArray(data)) {
    // If empty or non-array returned
    if (data && typeof data === 'object' && Array.isArray((data as any).products)) {
      const items = (data as any).products
      return {
        products: items,
        total: items.length,
        totalPages: items.length > 0 ? 1 : 0,
      }
    }
    return {
      products: [],
      total: 0,
      totalPages: 0,
    }
  }

  return {
    products: data,
    total: data.length,
    totalPages: data.length >= perPage ? page + 1 : page,
  }
}

/**
 * Fetch a single product by website ID
 */
export async function fetchMakersProductById(
  productId: number | string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<MakersApiProduct> {
  const url = `${MAKERS_BASE_URL}/products/${productId}`
  const data = await fetchMakersRaw(url, timeoutMs)
  
  if (!data || typeof data !== 'object' || !('id' in data)) {
    throw new MakersError('Invalid product data received from website.', 'INVALID_RESPONSE')
  }

  return data as MakersApiProduct
}

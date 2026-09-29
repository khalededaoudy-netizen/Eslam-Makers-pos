import React, { useState } from 'react'
import { Package, Cpu } from 'lucide-react'

interface ProductImageProps {
  src?: string | null
  alt?: string
  className?: string
  fallbackType?: 'package' | 'cpu'
  iconClassName?: string
}

function resolveImageSrc(src?: string | null): string | null {
  if (!src) return null
  const trimmed = src.trim()
  if (!trimmed) return null

  // If already http/https or data url or asset URL
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('asset://')
  ) {
    return trimmed
  }

  // If running in Tauri and has local absolute file path
  try {
    if (typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)) {
      // @tauri-apps/api/core convertFileSrc
      const { convertFileSrc } = (window as any).__TAURI__?.core || {}
      if (typeof convertFileSrc === 'function') {
        return convertFileSrc(trimmed)
      }
    }
  } catch (err) {
    console.warn('Error converting file src:', err)
  }

  return trimmed
}

export function ProductImage({
  src,
  alt = '',
  className = 'w-full h-full object-contain',
  fallbackType = 'package',
  iconClassName = 'w-1/2 h-1/2 opacity-30 text-muted-foreground',
}: ProductImageProps) {
  const [hasError, setHasError] = useState(false)
  const resolvedSrc = resolveImageSrc(src)

  if (!resolvedSrc || hasError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/40 rounded">
        {fallbackType === 'cpu' ? (
          <Cpu className={iconClassName} />
        ) : (
          <Package className={iconClassName} />
        )}
      </div>
    )
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setHasError(true)}
    />
  )
}

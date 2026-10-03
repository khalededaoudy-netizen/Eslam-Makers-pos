import React, { useState, useEffect } from 'react'
import { Package, Cpu } from 'lucide-react'
import { convertFileSrc } from '@tauri-apps/api/core'

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
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed === 'NaN') return null

  // If already http/https or data url or asset URL
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('asset://')
  ) {
    return trimmed
  }

  // If local absolute file path
  try {
    return convertFileSrc(trimmed)
  } catch {
    return trimmed
  }
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

  useEffect(() => {
    setHasError(false)
  }, [src])

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


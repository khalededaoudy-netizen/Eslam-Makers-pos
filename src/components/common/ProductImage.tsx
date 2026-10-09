import React, { useState, useEffect } from 'react'
import { Package, Cpu } from 'lucide-react'
import { convertFileSrc, invoke } from '@tauri-apps/api/core'

interface ProductImageProps {
  src?: string | null
  alt?: string
  className?: string
  fallbackType?: 'package' | 'cpu'
  iconClassName?: string
}

export function ProductImage({
  src,
  alt = '',
  className = 'w-full h-full object-contain',
  fallbackType = 'package',
  iconClassName = 'w-1/2 h-1/2 opacity-30 text-muted-foreground',
}: ProductImageProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null)
  const [hasError, setHasError] = useState(false)
  const [triedBase64, setTriedBase64] = useState(false)

  useEffect(() => {
    setHasError(false)
    setTriedBase64(false)

    if (!src) {
      setResolvedUrl(null)
      return
    }

    const trimmed = src.trim()
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed === 'NaN') {
      setResolvedUrl(null)
      return
    }

    // If already http/https or data url or asset URL
    if (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('asset://')
    ) {
      let finalUrl = trimmed
      if (finalUrl.startsWith('https://makerselectronics.com/wp-content/uploads/')) {
        finalUrl = finalUrl.replace('https://makerselectronics.com/', 'https://i0.wp.com/makerselectronics.com/')
      } else if (finalUrl.startsWith('https://www.makerselectronics.com/wp-content/uploads/')) {
        finalUrl = finalUrl.replace('https://www.makerselectronics.com/', 'https://i0.wp.com/makerselectronics.com/')
      } else if (finalUrl.startsWith('http://makerselectronics.com/wp-content/uploads/')) {
        finalUrl = finalUrl.replace('http://makerselectronics.com/', 'https://i0.wp.com/makerselectronics.com/')
      }
      setResolvedUrl(finalUrl)
      return
    }

    // Relative WordPress upload path
    if (trimmed.startsWith('/wp-content/uploads/')) {
      setResolvedUrl(`https://i0.wp.com/makerselectronics.com${trimmed}`)
      return
    }

    // Local file path — normalize separators and convert to asset URL
    try {
      const normalized = trimmed.replace(/\\/g, '/')
      const assetUrl = convertFileSrc(normalized)
      setResolvedUrl(assetUrl)
    } catch (err) {
      console.warn('[ProductImage] convertFileSrc error:', err)
      attemptBase64Fallback(trimmed)
    }
  }, [src])

  const attemptBase64Fallback = async (filePath: string) => {
    if (triedBase64) {
      setHasError(true)
      return
    }
    setTriedBase64(true)
    try {
      const base64Data = await invoke<string>('read_image_base64', { filePath })
      if (base64Data) {
        setResolvedUrl(base64Data)
        setHasError(false)
        return
      }
    } catch (err) {
      console.warn('[ProductImage] Base64 fallback failed for:', filePath, err)
    }
    setHasError(true)
  }

  const handleImgError = () => {
    if (src && !triedBase64 && !src.startsWith('data:') && !src.startsWith('http')) {
      attemptBase64Fallback(src.trim())
    } else {
      setHasError(true)
    }
  }

  if (!resolvedUrl || hasError) {
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
      src={resolvedUrl}
      alt={alt}
      className={className}
      loading="lazy"
      onError={handleImgError}
    />
  )
}

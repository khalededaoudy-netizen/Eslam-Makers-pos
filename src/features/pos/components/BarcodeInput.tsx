import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Scan, Zap, AlertCircle } from 'lucide-react'
import { posService } from '../posService'
import { PosProduct } from '../types'

interface BarcodeInputProps {
  onProductFound: (product: PosProduct) => void
  disabled?: boolean
}

export function BarcodeInput({ onProductFound, disabled = false }: BarcodeInputProps) {
  const { t } = useTranslation()
  const [barcode, setBarcode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleScanSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const code = barcode.trim()
    if (!code) return

    setLoading(true)
    setError(null)
    try {
      const product = await posService.lookupByBarcode(code)
      if (product) {
        onProductFound(product)
        setBarcode('')
      } else {
        setError(t('pos.productNotFound', 'لم يتم العثور على منتج بهذا الباركود / الكود'))
        setTimeout(() => setError(null), 3500)
      }
    } catch (err: any) {
      console.error('Barcode lookup error:', err)
      setError(err.message || 'Error looking up barcode')
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="relative">
      <form onSubmit={handleScanSubmit} className="relative flex items-center">
        <Scan className="w-5 h-5 absolute start-3 text-primary shrink-0 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={barcode}
          disabled={disabled}
          onChange={e => {
            setBarcode(e.target.value)
            if (error) setError(null)
          }}
          placeholder={t('pos.scanBarcode', 'امسح الباركود أو أدخل كود الصنف واضغط Enter...')}
          className="w-full ps-10 pe-24 py-2.5 bg-background border-2 border-primary/30 rounded-xl text-sm font-mono focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 shadow-sm transition-all placeholder:text-muted-foreground/70"
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={disabled || loading || !barcode.trim()}
          className="absolute end-1.5 top-1.5 bottom-1.5 px-3 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-40 flex items-center gap-1 shadow-sm"
        >
          <Zap className="w-3.5 h-3.5" />
          <span>{loading ? '...' : t('common.add', 'إضافة')}</span>
        </button>
      </form>

      {error && (
        <div className="absolute top-full start-0 end-0 mt-1 z-30 p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2 animate-fade-in shadow-md">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}

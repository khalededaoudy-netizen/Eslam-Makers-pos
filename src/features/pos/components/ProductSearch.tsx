import React, { useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, X, Loader2 } from 'lucide-react'

interface ProductSearchProps {
  query: string
  onQueryChange: (q: string) => void
  onClear: () => void
  searching?: boolean
  inputRef?: React.RefObject<HTMLInputElement>
}

export function ProductSearch({
  query,
  onQueryChange,
  onClear,
  searching = false,
  inputRef,
}: ProductSearchProps) {
  const { t } = useTranslation()

  return (
    <div className="relative">
      <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => onQueryChange(e.target.value)}
        placeholder={t(
          'pos.searchPlaceholder',
          'ابحث باسم المنتج (عربي / إنجليزي)، كود SKU، التصنيف، المواصفات... [F2]'
        )}
        className="w-full ps-9 pe-9 py-2 bg-background border border-input rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-sm"
        autoComplete="off"
      />
      {searching ? (
        <Loader2 className="w-4 h-4 absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />
      ) : query ? (
        <button
          type="button"
          onClick={onClear}
          className="absolute end-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      ) : null}
    </div>
  )
}

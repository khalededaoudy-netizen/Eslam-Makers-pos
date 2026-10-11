import React, { forwardRef } from 'react'

export interface NumberInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  allowWheel?: boolean
}

/**
 * Reusable NumberInput component that prevents accidental value modifications
 * when users scroll over the input with the mouse wheel, while keeping keyboard
 * arrow keys (up/down) and manual entry fully operational.
 */
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className = '', onWheel, allowWheel = false, ...props }, ref) => {
    const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
      if (!allowWheel) {
        e.currentTarget.blur()
      }
      onWheel?.(e)
    }

    return (
      <input
        ref={ref}
        type="number"
        onWheel={handleWheel}
        className={className}
        {...props}
      />
    )
  }
)

NumberInput.displayName = 'NumberInput'
export default NumberInput

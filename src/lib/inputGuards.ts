/**
 * MAKERS POS — Input Guards
 * Global handlers to prevent unwanted interactions such as mouse wheel value modification on number inputs,
 * while keeping keyboard arrow keys and manual typing fully functional.
 */

export function setupNumberInputWheelGuard(): () => void {
  if (typeof window === 'undefined') return () => {}

  const handleWheel = (event: WheelEvent) => {
    // If the active element or the event target is a number input, prevent accidental value scrolling
    const active = document.activeElement
    const target = event.target as HTMLElement | null

    const isNumberInput =
      (active instanceof HTMLInputElement && active.type === 'number') ||
      (target instanceof HTMLInputElement && target.type === 'number')

    if (isNumberInput) {
      if (active instanceof HTMLInputElement && active.type === 'number') {
        active.blur()
      }
      if (target instanceof HTMLInputElement && target.type === 'number') {
        target.blur()
      }
    }
  }

  // Use passive event listener for performance
  window.addEventListener('wheel', handleWheel, { passive: true })

  return () => {
    window.removeEventListener('wheel', handleWheel)
  }
}

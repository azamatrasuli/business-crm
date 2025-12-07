'use client'

import { useEffect, useRef, useCallback } from 'react'

/**
 * Focusable element selectors
 */
const FOCUSABLE_SELECTORS = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

/**
 * Hook to trap focus within a container (for modals, dialogs, etc.)
 * Implements WCAG 2.1 focus management requirements
 * 
 * @param isActive - Whether the focus trap should be active
 * @param options - Configuration options
 * 
 * @example
 * ```tsx
 * function Modal({ isOpen, onClose }) {
 *   const containerRef = useFocusTrap(isOpen)
 *   
 *   return isOpen ? (
 *     <div ref={containerRef} role="dialog" aria-modal="true">
 *       <button onClick={onClose}>Close</button>
 *       <input type="text" />
 *     </div>
 *   ) : null
 * }
 * ```
 */
export function useFocusTrap<T extends HTMLElement = HTMLElement>(
  isActive: boolean,
  options: {
    /** Return focus to this element when trap is deactivated */
    returnFocusTo?: HTMLElement | null
    /** Auto focus first focusable element when trap activates */
    autoFocus?: boolean
    /** Allow escape key to call this function */
    onEscape?: () => void
    /** Initial element to focus (selector or element) */
    initialFocus?: string | HTMLElement | null
  } = {}
) {
  const containerRef = useRef<T>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)

  const {
    returnFocusTo,
    autoFocus = true,
    onEscape,
    initialFocus,
  } = options

  // Get all focusable elements within container
  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return []
    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
    ).filter((el) => {
      // Filter out hidden elements
      return el.offsetParent !== null
    })
  }, [])

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!containerRef.current) return

      // Escape key
      if (event.key === 'Escape' && onEscape) {
        event.preventDefault()
        onEscape()
        return
      }

      // Tab key - trap focus within container
      if (event.key === 'Tab') {
        const focusableElements = getFocusableElements()
        if (focusableElements.length === 0) return

        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]

        // Shift+Tab on first element -> go to last
        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault()
          lastElement.focus()
        }
        // Tab on last element -> go to first
        else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault()
          firstElement.focus()
        }
      }
    },
    [getFocusableElements, onEscape]
  )

  // Activate focus trap
  useEffect(() => {
    if (!isActive) return

    // Store previously focused element
    previousActiveElement.current = document.activeElement as HTMLElement

    // Auto focus first element or specified initial focus
    if (autoFocus && containerRef.current) {
      let elementToFocus: HTMLElement | null = null

      if (initialFocus) {
        if (typeof initialFocus === 'string') {
          elementToFocus = containerRef.current.querySelector(initialFocus)
        } else {
          elementToFocus = initialFocus
        }
      }

      if (!elementToFocus) {
        const focusableElements = getFocusableElements()
        elementToFocus = focusableElements[0] || containerRef.current
      }

      // Delay focus to allow for animations
      requestAnimationFrame(() => {
        elementToFocus?.focus()
      })
    }

    // Add keyboard event listener
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)

      // Return focus to previous element
      const returnTarget = returnFocusTo || previousActiveElement.current
      if (returnTarget && typeof returnTarget.focus === 'function') {
        requestAnimationFrame(() => {
          returnTarget.focus()
        })
      }
    }
  }, [isActive, autoFocus, initialFocus, returnFocusTo, handleKeyDown, getFocusableElements])

  return containerRef
}

/**
 * Hook to restore focus when component unmounts
 * Useful for popovers, dropdowns, etc.
 */
export function useRestoreFocus() {
  const previousActiveElement = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previousActiveElement.current = document.activeElement as HTMLElement

    return () => {
      if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
        requestAnimationFrame(() => {
          previousActiveElement.current?.focus()
        })
      }
    }
  }, [])
}

/**
 * Hook to manage focus within a roving tabindex pattern
 * For keyboard navigation in lists, toolbars, etc.
 */
export function useRovingFocus<T extends HTMLElement = HTMLElement>(
  items: T[] | null,
  options: {
    orientation?: 'horizontal' | 'vertical' | 'both'
    loop?: boolean
    currentIndex?: number
    onIndexChange?: (index: number) => void
  } = {}
) {
  const {
    orientation = 'vertical',
    loop = true,
    currentIndex = 0,
    onIndexChange,
  } = options

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!items || items.length === 0) return

      const isVertical = orientation === 'vertical' || orientation === 'both'
      const isHorizontal = orientation === 'horizontal' || orientation === 'both'

      let nextIndex = currentIndex
      let handled = false

      switch (event.key) {
        case 'ArrowDown':
          if (isVertical) {
            nextIndex = currentIndex + 1
            handled = true
          }
          break
        case 'ArrowUp':
          if (isVertical) {
            nextIndex = currentIndex - 1
            handled = true
          }
          break
        case 'ArrowRight':
          if (isHorizontal) {
            nextIndex = currentIndex + 1
            handled = true
          }
          break
        case 'ArrowLeft':
          if (isHorizontal) {
            nextIndex = currentIndex - 1
            handled = true
          }
          break
        case 'Home':
          nextIndex = 0
          handled = true
          break
        case 'End':
          nextIndex = items.length - 1
          handled = true
          break
      }

      if (handled) {
        event.preventDefault()

        // Handle looping
        if (loop) {
          if (nextIndex < 0) nextIndex = items.length - 1
          if (nextIndex >= items.length) nextIndex = 0
        } else {
          nextIndex = Math.max(0, Math.min(items.length - 1, nextIndex))
        }

        onIndexChange?.(nextIndex)
        items[nextIndex]?.focus()
      }
    },
    [items, currentIndex, orientation, loop, onIndexChange]
  )

  return { handleKeyDown }
}


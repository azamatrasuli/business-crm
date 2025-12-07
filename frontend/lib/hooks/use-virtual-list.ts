'use client'

import { useRef, useCallback } from 'react'
import { useVirtualizer, type VirtualizerOptions } from '@tanstack/react-virtual'

/**
 * Hook for virtualizing long lists
 * Only renders visible items + buffer for performance
 * 
 * @example
 * ```tsx
 * function LongList({ items }) {
 *   const { parentRef, virtualizer, virtualItems, totalSize } = useVirtualList({
 *     count: items.length,
 *     estimateSize: 50, // estimated row height
 *   })
 *   
 *   return (
 *     <div ref={parentRef} style={{ height: 400, overflow: 'auto' }}>
 *       <div style={{ height: totalSize, position: 'relative' }}>
 *         {virtualItems.map((virtualItem) => (
 *           <div
 *             key={virtualItem.key}
 *             style={{
 *               position: 'absolute',
 *               top: virtualItem.start,
 *               height: virtualItem.size,
 *               width: '100%',
 *             }}
 *           >
 *             {items[virtualItem.index]}
 *           </div>
 *         ))}
 *       </div>
 *     </div>
 *   )
 * }
 * ```
 */
export function useVirtualList<T extends HTMLElement = HTMLDivElement>(options: {
  /** Number of items in the list */
  count: number
  /** Estimated size of each item (height for vertical, width for horizontal) */
  estimateSize: number | ((index: number) => number)
  /** Number of items to render above/below visible area */
  overscan?: number
  /** Horizontal or vertical scrolling */
  horizontal?: boolean
  /** Gap between items */
  gap?: number
  /** Enable dynamic sizing (measure actual item sizes) */
  enableDynamicSizing?: boolean
  /** Callback when item size changes (for dynamic sizing) */
  onItemSizeChange?: (index: number, size: number) => void
}) {
  const {
    count,
    estimateSize,
    overscan = 5,
    horizontal = false,
    gap = 0,
    enableDynamicSizing = false,
  } = options

  const parentRef = useRef<T>(null)

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: typeof estimateSize === 'function' ? estimateSize : () => estimateSize,
    overscan,
    horizontal,
    gap,
    measureElement: enableDynamicSizing
      ? (element) => element.getBoundingClientRect()[horizontal ? 'width' : 'height']
      : undefined,
  })

  // Get virtual items
  const virtualItems = virtualizer.getVirtualItems()
  
  // Total size of all items (for container sizing)
  const totalSize = virtualizer.getTotalSize()

  // Scroll to specific index
  const scrollToIndex = useCallback(
    (index: number, options?: { align?: 'start' | 'center' | 'end' | 'auto'; behavior?: 'auto' | 'smooth' }) => {
      virtualizer.scrollToIndex(index, options)
    },
    [virtualizer]
  )

  // Scroll to specific offset
  const scrollToOffset = useCallback(
    (offset: number, options?: { align?: 'start' | 'center' | 'end' | 'auto'; behavior?: 'auto' | 'smooth' }) => {
      virtualizer.scrollToOffset(offset, options)
    },
    [virtualizer]
  )

  // Measure element (for dynamic sizing)
  const measureElement = useCallback(
    (element: HTMLElement | null) => {
      if (element && enableDynamicSizing) {
        virtualizer.measureElement(element)
      }
    },
    [virtualizer, enableDynamicSizing]
  )

  return {
    parentRef,
    virtualizer,
    virtualItems,
    totalSize,
    scrollToIndex,
    scrollToOffset,
    measureElement,
  }
}

/**
 * Hook for virtualizing a grid/table
 * Supports both row and column virtualization
 */
export function useVirtualGrid<T extends HTMLElement = HTMLDivElement>(options: {
  rowCount: number
  columnCount: number
  rowEstimateSize: number | ((index: number) => number)
  columnEstimateSize: number | ((index: number) => number)
  overscan?: number
}) {
  const {
    rowCount,
    columnCount,
    rowEstimateSize,
    columnEstimateSize,
    overscan = 5,
  } = options

  const parentRef = useRef<T>(null)

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: typeof rowEstimateSize === 'function' ? rowEstimateSize : () => rowEstimateSize,
    overscan,
  })

  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: columnCount,
    getScrollElement: () => parentRef.current,
    estimateSize: typeof columnEstimateSize === 'function' ? columnEstimateSize : () => columnEstimateSize,
    overscan,
  })

  return {
    parentRef,
    rowVirtualizer,
    columnVirtualizer,
    virtualRows: rowVirtualizer.getVirtualItems(),
    virtualColumns: columnVirtualizer.getVirtualItems(),
    totalHeight: rowVirtualizer.getTotalSize(),
    totalWidth: columnVirtualizer.getTotalSize(),
  }
}

/**
 * Virtualized list component wrapper
 * Provides common patterns for virtualized lists
 */
export interface VirtualListProps<T> {
  items: T[]
  estimateSize: number
  overscan?: number
  className?: string
  renderItem: (item: T, index: number) => React.ReactNode
  getItemKey?: (item: T, index: number) => string | number
}

/**
 * Calculate visible range for a virtualized list
 * Useful for loading data on demand
 */
export function getVisibleRange(
  virtualizer: ReturnType<typeof useVirtualizer>
): { startIndex: number; endIndex: number } {
  const items = virtualizer.getVirtualItems()
  if (items.length === 0) {
    return { startIndex: 0, endIndex: 0 }
  }
  return {
    startIndex: items[0].index,
    endIndex: items[items.length - 1].index,
  }
}


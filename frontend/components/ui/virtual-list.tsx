"use client"

import * as React from "react"
import { useRef } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { cn } from "@/lib/utils"

interface VirtualListProps<T> {
  /** Array of items to render */
  items: T[]
  /** Render function for each item */
  renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode
  /** Get unique key for each item */
  getItemKey?: (item: T, index: number) => string | number
  /** Estimated height of each item */
  estimateSize?: number | ((index: number) => number)
  /** Number of items to render outside visible area */
  overscan?: number
  /** Height of the container */
  height?: number | string
  /** Width of the container */
  width?: number | string
  /** Gap between items */
  gap?: number
  /** Horizontal list instead of vertical */
  horizontal?: boolean
  /** Container className */
  className?: string
  /** Inner container className */
  innerClassName?: string
  /** Callback when scroll position changes */
  onScroll?: (scrollOffset: number) => void
  /** Loading state */
  isLoading?: boolean
  /** Loading skeleton component */
  loadingSkeleton?: React.ReactNode
  /** Number of loading skeletons to show */
  loadingCount?: number
  /** Empty state component */
  emptyState?: React.ReactNode
}

/**
 * Virtualized list component for rendering large lists efficiently
 * 
 * @example
 * ```tsx
 * <VirtualList
 *   items={users}
 *   height={400}
 *   estimateSize={60}
 *   renderItem={(user, index, style) => (
 *     <div key={user.id} style={style} className="p-4 border-b">
 *       {user.name}
 *     </div>
 *   )}
 * />
 * ```
 */
export function VirtualList<T>({
  items,
  renderItem,
  getItemKey,
  estimateSize = 50,
  overscan = 5,
  height = 400,
  width = "100%",
  gap = 0,
  horizontal = false,
  className,
  innerClassName,
  onScroll,
  isLoading = false,
  loadingSkeleton,
  loadingCount = 5,
  emptyState,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: typeof estimateSize === "function" ? estimateSize : () => estimateSize,
    overscan,
    horizontal,
    gap,
  })

  const virtualItems = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  // Handle scroll events
  React.useEffect(() => {
    if (!onScroll || !parentRef.current) return

    const handleScroll = () => {
      const el = parentRef.current
      if (el) {
        onScroll(horizontal ? el.scrollLeft : el.scrollTop)
      }
    }

    const el = parentRef.current
    el.addEventListener("scroll", handleScroll, { passive: true })
    return () => el.removeEventListener("scroll", handleScroll)
  }, [onScroll, horizontal])

  // Loading state
  if (isLoading) {
    return (
      <div
        className={cn("overflow-auto", className)}
        style={{ height, width }}
      >
        {loadingSkeleton ? (
          Array.from({ length: loadingCount }).map((_, i) => (
            <React.Fragment key={i}>{loadingSkeleton}</React.Fragment>
          ))
        ) : (
          <div className="space-y-2 p-4">
            {Array.from({ length: loadingCount }).map((_, i) => (
              <div
                key={i}
                className="h-12 bg-muted animate-pulse rounded"
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  // Empty state
  if (items.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-muted-foreground",
          className
        )}
        style={{ height, width }}
      >
        {emptyState || "Нет данных"}
      </div>
    )
  }

  return (
    <div
      ref={parentRef}
      className={cn("overflow-auto", className)}
      style={{ height, width }}
    >
      <div
        className={cn("relative", innerClassName)}
        style={
          horizontal
            ? { width: totalSize, height: "100%" }
            : { height: totalSize, width: "100%" }
        }
      >
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index]
          const key = getItemKey
            ? getItemKey(item, virtualItem.index)
            : virtualItem.key

          const style: React.CSSProperties = horizontal
            ? {
                position: "absolute",
                top: 0,
                left: virtualItem.start,
                width: virtualItem.size,
                height: "100%",
              }
            : {
                position: "absolute",
                top: virtualItem.start,
                left: 0,
                width: "100%",
                height: virtualItem.size,
              }

          return (
            <React.Fragment key={key}>
              {renderItem(item, virtualItem.index, style)}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Virtualized infinite list with load more support
 */
interface VirtualInfiniteListProps<T> extends Omit<VirtualListProps<T>, "items"> {
  items: T[]
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  fetchNextPage?: () => void
  /** Threshold in pixels from bottom to trigger load more */
  loadMoreThreshold?: number
}

export function VirtualInfiniteList<T>({
  items,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  loadMoreThreshold = 200,
  onScroll,
  ...props
}: VirtualInfiniteListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null)

  const handleScroll = React.useCallback(
    (scrollOffset: number) => {
      onScroll?.(scrollOffset)

      if (!hasNextPage || isFetchingNextPage || !fetchNextPage) return

      const el = parentRef.current
      if (!el) return

      const { scrollHeight, scrollTop, clientHeight } = el
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight

      if (distanceFromBottom < loadMoreThreshold) {
        fetchNextPage()
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage, loadMoreThreshold, onScroll]
  )

  return (
    <VirtualList
      {...props}
      items={items}
      onScroll={handleScroll}
    />
  )
}


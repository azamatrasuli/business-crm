/**
 * @fileoverview Data Fetcher Component
 * Render prop component for handling async data states.
 * Provides consistent loading/error/empty handling.
 */

'use client'

import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { AlertTriangle, RefreshCw, Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface DataFetcherProps<T> {
  /** React Query result object */
  query: UseQueryResult<T>
  /** Render function called with data when loaded */
  children: (data: T) => ReactNode
  /** Custom loading skeleton */
  skeleton?: ReactNode
  /** Custom error component */
  error?: ReactNode | ((error: Error, retry: () => void) => ReactNode)
  /** Custom empty state (when data is null/undefined/empty array) */
  empty?: ReactNode
  /** Show skeleton on refetch */
  showSkeletonOnRefetch?: boolean
  /** Minimum height for container */
  minHeight?: string | number
  /** Additional className */
  className?: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// Default Components
// ═══════════════════════════════════════════════════════════════════════════════

function DefaultSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-8 w-1/3" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  )
}

function DefaultError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <h3 className="font-semibold mb-1">Ошибка загрузки</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm">
        {error.message || 'Произошла ошибка при загрузке данных'}
      </p>
      <Button variant="outline" onClick={onRetry}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Повторить
      </Button>
    </div>
  )
}

function DefaultEmpty() {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
        <Inbox className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="font-semibold mb-1">Нет данных</h3>
      <p className="text-sm text-muted-foreground">
        Данные отсутствуют или не найдены
      </p>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * DataFetcher component for consistent data loading patterns.
 *
 * @example
 * // Basic usage
 * <DataFetcher query={employeesQuery}>
 *   {(employees) => <EmployeesList employees={employees} />}
 * </DataFetcher>
 *
 * @example
 * // With custom skeleton
 * <DataFetcher
 *   query={dashboardQuery}
 *   skeleton={<DashboardSkeleton />}
 * >
 *   {(data) => <Dashboard data={data} />}
 * </DataFetcher>
 *
 * @example
 * // With custom error handling
 * <DataFetcher
 *   query={ordersQuery}
 *   error={(error, retry) => (
 *     <CustomError message={error.message} onRetry={retry} />
 *   )}
 * >
 *   {(orders) => <OrdersList orders={orders} />}
 * </DataFetcher>
 */
export function DataFetcher<T>({
  query,
  children,
  skeleton,
  error,
  empty,
  showSkeletonOnRefetch = false,
  minHeight,
  className,
}: DataFetcherProps<T>) {
  const { data, isLoading, isFetching, isError, error: queryError, refetch } = query

  const showLoading = isLoading || (showSkeletonOnRefetch && isFetching)

  // Loading state
  if (showLoading) {
    return (
      <div className={cn(className)} style={{ minHeight }}>
        {skeleton ?? <DefaultSkeleton />}
      </div>
    )
  }

  // Error state
  if (isError && queryError) {
    const errorElement =
      typeof error === 'function'
        ? error(queryError as Error, refetch)
        : error ?? <DefaultError error={queryError as Error} onRetry={refetch} />

    return (
      <div className={cn(className)} style={{ minHeight }}>
        {errorElement}
      </div>
    )
  }

  // Empty state (no data or empty array)
  const isEmpty = (() => {
    if (data === null || data === undefined) return true
    if (Array.isArray(data) && data.length === 0) return true
    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>
      if ('items' in obj && Array.isArray(obj.items) && obj.items.length === 0) {
        return true
      }
    }
    return false
  })()

  if (isEmpty) {
    return (
      <div className={cn(className)} style={{ minHeight }}>
        {empty ?? <DefaultEmpty />}
      </div>
    )
  }

  // Success state
  return <>{children(data as T)}</>
}

// ═══════════════════════════════════════════════════════════════════════════════
// Specialized Variants
// ═══════════════════════════════════════════════════════════════════════════════

interface ListFetcherProps<T> extends Omit<DataFetcherProps<{ items: T[] }>, 'children'> {
  children: (items: T[]) => ReactNode
  emptyTitle?: string
  emptyDescription?: string
}

/**
 * Specialized fetcher for paginated list data.
 */
export function ListFetcher<T>({
  children,
  emptyTitle = 'Список пуст',
  emptyDescription = 'Нет элементов для отображения',
  empty,
  ...props
}: ListFetcherProps<T>) {
  return (
    <DataFetcher
      {...props}
      empty={
        empty ?? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
              <Inbox className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-1">{emptyTitle}</h3>
            <p className="text-sm text-muted-foreground">{emptyDescription}</p>
          </div>
        )
      }
    >
      {(data) => children(data.items)}
    </DataFetcher>
  )
}


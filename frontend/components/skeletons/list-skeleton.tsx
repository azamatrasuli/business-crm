/**
 * @fileoverview List Skeletons
 * Skeleton loading states for various list types.
 */

'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// ═══════════════════════════════════════════════════════════════════════════════
// Table Skeleton
// ═══════════════════════════════════════════════════════════════════════════════

interface TableSkeletonProps {
  rows?: number
  columns?: number
  showHeader?: boolean
  className?: string
}

export function TableSkeleton({
  rows = 5,
  columns = 5,
  showHeader = true,
  className,
}: TableSkeletonProps) {
  return (
    <div className={cn('w-full', className)}>
      {/* Header */}
      {showHeader && (
        <div className="flex gap-4 p-4 border-b">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton
              key={`header-${i}`}
              className="h-4"
              style={{ width: `${100 / columns}%` }}
            />
          ))}
        </div>
      )}

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 p-4 border-b last:border-0">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={`${rowIndex}-${colIndex}`}
              className="h-4"
              style={{ width: `${100 / columns}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Card List Skeleton
// ═══════════════════════════════════════════════════════════════════════════════

interface CardListSkeletonProps {
  count?: number
  showAvatar?: boolean
  showBadge?: boolean
  className?: string
}

export function CardListSkeleton({
  count = 5,
  showAvatar = true,
  showBadge = true,
  className,
}: CardListSkeletonProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-4 border rounded-lg bg-card"
        >
          {showAvatar && <Skeleton className="h-10 w-10 rounded-full shrink-0" />}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          {showBadge && <Skeleton className="h-6 w-16 rounded-full" />}
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Employee List Skeleton
// ═══════════════════════════════════════════════════════════════════════════════

interface EmployeeListSkeletonProps {
  count?: number
  className?: string
}

export function EmployeeListSkeleton({ count = 5, className }: EmployeeListSkeletonProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-4 border rounded-lg bg-card"
        >
          {/* Avatar */}
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />

          {/* Name & Phone */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>

          {/* Project */}
          <Skeleton className="h-3 w-20 hidden sm:block" />

          {/* Service Type */}
          <Skeleton className="h-6 w-16 rounded-full hidden md:block" />

          {/* Status */}
          <Skeleton className="h-6 w-20 rounded-full" />

          {/* Actions */}
          <div className="flex gap-1">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Order List Skeleton
// ═══════════════════════════════════════════════════════════════════════════════

interface OrderListSkeletonProps {
  count?: number
  className?: string
}

export function OrderListSkeleton({ count = 5, className }: OrderListSkeletonProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-4 border rounded-lg bg-card"
        >
          {/* Checkbox */}
          <Skeleton className="h-4 w-4 rounded shrink-0" />

          {/* Employee */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>

          {/* Combo */}
          <Skeleton className="h-6 w-20 rounded-full hidden sm:block" />

          {/* Price */}
          <Skeleton className="h-4 w-16 hidden md:block" />

          {/* Status */}
          <Skeleton className="h-6 w-20 rounded-full" />

          {/* Actions */}
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Stats Cards Skeleton
// ═══════════════════════════════════════════════════════════════════════════════

interface StatsSkeletonProps {
  count?: number
  className?: string
}

export function StatsCardsSkeleton({ count = 3, className }: StatsSkeletonProps) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-6 border rounded-lg bg-card">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-8 w-20 mb-2" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Dashboard Skeleton
// ═══════════════════════════════════════════════════════════════════════════════

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-10" />
        </div>
      </div>

      {/* Stats */}
      <StatsCardsSkeleton count={3} />

      {/* Orders */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-48" />
        </div>
        <OrderListSkeleton count={5} />
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Export all
// ═══════════════════════════════════════════════════════════════════════════════

export const Skeletons = {
  Table: TableSkeleton,
  CardList: CardListSkeleton,
  EmployeeList: EmployeeListSkeleton,
  OrderList: OrderListSkeleton,
  StatsCards: StatsCardsSkeleton,
  Dashboard: DashboardSkeleton,
}


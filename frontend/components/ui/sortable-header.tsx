'use client'

import * as React from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SortDirection = 'asc' | 'desc' | null

export interface SortConfig<T extends string = string> {
  field: T
  direction: SortDirection
}

interface SortableHeaderProps {
  label: string
  field: string
  currentSort: SortConfig | null
  onSort: (field: string) => void
  className?: string
}

export function SortableHeader({
  label,
  field,
  currentSort,
  onSort,
  className,
}: SortableHeaderProps) {
  const isActive = currentSort?.field === field
  const direction = isActive ? currentSort.direction : null

  const renderIcon = () => {
    if (!isActive || !direction) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground opacity-50" />
    }
    return direction === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5 text-primary" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-primary" />
    )
  }

  return (
    <button
      type="button"
      className={cn(
        'flex items-center gap-1.5 font-semibold hover:text-primary transition-colors -ml-2 px-2 py-1 rounded-md hover:bg-muted/50',
        isActive && 'text-primary',
        className
      )}
      onClick={() => onSort(field)}
    >
      {label}
      {renderIcon()}
    </button>
  )
}

// Hook for managing sort state
export function useSort<T extends string = string>(
  defaultField?: T,
  defaultDirection: SortDirection = 'asc'
) {
  const [sortConfig, setSortConfig] = React.useState<SortConfig<T> | null>(
    defaultField ? { field: defaultField, direction: defaultDirection } : null
  )

  const toggleSort = React.useCallback((field: T) => {
    setSortConfig((prev) => {
      if (prev?.field === field) {
        // Cycle: asc -> desc -> null -> asc
        if (prev.direction === 'asc') {
          return { field, direction: 'desc' }
        }
        if (prev.direction === 'desc') {
          return null
        }
      }
      return { field, direction: 'asc' }
    })
  }, [])

  const clearSort = React.useCallback(() => {
    setSortConfig(null)
  }, [])

  return { sortConfig, toggleSort, clearSort, setSortConfig }
}

// Generic sort function for arrays
export function sortData<T>(
  data: T[],
  sortConfig: SortConfig | null,
  comparators?: Partial<Record<string, (a: T, b: T) => number>>
): T[] {
  if (!sortConfig || !sortConfig.direction) {
    return data
  }

  const { field, direction } = sortConfig
  const multiplier = direction === 'asc' ? 1 : -1

  return [...data].sort((a, b) => {
    // Use custom comparator if provided
    if (comparators?.[field]) {
      return comparators[field]!(a, b) * multiplier
    }

    // Default comparison
    const aValue = (a as Record<string, unknown>)[field]
    const bValue = (b as Record<string, unknown>)[field]

    // Handle null/undefined
    if (aValue == null && bValue == null) return 0
    if (aValue == null) return 1
    if (bValue == null) return -1

    // Handle different types
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return aValue.localeCompare(bValue, 'ru') * multiplier
    }

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return (aValue - bValue) * multiplier
    }

    if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
      return ((aValue ? 1 : 0) - (bValue ? 1 : 0)) * multiplier
    }

    // Date comparison
    if (aValue instanceof Date && bValue instanceof Date) {
      return (aValue.getTime() - bValue.getTime()) * multiplier
    }

    // Try string comparison as fallback
    return String(aValue).localeCompare(String(bValue), 'ru') * multiplier
  })
}


/**
 * @fileoverview Pagination hook
 * Custom hook for handling pagination state and actions.
 * Based on Code Quality Audit Framework - DRY principle.
 */

import { useCallback, useMemo, useState } from 'react'

/**
 * Pagination configuration
 */
interface PaginationConfig {
  /** Initial page (default: 1) */
  initialPage?: number
  /** Items per page (default: 20) */
  pageSize?: number
  /** Total number of items */
  total: number
}

/**
 * Pagination state and actions
 */
interface UsePaginationReturn {
  /** Current page (1-indexed) */
  currentPage: number
  /** Items per page */
  pageSize: number
  /** Total number of items */
  total: number
  /** Total number of pages */
  totalPages: number
  /** Whether there's a previous page */
  hasPreviousPage: boolean
  /** Whether there's a next page */
  hasNextPage: boolean
  /** Start index for current page (0-indexed) */
  startIndex: number
  /** End index for current page (0-indexed, exclusive) */
  endIndex: number
  /** Go to a specific page */
  goToPage: (page: number) => void
  /** Go to next page */
  nextPage: () => void
  /** Go to previous page */
  previousPage: () => void
  /** Go to first page */
  firstPage: () => void
  /** Go to last page */
  lastPage: () => void
  /** Update page size */
  setPageSize: (size: number) => void
  /** Update total (useful when data changes) */
  setTotal: (total: number) => void
  /** Reset to first page */
  reset: () => void
  /** Get page numbers for pagination UI */
  getPageNumbers: (maxVisible?: number) => number[]
}

/**
 * Hook for handling pagination state and navigation.
 *
 * @example
 * ```tsx
 * const pagination = usePagination({ total: 100, pageSize: 20 })
 *
 * // In your data fetching
 * useEffect(() => {
 *   fetchData(pagination.currentPage, pagination.pageSize)
 * }, [pagination.currentPage, pagination.pageSize])
 *
 * // In your UI
 * <Pagination
 *   currentPage={pagination.currentPage}
 *   totalPages={pagination.totalPages}
 *   onPageChange={pagination.goToPage}
 * />
 * ```
 */
export function usePagination({
  initialPage = 1,
  pageSize: initialPageSize = 20,
  total: initialTotal,
}: PaginationConfig): UsePaginationReturn {
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [total, setTotal] = useState(initialTotal)

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize])

  const hasPreviousPage = currentPage > 1
  const hasNextPage = currentPage < totalPages

  const startIndex = (currentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, total)

  const goToPage = useCallback(
    (page: number) => {
      const validPage = Math.max(1, Math.min(page, totalPages))
      setCurrentPage(validPage)
    },
    [totalPages]
  )

  const nextPage = useCallback(() => {
    if (hasNextPage) {
      setCurrentPage((prev) => prev + 1)
    }
  }, [hasNextPage])

  const previousPage = useCallback(() => {
    if (hasPreviousPage) {
      setCurrentPage((prev) => prev - 1)
    }
  }, [hasPreviousPage])

  const firstPage = useCallback(() => {
    setCurrentPage(1)
  }, [])

  const lastPage = useCallback(() => {
    setCurrentPage(totalPages)
  }, [totalPages])

  const handleSetPageSize = useCallback((size: number) => {
    setPageSize(size)
    setCurrentPage(1) // Reset to first page when changing page size
  }, [])

  const reset = useCallback(() => {
    setCurrentPage(initialPage)
  }, [initialPage])

  const getPageNumbers = useCallback(
    (maxVisible = 5): number[] => {
      if (totalPages <= maxVisible) {
        return Array.from({ length: totalPages }, (_, i) => i + 1)
      }

      const half = Math.floor(maxVisible / 2)
      let start = currentPage - half
      let end = currentPage + half

      if (start < 1) {
        start = 1
        end = maxVisible
      }

      if (end > totalPages) {
        end = totalPages
        start = totalPages - maxVisible + 1
      }

      return Array.from({ length: end - start + 1 }, (_, i) => start + i)
    },
    [currentPage, totalPages]
  )

  return {
    currentPage,
    pageSize,
    total,
    totalPages,
    hasPreviousPage,
    hasNextPage,
    startIndex,
    endIndex,
    goToPage,
    nextPage,
    previousPage,
    firstPage,
    lastPage,
    setPageSize: handleSetPageSize,
    setTotal,
    reset,
    getPageNumbers,
  }
}


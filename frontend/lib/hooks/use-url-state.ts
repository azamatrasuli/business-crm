/**
 * @fileoverview URL State Hook
 * Synchronizes component state with URL search params.
 * Enables shareable URLs with filters/pagination preserved.
 */

'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useCallback, useMemo, useTransition } from 'react'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

type Primitive = string | number | boolean | null | undefined
type UrlStateValue = Primitive | Primitive[]

export interface UseUrlStateOptions {
  /** Use shallow routing (no page reload) */
  shallow?: boolean
  /** Scroll to top on state change */
  scroll?: boolean
  /** Debounce delay for rapid updates (ms) */
  debounce?: number
}

// ═══════════════════════════════════════════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Hook for managing state synchronized with URL search params.
 *
 * @example
 * // Basic usage
 * const [state, setState] = useUrlState({
 *   page: 1,
 *   search: '',
 *   status: 'all',
 * })
 *
 * // Update single value
 * setState({ page: 2 })
 *
 * // Update multiple values
 * setState({ search: 'john', page: 1 })
 *
 * // Results in URL: /employees?page=2&search=john
 */
export function useUrlState<T extends Record<string, UrlStateValue>>(
  defaultValues: T,
  options: UseUrlStateOptions = {}
): [T, (updates: Partial<T>) => void, { isPending: boolean; reset: () => void }] {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  const { shallow = true, scroll = false } = options

  // Parse current URL state
  const state = useMemo(() => {
    const result = { ...defaultValues } as T

    for (const key of Object.keys(defaultValues) as Array<keyof T>) {
      const urlValue = searchParams.get(key as string)
      const defaultValue = defaultValues[key]

      if (urlValue === null) continue

      // Parse based on default value type
      if (typeof defaultValue === 'number') {
        const num = Number(urlValue)
        if (!isNaN(num)) {
          result[key] = num as T[keyof T]
        }
      } else if (typeof defaultValue === 'boolean') {
        result[key] = (urlValue === 'true') as T[keyof T]
      } else if (Array.isArray(defaultValue)) {
        result[key] = urlValue.split(',') as T[keyof T]
      } else {
        result[key] = urlValue as T[keyof T]
      }
    }

    return result
  }, [searchParams, defaultValues])

  // Update URL state
  const setState = useCallback(
    (updates: Partial<T>) => {
      const params = new URLSearchParams(searchParams.toString())

      for (const [key, value] of Object.entries(updates)) {
        const defaultValue = defaultValues[key as keyof T]

        // Remove param if value equals default or is empty
        if (
          value === undefined ||
          value === null ||
          value === '' ||
          value === defaultValue ||
          (Array.isArray(value) && value.length === 0)
        ) {
          params.delete(key)
        } else if (Array.isArray(value)) {
          params.set(key, value.join(','))
        } else {
          params.set(key, String(value))
        }
      }

      const queryString = params.toString()
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname

      startTransition(() => {
        router.push(newUrl, { scroll })
      })
    },
    [searchParams, router, pathname, defaultValues, scroll]
  )

  // Reset to default values
  const reset = useCallback(() => {
    startTransition(() => {
      router.push(pathname, { scroll })
    })
  }, [router, pathname, scroll])

  return [state, setState, { isPending, reset }]
}

// ═══════════════════════════════════════════════════════════════════════════════
// Specialized Hooks
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Hook for pagination state in URL.
 */
export function useUrlPagination(defaultPage = 1, defaultPageSize = 20) {
  const [state, setState] = useUrlState({
    page: defaultPage,
    pageSize: defaultPageSize,
  })

  const setPage = useCallback((page: number) => setState({ page }), [setState])
  const setPageSize = useCallback(
    (pageSize: number) => setState({ pageSize, page: 1 }),
    [setState]
  )

  return {
    page: state.page,
    pageSize: state.pageSize,
    setPage,
    setPageSize,
  }
}

/**
 * Hook for search state in URL with debounce.
 */
export function useUrlSearch(debounceMs = 300) {
  const [state, setState] = useUrlState({ search: '' })

  const setSearch = useCallback(
    (search: string) => {
      setState({ search })
    },
    [setState]
  )

  return {
    search: state.search,
    setSearch,
  }
}

/**
 * Hook for sort state in URL.
 */
export function useUrlSort<T extends string>(
  defaultSortBy?: T,
  defaultSortOrder: 'asc' | 'desc' = 'asc'
) {
  const [state, setState] = useUrlState({
    sortBy: defaultSortBy ?? ('' as T),
    sortOrder: defaultSortOrder,
  })

  const setSort = useCallback(
    (sortBy: T, sortOrder?: 'asc' | 'desc') => {
      setState({
        sortBy,
        sortOrder: sortOrder ?? (state.sortBy === sortBy && state.sortOrder === 'asc' ? 'desc' : 'asc'),
      })
    },
    [setState, state.sortBy, state.sortOrder]
  )

  const clearSort = useCallback(() => {
    setState({ sortBy: '' as T, sortOrder: defaultSortOrder })
  }, [setState, defaultSortOrder])

  return {
    sortBy: state.sortBy || undefined,
    sortOrder: state.sortOrder,
    setSort,
    clearSort,
  }
}


/**
 * @fileoverview Employees Queries
 * React Query hooks for fetching employee data.
 * Part of CQRS-lite pattern - read operations only.
 */

import { useQuery, useInfiniteQuery, type UseQueryOptions } from '@tanstack/react-query'
import { queryKeys, staleTimes } from '@/lib/query/query-client'
import { employeesRepo, type EmployeesFilterParams } from '@/lib/repositories'
import type { Employee, EmployeeDetail } from '@/lib/api/employees'
import type { PaginatedResponse } from '@/lib/repositories'

// ═══════════════════════════════════════════════════════════════════════════════
// Query Options Factories
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Creates query options for employees list.
 * Can be used with useQuery or prefetched on server.
 */
export function employeesListQueryOptions(params: EmployeesFilterParams = {}) {
  return {
    queryKey: queryKeys.employees.list(params as Record<string, unknown>),
    queryFn: () => employeesRepo.findAll(params),
    staleTime: staleTimes.list,
  } satisfies UseQueryOptions<PaginatedResponse<Employee>>
}

/**
 * Creates query options for employee detail.
 */
export function employeeDetailQueryOptions(id: string) {
  return {
    queryKey: queryKeys.employees.detail(id),
    queryFn: () => employeesRepo.getDetail(id),
    staleTime: staleTimes.detail,
    enabled: Boolean(id),
  } satisfies UseQueryOptions<EmployeeDetail>
}

// ═══════════════════════════════════════════════════════════════════════════════
// Query Hooks
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Query hook for paginated employees list.
 * 
 * @example
 * const { data, isLoading } = useEmployeesListQuery({ 
 *   page: 1, 
 *   search: 'john',
 *   status: 'active' 
 * })
 */
export function useEmployeesListQuery(params: EmployeesFilterParams = {}) {
  return useQuery(employeesListQueryOptions(params))
}

/**
 * Query hook for employee detail.
 * 
 * @example
 * const { data: employee, isLoading } = useEmployeeDetailQuery(employeeId)
 */
export function useEmployeeDetailQuery(id: string) {
  return useQuery(employeeDetailQueryOptions(id))
}

/**
 * Query hook for employee orders.
 */
export function useEmployeeOrdersQuery(
  employeeId: string,
  params: { startDate?: string; endDate?: string; page?: number; pageSize?: number } = {}
) {
  return useQuery({
    queryKey: queryKeys.employees.orders(employeeId, params),
    queryFn: () => employeesRepo.getOrders(employeeId, params),
    staleTime: staleTimes.list,
    enabled: Boolean(employeeId),
  })
}

/**
 * Infinite query hook for lazy-loading employees.
 * Useful for autocomplete/search dropdowns.
 */
export function useEmployeesInfiniteQuery(search: string) {
  return useInfiniteQuery({
    queryKey: ['employees', 'infinite', search],
    queryFn: ({ pageParam = 1 }) =>
      employeesRepo.findAll({ page: pageParam, pageSize: 20, search }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    staleTime: staleTimes.list,
  })
}

/**
 * Query hook for employee search (autocomplete).
 */
export function useEmployeeSearchQuery(query: string, limit = 10) {
  return useQuery({
    queryKey: ['employees', 'search', query, limit],
    queryFn: () => employeesRepo.search(query, limit),
    enabled: query.length >= 2,
    staleTime: 30 * 1000, // 30 seconds
  })
}


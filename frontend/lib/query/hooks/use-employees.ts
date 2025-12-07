'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys, staleTimes } from '../query-client'
import { employeesApi, type Employee, type EmployeeDetail, type CreateEmployeeRequest, type UpdateEmployeeRequest, type UpdateBudgetRequest, type ServiceType, type EmployeesResponse } from '@/lib/api/employees'
import { toast } from 'sonner'
import { parseError } from '@/lib/errors'
import { logger } from '@/lib/logger'

// ============================================================================
// Types
// ============================================================================

export interface EmployeesQueryParams {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  inviteStatus?: string
  orderStatus?: string
  minBudget?: number
  maxBudget?: number
  hasSubscription?: boolean
  mealStatus?: string
  serviceType?: ServiceType
}

// ============================================================================
// Queries
// ============================================================================

/**
 * Hook to fetch paginated list of employees
 */
export function useEmployees(params: EmployeesQueryParams = {}) {
  const {
    page = 1,
    pageSize = 20,
    search,
    status,
    inviteStatus,
    orderStatus,
    minBudget,
    maxBudget,
    hasSubscription,
    mealStatus,
    serviceType,
  } = params

  return useQuery({
    queryKey: queryKeys.employees.list({
      page,
      pageSize,
      search,
      status,
      inviteStatus,
      orderStatus,
      minBudget,
      maxBudget,
      hasSubscription,
      mealStatus,
      serviceType,
    }),
    queryFn: () =>
      employeesApi.getEmployees(
        page,
        pageSize,
        search,
        status,
        inviteStatus,
        orderStatus,
        minBudget,
        maxBudget,
        hasSubscription,
        mealStatus,
        serviceType
      ),
    staleTime: staleTimes.list,
    placeholderData: (previousData) => previousData, // Keep previous data while fetching
  })
}

/**
 * Hook to fetch single employee details
 */
export function useEmployee(id: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.employees.detail(id || ''),
    queryFn: () => employeesApi.getEmployee(id!),
    enabled: Boolean(id),
    staleTime: staleTimes.detail,
  })
}

/**
 * Hook to fetch employee orders
 */
export function useEmployeeOrders(
  employeeId: string | null | undefined,
  params: { page?: number; pageSize?: number; date?: string; status?: string; serviceType?: string } = {}
) {
  const { page = 1, pageSize = 20, date, status, serviceType } = params

  return useQuery({
    queryKey: queryKeys.employees.orders(employeeId || '', { page, pageSize, date, status, serviceType }),
    queryFn: () => employeesApi.getEmployeeOrders(employeeId!, page, pageSize, date, status, serviceType),
    enabled: Boolean(employeeId),
    staleTime: staleTimes.list,
  })
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Hook to create a new employee
 */
export function useCreateEmployee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateEmployeeRequest) => employeesApi.createEmployee(data),
    onSuccess: (newEmployee) => {
      // Invalidate employees list to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.lists() })
      
      logger.info('Employee created', { employeeId: newEmployee.id })
      toast.success('Сотрудник успешно создан')
    },
    onError: (error) => {
      const appError = parseError(error)
      logger.error('Failed to create employee', error instanceof Error ? error : new Error(appError.message))
      // Don't show toast here - let the component handle field-specific errors
    },
  })
}

/**
 * Hook to update an employee
 */
export function useUpdateEmployee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateEmployeeRequest }) =>
      employeesApi.updateEmployee(id, data),
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.employees.detail(id) })
      
      // Snapshot previous value
      const previousEmployee = queryClient.getQueryData<EmployeeDetail>(
        queryKeys.employees.detail(id)
      )
      
      // Optimistically update cache
      if (previousEmployee) {
        queryClient.setQueryData<EmployeeDetail>(
          queryKeys.employees.detail(id),
          { ...previousEmployee, ...data }
        )
      }
      
      return { previousEmployee }
    },
    onError: (error, { id }, context) => {
      // Rollback on error
      if (context?.previousEmployee) {
        queryClient.setQueryData(
          queryKeys.employees.detail(id),
          context.previousEmployee
        )
      }
      
      const appError = parseError(error)
      logger.error('Failed to update employee', error instanceof Error ? error : new Error(appError.message))
      toast.error(appError.message, { description: appError.action })
    },
    onSettled: (_, __, { id }) => {
      // Always refetch after mutation
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.lists() })
    },
    onSuccess: () => {
      toast.success('Данные сотрудника обновлены')
    },
  })
}

/**
 * Hook to toggle employee activation
 */
export function useToggleEmployeeActive() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => employeesApi.toggleActivation(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.employees.detail(id) })
      
      const previousEmployee = queryClient.getQueryData<EmployeeDetail>(
        queryKeys.employees.detail(id)
      )
      
      // Optimistically toggle
      if (previousEmployee) {
        queryClient.setQueryData<EmployeeDetail>(
          queryKeys.employees.detail(id),
          { ...previousEmployee, isActive: !previousEmployee.isActive }
        )
      }
      
      return { previousEmployee }
    },
    onError: (error, id, context) => {
      if (context?.previousEmployee) {
        queryClient.setQueryData(
          queryKeys.employees.detail(id),
          context.previousEmployee
        )
      }
      
      const appError = parseError(error)
      toast.error(appError.message, { description: appError.action })
    },
    onSettled: (_, __, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.lists() })
    },
    onSuccess: (employee) => {
      const status = employee.isActive ? 'активирован' : 'деактивирован'
      toast.success(`Сотрудник ${status}`)
    },
  })
}

/**
 * Hook to update employee budget
 */
export function useUpdateEmployeeBudget() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ employeeId, data }: { employeeId: string; data: UpdateBudgetRequest }) =>
      employeesApi.updateBudget(employeeId, data),
    onSuccess: (_, { employeeId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.detail(employeeId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.lists() })
      toast.success('Бюджет обновлен')
    },
    onError: (error) => {
      const appError = parseError(error)
      toast.error(appError.message, { description: appError.action })
    },
  })
}

// ============================================================================
// Prefetching
// ============================================================================

/**
 * Prefetch employee details (for hover/link prefetch)
 */
export function usePrefetchEmployee() {
  const queryClient = useQueryClient()

  return (id: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.employees.detail(id),
      queryFn: () => employeesApi.getEmployee(id),
      staleTime: staleTimes.detail,
    })
  }
}


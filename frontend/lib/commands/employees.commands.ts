/**
 * @fileoverview Employees Commands
 * React Query mutations for employee write operations.
 * Part of CQRS-lite pattern - write operations only.
 * Includes optimistic updates for better UX.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query/query-client'
import { employeesRepo } from '@/lib/repositories'
import { emitEvent, AppEvents } from '@/lib/events'
import { parseError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import type { Employee, EmployeeDetail, CreateEmployeeRequest, UpdateEmployeeRequest } from '@/lib/api/employees'
import type { PaginatedResponse } from '@/lib/repositories'

// ═══════════════════════════════════════════════════════════════════════════════
// Create Employee Command
// ═══════════════════════════════════════════════════════════════════════════════

interface UseCreateEmployeeOptions {
  onSuccess?: (employee: Employee) => void
  onError?: (error: Error) => void
}

/**
 * Command hook for creating a new employee.
 * Invalidates list cache on success.
 * 
 * @example
 * const { mutate: createEmployee, isPending } = useCreateEmployeeCommand()
 * createEmployee({ fullName: 'John Doe', phone: '+971501234567', email: 'john@example.com' })
 */
export function useCreateEmployeeCommand(options: UseCreateEmployeeOptions = {}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateEmployeeRequest) => employeesRepo.create(data),
    
    onSuccess: (employee) => {
      // Invalidate all employee lists
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.lists() })
      
      // Show success toast
      toast.success('Сотрудник создан', {
        description: employee.fullName,
      })
      
      // Emit event for other components
      emitEvent(AppEvents.EMPLOYEE_CREATED, { id: employee.id, name: employee.fullName })
      
      options.onSuccess?.(employee)
    },
    
    onError: (error) => {
      const appError = parseError(error)
      logger.error('Failed to create employee', error, { code: appError.code })
      toast.error(appError.message, { description: appError.action })
      options.onError?.(error)
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// Update Employee Command (with Optimistic Update)
// ═══════════════════════════════════════════════════════════════════════════════

interface UseUpdateEmployeeOptions {
  onSuccess?: (employee: Employee) => void
  onError?: (error: Error) => void
}

/**
 * Command hook for updating an employee.
 * Uses optimistic updates for immediate UI feedback.
 * 
 * @example
 * const { mutate: updateEmployee, isPending } = useUpdateEmployeeCommand()
 * updateEmployee({ id: '123', data: { fullName: 'John Updated' } })
 */
export function useUpdateEmployeeCommand(options: UseUpdateEmployeeOptions = {}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateEmployeeRequest }) =>
      employeesRepo.update(id, data),

    // Optimistic update
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.employees.detail(id) })

      // Snapshot previous value for rollback
      const previousEmployee = queryClient.getQueryData<EmployeeDetail>(
        queryKeys.employees.detail(id)
      )

      // Optimistically update detail cache
      if (previousEmployee) {
        queryClient.setQueryData<EmployeeDetail>(queryKeys.employees.detail(id), {
          ...previousEmployee,
          ...data,
        })
      }

      // Optimistically update in lists
      queryClient.setQueriesData<PaginatedResponse<Employee>>(
        { queryKey: queryKeys.employees.lists() },
        (old) => {
          if (!old) return old
          return {
            ...old,
            items: old.items.map((emp) =>
              emp.id === id ? { ...emp, ...data } : emp
            ),
          }
        }
      )

      return { previousEmployee }
    },

    // Rollback on error
    onError: (error, { id }, context) => {
      // Restore previous value
      if (context?.previousEmployee) {
        queryClient.setQueryData(
          queryKeys.employees.detail(id),
          context.previousEmployee
        )
      }

      const appError = parseError(error)
      logger.error('Failed to update employee', error, { code: appError.code })
      toast.error(appError.message, { description: appError.action })
      options.onError?.(error)
    },

    // Refetch after success
    onSuccess: (employee, { id }) => {
      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.lists() })

      toast.success('Сотрудник обновлён', {
        description: employee.fullName,
      })

      emitEvent(AppEvents.EMPLOYEE_UPDATED, { id, changes: {} })
      options.onSuccess?.(employee)
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// Toggle Activation Command (with Optimistic Update)
// ═══════════════════════════════════════════════════════════════════════════════

interface UseToggleEmployeeActivationOptions {
  onSuccess?: (employee: Employee) => void
  onError?: (error: Error) => void
}

/**
 * Command hook for toggling employee activation.
 * Uses optimistic updates for immediate feedback.
 * 
 * @example
 * const { mutate: toggleActivation, isPending } = useToggleEmployeeActivationCommand()
 * toggleActivation('employee-123')
 */
export function useToggleEmployeeActivationCommand(
  options: UseToggleEmployeeActivationOptions = {}
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => employeesRepo.toggleActivation(id),

    // Optimistic update
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.employees.detail(id) })

      const previousEmployee = queryClient.getQueryData<EmployeeDetail>(
        queryKeys.employees.detail(id)
      )

      // Optimistically toggle isActive
      if (previousEmployee) {
        queryClient.setQueryData<EmployeeDetail>(queryKeys.employees.detail(id), {
          ...previousEmployee,
          isActive: !previousEmployee.isActive,
        })
      }

      // Update in lists
      queryClient.setQueriesData<PaginatedResponse<Employee>>(
        { queryKey: queryKeys.employees.lists() },
        (old) => {
          if (!old) return old
          return {
            ...old,
            items: old.items.map((emp) =>
              emp.id === id ? { ...emp, isActive: !emp.isActive } : emp
            ),
          }
        }
      )

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
      logger.error('Failed to toggle employee activation', error, { code: appError.code })
      toast.error(appError.message, { description: appError.action })
      options.onError?.(error)
    },

    onSuccess: (employee, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.lists() })

      const action = employee.isActive ? 'активирован' : 'деактивирован'
      toast.success(`Сотрудник ${action}`, {
        description: employee.fullName,
      })

      const event = employee.isActive
        ? AppEvents.EMPLOYEE_ACTIVATED
        : AppEvents.EMPLOYEE_DEACTIVATED
      emitEvent(event, { id })

      options.onSuccess?.(employee)
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// Delete Employee Command
// ═══════════════════════════════════════════════════════════════════════════════

interface UseDeleteEmployeeOptions {
  onSuccess?: () => void
  onError?: (error: Error) => void
}

/**
 * Command hook for deleting an employee.
 * 
 * @example
 * const { mutate: deleteEmployee, isPending } = useDeleteEmployeeCommand()
 * deleteEmployee('employee-123')
 */
export function useDeleteEmployeeCommand(options: UseDeleteEmployeeOptions = {}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => employeesRepo.delete(id),

    // Optimistic removal from lists
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.employees.lists() })

      const previousLists = queryClient.getQueriesData<PaginatedResponse<Employee>>({
        queryKey: queryKeys.employees.lists(),
      })

      // Optimistically remove from all lists
      queryClient.setQueriesData<PaginatedResponse<Employee>>(
        { queryKey: queryKeys.employees.lists() },
        (old) => {
          if (!old) return old
          return {
            ...old,
            items: old.items.filter((emp) => emp.id !== id),
            total: old.total - 1,
          }
        }
      )

      return { previousLists }
    },

    onError: (error, id, context) => {
      // Restore all lists
      context?.previousLists.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data)
      })

      const appError = parseError(error)
      logger.error('Failed to delete employee', error, { code: appError.code })
      toast.error(appError.message, { description: appError.action })
      options.onError?.(error)
    },

    onSuccess: (_, id) => {
      // Remove detail from cache
      queryClient.removeQueries({ queryKey: queryKeys.employees.detail(id) })
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.lists() })

      toast.success('Сотрудник удалён')
      emitEvent(AppEvents.EMPLOYEE_DELETED, { id })
      options.onSuccess?.()
    },
  })
}


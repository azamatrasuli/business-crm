/**
 * TanStack Query hooks
 * 
 * These hooks provide data fetching with:
 * - Automatic caching
 * - Background refetching
 * - Optimistic updates
 * - Error handling
 * - Loading states
 */

// Employee hooks
export {
  useEmployees,
  useEmployee,
  useEmployeeOrders,
  useCreateEmployee,
  useUpdateEmployee,
  useToggleEmployeeActive,
  useUpdateEmployeeBudget,
  usePrefetchEmployee,
  type EmployeesQueryParams,
} from './use-employees'

// Dashboard hooks
export {
  useDashboardStats,
  useCutoffTime,
  useOrders,
  useBulkOrderAction,
  useCreateGuestOrder,
  useHomeData,
  type OrdersQueryParams,
} from './use-dashboard'


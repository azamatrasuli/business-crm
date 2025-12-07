/**
 * @fileoverview Custom hooks library
 * Reusable hooks for common patterns.
 * Based on Code Quality Audit Framework - DRY principle.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Form hooks
// ═══════════════════════════════════════════════════════════════════════════════
export { useFormError } from './use-form-error'

// ═══════════════════════════════════════════════════════════════════════════════
// Async operation hooks
// ═══════════════════════════════════════════════════════════════════════════════
export { useAsync, useMutation, useDebounce } from './use-async'

// ═══════════════════════════════════════════════════════════════════════════════
// Pagination hooks
// ═══════════════════════════════════════════════════════════════════════════════
export { usePagination } from './use-pagination'

// ═══════════════════════════════════════════════════════════════════════════════
// Dashboard hooks
// ═══════════════════════════════════════════════════════════════════════════════
export { useDashboard, type UseDashboardReturn } from './use-dashboard'
export { useOrderActions, type UseOrderActionsReturn } from './use-order-actions'

// ═══════════════════════════════════════════════════════════════════════════════
// Employee hooks
// ═══════════════════════════════════════════════════════════════════════════════
export { useEmployeeDetail, type UseEmployeeDetailReturn } from './use-employee-detail'
export { useEmployeeOrderActions, type UseEmployeeOrderActionsReturn } from './use-employee-order-actions'
export { useEmployeesPage, type UseEmployeesPageReturn, type EmployeesStats } from './use-employees-page'
export {
  useEmployeeForm,
  employeeFormSchema,
  type EmployeeFormData,
  type UseEmployeeFormProps,
  type UseEmployeeFormReturn,
} from './use-employee-form'

// ═══════════════════════════════════════════════════════════════════════════════
// Subscription hooks
// ═══════════════════════════════════════════════════════════════════════════════
export {
  useLunchSubscriptionForm,
  STEP_LABELS,
  type UseLunchSubscriptionFormProps,
  type UseLunchSubscriptionFormReturn,
} from './use-lunch-subscription-form'

export {
  useCompensationForm,
  COMPENSATION_STEP_LABELS,
  DEFAULT_DAILY_LIMIT,
  type UseCompensationFormProps,
  type UseCompensationFormReturn,
} from './use-compensation-form'

// ═══════════════════════════════════════════════════════════════════════════════
// Order/Bulk Edit hooks
// ═══════════════════════════════════════════════════════════════════════════════
export {
  useBulkEditForm,
  ACTION_OPTIONS,
  type BulkAction,
  type ActionOption,
  type UseBulkEditFormProps,
  type UseBulkEditFormReturn,
} from './use-bulk-edit-form'

export {
  useGuestOrderForm,
  guestOrderFormSchema,
  GUEST_COMBO_OPTIONS,
  type GuestOrderFormData,
  type UseGuestOrderFormProps,
  type UseGuestOrderFormReturn,
} from './use-guest-order-form'

// ═══════════════════════════════════════════════════════════════════════════════
// URL State hooks
// ═══════════════════════════════════════════════════════════════════════════════
export {
  useUrlState,
  useUrlPagination,
  useUrlSearch,
  useUrlSort,
  type UseUrlStateOptions,
} from './use-url-state'

// ═══════════════════════════════════════════════════════════════════════════════
// Accessibility hooks
// ═══════════════════════════════════════════════════════════════════════════════
export { useFocusTrap, useRestoreFocus, useRovingFocus } from './use-focus-trap'

// ═══════════════════════════════════════════════════════════════════════════════
// Performance hooks
// ═══════════════════════════════════════════════════════════════════════════════
export {
  useVirtualList,
  useVirtualGrid,
  getVisibleRange,
  type VirtualListProps,
} from './use-virtual-list'


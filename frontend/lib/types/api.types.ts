/**
 * @fileoverview API Response Types
 * Centralized type definitions for API responses.
 * Based on Code Quality Audit Framework - Single Source of Truth for types.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Generic API Response Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Standard paginated response from API
 */
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/**
 * Standard success response wrapper
 */
export interface ApiResponse<T> {
  success: true
  data: T
}

/**
 * Standard error response from API
 */
export interface ApiErrorResponse {
  success: false
  error: {
    code: string
    message: string
    type: 'Validation' | 'NotFound' | 'Forbidden' | 'Conflict' | 'Internal'
    details?: Record<string, unknown>
    action?: string | null
  }
  path: string
  timestamp: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// Domain Entity Types
// ═══════════════════════════════════════════════════════════════════════════════

/** Service type for employees */
export type ServiceType = 'LUNCH' | 'COMPENSATION'

/** Shift type for employees */
export type ShiftType = 'DAY' | 'NIGHT'

/** 
 * Order status 
 * Synced with PostgreSQL enum order_status:
 * {Активен, Выполнен, Отменён, Заморожен, Приостановлен, Выходной, Доставлен}
 */
export type OrderStatus = 
  | 'Активен'       // Active order, ready for delivery
  | 'Приостановлен' // Paused (subscription paused)
  | 'Заморожен'     // Frozen (day skipped)
  | 'Выходной'      // Day off
  | 'Доставлен'     // Delivered (new terminal status)
  | 'Выполнен'      // Completed (legacy DB value)
  | 'Отменён'       // Cancelled
  // DEPRECATED: Legacy UI values (for backward compatibility only)
  | 'На паузе'      // DEPRECATED: Use 'Приостановлен' instead
  | 'Завершен'      // DEPRECATED: Use 'Выполнен' instead

/** Employee invite status */
export type InviteStatus = 'Принято' | 'Ожидает' | 'Отклонено'

/** Budget period */
export type BudgetPeriod = 'в День' | 'в Неделю' | 'в Месяц'

// ═══════════════════════════════════════════════════════════════════════════════
// Utility Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Makes specified keys required while keeping others optional
 */
export type RequiredKeys<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>

/**
 * Makes specified keys optional while keeping others required
 */
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

/**
 * Extract non-nullable type from T
 */
export type NonNullableFields<T> = {
  [P in keyof T]: NonNullable<T[P]>
}

/**
 * Common async state for UI components
 */
export interface AsyncState {
  isLoading: boolean
  error: string | null
}

/**
 * Pagination state for list views
 */
export interface PaginationState {
  currentPage: number
  totalPages: number
  total: number
  pageSize: number
}

/**
 * Combined data list state
 */
export interface DataListState<T> extends AsyncState, PaginationState {
  items: T[]
}

// ═══════════════════════════════════════════════════════════════════════════════
// Type Guards
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Type guard for API error responses
 */
export function isApiErrorResponse(response: unknown): response is ApiErrorResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    (response as ApiErrorResponse).success === false &&
    'error' in response
  )
}

/**
 * Type guard for paginated responses
 */
export function isPaginatedResponse<T>(response: unknown): response is PaginatedResponse<T> {
  return (
    typeof response === 'object' &&
    response !== null &&
    'items' in response &&
    'total' in response &&
    'page' in response
  )
}


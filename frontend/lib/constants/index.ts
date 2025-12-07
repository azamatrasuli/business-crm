/**
 * @fileoverview Application Constants
 * Centralized constants for the application.
 * 
 * NOTE: Business constants (prices, limits, etc.) are in /config.json
 * Use imports from '@/lib/config' for those.
 */

// Re-export employee constants
export {
  DAYS_OF_WEEK,
  WORKING_DAYS_PRESETS,
  PHONE_REGEX,
  TIME_REGEX,
  ROUTE_LABELS,
  sortWorkingDays,
  toggleWorkingDay,
} from './employee'

// Re-export from centralized config
export {
  // Pagination
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  // Date/Time
  DATE_FORMAT,
  API_DATE_FORMAT,
  TIME_FORMAT,
  DATETIME_FORMAT,
  DEFAULT_TIMEZONE,
  // Business
  CUTOFF_TIME,
  CUTOFF_TIMEZONE,
  MAX_FREEZES_PER_WEEK,
  MIN_SUBSCRIPTION_DAYS,
  COMBO_PRICES,
  COMBO_OPTIONS,
  COMBO_OPTIONS_EXTENDED,
  BUDGET_PERIODS,
  // Defaults
  DEFAULT_WORKING_DAYS,
  DEFAULT_WORK_START_TIME,
  DEFAULT_WORK_END_TIME,
  // Feature flags
  FEATURES,
  // Contacts
  SUPPORT_CONTACTS,
} from '../config'

// ═══════════════════════════════════════════════════════════════════════════════
// Technical Constants (not in config.json - code-specific)
// ═══════════════════════════════════════════════════════════════════════════════

/** API request timeout in milliseconds */
export const API_TIMEOUT = 15000

/** Stale time for React Query (5 minutes) */
export const QUERY_STALE_TIME = 5 * 60 * 1000

/** Cache time for React Query (30 minutes) */
export const QUERY_CACHE_TIME = 30 * 60 * 1000

/** Debounce delay for search inputs (milliseconds) */
export const SEARCH_DEBOUNCE_DELAY = 300

/** Animation duration (milliseconds) */
export const ANIMATION_DURATION = 200

/** Toast display duration (milliseconds) */
export const TOAST_DURATION = 5000

/** Modal z-index */
export const MODAL_Z_INDEX = 50

/** Breakpoints (matching Tailwind defaults) */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const

// ═══════════════════════════════════════════════════════════════════════════════
// Enum-like Constants (labels/mappings)
// ═══════════════════════════════════════════════════════════════════════════════

export const SERVICE_TYPES = {
  LUNCH: 'LUNCH',
  COMPENSATION: 'COMPENSATION',
} as const

export const SERVICE_TYPE_LABELS = {
  [SERVICE_TYPES.LUNCH]: 'Обеды',
  [SERVICE_TYPES.COMPENSATION]: 'Компенсация',
} as const

export const SHIFT_TYPES = {
  DAY: 'DAY',
  NIGHT: 'NIGHT',
} as const

export const SHIFT_TYPE_LABELS = {
  [SHIFT_TYPES.DAY]: 'Дневная',
  [SHIFT_TYPES.NIGHT]: 'Ночная',
} as const

export const ORDER_STATUSES = {
  ACTIVE: 'Активен',
  PAUSED: 'На паузе',
  CANCELLED: 'Отменён',
  COMPLETED: 'Завершен',
} as const

export const ORDER_STATUS_COLORS = {
  [ORDER_STATUSES.ACTIVE]: 'bg-green-100 text-green-800',
  [ORDER_STATUSES.PAUSED]: 'bg-yellow-100 text-yellow-800',
  [ORDER_STATUSES.CANCELLED]: 'bg-red-100 text-red-800',
  [ORDER_STATUSES.COMPLETED]: 'bg-gray-100 text-gray-800',
} as const

export const USER_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  OPERATOR: 'OPERATOR',
} as const

export const USER_ROLE_LABELS = {
  [USER_ROLES.SUPER_ADMIN]: 'Супер-администратор',
  [USER_ROLES.ADMIN]: 'Администратор',
  [USER_ROLES.OPERATOR]: 'Оператор',
} as const

export const COMBO_TYPES = {
  COMBO_25: 'Комбо 25',
  COMBO_35: 'Комбо 35',
} as const


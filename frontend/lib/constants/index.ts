/**
 * @fileoverview Application Constants
 * Centralized constants for the application.
 * 
 * NOTE: Business constants (prices, limits, etc.) are in /config.json
 * Use imports from '@/lib/config' for those.
 */

// Импортируем из dictionaries для labels (внутренний импорт)
import { 
  SERVICE_TYPES as _SERVICE_TYPES, 
  SHIFT_TYPES as _SHIFT_TYPES, 
  ORDER_STATUSES as _ORDER_STATUSES 
} from './dictionaries'

// Re-export employee constants
export {
  DAYS_OF_WEEK,
  WORKING_DAYS_PRESETS,
  PHONE_REGEX,
  TIME_REGEX,
  ROUTE_LABELS,
  sortWorkingDays,
  toggleWorkingDay,
  // Working days helpers (mirrors backend WorkingDaysHelper.cs)
  DEFAULT_WORKING_DAYS,
  getEffectiveWorkingDays,
  isWorkingDay,
  countWorkingDaysInRange,
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
  BUDGET_PERIODS,  // From config (simplified period options)
  // Defaults (DEFAULT_WORKING_DAYS now in employee.ts with helpers)
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
// Основные константы теперь в dictionaries.ts - здесь только labels для обратной совместимости
// ═══════════════════════════════════════════════════════════════════════════════

export const SERVICE_TYPE_LABELS = {
  [_SERVICE_TYPES.LUNCH]: 'Обеды',
  [_SERVICE_TYPES.COMPENSATION]: 'Компенсация',
} as const

export const SHIFT_TYPE_LABELS = {
  [_SHIFT_TYPES.DAY]: 'Дневная',
  [_SHIFT_TYPES.NIGHT]: 'Ночная',
} as const

// Re-export status helpers from entity-statuses (preferred)
export {
  ORDER_STATUS,
  isOrderActive,
  isOrderPaused,
  isOrderFrozen,
  isOrderCancelled,
  isOrderDelivered,
  isOrderTerminal,
  canModifyOrder,
  getOrderStatusConfig,
  SUBSCRIPTION_STATUS,
  isSubscriptionActive,
  isSubscriptionPaused,
  isSubscriptionCompleted,
  isSubscriptionTerminal,
  canResumeSubscription,
  getSubscriptionStatusConfig,
  INVITE_STATUS,
  getInviteStatusConfig,
} from './entity-statuses'

// Re-export dictionaries (единый источник данных для справочников и фильтров)
export {
  // Статусы заказов
  ORDER_STATUSES,
  ORDER_STATUS_OPTIONS,
  // Типы заказчиков
  ORDER_TYPES,
  ORDER_TYPE_OPTIONS,
  // Типы комбо
  COMBO_TYPES,
  COMBO_TYPE_OPTIONS,
  COMBO_METADATA,
  getComboPrice,
  // Типы услуг
  SERVICE_TYPES,
  SERVICE_TYPE_OPTIONS,
  // Статусы подписок
  SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_STATUS_OPTIONS,
  // Статусы сотрудников
  EMPLOYEE_STATUSES,
  EMPLOYEE_STATUS_OPTIONS,
  // Статусы приглашений
  INVITE_STATUSES,
  INVITE_STATUS_OPTIONS,
  // Типы смен
  SHIFT_TYPES,
  SHIFT_TYPE_OPTIONS,
  // Периоды бюджета (расширенные с описаниями)
  BUDGET_PERIODS as BUDGET_PERIOD_DICT,
  BUDGET_PERIOD_OPTIONS,
  // Типы расписания
  SCHEDULE_TYPES,
  SCHEDULE_TYPE_OPTIONS,
  // Дни недели
  WEEKDAYS,
  WEEKDAY_OPTIONS,
  // Утилиты
  toFilterOptions,
  getLabelByValue,
  getDescriptionByValue,
  type FilterOption,
} from './dictionaries'

export const ORDER_STATUS_COLORS = {
  [_ORDER_STATUSES.ACTIVE]: 'bg-green-100 text-green-800',
  [_ORDER_STATUSES.PAUSED]: 'bg-yellow-100 text-yellow-800',
  [_ORDER_STATUSES.COMPLETED]: 'bg-gray-100 text-gray-800',
  [_ORDER_STATUSES.CANCELLED]: 'bg-red-100 text-red-800',
  // Legacy values for backward compatibility
  'Завершен': 'bg-gray-100 text-gray-800',
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

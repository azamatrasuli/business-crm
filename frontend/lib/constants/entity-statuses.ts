/**
 * @fileoverview Entity Status Constants and Helpers
 * Centralized status definitions for all entities.
 * Single source of truth for status values and their UI representations.
 * 
 * REFACTORED: 2025-01-09
 * Simplified status system:
 * - Employee: Active, Deactivated
 * - Order: Active, Paused, Completed, Cancelled
 * - Subscription: Active, Paused, Completed
 * - Company/Project: Active, Inactive
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Company / Project Statuses
// Only Active and Inactive (Frozen and Suspended removed)
// ═══════════════════════════════════════════════════════════════════════════════

export const COMPANY_STATUS = {
  ACTIVE: 'Активный',
  INACTIVE: 'Не активный',
} as const

export type CompanyStatusType = typeof COMPANY_STATUS[keyof typeof COMPANY_STATUS]

export function getCompanyStatusConfig(status?: string) {
  switch (status) {
    case COMPANY_STATUS.ACTIVE:
    case 'ACTIVE':
      return {
        label: 'Активный',
        variant: 'default' as const,
        className: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
      }
    case COMPANY_STATUS.INACTIVE:
    case 'INACTIVE':
    // Legacy mappings - treat as Inactive
    case 'Заморожен':
    case 'FROZEN':
    case 'Приостановлен':
    case 'SUSPENDED':
      return {
        label: 'Не активный',
        variant: 'secondary' as const,
        className: 'bg-gray-500/10 text-gray-600 border-gray-200',
      }
    default:
      return {
        label: status || 'Неизвестно',
        variant: 'outline' as const,
        className: '',
      }
  }
}

export function isCompanyOperational(status?: string): boolean {
  return status === COMPANY_STATUS.ACTIVE || status === 'ACTIVE'
}

// ═══════════════════════════════════════════════════════════════════════════════
// Employee Statuses
// Only Active and Deactivated (Vacation removed - handled via working days)
// ═══════════════════════════════════════════════════════════════════════════════

export const EMPLOYEE_STATUS = {
  ACTIVE: 'Активный',
  DEACTIVATED: 'Деактивирован',
} as const

export type EmployeeStatusType = typeof EMPLOYEE_STATUS[keyof typeof EMPLOYEE_STATUS]

export function getEmployeeStatusConfig(status?: string) {
  switch (status) {
    case EMPLOYEE_STATUS.ACTIVE:
    case 'ACTIVE':
      return {
        label: 'Активный',
        variant: 'default' as const,
        className: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
      }
    case EMPLOYEE_STATUS.DEACTIVATED:
    case 'DEACTIVATED':
    // Legacy mappings - treat as Deactivated
    case 'Отпуск':
    case 'VACATION':
      return {
        label: 'Деактивирован',
        variant: 'secondary' as const,
        className: 'bg-gray-500/10 text-gray-600 border-gray-200',
      }
    default:
      return {
        label: status || 'Неизвестно',
        variant: 'outline' as const,
        className: '',
      }
  }
}

export function isEmployeeActive(status?: string): boolean {
  return status === EMPLOYEE_STATUS.ACTIVE || status === 'ACTIVE'
}

export function isEmployeeDeactivated(status?: string): boolean {
  return status === EMPLOYEE_STATUS.DEACTIVATED || 
         status === 'DEACTIVATED' ||
         status === 'Отпуск' // Legacy
}

// ═══════════════════════════════════════════════════════════════════════════════
// Order Statuses
// Active, Paused, Completed, Cancelled
// Frozen, DayOff, Delivered - REMOVED (temporarily disabled)
// ═══════════════════════════════════════════════════════════════════════════════

export const ORDER_STATUS = {
  /** Активен - Active order, ready for delivery */
  ACTIVE: 'Активен',
  /** Приостановлен - Order is paused (subscription paused) */
  PAUSED: 'Приостановлен',
  /** Выполнен - Completed (order was delivered/fulfilled) */
  COMPLETED: 'Выполнен',
  /** Отменён - Cancelled order (visible in history, cannot be restored) */
  CANCELLED: 'Отменён',
} as const

export type OrderStatusType = typeof ORDER_STATUS[keyof typeof ORDER_STATUS]

export function getOrderStatusConfig(status?: string) {
  switch (status) {
    case ORDER_STATUS.ACTIVE:
    case 'Активен':
      return {
        label: 'Активен',
        variant: 'default' as const,
        className: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
      }
    case ORDER_STATUS.PAUSED:
    case 'Приостановлен':
    case 'На паузе':  // DEPRECATED: Legacy alias
      return {
        label: 'Приостановлен',
        variant: 'secondary' as const,
        className: 'bg-amber-500/10 text-amber-600 border-amber-200',
      }
    case ORDER_STATUS.COMPLETED:
    case 'Выполнен':
    case 'Завершен':  // Legacy UI value
    // Legacy mappings - treat as Completed
    case 'Доставлен':
      return {
        label: 'Выполнен',
        variant: 'outline' as const,
        className: 'bg-gray-500/10 text-gray-600 border-gray-200',
      }
    case ORDER_STATUS.CANCELLED:
    case 'Отменён':
    // Legacy mappings - treat as Cancelled
    case 'Заморожен':
    case 'Выходной':
      return {
        label: 'Отменён',
        variant: 'destructive' as const,
        className: 'bg-red-500/10 text-red-600 border-red-200',
      }
    default:
      return {
        label: status || 'Неизвестно',
        variant: 'outline' as const,
        className: '',
      }
  }
}

/**
 * Check if order is active (can be processed for delivery).
 */
export function isOrderActive(status?: string): boolean {
  return status === ORDER_STATUS.ACTIVE || status === 'Активен'
}

/**
 * Check if order is paused (subscription temporarily stopped).
 */
export function isOrderPaused(status?: string): boolean {
  return status === ORDER_STATUS.PAUSED ||
         status === 'Приостановлен' ||
         status === 'На паузе'  // DEPRECATED: Legacy alias
}

/**
 * Check if order is completed/delivered.
 */
export function isOrderCompleted(status?: string): boolean {
  return status === ORDER_STATUS.COMPLETED ||
         status === 'Выполнен' ||
         status === 'Завершен' ||
         status === 'Доставлен'  // Legacy
}

/**
 * Check if order is cancelled.
 */
export function isOrderCancelled(status?: string): boolean {
  return status === ORDER_STATUS.CANCELLED ||
         status === 'Отменён' ||
         status === 'Заморожен' ||  // Legacy - treat as cancelled
         status === 'Выходной'      // Legacy - treat as cancelled
}

/**
 * Check if order can be modified (only active orders).
 * Paused orders cannot be manually modified - they are controlled by subscription.
 */
export function canModifyOrder(status?: string): boolean {
  return isOrderActive(status)
}

/**
 * Check if order is in terminal state (completed or cancelled).
 */
export function isOrderTerminal(status?: string): boolean {
  return isOrderCompleted(status) || isOrderCancelled(status)
}

// DEPRECATED: Use isOrderCompleted instead
export function isOrderDelivered(status?: string): boolean {
  return isOrderCompleted(status)
}

// DEPRECATED: Frozen status removed
export function isOrderFrozen(status?: string): boolean {
  // All frozen orders are treated as cancelled now
  return status === 'Заморожен'
}

// ═══════════════════════════════════════════════════════════════════════════════
// Subscription Statuses
// ═══════════════════════════════════════════════════════════════════════════════

export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'Активна',
  PAUSED: 'Приостановлена',
  COMPLETED: 'Завершена',
} as const

export type SubscriptionStatusType = typeof SUBSCRIPTION_STATUS[keyof typeof SUBSCRIPTION_STATUS]

export function getSubscriptionStatusConfig(status?: string) {
  switch (status) {
    case SUBSCRIPTION_STATUS.ACTIVE:
    case 'Активный':
    case 'Активна':
      return {
        label: 'Активна',
        variant: 'default' as const,
        className: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
      }
    case SUBSCRIPTION_STATUS.PAUSED:
    case 'Приостановлена':
    case 'На паузе':  // DEPRECATED: Legacy alias
      return {
        label: 'Приостановлена',
        variant: 'secondary' as const,
        className: 'bg-amber-500/10 text-amber-600 border-amber-200',
      }
    case SUBSCRIPTION_STATUS.COMPLETED:
    case 'Завершена':
    case 'Завершен':
      return {
        label: 'Завершена',
        variant: 'outline' as const,
        className: 'bg-gray-500/10 text-gray-600 border-gray-200',
      }
    default:
      return {
        label: status || 'Неизвестно',
        variant: 'outline' as const,
        className: '',
      }
  }
}

export function isSubscriptionActive(status?: string): boolean {
  return status === SUBSCRIPTION_STATUS.ACTIVE || 
         status === 'Активный' ||
         status === 'Активна'
}

/**
 * Check if subscription is paused.
 */
export function isSubscriptionPaused(status?: string): boolean {
  return status === SUBSCRIPTION_STATUS.PAUSED || 
         status === 'Приостановлена' ||
         status === 'На паузе'  // DEPRECATED: Legacy alias
}

export function isSubscriptionCompleted(status?: string): boolean {
  return status === SUBSCRIPTION_STATUS.COMPLETED || 
         status === 'Завершена' ||
         status === 'Завершен'
}

/**
 * Check if subscription is in a terminal state (cannot be resumed).
 */
export function isSubscriptionTerminal(status?: string): boolean {
  return isSubscriptionCompleted(status)
}

/**
 * Check if subscription can be resumed (only paused, not completed).
 */
export function canResumeSubscription(status?: string): boolean {
  return isSubscriptionPaused(status) && !isSubscriptionCompleted(status)
}

// ═══════════════════════════════════════════════════════════════════════════════
// Employee Invite Statuses
// ═══════════════════════════════════════════════════════════════════════════════

export const INVITE_STATUS = {
  ACCEPTED: 'Принято',
  PENDING: 'Ожидает',
  REJECTED: 'Отклонено',
} as const

export type InviteStatusType = typeof INVITE_STATUS[keyof typeof INVITE_STATUS]

export function getInviteStatusConfig(status?: string) {
  switch (status) {
    case INVITE_STATUS.ACCEPTED:
      return {
        label: 'Принято',
        variant: 'default' as const,
        className: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
      }
    case INVITE_STATUS.PENDING:
      return {
        label: 'Ожидает',
        variant: 'secondary' as const,
        className: 'bg-amber-500/10 text-amber-600 border-amber-200',
      }
    case INVITE_STATUS.REJECTED:
      return {
        label: 'Отклонено',
        variant: 'destructive' as const,
        className: 'bg-red-500/10 text-red-600 border-red-200',
      }
    default:
      return {
        label: 'Не приглашён',
        variant: 'outline' as const,
        className: '',
      }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Unified Status Colors - Use these for consistent styling across the app
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Unified color palette for order statuses.
 * Use these for calendar cells, cards, icons, etc.
 */
export const STATUS_COLORS = {
  // Active status - Green
  active: {
    bg: 'bg-emerald-500/10',
    bgHover: 'hover:bg-emerald-500/20',
    bgDark: 'dark:bg-emerald-950/40',
    text: 'text-emerald-600',
    textDark: 'dark:text-emerald-400',
    border: 'border-emerald-200',
    borderDark: 'dark:border-emerald-800',
    icon: 'text-emerald-500',
  },
  // Paused status - Orange/Amber
  paused: {
    bg: 'bg-amber-500/10',
    bgHover: 'hover:bg-amber-500/20',
    bgDark: 'dark:bg-amber-950/40',
    text: 'text-amber-600',
    textDark: 'dark:text-amber-400',
    border: 'border-amber-200',
    borderDark: 'dark:border-amber-800',
    icon: 'text-amber-500',
  },
  // Completed status - Gray
  completed: {
    bg: 'bg-gray-500/10',
    bgHover: 'hover:bg-gray-500/20',
    bgDark: 'dark:bg-gray-800/40',
    text: 'text-gray-600',
    textDark: 'dark:text-gray-400',
    border: 'border-gray-200',
    borderDark: 'dark:border-gray-700',
    icon: 'text-gray-500',
  },
  // Cancelled status - Red
  cancelled: {
    bg: 'bg-red-500/10',
    bgHover: 'hover:bg-red-500/20',
    bgDark: 'dark:bg-red-950/40',
    text: 'text-red-600',
    textDark: 'dark:text-red-400',
    border: 'border-red-200',
    borderDark: 'dark:border-red-800',
    icon: 'text-red-500',
  },
} as const

/**
 * Get status color key based on order status string.
 */
export function getStatusColorKey(status?: string): keyof typeof STATUS_COLORS {
  if (isOrderCancelled(status)) return 'cancelled'
  if (isOrderPaused(status)) return 'paused'
  if (isOrderCompleted(status)) return 'completed'
  return 'active'
}

/**
 * Get full CSS classes for a status - for badges, cards, etc.
 */
export function getStatusClasses(status?: string) {
  const key = getStatusColorKey(status)
  const colors = STATUS_COLORS[key]
  return {
    badge: `${colors.bg} ${colors.text} ${colors.border}`,
    card: `${colors.bg} ${colors.bgDark} ${colors.border} ${colors.borderDark}`,
    text: `${colors.text} ${colors.textDark}`,
    icon: colors.icon,
    bg: `${colors.bg} ${colors.bgDark}`,
    border: `${colors.border} ${colors.borderDark}`,
  }
}

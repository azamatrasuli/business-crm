/**
 * @fileoverview Entity Status Constants and Helpers
 * Centralized status definitions for all entities.
 * Single source of truth for status values and their UI representations.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Company / Project Statuses
// ═══════════════════════════════════════════════════════════════════════════════

export const COMPANY_STATUS = {
  ACTIVE: 'Активный',
  INACTIVE: 'Не активный',
  FROZEN: 'Заморожен',
  SUSPENDED: 'Приостановлен',
} as const

export type CompanyStatusType = typeof COMPANY_STATUS[keyof typeof COMPANY_STATUS]

export function getCompanyStatusConfig(status?: string) {
  switch (status) {
    case COMPANY_STATUS.ACTIVE:
      return {
        label: 'Активный',
        variant: 'default' as const,
        className: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
      }
    case COMPANY_STATUS.INACTIVE:
      return {
        label: 'Не активный',
        variant: 'secondary' as const,
        className: 'bg-gray-500/10 text-gray-600 border-gray-200',
      }
    case COMPANY_STATUS.FROZEN:
      return {
        label: 'Заморожен',
        variant: 'outline' as const,
        className: 'bg-blue-500/10 text-blue-600 border-blue-200',
      }
    case COMPANY_STATUS.SUSPENDED:
      return {
        label: 'Приостановлен',
        variant: 'outline' as const,
        className: 'bg-amber-500/10 text-amber-600 border-amber-200',
      }
    // Legacy support for English status values
    case 'ACTIVE':
      return getCompanyStatusConfig(COMPANY_STATUS.ACTIVE)
    case 'INACTIVE':
      return getCompanyStatusConfig(COMPANY_STATUS.INACTIVE)
    case 'FROZEN':
      return getCompanyStatusConfig(COMPANY_STATUS.FROZEN)
    case 'SUSPENDED':
      return getCompanyStatusConfig(COMPANY_STATUS.SUSPENDED)
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
// ═══════════════════════════════════════════════════════════════════════════════

export const EMPLOYEE_STATUS = {
  ACTIVE: 'Активный',
  DEACTIVATED: 'Деактивирован',
  VACATION: 'Отпуск',
} as const

export type EmployeeStatusType = typeof EMPLOYEE_STATUS[keyof typeof EMPLOYEE_STATUS]

export function getEmployeeStatusConfig(status?: string) {
  switch (status) {
    case EMPLOYEE_STATUS.ACTIVE:
      return {
        label: 'Активный',
        variant: 'default' as const,
        className: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
      }
    case EMPLOYEE_STATUS.DEACTIVATED:
      return {
        label: 'Деактивирован',
        variant: 'secondary' as const,
        className: 'bg-gray-500/10 text-gray-600 border-gray-200',
      }
    case EMPLOYEE_STATUS.VACATION:
      return {
        label: 'Отпуск',
        variant: 'outline' as const,
        className: 'bg-amber-500/10 text-amber-600 border-amber-200',
      }
    default:
      return {
        label: status || 'Неизвестно',
        variant: 'outline' as const,
        className: '',
      }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Order Statuses
// Synced with PostgreSQL enum order_status:
// {Активен, Выполнен, Отменён, Заморожен, Приостановлен, Выходной, Доставлен}
// ═══════════════════════════════════════════════════════════════════════════════

export const ORDER_STATUS = {
  /** Активен - Active order, ready for delivery */
  ACTIVE: 'Активен',
  /** Приостановлен - Order is paused (subscription paused) */
  PAUSED: 'Приостановлен',
  /** Заморожен - Frozen order (day skipped, moved to end of subscription) */
  FROZEN: 'Заморожен',
  /** Выходной - Day off (no work on this day) */
  DAY_OFF: 'Выходной',
  /** Доставлен - Order has been delivered (primary terminal status) */
  DELIVERED: 'Доставлен',
  /** Выполнен - Completed (legacy DB value, maps to DB 'Выполнен') */
  COMPLETED: 'Выполнен',
  /** Отменён - Cancelled order */
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
    case 'На паузе':  // DEPRECATED: Legacy alias, migrated to "Приостановлен"
      return {
        label: 'Приостановлен',
        variant: 'secondary' as const,
        className: 'bg-amber-500/10 text-amber-600 border-amber-200',
      }
    case ORDER_STATUS.FROZEN:
    case 'Заморожен':
      return {
        label: 'Заморожен',
        variant: 'outline' as const,
        className: 'bg-blue-500/10 text-blue-600 border-blue-200',
      }
    case ORDER_STATUS.DAY_OFF:
    case 'Выходной':
      return {
        label: 'Выходной',
        variant: 'outline' as const,
        className: 'bg-gray-500/10 text-gray-600 border-gray-200',
      }
    case ORDER_STATUS.DELIVERED:
    case 'Доставлен':
      return {
        label: 'Доставлен',
        variant: 'default' as const,
        className: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
      }
    case ORDER_STATUS.COMPLETED:
    case 'Выполнен':  // Legacy DB value
    case 'Завершен':  // Legacy UI value
      return {
        label: 'Выполнен',
        variant: 'outline' as const,
        className: 'bg-gray-500/10 text-gray-600 border-gray-200',
      }
    case ORDER_STATUS.CANCELLED:
    case 'Отменён':
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
  return status === ORDER_STATUS.ACTIVE ||
         status === 'Активен'
}

/**
 * Check if order is paused (subscription temporarily stopped).
 * Note: "На паузе" is deprecated, use "Приостановлен" - kept for backward compatibility only.
 */
export function isOrderPaused(status?: string): boolean {
  return status === ORDER_STATUS.PAUSED ||
         status === 'Приостановлен' ||
         status === 'На паузе'  // DEPRECATED: Legacy alias
}

/**
 * Check if order is frozen (day skipped, moved to end).
 */
export function isOrderFrozen(status?: string): boolean {
  return status === ORDER_STATUS.FROZEN ||
         status === 'Заморожен'
}

/**
 * Check if order is cancelled.
 */
export function isOrderCancelled(status?: string): boolean {
  return status === ORDER_STATUS.CANCELLED ||
         status === 'Отменён'
}

export function canModifyOrder(status?: string): boolean {
  return isOrderActive(status) || isOrderPaused(status) || isOrderFrozen(status)
}

export function isOrderTerminal(status?: string): boolean {
  return isOrderDelivered(status) || isOrderCancelled(status)
}

/**
 * Check if order was successfully delivered (Delivered or legacy Completed).
 */
export function isOrderDelivered(status?: string): boolean {
  return status === ORDER_STATUS.DELIVERED ||
         status === ORDER_STATUS.COMPLETED ||
         status === 'Доставлен' ||
         status === 'Выполнен' ||
         status === 'Завершен'  // Legacy UI value
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
    case 'Активный': // альтернативное написание
      return {
        label: 'Активна',
        variant: 'default' as const,
        className: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
      }
    case SUBSCRIPTION_STATUS.PAUSED:
    case 'Приостановлена':
    case 'На паузе': // DEPRECATED: Legacy alias, use "Приостановлена"
      return {
        label: 'Приостановлена',
        variant: 'secondary' as const,
        className: 'bg-amber-500/10 text-amber-600 border-amber-200',
      }
    case SUBSCRIPTION_STATUS.COMPLETED:
    case 'Завершен': // альтернативное написание (м.р.)
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
 * Note: "На паузе" is deprecated, use "Приостановлена" - kept for backward compatibility only.
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


/**
 * @fileoverview Format Utilities
 * Centralized formatting functions for consistent display across the app.
 * Eliminates duplication of formatting logic in components.
 */

import type { DayOfWeek } from '@/lib/api/employees'

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

export const DAYS_OF_WEEK_SHORT: Record<number, string> = {
  0: 'Вс',
  1: 'Пн',
  2: 'Вт',
  3: 'Ср',
  4: 'Чт',
  5: 'Пт',
  6: 'Сб',
}

export const DAYS_OF_WEEK_FULL: Record<number, string> = {
  0: 'Воскресенье',
  1: 'Понедельник',
  2: 'Вторник',
  3: 'Среда',
  4: 'Четверг',
  5: 'Пятница',
  6: 'Суббота',
}

// ═══════════════════════════════════════════════════════════════════════════════
// Work Schedule Formatting
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format working days array to human-readable string.
 * @example formatWorkingDays([1,2,3,4,5]) => "Пн-Пт"
 * @example formatWorkingDays([1,3,5]) => "Пн, Ср, Пт"
 */
export function formatWorkingDays(workingDays?: DayOfWeek[] | number[]): string {
  if (!workingDays || workingDays.length === 0) return '—'
  if (workingDays.length === 7) return 'Ежедневно'

  // Check for standard weekdays (Mon-Fri)
  const isWeekdays =
    workingDays.length === 5 &&
    [1, 2, 3, 4, 5].every((d) => workingDays.includes(d as DayOfWeek)) &&
    !workingDays.includes(0 as DayOfWeek) &&
    !workingDays.includes(6 as DayOfWeek)

  if (isWeekdays) return 'Пн-Пт'

  // Check for 6-day week
  if (workingDays.length === 6) return '6-дневка'

  // Sort and format individual days
  const sortedDays = [...workingDays].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
  return sortedDays.map((d) => DAYS_OF_WEEK_SHORT[d]).join(', ')
}

/**
 * Format shift type to human-readable string.
 */
export function formatShiftType(shift: 'DAY' | 'NIGHT' | null | undefined): string {
  if (shift === 'NIGHT') return 'Ночная смена'
  return 'Дневная смена'
}

/**
 * Get shift emoji icon.
 */
export function getShiftIcon(shift: 'DAY' | 'NIGHT' | null | undefined): string {
  if (shift === 'NIGHT') return '🌙'
  return '☀️'
}

/**
 * Format time range.
 */
export function formatTimeRange(start?: string | null, end?: string | null): string {
  if (!start && !end) return 'Не указано'
  if (start && end) return `${start} — ${end}`
  if (start) return `с ${start}`
  return `до ${end}`
}

/**
 * Format work schedule (shift + time).
 */
export function formatWorkSchedule(employee: {
  shiftType?: 'DAY' | 'NIGHT' | null
  workStartTime?: string | null
  workEndTime?: string | null
}): { shift: string; time: string; icon: string } {
  const icon = getShiftIcon(employee.shiftType)
  const shift = formatShiftType(employee.shiftType)
  const time = formatTimeRange(employee.workStartTime, employee.workEndTime)
  return { shift, time, icon }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Status Formatting
// ═══════════════════════════════════════════════════════════════════════════════

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

/**
 * Get status badge variant for order/subscription status.
 */
export function getStatusBadgeVariant(status?: string): BadgeVariant {
  switch (status) {
    case 'Активен':
    case 'Активна':
      return 'default'
    case 'На паузе':
    case 'Приостановлена':
      return 'secondary'
    case 'Завершен':
    case 'Завершена':
      return 'outline'
    case 'Заморожен':
      return 'secondary'
    case 'Запланирован':
      return 'outline'
    default:
      return 'outline'
  }
}

/**
 * Get status badge styling config.
 */
export function getStatusConfig(status?: string): { className: string } {
  switch (status) {
    case 'Активен':
    case 'Активна':
      return { className: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' }
    case 'На паузе':
    case 'Приостановлена':
      return { className: 'bg-amber-500/10 text-amber-600 border-amber-200' }
    case 'Завершен':
    case 'Завершена':
      return { className: 'bg-muted text-muted-foreground border-muted' }
    case 'Заморожен':
      return { className: 'bg-blue-500/10 text-blue-600 border-blue-200' }
    default:
      return { className: '' }
  }
}

/**
 * Get invite status badge config.
 */
export function getInviteStatusConfig(status?: string): {
  variant: BadgeVariant
  className: string
  label: string
} {
  switch (status) {
    case 'Принято':
      return {
        variant: 'default',
        className: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
        label: 'Принято',
      }
    case 'Ожидает':
      return {
        variant: 'secondary',
        className: 'bg-amber-500/10 text-amber-600 border-amber-200',
        label: 'Ожидает',
      }
    case 'Отклонено':
      return {
        variant: 'destructive',
        className: 'bg-red-500/10 text-red-600 border-red-200',
        label: 'Отклонено',
      }
    default:
      return {
        variant: 'outline',
        className: '',
        label: 'Не приглашён',
      }
  }
}

/**
 * Get service type badge config.
 */
export function getServiceTypeConfig(serviceType?: 'LUNCH' | 'COMPENSATION' | null): {
  label: string
  className: string
  icon: 'lunch' | 'wallet'
} {
  if (serviceType === 'COMPENSATION') {
    return {
      label: 'Компенсация',
      className: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
      icon: 'wallet',
    }
  }
  return {
    label: 'Ланч',
    className: 'bg-amber-500/10 text-amber-600 border-amber-200',
    icon: 'lunch',
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Number Formatting
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format currency amount in TJS.
 */
export function formatTJS(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  return `${amount.toLocaleString('ru-RU')} TJS`
}

/**
 * Format budget with currency.
 */
export function formatBudget(budget: number | null | undefined): string {
  if (!budget) return '0 TJS'
  return formatTJS(budget)
}

/**
 * Format percentage.
 */
export function formatPercent(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`
}

// ═══════════════════════════════════════════════════════════════════════════════
// Pluralization
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get correct Russian plural form.
 * @example pluralize(1, 'день', 'дня', 'дней') => 'день'
 * @example pluralize(2, 'день', 'дня', 'дней') => 'дня'
 * @example pluralize(5, 'день', 'дня', 'дней') => 'дней'
 */
export function pluralize(count: number, one: string, few: string, many: string): string {
  const n = Math.abs(count) % 100
  const n1 = n % 10

  if (n > 10 && n < 20) return many
  if (n1 > 1 && n1 < 5) return few
  if (n1 === 1) return one
  return many
}

/**
 * Format count with correct plural form.
 */
export function formatCount(count: number, one: string, few: string, many: string): string {
  return `${count} ${pluralize(count, one, few, many)}`
}

// Common pluralizations
export const pluralDays = (n: number) => formatCount(n, 'день', 'дня', 'дней')
export const pluralEmployees = (n: number) => formatCount(n, 'сотрудник', 'сотрудника', 'сотрудников')
export const pluralOrders = (n: number) => formatCount(n, 'заказ', 'заказа', 'заказов')


import { addDays } from 'date-fns'
import type { DayOfWeek } from '@/lib/api/employees'

// =============================================================================
// WORKING DAYS - ЕДИНЫЙ СТАНДАРТ (зеркало бэкенда WorkingDaysHelper.cs)
// =============================================================================

/**
 * Default working days: Monday to Friday (1-5)
 * ВАЖНО: Это единственный источник правды для дефолтных рабочих дней!
 * Соответствует бэкенду: WorkingDaysHelper.GetDefaultWorkingDays()
 */
export const DEFAULT_WORKING_DAYS: DayOfWeek[] = [1, 2, 3, 4, 5]

/**
 * Get effective working days for an employee.
 * If employee has no working days set, returns default (Mon-Fri).
 * Mirrors backend: WorkingDaysHelper.IsWorkingDay()
 */
export function getEffectiveWorkingDays(employeeWorkingDays?: DayOfWeek[] | number[] | null): DayOfWeek[] {
  if (employeeWorkingDays && employeeWorkingDays.length > 0) {
    return employeeWorkingDays as DayOfWeek[]
  }
  return DEFAULT_WORKING_DAYS
}

/**
 * Check if a date is a working day for the employee.
 * Mirrors backend: WorkingDaysHelper.IsWorkingDay()
 */
export function isWorkingDay(employeeWorkingDays: DayOfWeek[] | number[] | null | undefined, date: Date): boolean {
  const effectiveWorkingDays = getEffectiveWorkingDays(employeeWorkingDays as DayOfWeek[])
  const dayOfWeek = date.getDay() as DayOfWeek // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  return effectiveWorkingDays.includes(dayOfWeek)
}

/**
 * Count working days in a date range for an employee.
 * Mirrors backend: WorkingDaysHelper.CountWorkingDays()
 */
export function countWorkingDaysInRange(
  employeeWorkingDays: DayOfWeek[] | number[] | null | undefined,
  startDate: Date,
  endDate: Date
): number {
  if (startDate > endDate) return 0

  let count = 0
  let current = new Date(startDate)

  while (current <= endDate) {
    if (isWorkingDay(employeeWorkingDays as DayOfWeek[], current)) {
      count++
    }
    current = addDays(current, 1)
  }

  return count
}

export const DAYS_OF_WEEK: { value: DayOfWeek; label: string; shortLabel: string }[] = [
  { value: 1, label: 'Понедельник', shortLabel: 'Пн' },
  { value: 2, label: 'Вторник', shortLabel: 'Вт' },
  { value: 3, label: 'Среда', shortLabel: 'Ср' },
  { value: 4, label: 'Четверг', shortLabel: 'Чт' },
  { value: 5, label: 'Пятница', shortLabel: 'Пт' },
  { value: 6, label: 'Суббота', shortLabel: 'Сб' },
  { value: 0, label: 'Воскресенье', shortLabel: 'Вс' },
]

export const WORKING_DAYS_PRESETS = [
  { label: '5-дневка', days: DEFAULT_WORKING_DAYS },
  { label: '6-дневка', days: [1, 2, 3, 4, 5, 6] as DayOfWeek[] },
  { label: 'Все дни', days: [0, 1, 2, 3, 4, 5, 6] as DayOfWeek[] },
]

// =============================================================================
// VALIDATION PATTERNS
// =============================================================================

export const PHONE_REGEX = /^\+?[0-9]{9,15}$/
export const TIME_REGEX = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/

// =============================================================================
// ROUTE LABELS (for permissions)
// =============================================================================

export const ROUTE_LABELS: Record<string, string> = {
  home: 'Главная',
  employees: 'Сотрудники',
  payments: 'Оплаты',
  analytics: 'Аналитика',
  news: 'Новости',
  partners: 'Партнеры',
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Format working days as human-readable description.
 * Examples:
 * - [1,2,3,4,5] → "Понедельник — Пятница"
 * - [1,2,3,4,5,6] → "Понедельник — Суббота"
 * - [0,1,2,3,4,5,6] → "Все дни"
 * - [1,3,5] → "Понедельник, Среда, Пятница"
 */
export function formatWorkingDaysDescription(days: DayOfWeek[]): string {
  if (!days || days.length === 0) return 'Нет рабочих дней'

  const sorted = sortWorkingDays(days)

  // Check for preset patterns
  if (sorted.length === 7) return 'Все дни'

  // Check if consecutive days (excluding Sunday which is 0)
  const weekdaysOnly = sorted.filter(d => d !== 0)
  if (weekdaysOnly.length >= 2) {
    const isConsecutive = weekdaysOnly.every((d, i, arr) =>
      i === 0 || d === arr[i - 1] + 1
    )

    if (isConsecutive) {
      const firstDay = DAYS_OF_WEEK.find(d => d.value === weekdaysOnly[0])?.label || ''
      const lastDay = DAYS_OF_WEEK.find(d => d.value === weekdaysOnly[weekdaysOnly.length - 1])?.label || ''

      // Add Sunday if present
      if (sorted.includes(0)) {
        return `${firstDay} — ${lastDay}, Воскресенье`
      }
      return `${firstDay} — ${lastDay}`
    }
  }

  // For non-consecutive, list all days
  return sorted
    .map(d => DAYS_OF_WEEK.find(day => day.value === d)?.label || '')
    .filter(Boolean)
    .join(', ')
}

/**
 * Sort days so Sunday (0) comes after Saturday (6)
 */
export function sortWorkingDays(days: DayOfWeek[]): DayOfWeek[] {
  return [...days].sort((a, b) => {
    const aVal = a === 0 ? 7 : a
    const bVal = b === 0 ? 7 : b
    return aVal - bVal
  })
}

/**
 * Toggle a day in/out of the working days array
 */
export function toggleWorkingDay(
  currentDays: DayOfWeek[],
  day: DayOfWeek,
  minDays = 0
): DayOfWeek[] {
  if (currentDays.includes(day)) {
    if (currentDays.length > minDays) {
      return currentDays.filter(d => d !== day)
    }
    return currentDays
  }
  return sortWorkingDays([...currentDays, day])
}


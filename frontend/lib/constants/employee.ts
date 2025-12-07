import type { DayOfWeek } from '@/lib/api/employees'

// =============================================================================
// WORKING DAYS
// =============================================================================

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
  { label: '5-дневка', days: [1, 2, 3, 4, 5] as DayOfWeek[] },
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


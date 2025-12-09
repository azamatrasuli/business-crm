/**
 * @fileoverview Единый источник данных для всех справочников
 * Single Source of Truth для всех констант, опций фильтров и справочных данных.
 * 
 * ВАЖНО: Все значения для фильтров, select-полей и справочников должны браться ОТСЮДА.
 * Не дублируйте эти данные в других файлах!
 */

import { config } from '../config'

// ═══════════════════════════════════════════════════════════════════════════════
// СТАТУСЫ ЗАКАЗОВ
// Синхронизировано с PostgreSQL enum order_status
// ═══════════════════════════════════════════════════════════════════════════════

export const ORDER_STATUSES = {
  ACTIVE: 'Активен',
  PAUSED: 'Приостановлен',
  FROZEN: 'Заморожен',
  DAY_OFF: 'Выходной',
  DELIVERED: 'Доставлен',
  COMPLETED: 'Выполнен',
  CANCELLED: 'Отменён',
} as const

export type OrderStatusKey = keyof typeof ORDER_STATUSES
export type OrderStatusValue = typeof ORDER_STATUSES[OrderStatusKey]

/** Опции для фильтра статуса заказа */
export const ORDER_STATUS_OPTIONS = [
  { value: ORDER_STATUSES.ACTIVE, label: 'Активен', description: 'Готов к доставке' },
  { value: ORDER_STATUSES.PAUSED, label: 'На паузе', description: 'Временно остановлен' },
  { value: ORDER_STATUSES.FROZEN, label: 'Заморожен', description: 'День перенесён' },
  { value: ORDER_STATUSES.DAY_OFF, label: 'Выходной', description: 'Нерабочий день' },
  { value: ORDER_STATUSES.DELIVERED, label: 'Доставлен', description: 'Выполнен' },
  { value: ORDER_STATUSES.CANCELLED, label: 'Отменён', description: 'Заказ отменён' },
] as const

// ═══════════════════════════════════════════════════════════════════════════════
// ТИПЫ ЗАКАЗЧИКОВ
// ═══════════════════════════════════════════════════════════════════════════════

export const ORDER_TYPES = {
  EMPLOYEE: 'Сотрудник',
  GUEST: 'Гость',
} as const

export type OrderTypeKey = keyof typeof ORDER_TYPES
export type OrderTypeValue = typeof ORDER_TYPES[OrderTypeKey]

/** Опции для фильтра типа заказчика */
export const ORDER_TYPE_OPTIONS = [
  { value: ORDER_TYPES.EMPLOYEE, label: 'Сотрудник', description: 'Штатный работник' },
  { value: ORDER_TYPES.GUEST, label: 'Гость', description: 'Разовый заказ' },
] as const

// ═══════════════════════════════════════════════════════════════════════════════
// ТИПЫ КОМБО-ОБЕДОВ
// Цены берутся из централизованного конфига
// ═══════════════════════════════════════════════════════════════════════════════

const { COMBO_25, COMBO_35 } = config.pricing.combos

export const COMBO_TYPES = {
  COMBO_25: 'Комбо 25',
  COMBO_35: 'Комбо 35',
} as const

export type ComboTypeKey = keyof typeof COMBO_TYPES
export type ComboTypeValue = typeof COMBO_TYPES[ComboTypeKey]

/** Метаданные комбо (цены, описания) */
export const COMBO_METADATA = {
  [COMBO_TYPES.COMBO_25]: {
    name: COMBO_25.name,
    price: COMBO_25.price,
    currency: 'TJS',
    tier: 'standard',
    features: ['Второе блюдо', 'Салат', 'Хлеб + приборы'],
  },
  [COMBO_TYPES.COMBO_35]: {
    name: COMBO_35.name,
    price: COMBO_35.price,
    currency: 'TJS',
    tier: 'extended',
    features: ['Первое блюдо', 'Второе блюдо', 'Салат', 'Хлеб + приборы'],
  },
} as const

/** Опции для фильтра типа комбо */
export const COMBO_TYPE_OPTIONS = [
  { 
    value: COMBO_TYPES.COMBO_25, 
    label: `Комбо ${COMBO_25.price} TJS`, 
    description: 'Стандартный обед',
    price: COMBO_25.price,
  },
  { 
    value: COMBO_TYPES.COMBO_35, 
    label: `Комбо ${COMBO_35.price} TJS`, 
    description: 'Расширенный обед',
    price: COMBO_35.price,
  },
] as const

/** Получить цену комбо по типу */
export const getComboPrice = (comboType: ComboTypeValue): number => {
  return COMBO_METADATA[comboType]?.price ?? 0
}

/** Список всех типов комбо (для API) */
export const COMBO_TYPE_VALUES: ComboTypeValue[] = Object.values(COMBO_TYPES)

// ═══════════════════════════════════════════════════════════════════════════════
// ТИПЫ УСЛУГ
// ═══════════════════════════════════════════════════════════════════════════════

export const SERVICE_TYPES = {
  LUNCH: 'LUNCH',
  COMPENSATION: 'COMPENSATION',
} as const

export type ServiceTypeKey = keyof typeof SERVICE_TYPES
export type ServiceTypeValue = typeof SERVICE_TYPES[ServiceTypeKey]

/** Опции для фильтра типа услуги */
export const SERVICE_TYPE_OPTIONS = [
  { value: SERVICE_TYPES.LUNCH, label: 'Ланч', description: 'Доставка обеда' },
  { value: SERVICE_TYPES.COMPENSATION, label: 'Компенсация', description: 'Денежная выплата' },
] as const

// ═══════════════════════════════════════════════════════════════════════════════
// СТАТУСЫ ПОДПИСОК
// ═══════════════════════════════════════════════════════════════════════════════

export const SUBSCRIPTION_STATUSES = {
  ACTIVE: 'Активна',
  PAUSED: 'Приостановлена',
  COMPLETED: 'Завершена',
} as const

export type SubscriptionStatusKey = keyof typeof SUBSCRIPTION_STATUSES
export type SubscriptionStatusValue = typeof SUBSCRIPTION_STATUSES[SubscriptionStatusKey]

/** Опции для фильтра статуса подписки */
export const SUBSCRIPTION_STATUS_OPTIONS = [
  { value: SUBSCRIPTION_STATUSES.ACTIVE, label: 'Активна', description: 'Подписка действует' },
  { value: SUBSCRIPTION_STATUSES.PAUSED, label: 'Приостановлена', description: 'Временно остановлена' },
  { value: SUBSCRIPTION_STATUSES.COMPLETED, label: 'Завершена', description: 'Подписка закончилась' },
] as const

// ═══════════════════════════════════════════════════════════════════════════════
// СТАТУСЫ СОТРУДНИКОВ
// ═══════════════════════════════════════════════════════════════════════════════

export const EMPLOYEE_STATUSES = {
  ACTIVE: 'Активный',
  DEACTIVATED: 'Деактивирован',
  VACATION: 'Отпуск',
} as const

export type EmployeeStatusKey = keyof typeof EMPLOYEE_STATUSES
export type EmployeeStatusValue = typeof EMPLOYEE_STATUSES[EmployeeStatusKey]

/** Опции для фильтра статуса сотрудника */
export const EMPLOYEE_STATUS_OPTIONS = [
  { value: EMPLOYEE_STATUSES.ACTIVE, label: 'Активный', description: 'Работает' },
  { value: EMPLOYEE_STATUSES.DEACTIVATED, label: 'Деактивирован', description: 'Уволен/отключён' },
  { value: EMPLOYEE_STATUSES.VACATION, label: 'Отпуск', description: 'Временно отсутствует' },
] as const

// ═══════════════════════════════════════════════════════════════════════════════
// СТАТУСЫ ПРИГЛАШЕНИЙ
// ═══════════════════════════════════════════════════════════════════════════════

export const INVITE_STATUSES = {
  ACCEPTED: 'Принято',
  PENDING: 'Ожидает',
  REJECTED: 'Отклонено',
} as const

export type InviteStatusKey = keyof typeof INVITE_STATUSES
export type InviteStatusValue = typeof INVITE_STATUSES[InviteStatusKey]

/** Опции для фильтра статуса приглашения */
export const INVITE_STATUS_OPTIONS = [
  { value: INVITE_STATUSES.ACCEPTED, label: 'Принято', description: 'Приглашение принято' },
  { value: INVITE_STATUSES.PENDING, label: 'Ожидает', description: 'Ждёт ответа' },
  { value: INVITE_STATUSES.REJECTED, label: 'Отклонено', description: 'Отказался' },
] as const

// ═══════════════════════════════════════════════════════════════════════════════
// ТИПЫ СМЕН
// ═══════════════════════════════════════════════════════════════════════════════

export const SHIFT_TYPES = {
  DAY: 'DAY',
  NIGHT: 'NIGHT',
} as const

export type ShiftTypeKey = keyof typeof SHIFT_TYPES
export type ShiftTypeValue = typeof SHIFT_TYPES[ShiftTypeKey]

/** Опции для фильтра типа смены */
export const SHIFT_TYPE_OPTIONS = [
  { value: SHIFT_TYPES.DAY, label: 'Дневная', description: '08:00 - 18:00' },
  { value: SHIFT_TYPES.NIGHT, label: 'Ночная', description: '18:00 - 08:00' },
] as const

// ═══════════════════════════════════════════════════════════════════════════════
// ПЕРИОДЫ БЮДЖЕТА
// ═══════════════════════════════════════════════════════════════════════════════

export const BUDGET_PERIODS = {
  DAY: 'в День',
  WEEK: 'в Неделю',
  MONTH: 'в Месяц',
} as const

export type BudgetPeriodKey = keyof typeof BUDGET_PERIODS
export type BudgetPeriodValue = typeof BUDGET_PERIODS[BudgetPeriodKey]

/** Опции для выбора периода бюджета */
export const BUDGET_PERIOD_OPTIONS = [
  { value: BUDGET_PERIODS.DAY, label: 'в День', description: 'Ежедневный лимит' },
  { value: BUDGET_PERIODS.WEEK, label: 'в Неделю', description: 'Недельный лимит' },
  { value: BUDGET_PERIODS.MONTH, label: 'в Месяц', description: 'Месячный лимит' },
] as const

// ═══════════════════════════════════════════════════════════════════════════════
// ТИПЫ РАСПИСАНИЯ
// ═══════════════════════════════════════════════════════════════════════════════

export const SCHEDULE_TYPES = {
  FIVE_TWO: '5/2',
  SIX_ONE: '6/1',
  TWO_TWO: '2/2',
  CUSTOM: 'CUSTOM',
} as const

export type ScheduleTypeKey = keyof typeof SCHEDULE_TYPES
export type ScheduleTypeValue = typeof SCHEDULE_TYPES[ScheduleTypeKey]

/** Опции для выбора типа расписания */
export const SCHEDULE_TYPE_OPTIONS = [
  { value: SCHEDULE_TYPES.FIVE_TWO, label: '5/2', description: 'Пн-Пт, выходные Сб-Вс' },
  { value: SCHEDULE_TYPES.SIX_ONE, label: '6/1', description: 'Пн-Сб, выходной Вс' },
  { value: SCHEDULE_TYPES.TWO_TWO, label: '2/2', description: '2 дня работа, 2 выходных' },
  { value: SCHEDULE_TYPES.CUSTOM, label: 'Свой', description: 'Индивидуальное расписание' },
] as const

// ═══════════════════════════════════════════════════════════════════════════════
// ДНИ НЕДЕЛИ
// ═══════════════════════════════════════════════════════════════════════════════

export const WEEKDAYS = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
  SUNDAY: 0,
} as const

/** Опции для выбора дней недели */
export const WEEKDAY_OPTIONS = [
  { value: WEEKDAYS.MONDAY, label: 'Пн', fullLabel: 'Понедельник' },
  { value: WEEKDAYS.TUESDAY, label: 'Вт', fullLabel: 'Вторник' },
  { value: WEEKDAYS.WEDNESDAY, label: 'Ср', fullLabel: 'Среда' },
  { value: WEEKDAYS.THURSDAY, label: 'Чт', fullLabel: 'Четверг' },
  { value: WEEKDAYS.FRIDAY, label: 'Пт', fullLabel: 'Пятница' },
  { value: WEEKDAYS.SATURDAY, label: 'Сб', fullLabel: 'Суббота' },
  { value: WEEKDAYS.SUNDAY, label: 'Вс', fullLabel: 'Воскресенье' },
] as const

// ═══════════════════════════════════════════════════════════════════════════════
// УТИЛИТЫ
// ═══════════════════════════════════════════════════════════════════════════════

/** Тип опции для select/фильтра */
export interface FilterOption {
  value: string
  label: string
  description?: string
}

/** Преобразовать опции в формат для FilterBuilder */
export function toFilterOptions<T extends readonly { value: string; label: string; description?: string }[]>(
  options: T
): FilterOption[] {
  return options.map(opt => ({
    value: opt.value,
    label: opt.description ? `${opt.label} — ${opt.description}` : opt.label,
  }))
}

/** Получить label по value из списка опций */
export function getLabelByValue<T extends readonly { value: string; label: string }[]>(
  options: T,
  value: string
): string {
  const option = options.find(opt => opt.value === value)
  return option?.label ?? value
}

/** Получить описание по value из списка опций */
export function getDescriptionByValue<T extends readonly { value: string; description?: string }[]>(
  options: T,
  value: string
): string | undefined {
  const option = options.find(opt => opt.value === value)
  return option?.description
}


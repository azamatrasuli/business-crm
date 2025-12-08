/**
 * @fileoverview Centralized Configuration
 * 
 * Загружает конфиг из /config.json в корне проекта.
 * Все бизнес-константы должны браться отсюда.
 * 
 * Чтобы изменить настройку — измените /config.json и перезапустите проект.
 */

import configData from '../config.json'

// =============================================================================
// Types
// =============================================================================

export interface AppConfig {
  business: {
    orders: {
      cutoffTime: string
      cutoffTimezone: string
    }
    freezes: {
      maxPerWeek: number
    }
    subscriptions: {
      minDays: number
    }
  }
  pricing: {
    combos: {
      COMBO_25: { name: string; price: number; description: string }
      COMBO_35: { name: string; price: number; description: string }
    }
    delivery: {
      free: boolean
      minOrderForFreeDelivery: number
    }
  }
  budgets: {
    defaults: {
      employeeDailyLimit: number
      projectOverdraftLimit: number
      companyOverdraftLimit: number
    }
    periods: Record<string, string>
  }
  workSchedule: {
    defaults: {
      workingDays: number[]
      workStartTime: string
      workEndTime: string
      shiftType: string
    }
    presets: {
      fiveDays: { label: string; days: number[] }
      sixDays: { label: string; days: number[] }
      allDays: { label: string; days: number[] }
    }
  }
  ui: {
    pagination: {
      defaultPageSize: number
      pageSizeOptions: number[]
    }
    dateFormats: {
      display: string
      api: string
      time: string
      datetime: string
    }
    locale: {
      default: string
      timezone: string
    }
  }
  contacts: {
    support: {
      phone: string
      email: string
      telegram: string
    }
    office: {
      address: string
      workingHours: string
    }
  }
  features: {
    lunch: boolean
    compensation: boolean
    passwordReset: boolean
    payments: boolean
    analytics: boolean
    news: boolean
    partners: boolean
  }
}

// =============================================================================
// Config Instance
// =============================================================================

export const config: AppConfig = configData as AppConfig

// =============================================================================
// Convenience Exports
// =============================================================================

// Business Rules
export const CUTOFF_TIME = config.business.orders.cutoffTime
export const CUTOFF_TIMEZONE = config.business.orders.cutoffTimezone
export const MAX_FREEZES_PER_WEEK = config.business.freezes.maxPerWeek
export const MIN_SUBSCRIPTION_DAYS = config.business.subscriptions.minDays

// Pricing
export const COMBO_PRICES = {
  'Комбо 25': config.pricing.combos.COMBO_25.price,
  'Комбо 35': config.pricing.combos.COMBO_35.price,
} as const

export const COMBO_OPTIONS = [
  { value: 'Комбо 25', label: 'Комбо 25', price: config.pricing.combos.COMBO_25.price },
  { value: 'Комбо 35', label: 'Комбо 35', price: config.pricing.combos.COMBO_35.price },
] as const

// Extended combo options with items for forms
export const COMBO_OPTIONS_EXTENDED = [
  {
    value: 'Комбо 25' as const,
    price: config.pricing.combos.COMBO_25.price,
    label: 'Комбо 25',
    items: ['Второе', 'Салат', 'Хлеб', 'Приборы'],
  },
  {
    value: 'Комбо 35' as const,
    price: config.pricing.combos.COMBO_35.price,
    label: 'Комбо 35',
    items: ['Первое', 'Второе', 'Салат', 'Хлеб', 'Приборы'],
  },
] as const

// Budget Defaults
export const DEFAULT_EMPLOYEE_DAILY_LIMIT = config.budgets.defaults.employeeDailyLimit
export const DEFAULT_PROJECT_OVERDRAFT = config.budgets.defaults.projectOverdraftLimit
export const DEFAULT_COMPANY_OVERDRAFT = config.budgets.defaults.companyOverdraftLimit
export const BUDGET_PERIODS = config.budgets.periods

// Work Schedule Defaults
export const DEFAULT_WORKING_DAYS = config.workSchedule.defaults.workingDays
export const DEFAULT_WORK_START_TIME = config.workSchedule.defaults.workStartTime
export const DEFAULT_WORK_END_TIME = config.workSchedule.defaults.workEndTime
export const DEFAULT_SHIFT_TYPE = config.workSchedule.defaults.shiftType

export const WORKING_DAYS_PRESETS_FROM_CONFIG = [
  config.workSchedule.presets.fiveDays,
  config.workSchedule.presets.sixDays,
  config.workSchedule.presets.allDays,
]

// UI Settings
export const DEFAULT_PAGE_SIZE = config.ui.pagination.defaultPageSize
export const PAGE_SIZE_OPTIONS = config.ui.pagination.pageSizeOptions

export const DATE_FORMAT = config.ui.dateFormats.display
export const API_DATE_FORMAT = config.ui.dateFormats.api
export const TIME_FORMAT = config.ui.dateFormats.time
export const DATETIME_FORMAT = config.ui.dateFormats.datetime

export const DEFAULT_LOCALE = config.ui.locale.default
export const DEFAULT_TIMEZONE = config.ui.locale.timezone

// Contacts
export const SUPPORT_CONTACTS = config.contacts.support
export const OFFICE_INFO = config.contacts.office

// Feature Flags
export const FEATURES = config.features


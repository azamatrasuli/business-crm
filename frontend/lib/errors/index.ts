import { AxiosError } from 'axios'

/**
 * Error types matching backend ErrorType enum
 */
export type ErrorType = 'Validation' | 'NotFound' | 'Forbidden' | 'Conflict' | 'Internal'

/**
 * Structured API error response from backend
 */
export interface ApiErrorResponse {
  success: false
  error: {
    code: string
    message: string
    type: ErrorType
    details?: Record<string, unknown>
    action?: string | null
  }
  path: string
  timestamp: string
}

/**
 * Parsed error object for use in components
 */
export interface AppError {
  code: string
  message: string
  type: ErrorType
  details?: Record<string, unknown>
  action?: string
  isNetworkError: boolean
  isServerError: boolean
  isValidationError: boolean
  isAuthError: boolean
}

/**
 * Error codes matching backend ErrorCodes
 */
export const ErrorCodes = {
  // Auth
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_USER_BLOCKED: 'AUTH_USER_BLOCKED',
  AUTH_USER_INACTIVE: 'AUTH_USER_INACTIVE',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
  AUTH_FORBIDDEN: 'AUTH_FORBIDDEN',
  AUTH_IMPERSONATION_NOT_ALLOWED: 'AUTH_IMPERSONATION_NOT_ALLOWED',
  AUTH_PASSWORD_MISMATCH: 'AUTH_PASSWORD_MISMATCH',

  // User
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_PHONE_EXISTS: 'USER_PHONE_EXISTS',
  USER_EMAIL_EXISTS: 'USER_EMAIL_EXISTS',
  USER_CANNOT_DELETE_SELF: 'USER_CANNOT_DELETE_SELF',
  USER_CANNOT_DELETE_LAST_ADMIN: 'USER_CANNOT_DELETE_LAST_ADMIN',
  USER_INVALID_PHONE_FORMAT: 'USER_INVALID_PHONE_FORMAT',
  USER_INVALID_EMAIL_FORMAT: 'USER_INVALID_EMAIL_FORMAT',

  // Employee
  EMP_NOT_FOUND: 'EMP_NOT_FOUND',
  EMP_PHONE_EXISTS: 'EMP_PHONE_EXISTS',
  EMP_PHONE_DELETED: 'EMP_PHONE_DELETED',
  EMP_INVALID_PHONE_FORMAT: 'EMP_INVALID_PHONE_FORMAT',
  EMP_SERVICE_TYPE_SWITCH_BLOCKED: 'EMP_SERVICE_TYPE_SWITCH_BLOCKED',

  // Project
  PROJ_NOT_FOUND: 'PROJ_NOT_FOUND',
  PROJ_ADDRESS_IMMUTABLE: 'PROJ_ADDRESS_IMMUTABLE',
  PROJ_FOREIGN_COMPANY: 'PROJ_FOREIGN_COMPANY',

  // Subscription
  SUB_NOT_FOUND: 'SUB_NOT_FOUND',
  SUB_MIN_DAYS_REQUIRED: 'SUB_MIN_DAYS_REQUIRED',
  SUB_PAST_DATE_NOT_ALLOWED: 'SUB_PAST_DATE_NOT_ALLOWED',
  SUB_ALREADY_PAUSED: 'SUB_ALREADY_PAUSED',
  SUB_ALREADY_ACTIVE: 'SUB_ALREADY_ACTIVE',
  SUB_ALREADY_CANCELLED: 'SUB_ALREADY_CANCELLED',

  // Freeze
  FREEZE_LIMIT_EXCEEDED: 'FREEZE_LIMIT_EXCEEDED',
  FREEZE_ALREADY_FROZEN: 'FREEZE_ALREADY_FROZEN',
  FREEZE_NOT_FROZEN: 'FREEZE_NOT_FROZEN',
  FREEZE_PAST_DATE_NOT_ALLOWED: 'FREEZE_PAST_DATE_NOT_ALLOWED',

  // Order
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  ORDER_CUTOFF_PASSED: 'ORDER_CUTOFF_PASSED',
  ORDER_PAST_DATE_NOT_ALLOWED: 'ORDER_PAST_DATE_NOT_ALLOWED',
  ORDER_GUEST_CANNOT_FREEZE: 'ORDER_GUEST_CANNOT_FREEZE',

  // Budget
  BUDGET_INSUFFICIENT: 'BUDGET_INSUFFICIENT',
  BUDGET_OVERDRAFT_EXCEEDED: 'BUDGET_OVERDRAFT_EXCEEDED',

  // Generic
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const

/**
 * User-friendly error messages (fallback if not provided by backend)
 */
const ERROR_MESSAGES: Record<string, string> = {
  [ErrorCodes.AUTH_INVALID_CREDENTIALS]: 'Неверный логин или пароль',
  [ErrorCodes.AUTH_USER_BLOCKED]: 'Ваш аккаунт заблокирован. Обратитесь к администратору',
  [ErrorCodes.AUTH_USER_INACTIVE]: 'Ваш аккаунт неактивен',
  [ErrorCodes.AUTH_TOKEN_EXPIRED]: 'Сессия истекла. Пожалуйста, войдите заново',
  [ErrorCodes.AUTH_UNAUTHORIZED]: 'Требуется авторизация',
  [ErrorCodes.AUTH_FORBIDDEN]: 'Доступ запрещён',
  
  [ErrorCodes.USER_PHONE_EXISTS]: 'Пользователь с таким телефоном уже существует',
  [ErrorCodes.USER_CANNOT_DELETE_SELF]: 'Нельзя удалить самого себя',
  [ErrorCodes.USER_CANNOT_DELETE_LAST_ADMIN]: 'Нельзя удалить последнего администратора',
  [ErrorCodes.USER_INVALID_PHONE_FORMAT]: 'Неверный формат телефона',
  
  [ErrorCodes.EMP_PHONE_EXISTS]: 'Сотрудник с таким телефоном уже существует',
  [ErrorCodes.EMP_PHONE_DELETED]: 'Этот телефон был удалён. Обратитесь к администратору',
  [ErrorCodes.EMP_SERVICE_TYPE_SWITCH_BLOCKED]: 'Нельзя сменить тип услуги при активной подписке',
  
  [ErrorCodes.FREEZE_LIMIT_EXCEEDED]: 'Вы уже использовали 2 заморозки на этой неделе',
  [ErrorCodes.FREEZE_ALREADY_FROZEN]: 'Этот заказ уже заморожен',
  [ErrorCodes.FREEZE_NOT_FROZEN]: 'Этот заказ не заморожен',
  
  [ErrorCodes.ORDER_CUTOFF_PASSED]: 'Время для изменения заказов истекло',
  [ErrorCodes.ORDER_GUEST_CANNOT_FREEZE]: 'Гостевые заказы нельзя замораживать',
  
  [ErrorCodes.BUDGET_INSUFFICIENT]: 'Недостаточно бюджета',
  
  [ErrorCodes.SUB_MIN_DAYS_REQUIRED]: 'Минимальный период подписки — 5 дней',
  [ErrorCodes.SUB_PAST_DATE_NOT_ALLOWED]: 'Нельзя создать подписку на прошедшие даты',
  
  [ErrorCodes.INTERNAL_ERROR]: 'Произошла внутренняя ошибка. Попробуйте позже',
  [ErrorCodes.NETWORK_ERROR]: 'Ошибка сети. Проверьте подключение к интернету',
  [ErrorCodes.VALIDATION_ERROR]: 'Ошибка валидации данных',
}

/**
 * Action suggestions for users
 */
const ERROR_ACTIONS: Record<string, string> = {
  [ErrorCodes.AUTH_INVALID_CREDENTIALS]: 'Проверьте данные или восстановите пароль',
  [ErrorCodes.AUTH_USER_BLOCKED]: 'Свяжитесь с администратором',
  [ErrorCodes.AUTH_TOKEN_EXPIRED]: 'Войдите в систему заново',
  [ErrorCodes.BUDGET_INSUFFICIENT]: 'Обратитесь к администратору для пополнения',
  [ErrorCodes.FREEZE_LIMIT_EXCEEDED]: 'Дождитесь следующей недели',
  [ErrorCodes.ORDER_CUTOFF_PASSED]: 'Изменения возможны только до указанного времени',
  [ErrorCodes.NETWORK_ERROR]: 'Проверьте подключение и попробуйте снова',
  [ErrorCodes.INTERNAL_ERROR]: 'Попробуйте обновить страницу',
}

/**
 * Parse error from various sources into a standardized AppError
 */
export function parseError(error: unknown): AppError {
  // Network error (no response)
  if (error instanceof Error && !('response' in error)) {
    return {
      code: ErrorCodes.NETWORK_ERROR,
      message: 'Ошибка сети. Проверьте подключение к интернету',
      type: 'Internal',
      action: ERROR_ACTIONS[ErrorCodes.NETWORK_ERROR],
      isNetworkError: true,
      isServerError: false,
      isValidationError: false,
      isAuthError: false,
    }
  }

  // Axios error with response
  if (isAxiosError(error) && error.response) {
    const data = error.response.data as ApiErrorResponse | { message?: string }
    
    // Structured error response from backend
    if ('success' in data && data.success === false && 'error' in data) {
      const apiError = data as ApiErrorResponse
      return {
        code: apiError.error.code,
        message: apiError.error.message,
        type: apiError.error.type,
        details: apiError.error.details,
        action: apiError.error.action ?? ERROR_ACTIONS[apiError.error.code],
        isNetworkError: false,
        isServerError: apiError.error.type === 'Internal',
        isValidationError: apiError.error.type === 'Validation',
        isAuthError: apiError.error.code.startsWith('AUTH_'),
      }
    }

    // Legacy error response (just message)
    const message = (data as { message?: string }).message ?? 'Произошла ошибка'
    const statusCode = error.response.status
    
    return {
      code: statusCode >= 500 ? ErrorCodes.INTERNAL_ERROR : ErrorCodes.VALIDATION_ERROR,
      message,
      type: statusCode >= 500 ? 'Internal' : 'Validation',
      action: statusCode >= 500 ? ERROR_ACTIONS[ErrorCodes.INTERNAL_ERROR] : undefined,
      isNetworkError: false,
      isServerError: statusCode >= 500,
      isValidationError: statusCode >= 400 && statusCode < 500,
      isAuthError: statusCode === 401 || statusCode === 403,
    }
  }

  // Unknown error
  return {
    code: ErrorCodes.INTERNAL_ERROR,
    message: error instanceof Error ? error.message : 'Произошла неизвестная ошибка',
    type: 'Internal',
    action: ERROR_ACTIONS[ErrorCodes.INTERNAL_ERROR],
    isNetworkError: false,
    isServerError: true,
    isValidationError: false,
    isAuthError: false,
  }
}

/**
 * Get user-friendly message for an error code
 */
export function getErrorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? 'Произошла ошибка'
}

/**
 * Get action suggestion for an error code
 */
export function getErrorAction(code: string): string | undefined {
  return ERROR_ACTIONS[code]
}

/**
 * Type guard for AxiosError
 */
function isAxiosError(error: unknown): error is AxiosError {
  return error instanceof Error && 'isAxiosError' in error && (error as AxiosError).isAxiosError === true
}

/**
 * Format error for display in toast
 */
export function formatErrorForToast(error: AppError): { title: string; description?: string } {
  return {
    title: error.message,
    description: error.action,
  }
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: AppError): boolean {
  return error.isNetworkError || error.isServerError
}


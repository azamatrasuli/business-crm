/**
 * Centralized error handling utility for all stores
 */

export interface ApiError {
  message: string
  code?: string
  status?: number
}

/**
 * Extracts user-friendly error message from various error types
 */
export function getErrorMessage(error: unknown, fallback = 'Произошла ошибка'): string {
  if (typeof error === 'string') return error

  // Handle Axios errors
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as {
      response?: {
        status?: number
        data?: {
          message?: string
          error?: { message?: string; code?: string }
        }
      }
      message?: string
    }
    const status = axiosError.response?.status

    // Standard HTTP error messages
    const httpErrors: Record<number, string> = {
      400: 'Некорректный запрос',
      401: 'Сессия истекла. Пожалуйста, войдите заново.',
      403: 'Доступ запрещён',
      404: 'Ресурс не найден',
      409: 'Конфликт данных',
      422: 'Ошибка валидации',
      429: 'Слишком много запросов. Подождите.',
      500: 'Сервер временно недоступен. Попробуйте позже.',
      502: 'Сервер перезагружается. Подождите 1-2 минуты.',
      503: 'Сервис недоступен. Подождите 1-2 минуты.',
      504: 'Превышено время ожидания. Попробуйте снова.',
    }

    if (status && httpErrors[status]) {
      return httpErrors[status]
    }

    if (!axiosError.response) {
      return 'Нет соединения с сервером. Проверьте интернет.'
    }

    // Try to get message from response
    const message =
      axiosError.response.data?.message ||
      axiosError.response.data?.error?.message
    if (message) return message
  }

  if (error instanceof Error) {
    if (error.message.includes('Network Error')) {
      return 'Нет соединения с сервером. Проверьте интернет.'
    }
    return error.message
  }

  return fallback
}

/**
 * Parse error to ApiError object for more detailed handling
 */
export function parseApiError(error: unknown): ApiError {
  const message = getErrorMessage(error)

  let status: number | undefined
  let code: string | undefined

  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as {
      response?: {
        status?: number
        data?: { error?: { code?: string } }
      }
    }
    status = axiosError.response?.status
    code = axiosError.response?.data?.error?.code
  }

  return { message, status, code }
}


import { useState, useCallback } from 'react'
import { UseFormSetError, FieldPath, FieldValues } from 'react-hook-form'
import { toast } from 'sonner'
import { parseError, ErrorCodes, type AppError } from '@/lib/errors'
import { logger } from '@/lib/logger'

/**
 * Field mapping from API error codes to form field names
 */
const ERROR_FIELD_MAPPING: Record<string, string> = {
  [ErrorCodes.EMP_PHONE_EXISTS]: 'phone',
  [ErrorCodes.EMP_PHONE_DELETED]: 'phone',
  [ErrorCodes.EMP_INVALID_PHONE_FORMAT]: 'phone',
  [ErrorCodes.USER_PHONE_EXISTS]: 'phone',
  [ErrorCodes.USER_INVALID_PHONE_FORMAT]: 'phone',
  [ErrorCodes.USER_INVALID_EMAIL_FORMAT]: 'email',
}

interface UseFormErrorOptions<T extends FieldValues> {
  setError: UseFormSetError<T>
  onRetry?: () => void
  maxRetries?: number
}

interface FormErrorState {
  isSubmitting: boolean
  submitError: AppError | null
  retryCount: number
  canRetry: boolean
}

/**
 * Hook for handling form submission errors with inline field mapping
 */
export function useFormError<T extends FieldValues>(options: UseFormErrorOptions<T>) {
  const { setError, onRetry, maxRetries = 3 } = options
  
  const [state, setState] = useState<FormErrorState>({
    isSubmitting: false,
    submitError: null,
    retryCount: 0,
    canRetry: false,
  })

  /**
   * Handle API error and map to form fields if possible
   */
  const handleError = useCallback((error: unknown) => {
    const appError = parseError(error)
    
    logger.error('Form submission error', error instanceof Error ? error : new Error(appError.message), {
      errorCode: appError.code,
      errorType: appError.type,
    })

    // Try to map error to a specific field
    const fieldName = ERROR_FIELD_MAPPING[appError.code]
    
    if (fieldName) {
      // Set inline error on specific field
      setError(fieldName as FieldPath<T>, {
        type: 'server',
        message: appError.message,
      })
      
      // Also show toast for visibility
      toast.error(appError.message, {
        description: appError.action,
      })
    } else {
      // Show generic error toast
      toast.error(appError.message, {
        description: appError.action,
        action: appError.isNetworkError && state.retryCount < maxRetries ? {
          label: 'Повторить',
          onClick: () => onRetry?.(),
        } : undefined,
      })
    }

    setState(prev => ({
      ...prev,
      isSubmitting: false,
      submitError: appError,
      canRetry: appError.isNetworkError || appError.isServerError,
    }))

    return appError
  }, [setError, onRetry, maxRetries, state.retryCount])

  /**
   * Start form submission
   */
  const startSubmit = useCallback(() => {
    setState(prev => ({
      ...prev,
      isSubmitting: true,
      submitError: null,
    }))
  }, [])

  /**
   * Complete form submission successfully
   */
  const completeSubmit = useCallback(() => {
    setState({
      isSubmitting: false,
      submitError: null,
      retryCount: 0,
      canRetry: false,
    })
  }, [])

  /**
   * Retry submission
   */
  const retry = useCallback(() => {
    if (state.retryCount >= maxRetries) {
      toast.error('Превышено максимальное количество попыток', {
        description: 'Пожалуйста, попробуйте позже или обратитесь в поддержку',
      })
      return false
    }

    setState(prev => ({
      ...prev,
      retryCount: prev.retryCount + 1,
      submitError: null,
    }))
    
    onRetry?.()
    return true
  }, [state.retryCount, maxRetries, onRetry])

  /**
   * Reset error state
   */
  const reset = useCallback(() => {
    setState({
      isSubmitting: false,
      submitError: null,
      retryCount: 0,
      canRetry: false,
    })
  }, [])

  return {
    ...state,
    handleError,
    startSubmit,
    completeSubmit,
    retry,
    reset,
  }
}

/**
 * Wrapper for async form submission with error handling
 */
export function withFormErrorHandling<T extends FieldValues>(
  submitFn: () => Promise<void>,
  errorHandler: ReturnType<typeof useFormError<T>>
) {
  return async () => {
    errorHandler.startSubmit()
    try {
      await submitFn()
      errorHandler.completeSubmit()
    } catch (error) {
      errorHandler.handleError(error)
      throw error // Re-throw to let the form know submission failed
    }
  }
}


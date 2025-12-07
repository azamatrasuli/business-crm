/**
 * @fileoverview Async operation hooks
 * Custom hooks for handling async operations with loading and error states.
 * Based on Code Quality Audit Framework - DRY principle.
 */

import { useCallback, useState } from 'react'
import { parseError, type AppError } from '@/lib/errors'

/**
 * State for async operations
 */
interface AsyncOperationState<T> {
  data: T | null
  error: AppError | null
  isLoading: boolean
  isSuccess: boolean
  isError: boolean
}

/**
 * Return type for useAsync hook
 */
interface UseAsyncReturn<T, Args extends unknown[]> {
  /** Current state of the async operation */
  state: AsyncOperationState<T>
  /** Execute the async operation */
  execute: (...args: Args) => Promise<T | null>
  /** Reset the state */
  reset: () => void
  /** Set data manually */
  setData: (data: T | null) => void
}

/**
 * Initial async state
 */
const initialState = <T>(): AsyncOperationState<T> => ({
  data: null,
  error: null,
  isLoading: false,
  isSuccess: false,
  isError: false,
})

/**
 * Hook for handling async operations with loading and error states.
 *
 * @example
 * ```tsx
 * const { state, execute } = useAsync(async (id: string) => {
 *   return await api.getUser(id)
 * })
 *
 * // Execute the operation
 * await execute('user-123')
 *
 * // Access state
 * if (state.isLoading) return <Spinner />
 * if (state.error) return <Error message={state.error.message} />
 * if (state.data) return <UserProfile user={state.data} />
 * ```
 */
export function useAsync<T, Args extends unknown[]>(
  asyncFn: (...args: Args) => Promise<T>
): UseAsyncReturn<T, Args> {
  const [state, setState] = useState<AsyncOperationState<T>>(initialState<T>())

  const execute = useCallback(
    async (...args: Args): Promise<T | null> => {
      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
        isSuccess: false,
        isError: false,
      }))

      try {
        const data = await asyncFn(...args)
        setState({
          data,
          error: null,
          isLoading: false,
          isSuccess: true,
          isError: false,
        })
        return data
      } catch (error) {
        const parsedError = parseError(error)
        setState((prev) => ({
          ...prev,
          error: parsedError,
          isLoading: false,
          isSuccess: false,
          isError: true,
        }))
        return null
      }
    },
    [asyncFn]
  )

  const reset = useCallback(() => {
    setState(initialState<T>())
  }, [])

  const setData = useCallback((data: T | null) => {
    setState((prev) => ({ ...prev, data }))
  }, [])

  return { state, execute, reset, setData }
}

/**
 * Hook for handling mutation operations (create, update, delete).
 * Similar to useAsync but with additional callbacks for success/error.
 *
 * @example
 * ```tsx
 * const mutation = useMutation(
 *   async (data: CreateUserDto) => await api.createUser(data),
 *   {
 *     onSuccess: (user) => toast.success(`User ${user.name} created`),
 *     onError: (error) => toast.error(error.message),
 *   }
 * )
 * ```
 */
export function useMutation<T, Args extends unknown[]>(
  mutationFn: (...args: Args) => Promise<T>,
  options?: {
    onSuccess?: (data: T) => void
    onError?: (error: AppError) => void
    onSettled?: () => void
  }
): UseAsyncReturn<T, Args> {
  const { state, execute: baseExecute, reset, setData } = useAsync(mutationFn)

  const execute = useCallback(
    async (...args: Args): Promise<T | null> => {
      try {
        const data = await mutationFn(...args)
        options?.onSuccess?.(data)
        options?.onSettled?.()
        return data
      } catch (error) {
        const parsedError = parseError(error)
        options?.onError?.(parsedError)
        options?.onSettled?.()
        return null
      }
    },
    [mutationFn, options]
  )

  return { state, execute, reset, setData }
}

/**
 * Hook for debouncing values.
 * Useful for search inputs to avoid too many API calls.
 *
 * @example
 * ```tsx
 * const [search, setSearch] = useState('')
 * const debouncedSearch = useDebounce(search, 300)
 *
 * useEffect(() => {
 *   api.search(debouncedSearch)
 * }, [debouncedSearch])
 * ```
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  // Note: This is simplified. In production, consider using a library like lodash-es.
  useState(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  })

  return debouncedValue
}


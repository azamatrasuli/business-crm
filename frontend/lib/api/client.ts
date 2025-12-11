import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios'
import { parseError, type AppError, ErrorCodes } from '@/lib/errors'
import { getCookie, clearAuthStatusCookie } from '@/stores/utils/cookie-manager'

// Generate unique correlation ID for request tracing
function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Get token from auth store (for Safari ITP workaround)
// Safari blocks cross-site cookies, so we need to send token in Authorization header
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem('auth-storage')
    if (stored) {
      const parsed = JSON.parse(stored)
      // Zustand persist stores state in "state" key
      return parsed?.state?.token || null
    }
  } catch {
    // Ignore parse errors
  }
  return null
}

const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
  // IMPORTANT: Send cookies with requests (for HttpOnly cookie auth)
  withCredentials: true,
})

// Track if we're currently refreshing to avoid infinite loops
let isRefreshing = false
let failedQueue: Array<{
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
}> = []

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error)
    } else {
      promise.resolve(token)
    }
  })
  failedQueue = []
}

// Request interceptor - add correlation ID, CSRF token, and Authorization header
// Note: We send both cookies AND Authorization header for Safari ITP compatibility
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Add correlation ID for request tracing
    const correlationId = generateCorrelationId()
    config.headers['X-Correlation-ID'] = correlationId
    
    // Store correlation ID for logging
    if (typeof window !== 'undefined') {
      (window as Window & { __lastCorrelationId?: string }).__lastCorrelationId = correlationId
    }
    
    // Add CSRF token from cookie to header (double-submit pattern)
    if (typeof window !== 'undefined') {
      const csrfToken = getCookie('XSRF-TOKEN')
      if (csrfToken) {
        config.headers['X-XSRF-TOKEN'] = csrfToken
      }
    }
    
    // Safari ITP workaround: Add Authorization header with Bearer token
    // Safari blocks cross-site cookies, so backend needs token in header
    // Backend checks Authorization header first, then falls back to cookie
    const token = getAuthToken()
    if (token && !config.headers['Authorization']) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    
    // Log request in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`, {
        correlationId,
        data: config.data,
      })
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor - handle errors and token refresh
apiClient.interceptors.response.use(
  (response) => {
    // Log successful response in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API] Response ${response.status}`, {
        url: response.config.url,
        data: response.data,
      })
    }
    return response
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    
    // Parse error for logging
    const parsedError = parseError(error)
    
    // Log error
    if (process.env.NODE_ENV === 'development') {
      console.error(`[API] Error ${error.response?.status ?? 'Network'}`, {
        url: originalRequest?.url,
        error: parsedError,
      })
    }
    
    // If 401 and not on auth endpoints and not already retried
    if (
      error.response?.status === 401 &&
      !originalRequest?.url?.includes('/auth/login') &&
      !originalRequest?.url?.includes('/auth/refresh') &&
      !originalRequest._retry
    ) {
      if (typeof window === 'undefined') {
        return Promise.reject(error)
      }

      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then(() => {
            // Retry with cookies (no need to manually set token)
            return apiClient(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        // Attempt to refresh the token via cookie-based endpoint
        // The refresh token is in an HttpOnly cookie, so we don't need to send it in body
        const response = await axios.post(
          `${apiClient.defaults.baseURL}/auth/refresh`,
          {}, // Empty body - refresh token is in cookie
          { 
            headers: { 'Content-Type': 'application/json' },
            withCredentials: true // Important: send cookies
          }
        )

        const { token } = response.data

        // Process queued requests (token comes from HttpOnly cookie)
        processQueue(null, token)

        // Retry original request (cookies will be sent automatically)
        return apiClient(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        clearAuthAndRedirect()
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

function clearAuthAndRedirect() {
  if (typeof window !== 'undefined') {
    clearAuthStatusCookie()
    
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
  }
}

/**
 * Enhanced API call with error parsing
 */
export async function apiCall<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  data?: unknown,
  options?: { showErrorToast?: boolean }
): Promise<{ data: T; error: null } | { data: null; error: AppError }> {
  try {
    const response = await apiClient.request<T>({
      method,
      url,
      data,
    })
    return { data: response.data, error: null }
  } catch (error) {
    const parsedError = parseError(error)
    
    // Show toast notification for errors if requested
    if (options?.showErrorToast && typeof window !== 'undefined') {
      // Import dynamically to avoid SSR issues
      import('sonner').then(({ toast }) => {
        toast.error(parsedError.message, {
          description: parsedError.action,
        })
      })
    }
    
    return { data: null, error: parsedError }
  }
}

/**
 * Re-export parseError for use in components
 */
export { parseError, ErrorCodes }
export type { AppError }

export default apiClient

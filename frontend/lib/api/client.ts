import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios'
import { parseError, type AppError, ErrorCodes } from '@/lib/errors'

// Generate unique correlation ID for request tracing
function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
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

// Request interceptor - add auth token and correlation ID
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Add correlation ID for request tracing
    const correlationId = generateCorrelationId()
    config.headers['X-Correlation-ID'] = correlationId
    
    // Store correlation ID for logging
    if (typeof window !== 'undefined') {
      (window as Window & { __lastCorrelationId?: string }).__lastCorrelationId = correlationId
    }
    
    // Don't add token for auth endpoints (except refresh which needs it)
    if (!config.url?.includes('/auth/login') && !config.url?.includes('/auth/forgot')) {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
      }
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

      const refreshToken = localStorage.getItem('refreshToken')
      
      // No refresh token available, redirect to login
      if (!refreshToken) {
        clearAuthAndRedirect()
        return Promise.reject(error)
      }

      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return apiClient(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        // Attempt to refresh the token
        const response = await axios.post(
          `${apiClient.defaults.baseURL}/auth/refresh`,
          { refreshToken },
          { headers: { 'Content-Type': 'application/json' } }
        )

        const { token, refreshToken: newRefreshToken, expiresAt, user } = response.data

        // Update stored tokens
        localStorage.setItem('token', token)
        if (newRefreshToken) {
          localStorage.setItem('refreshToken', newRefreshToken)
        }
        if (expiresAt) {
          localStorage.setItem('tokenExpiresAt', expiresAt.toString())
        }
        if (user) {
          localStorage.setItem('user', JSON.stringify(user))
        }
        document.cookie = `token=${token}; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`

        // Process queued requests
        processQueue(null, token)

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${token}`
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
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('tokenExpiresAt')
    localStorage.removeItem('user')
    document.cookie = 'token=; path=/; max-age=0'
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

import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios'

const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api',
  timeout: 10000,
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

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Don't add token for auth endpoints (except refresh which needs it)
    if (!config.url?.includes('/auth/login') && !config.url?.includes('/auth/forgot')) {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        
        // Add X-Company-Id header for SUPER_ADMIN company switching
        const companySelectorStr = localStorage.getItem('company-selector')
        if (companySelectorStr) {
          try {
            const companySelectorData = JSON.parse(companySelectorStr)
            const selectedCompanyId = companySelectorData?.state?.selectedCompanyId
            if (selectedCompanyId) {
              config.headers['X-Company-Id'] = selectedCompanyId
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    
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

export default apiClient


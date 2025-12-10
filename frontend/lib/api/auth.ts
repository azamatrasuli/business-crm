import apiClient from './client'
import { clearAuthStatusCookie } from '@/stores/utils/cookie-manager'
import { logger } from '@/lib/logger'

export interface LoginRequest {
  phone: string
  password: string
}

export interface LoginResponse {
  token: string
  refreshToken?: string | null
  expiresAt?: number | null
  user: {
    id: string
    fullName: string
    phone: string
    email: string
    role: string
    status: string
    companyId: string
    companyName?: string | null
    // Project info
    projectId?: string | null
    projectName?: string | null
    isHeadquarters: boolean
    projectServiceTypes?: string[] | null  // ['LUNCH'], ['COMPENSATION'], or ['LUNCH', 'COMPENSATION']
    permissions: string[]
  }
  // Impersonation info
  isImpersonating?: boolean
  impersonatedBy?: string | null
}

export interface AdminListItem {
  id: string
  fullName: string
  phone: string
  email: string
  role: string
  status: string
  companyId: string
  companyName: string
  projectId?: string | null
  projectName?: string | null
  lastLoginAt?: string | null
}

export interface ForgotPasswordRequest {
  email: string
}

export interface ResetPasswordRequest {
  token: string
  password: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

export interface UpdateProfileRequest {
  fullName: string
  phone: string
  email: string
}

export interface RefreshTokenRequest {
  refreshToken: string
}

export const authApi = {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/auth/login', credentials)
    return response.data
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout')
    } catch (error) {
      // Log but don't throw - logout should always succeed client-side
      logger.warn('Logout API call failed (non-critical)', { error })
    } finally {
      clearAuthStatusCookie()
    }
  },

  async refresh(): Promise<LoginResponse> {
    // Server reads refresh token from HttpOnly cookie
    const response = await apiClient.post<LoginResponse>('/auth/refresh', {})
    return response.data
  },

  async forgotPassword(data: ForgotPasswordRequest): Promise<void> {
    await apiClient.post('/auth/forgot-password', data)
  },

  async resetPassword(data: ResetPasswordRequest): Promise<void> {
    await apiClient.post('/auth/reset-password', data)
  },

  async changePassword(data: ChangePasswordRequest): Promise<LoginResponse['user']> {
    const response = await apiClient.post<{ message: string; user: LoginResponse['user'] }>(
      '/auth/change-password',
      data
    )
    return response.data.user
  },

  async updateProfile(data: UpdateProfileRequest): Promise<LoginResponse['user']> {
    const response = await apiClient.put<LoginResponse['user']>('/auth/profile', data)
    return response.data
  },

  async impersonate(userId: string): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>(`/auth/impersonate/${userId}`)
    return response.data
  },

  async stopImpersonation(): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/auth/stop-impersonation', {})
    return response.data
  },

  async getAllAdmins(search?: string): Promise<AdminListItem[]> {
    const params = search ? { search } : {}
    const response = await apiClient.get<AdminListItem[]>('/users/all-admins', { params })
    return response.data
  },
}


import apiClient from './client'

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
    } catch {
      // Ignore errors on logout
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token')
        localStorage.removeItem('refreshToken')
        localStorage.removeItem('tokenExpiresAt')
        localStorage.removeItem('user')
      }
    }
  },

  async refresh(refreshToken: string): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/auth/refresh', { refreshToken })
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

  async getAllAdmins(search?: string): Promise<AdminListItem[]> {
    const params = search ? { search } : {}
    const response = await apiClient.get<AdminListItem[]>('/users/all-admins', { params })
    return response.data
  },
}


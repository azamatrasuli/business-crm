import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi, type LoginResponse } from '@/lib/api/auth'

export interface User {
  id: string
  fullName: string
  phone: string
  email: string
  role: string
  status: string
  companyId: string
  // Project info
  projectId?: string | null
  projectName?: string | null
  isHeadquarters: boolean
  permissions: string[]
}

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  companyId: string | null
  projectId: string | null
  projectName: string | null
  isHeadquarters: boolean
  
  // Actions
  login: (phone: string, password: string) => Promise<User>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
  updateProfile: (data: { fullName: string; phone: string; email: string }) => Promise<User>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  hasPermission: (permission: string) => boolean
  initialize: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: true,
      isAuthenticated: false,
      companyId: null,
      projectId: null,
      projectName: null,
      isHeadquarters: false,

      initialize: async () => {
        try {
          // Check if we have a token in localStorage
          if (typeof window !== 'undefined') {
            const token = localStorage.getItem('token')
            const userStr = localStorage.getItem('user')
            
            if (token && userStr) {
              try {
                const user = JSON.parse(userStr) as User
                const expiresAt = localStorage.getItem('tokenExpiresAt')
                
                // Check if token is expired
                if (expiresAt && parseInt(expiresAt) < Date.now()) {
                  // Token expired, clear everything
                  localStorage.removeItem('token')
                  localStorage.removeItem('user')
                  localStorage.removeItem('tokenExpiresAt')
                  localStorage.removeItem('refreshToken')
                  
                  set({ 
                    user: null, 
                    isAuthenticated: false, 
                    isLoading: false,
                    companyId: null,
                    projectId: null,
                    projectName: null,
                    isHeadquarters: false,
                  })
                  return
                }
                
                // Token is valid, restore user state
                // Also set cookie for middleware
                document.cookie = `token=${token}; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`
                
                set({
                  user,
                  isAuthenticated: true,
                  isLoading: false,
                  companyId: user.companyId,
                  projectId: user.projectId || null,
                  projectName: user.projectName || null,
                  isHeadquarters: user.isHeadquarters || false,
                })
              } catch (error) {
                console.error('Error parsing user data:', error)
                localStorage.removeItem('token')
                localStorage.removeItem('user')
                localStorage.removeItem('tokenExpiresAt')
                localStorage.removeItem('refreshToken')
                
                set({ 
                  user: null, 
                  isAuthenticated: false, 
                  isLoading: false,
                  companyId: null,
                  projectId: null,
                  projectName: null,
                  isHeadquarters: false,
                })
              }
            } else {
              set({ 
                user: null, 
                isAuthenticated: false, 
                isLoading: false,
                companyId: null,
                projectId: null,
                projectName: null,
                isHeadquarters: false,
              })
            }
          }
        } catch (error) {
          console.error('Auth initialization error:', error)
          set({ 
            user: null, 
            isAuthenticated: false, 
            isLoading: false,
            companyId: null,
            projectId: null,
            projectName: null,
            isHeadquarters: false,
          })
        }
      },

      login: async (phone: string, password: string) => {
        set({ isLoading: true })

        try {
          // Ensure phone is in correct format (with + prefix if not present)
          const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`
          
          // Sign in with backend API
          const response: LoginResponse = await authApi.login({
            phone: formattedPhone,
            password,
          })

          if (!response.user) {
            throw new Error('No user data returned')
          }

          if (response.user.status === 'Заблокирован') {
            throw new Error('Пользователь заблокирован')
          }

          // Store token and user data
          if (typeof window !== 'undefined') {
            localStorage.setItem('token', response.token)
            if (response.refreshToken) {
              localStorage.setItem('refreshToken', response.refreshToken)
            }
            if (response.expiresAt) {
              localStorage.setItem('tokenExpiresAt', response.expiresAt.toString())
            }
            localStorage.setItem('user', JSON.stringify(response.user))
            
            // Set token in cookie for middleware
            document.cookie = `token=${response.token}; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`
          }

          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
            companyId: response.user.companyId,
            projectId: response.user.projectId || null,
            projectName: response.user.projectName || null,
            isHeadquarters: response.user.isHeadquarters || false,
          })

          return response.user
        } catch (error) {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            companyId: null,
            projectId: null,
            projectName: null,
            isHeadquarters: false,
          })
          throw error
        }
      },

      logout: async () => {
        try {
          await authApi.logout()
        } catch (error) {
          console.error('Logout error:', error)
        } finally {
          // Clear local storage and cookie
          if (typeof window !== 'undefined') {
            localStorage.removeItem('token')
            localStorage.removeItem('user')
            localStorage.removeItem('tokenExpiresAt')
            localStorage.removeItem('refreshToken')
            // Remove token cookie
            document.cookie = 'token=; path=/; max-age=0'
          }
          
          set({
            user: null,
            isAuthenticated: false,
            companyId: null,
            projectId: null,
            projectName: null,
            isHeadquarters: false,
          })
        }
      },

      refreshSession: async () => {
        if (typeof window === 'undefined') return
        
        const refreshToken = localStorage.getItem('refreshToken')
        if (!refreshToken) {
          // No refresh token, clear auth state
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          localStorage.removeItem('tokenExpiresAt')
          document.cookie = 'token=; path=/; max-age=0'
          
          set({
            user: null,
            isAuthenticated: false,
            companyId: null,
            projectId: null,
            projectName: null,
            isHeadquarters: false,
          })
          return
        }

        try {
          const response = await authApi.refresh(refreshToken)
          
          if (!response.user) {
            throw new Error('No user data returned')
          }

          // Store new tokens
          localStorage.setItem('token', response.token)
          if (response.refreshToken) {
            localStorage.setItem('refreshToken', response.refreshToken)
          }
          if (response.expiresAt) {
            localStorage.setItem('tokenExpiresAt', response.expiresAt.toString())
          }
          localStorage.setItem('user', JSON.stringify(response.user))
          
          // Update cookie for middleware
          document.cookie = `token=${response.token}; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`

          set({
            user: response.user,
            isAuthenticated: true,
            companyId: response.user.companyId,
            projectId: response.user.projectId || null,
            projectName: response.user.projectName || null,
            isHeadquarters: response.user.isHeadquarters || false,
          })
        } catch (error) {
          console.error('Token refresh failed:', error)
          
          // Clear all auth data on refresh failure
          localStorage.removeItem('token')
          localStorage.removeItem('refreshToken')
          localStorage.removeItem('tokenExpiresAt')
          localStorage.removeItem('user')
          document.cookie = 'token=; path=/; max-age=0'
          
          set({
            user: null,
            isAuthenticated: false,
            companyId: null,
            projectId: null,
            projectName: null,
            isHeadquarters: false,
          })
        }
      },

      updateProfile: async (data) => {
        const { user } = get()
        
        if (!user) throw new Error('Not authenticated')

        try {
          const updatedUser = await authApi.updateProfile(data)
          
          // Update local storage
          if (typeof window !== 'undefined') {
            localStorage.setItem('user', JSON.stringify(updatedUser))
          }

          set({ user: updatedUser })
          return updatedUser
        } catch (error) {
          throw error
        }
      },

      changePassword: async (currentPassword: string, newPassword: string) => {
        const { user } = get()
        
        if (!user) throw new Error('Not authenticated')

        try {
          await authApi.changePassword({
            currentPassword,
            newPassword,
          })
        } catch (error) {
          throw error
        }
      },

      hasPermission: (permission: string): boolean => {
        const { user } = get()
        if (!user) return false
        if (user.permissions.includes('*')) return true
        return user.permissions.includes(permission)
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        companyId: state.companyId,
        projectId: state.projectId,
        projectName: state.projectName,
        isHeadquarters: state.isHeadquarters,
      }),
    }
  )
)

// Initialize auth on app load
if (typeof window !== 'undefined') {
  useAuthStore.getState().initialize()
}


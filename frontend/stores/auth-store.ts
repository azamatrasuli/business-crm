import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi, type LoginResponse, type AdminListItem } from '@/lib/api/auth'

export interface User {
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

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  companyId: string | null
  projectId: string | null
  projectName: string | null
  isHeadquarters: boolean
  
  // Impersonation state
  isImpersonating: boolean
  impersonatedBy: string | null
  originalToken: string | null
  originalUser: User | null
  
  // Admin list for impersonation (cached)
  allAdmins: AdminListItem[]
  adminsLoading: boolean
  
  // Actions
  login: (phone: string, password: string) => Promise<User>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
  updateProfile: (data: { fullName: string; phone: string; email: string }) => Promise<User>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  hasPermission: (permission: string) => boolean
  initialize: () => Promise<void>
  
  // Impersonation actions
  impersonate: (userId: string) => Promise<void>
  stopImpersonating: () => Promise<void>
  fetchAllAdmins: (search?: string) => Promise<AdminListItem[]>
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
      
      // Impersonation state
      isImpersonating: false,
      impersonatedBy: null,
      originalToken: null,
      originalUser: null,
      
      // Admin list
      allAdmins: [],
      adminsLoading: false,

      initialize: async () => {
        try {
          // Check if we have a token in localStorage
          if (typeof window !== 'undefined') {
            const token = localStorage.getItem('token')
            const userStr = localStorage.getItem('user')
            const originalTokenStr = localStorage.getItem('originalToken')
            const originalUserStr = localStorage.getItem('originalUser')
            
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
                  localStorage.removeItem('originalToken')
                  localStorage.removeItem('originalUser')
                  
                  set({ 
                    user: null, 
                    isAuthenticated: false, 
                    isLoading: false,
                    companyId: null,
                    projectId: null,
                    projectName: null,
                    isHeadquarters: false,
                    isImpersonating: false,
                    impersonatedBy: null,
                    originalToken: null,
                    originalUser: null,
                  })
                  return
                }
                
                // Check if we're in impersonation mode
                const isImpersonating = !!originalTokenStr
                let originalUser: User | null = null
                if (originalUserStr) {
                  try {
                    originalUser = JSON.parse(originalUserStr) as User
                  } catch {
                    // Ignore parse errors
                  }
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
                  isImpersonating,
                  originalToken: originalTokenStr || null,
                  originalUser,
                })
              } catch (error) {
                console.error('Error parsing user data:', error)
                localStorage.removeItem('token')
                localStorage.removeItem('user')
                localStorage.removeItem('tokenExpiresAt')
                localStorage.removeItem('refreshToken')
                localStorage.removeItem('originalToken')
                localStorage.removeItem('originalUser')
                
                set({ 
                  user: null, 
                  isAuthenticated: false, 
                  isLoading: false,
                  companyId: null,
                  projectId: null,
                  projectName: null,
                  isHeadquarters: false,
                  isImpersonating: false,
                  impersonatedBy: null,
                  originalToken: null,
                  originalUser: null,
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
                isImpersonating: false,
                impersonatedBy: null,
                originalToken: null,
                originalUser: null,
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
            isImpersonating: false,
            impersonatedBy: null,
            originalToken: null,
            originalUser: null,
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
            isImpersonating: false,
            impersonatedBy: null,
            originalToken: null,
            originalUser: null,
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
            isImpersonating: false,
            impersonatedBy: null,
            originalToken: null,
            originalUser: null,
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
            localStorage.removeItem('originalToken')
            localStorage.removeItem('originalUser')
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
            isImpersonating: false,
            impersonatedBy: null,
            originalToken: null,
            originalUser: null,
            allAdmins: [],
          })
        }
      },

      refreshSession: async () => {
        if (typeof window === 'undefined') return
        
        const { isImpersonating, stopImpersonating } = get()
        
        // If impersonating, don't try to refresh - return to original account
        // Impersonation tokens don't have refresh tokens for security
        if (isImpersonating) {
          console.log('Impersonation session expired, returning to original account')
          stopImpersonating()
          return
        }
        
        const refreshToken = localStorage.getItem('refreshToken')
        if (!refreshToken) {
          // No refresh token, clear auth state
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          localStorage.removeItem('tokenExpiresAt')
          localStorage.removeItem('originalToken')
          localStorage.removeItem('originalUser')
          document.cookie = 'token=; path=/; max-age=0'
          
          set({
            user: null,
            isAuthenticated: false,
            companyId: null,
            projectId: null,
            projectName: null,
            isHeadquarters: false,
            isImpersonating: false,
            impersonatedBy: null,
            originalToken: null,
            originalUser: null,
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
          localStorage.removeItem('originalToken')
          localStorage.removeItem('originalUser')
          document.cookie = 'token=; path=/; max-age=0'
          
          set({
            user: null,
            isAuthenticated: false,
            companyId: null,
            projectId: null,
            projectName: null,
            isHeadquarters: false,
            isImpersonating: false,
            impersonatedBy: null,
            originalToken: null,
            originalUser: null,
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

      // Impersonation actions
      impersonate: async (userId: string) => {
        const { user } = get()
        if (!user || user.role !== 'SUPER_ADMIN') {
          throw new Error('Only SUPER_ADMIN can impersonate other users')
        }

        try {
          // Save current token and user before impersonation
          const currentToken = localStorage.getItem('token')
          
          const response = await authApi.impersonate(userId)

          if (!response.user) {
            throw new Error('No user data returned')
          }

          // Store original token and user for later restoration
          if (typeof window !== 'undefined') {
            localStorage.setItem('originalToken', currentToken || '')
            localStorage.setItem('originalUser', JSON.stringify(user))
            
            // Set new token and user
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
          }

          set({
            user: response.user,
            companyId: response.user.companyId,
            projectId: response.user.projectId || null,
            projectName: response.user.projectName || null,
            isHeadquarters: response.user.isHeadquarters || false,
            isImpersonating: true,
            impersonatedBy: response.impersonatedBy || user.id,
            originalToken: currentToken,
            originalUser: user,
          })

          // Reload the page to apply new context
          if (typeof window !== 'undefined') {
            window.location.href = '/'
          }
        } catch (error) {
          console.error('Impersonation failed:', error)
          throw error
        }
      },

      stopImpersonating: async () => {
        const { originalToken, originalUser } = get()
        
        if (!originalToken || !originalUser) {
          console.error('No original token or user to restore')
          return
        }

        // Call API to log the end of impersonation (fire and forget - don't block on errors)
        try {
          await authApi.stopImpersonation()
        } catch (error) {
          console.warn('Failed to log stop impersonation:', error)
          // Continue anyway - the important thing is to restore the original token
        }

        if (typeof window !== 'undefined') {
          // Restore original token and user
          localStorage.setItem('token', originalToken)
          localStorage.setItem('user', JSON.stringify(originalUser))
          localStorage.removeItem('originalToken')
          localStorage.removeItem('originalUser')
          
          // Update cookie for middleware
          document.cookie = `token=${originalToken}; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`
        }

        set({
          user: originalUser,
          companyId: originalUser.companyId,
          projectId: originalUser.projectId || null,
          projectName: originalUser.projectName || null,
          isHeadquarters: originalUser.isHeadquarters || false,
          isImpersonating: false,
          impersonatedBy: null,
          originalToken: null,
          originalUser: null,
        })

        // Reload the page to apply original context
        if (typeof window !== 'undefined') {
          window.location.href = '/'
        }
      },

      fetchAllAdmins: async (search?: string) => {
        set({ adminsLoading: true })
        try {
          const admins = await authApi.getAllAdmins(search)
          set({ allAdmins: admins, adminsLoading: false })
          return admins
        } catch (error) {
          console.error('Failed to fetch admins:', error)
          set({ adminsLoading: false })
          throw error
        }
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
        isImpersonating: state.isImpersonating,
        impersonatedBy: state.impersonatedBy,
        originalToken: state.originalToken,
        originalUser: state.originalUser,
      }),
    }
  )
)

// Initialize auth on app load
if (typeof window !== 'undefined') {
  useAuthStore.getState().initialize()
}

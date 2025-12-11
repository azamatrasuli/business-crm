import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { authApi, type LoginResponse, type AdminListItem } from '@/lib/api/auth'
import { logger } from '@/lib/logger'
import {
  setAuthStatusCookie,
  clearAuthStatusCookie,
  hasAuthStatusCookie,
} from './utils/cookie-manager'

// Track hydration state for Safari compatibility
let isHydrated = false

// ============================================================================
// Types
// ============================================================================

export interface User {
  id: string
  fullName: string
  phone: string
  email: string
  role: string
  status: string
  companyId: string
  companyName?: string | null
  projectId?: string | null
  projectName?: string | null
  isHeadquarters: boolean
  projectServiceTypes?: string[] | null
  permissions: string[]
}

interface AuthState {
  // User data
  user: User | null
  isAuthenticated: boolean

  // Loading states
  isLoading: boolean
  isInitializing: boolean

  // Hydration state - important for Safari!
  _hasHydrated: boolean

  // Derived user context
  companyId: string | null
  projectId: string | null
  projectName: string | null
  isHeadquarters: boolean
  projectServiceTypes: string[] | null

  // Impersonation
  isImpersonating: boolean
  impersonatedBy: string | null
  originalUser: User | null

  // Admin list for impersonation
  allAdmins: AdminListItem[]
  adminsLoading: boolean
}

interface AuthActions {
  initialize: () => Promise<void>
  login: (phone: string, password: string) => Promise<User>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
  updateProfile: (data: { fullName: string; phone: string; email: string }) => Promise<User>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  hasPermission: (permission: string) => boolean
  impersonate: (userId: string) => Promise<void>
  stopImpersonating: () => Promise<void>
  fetchAllAdmins: (search?: string) => Promise<AdminListItem[]>
}

type AuthStore = AuthState & AuthActions

// ============================================================================
// Initial State
// ============================================================================

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isInitializing: true,
  _hasHydrated: false,
  companyId: null,
  projectId: null,
  projectName: null,
  isHeadquarters: false,
  projectServiceTypes: null,
  isImpersonating: false,
  impersonatedBy: null,
  originalUser: null,
  allAdmins: [],
  adminsLoading: false,
}

// ============================================================================
// Helper Functions
// ============================================================================

function extractUserContext(user: User) {
  return {
    companyId: user.companyId,
    projectId: user.projectId || null,
    projectName: user.projectName || null,
    isHeadquarters: user.isHeadquarters || false,
    projectServiceTypes: user.projectServiceTypes || null,
  }
}

function clearAuthState(): Partial<AuthState> {
  return {
    user: null,
    isAuthenticated: false,
    companyId: null,
    projectId: null,
    projectName: null,
    isHeadquarters: false,
    projectServiceTypes: null,
    isImpersonating: false,
    impersonatedBy: null,
    originalUser: null,
  }
}

// ============================================================================
// Store
// ============================================================================

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      initialize: async () => {
        try {
          if (typeof window === 'undefined') {
            set({ isInitializing: false })
            return
          }

          const { user } = get()
          const hasValidCookie = hasAuthStatusCookie()

          if (user) {
            // User data exists in localStorage (restored by Zustand persist)
            // Trust localStorage over cookie - Safari ITP may block cookies
            // but localStorage should work
            if (!hasValidCookie) {
              // Re-set the cookie in case Safari cleared it
              setAuthStatusCookie()
            }
            set({ isInitializing: false, isAuthenticated: true })
          } else if (hasValidCookie) {
            // Cookie exists but no user data - try to refresh session
            // This shouldn't happen normally, but handle it gracefully
            clearAuthStatusCookie()
            set({ ...clearAuthState(), isInitializing: false })
          } else {
            // No user data and no cookie - not authenticated
            set({ ...clearAuthState(), isInitializing: false })
          }
        } catch (error) {
          logger.error('Auth initialization error', error instanceof Error ? error : new Error(String(error)))
          set({ ...clearAuthState(), isInitializing: false })
        }
      },

      login: async (phone: string, password: string) => {
        set({ isLoading: true })

        try {
          const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`
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

          setAuthStatusCookie()

          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
            ...extractUserContext(response.user),
            isImpersonating: false,
            impersonatedBy: null,
            originalUser: null,
          })

          return response.user
        } catch (error) {
          set({ ...clearAuthState(), isLoading: false })
          throw error
        }
      },

      logout: async () => {
        try {
          await authApi.logout()
        } catch (error) {
          logger.warn('Logout error (non-critical)', { error })
        } finally {
          clearAuthStatusCookie()
          set({ ...clearAuthState(), allAdmins: [] })
        }
      },

      refreshSession: async () => {
        if (typeof window === 'undefined') return

        const { isImpersonating, stopImpersonating } = get()

        if (isImpersonating) {
          logger.info('Impersonation session expired, returning to original account')
          stopImpersonating()
          return
        }

        try {
          const response = await authApi.refresh()

          if (!response.user) {
            throw new Error('No user data returned')
          }

          setAuthStatusCookie()

          set({
            user: response.user,
            isAuthenticated: true,
            ...extractUserContext(response.user),
          })
        } catch (error) {
          logger.error('Token refresh failed', error instanceof Error ? error : new Error(String(error)))
          clearAuthStatusCookie()
          set(clearAuthState())
        }
      },

      updateProfile: async (data) => {
        const { user } = get()
        if (!user) throw new Error('Not authenticated')

        const updatedUser = await authApi.updateProfile(data)
        set({ user: updatedUser })
        return updatedUser
      },

      changePassword: async (currentPassword: string, newPassword: string) => {
        const { user } = get()
        if (!user) throw new Error('Not authenticated')

        await authApi.changePassword({ currentPassword, newPassword })
      },

      hasPermission: (permission: string): boolean => {
        const { user } = get()
        if (!user) return false
        if (user.permissions.includes('*')) return true
        return user.permissions.includes(permission)
      },

      impersonate: async (userId: string) => {
        const { user } = get()
        if (!user || user.role !== 'SUPER_ADMIN') {
          throw new Error('Only SUPER_ADMIN can impersonate other users')
        }

        try {
          const response = await authApi.impersonate(userId)

          if (!response.user) {
            throw new Error('No user data returned')
          }

          setAuthStatusCookie()

          set({
            user: response.user,
            ...extractUserContext(response.user),
            isImpersonating: true,
            impersonatedBy: response.impersonatedBy || user.id,
            originalUser: user,
          })

          if (typeof window !== 'undefined') {
            window.location.href = '/'
          }
        } catch (error) {
          logger.error('Impersonation failed', error instanceof Error ? error : new Error(String(error)))
          throw error
        }
      },

      stopImpersonating: async () => {
        try {
          // Backend returns fresh tokens and user data for the original user
          const response = await authApi.stopImpersonation()

          if (!response.user) {
            throw new Error('No user data returned')
          }

          setAuthStatusCookie()

          set({
            user: response.user,
            ...extractUserContext(response.user),
            isImpersonating: false,
            impersonatedBy: null,
            originalUser: null,
          })

          if (typeof window !== 'undefined') {
            window.location.href = '/'
          }
        } catch (error) {
          logger.error('Failed to stop impersonation', error instanceof Error ? error : new Error(String(error)))
          // Fallback: clear auth state and redirect to login
          clearAuthStatusCookie()
          set(clearAuthState())
          if (typeof window !== 'undefined') {
            window.location.href = '/login'
          }
        }
      },

      fetchAllAdmins: async (search?: string) => {
        set({ adminsLoading: true })
        try {
          const admins = await authApi.getAllAdmins(search)
          set({ allAdmins: admins, adminsLoading: false })
          return admins
        } catch (error) {
          logger.error('Failed to fetch admins', error instanceof Error ? error : new Error(String(error)))
          set({ adminsLoading: false })
          throw error
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist essential data
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        companyId: state.companyId,
        projectId: state.projectId,
        projectName: state.projectName,
        isHeadquarters: state.isHeadquarters,
        projectServiceTypes: state.projectServiceTypes,
        isImpersonating: state.isImpersonating,
        impersonatedBy: state.impersonatedBy,
        originalUser: state.originalUser,
      }),
      // Called when hydration is complete - IMPORTANT for Safari!
      onRehydrateStorage: () => (state, error) => {
        isHydrated = true
        if (error) {
          logger.error('Zustand hydration error', error instanceof Error ? error : new Error(String(error)))
          return
        }
        // Update store with hydration complete flag
        useAuthStore.setState({ _hasHydrated: true })
        if (state?.user && state?.isAuthenticated) {
          // Sync cookie with restored state after hydration
          setAuthStatusCookie()
        }
      },
    }
  )
)

// Export hydration check for components
export const getIsHydrated = () => isHydrated

// DO NOT call initialize() here - it causes race condition with persist!
// Initialize is called from AuthProvider after hydration

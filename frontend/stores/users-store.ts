import { create } from 'zustand'
import { usersApi, type User, type CreateUserRequest, type UpdateUserRequest } from '@/lib/api/users'
import { getErrorMessage } from './utils'

interface UsersState {
  users: User[]
  selectedUser: User | null
  availableRoutes: string[]
  isLoading: boolean
  error: string | null
  total: number
  currentPage: number
  totalPages: number
  pageSize: number
  showAll: boolean

  // Actions
  fetchUsers: (page?: number) => Promise<void>
  setShowAll: (value: boolean) => void
  fetchUser: (id: string) => Promise<User>
  createUser: (data: CreateUserRequest) => Promise<User>
  updateUser: (id: string, data: UpdateUserRequest) => Promise<User>
  deleteUser: (id: string) => Promise<void>
  selectUser: (user: User | null) => void
  fetchAvailableRoutes: () => Promise<void>
}

export const useUsersStore = create<UsersState>((set, get) => ({
  users: [],
  selectedUser: null,
  availableRoutes: [],
  isLoading: false,
  error: null,
  total: 0,
  currentPage: 1,
  totalPages: 1,
  pageSize: 20,
  showAll: false,

  fetchUsers: async (page = 1) => {
    set({ isLoading: true, error: null })
    
    try {
      const { pageSize, showAll } = get()
      // If showAll is true, fetch all records
      const effectivePageSize = showAll ? 10000 : pageSize
      const effectivePage = showAll ? 1 : page
      const response = await usersApi.getUsers(effectivePage, effectivePageSize)
      set({
        users: response.items,
        total: response.total,
        currentPage: response.page,
        totalPages: response.totalPages,
        isLoading: false,
      })
    } catch (error) {
      set({ error: getErrorMessage(error), isLoading: false })
    }
  },

  fetchUser: async (id: string) => {
    set({ isLoading: true, error: null })
    
    try {
      const user = await usersApi.getUserById(id)
      set({ selectedUser: user, isLoading: false })
      return user
    } catch (error) {
      set({ error: getErrorMessage(error), isLoading: false })
      throw error
    }
  },

  createUser: async (data: CreateUserRequest) => {
    set({ isLoading: true, error: null })
    
    try {
      const newUser = await usersApi.createUser(data)
      await get().fetchUsers(get().currentPage)
      set({ isLoading: false })
      return newUser
    } catch (error) {
      set({ error: getErrorMessage(error), isLoading: false })
      throw error
    }
  },

  updateUser: async (id: string, data: UpdateUserRequest) => {
    set({ isLoading: true, error: null })
    
    try {
      const updated = await usersApi.updateUser(id, data)
      await get().fetchUsers(get().currentPage)
      set({ isLoading: false })
      return updated
    } catch (error) {
      set({ error: getErrorMessage(error), isLoading: false })
      throw error
    }
  },

  deleteUser: async (id: string) => {
    set({ isLoading: true, error: null })
    
    try {
      await usersApi.deleteUser(id)
      await get().fetchUsers(get().currentPage)
      set({ isLoading: false })
    } catch (error) {
      set({ error: getErrorMessage(error), isLoading: false })
      throw error
    }
  },

  selectUser: (user) => {
    set({ selectedUser: user })
  },

  setShowAll: (value: boolean) => {
    set({ showAll: value })
  },

  fetchAvailableRoutes: async () => {
    try {
      const routes = await usersApi.getAvailableRoutes()
      set({ availableRoutes: routes })
    } catch (error) {
      set({ error: getErrorMessage(error) })
    }
  },
}))

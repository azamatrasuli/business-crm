import { create } from 'zustand'
import { usersApi, type User, type CreateUserRequest, type UpdateUserRequest } from '@/lib/api/users'

interface UsersState {
  users: User[]
  selectedUser: User | null
  availableRoutes: string[]
  loading: boolean
  error: string | null
  total: number
  currentPage: number
  totalPages: number
  pageSize: number

  // Actions
  fetchUsers: (page?: number) => Promise<void>
  fetchUser: (id: string) => Promise<User>
  createUser: (data: CreateUserRequest) => Promise<User>
  updateUser: (id: string, data: UpdateUserRequest) => Promise<User>
  deleteUser: (id: string) => Promise<void>
  selectUser: (user: User | null) => void
  fetchAvailableRoutes: () => Promise<void>
}

const getErrorMessage = (error: unknown, fallback = 'Произошла ошибка') => {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  return fallback
}

export const useUsersStore = create<UsersState>((set, get) => ({
  users: [],
  selectedUser: null,
  availableRoutes: [],
  loading: false,
  error: null,
  total: 0,
  currentPage: 1,
  totalPages: 1,
  pageSize: 20,

  fetchUsers: async (page = 1) => {
    set({ loading: true, error: null })
    
    try {
      const { pageSize } = get()
      const response = await usersApi.getUsers(page, pageSize)
      set({
        users: response.items,
        total: response.total,
        currentPage: response.page,
        totalPages: response.totalPages,
        loading: false,
      })
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
    }
  },

  fetchUser: async (id: string) => {
    set({ loading: true, error: null })
    
    try {
      const user = await usersApi.getUserById(id)
      set({ selectedUser: user, loading: false })
      return user
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  createUser: async (data: CreateUserRequest) => {
    set({ loading: true, error: null })
    
    try {
      const newUser = await usersApi.createUser(data)
      await get().fetchUsers(get().currentPage)
      set({ loading: false })
      return newUser
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  updateUser: async (id: string, data: UpdateUserRequest) => {
    set({ loading: true, error: null })
    
    try {
      const updated = await usersApi.updateUser(id, data)
      await get().fetchUsers(get().currentPage)
      set({ loading: false })
      return updated
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  deleteUser: async (id: string) => {
    set({ loading: true, error: null })
    
    try {
      await usersApi.deleteUser(id)
      await get().fetchUsers(get().currentPage)
      set({ loading: false })
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  selectUser: (user) => {
    set({ selectedUser: user })
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

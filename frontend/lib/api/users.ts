import apiClient from './client'

export interface User {
  id: string
  fullName: string
  phone: string
  email: string
  role: string
  status: string
  permissions?: string[]
}

export interface CreateUserRequest {
  fullName: string
  phone: string
  email: string
  role: string
  password: string
  permissions: string[]
}

export interface UpdateUserRequest {
  fullName: string
  phone: string
  email: string
  role: string
  status: string
  permissions: string[]
}

export interface UsersResponse {
  items: User[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export const usersApi = {
  async getUsers(page: number = 1, pageSize: number = 20): Promise<UsersResponse> {
    const response = await apiClient.get<UsersResponse>('/users', {
      params: { page, pageSize },
    })
    return response.data
  },

  async getUserById(id: string): Promise<User> {
    const response = await apiClient.get<User>(`/users/${id}`)
    return response.data
  },

  async createUser(data: CreateUserRequest): Promise<User> {
    const response = await apiClient.post<User>('/users', data)
    return response.data
  },

  async updateUser(id: string, data: UpdateUserRequest): Promise<User> {
    const response = await apiClient.put<User>(`/users/${id}`, data)
    return response.data
  },

  async deleteUser(id: string): Promise<void> {
    await apiClient.delete(`/users/${id}`)
  },

  async getAvailableRoutes(): Promise<string[]> {
    const response = await apiClient.get<string[]>('/users/permissions/routes')
    return response.data
  },
}


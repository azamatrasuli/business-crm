import apiClient from './client'

export interface DashboardStats {
  totalBudget: number
  forecast: number
  totalOrders: number
  activeOrders: number
  pausedOrders: number
  guestOrders: number
  activeGuestOrders: number
  pausedGuestOrders: number
}

export type ComboType = 'Комбо 25' | 'Комбо 35'

export type ServiceType = 'LUNCH' | 'COMPENSATION'

export interface Order {
  id: string
  employeeId?: string | null
  employeeName: string
  employeePhone: string | null
  date: string
  status: string
  // Address comes from project (immutable)
  address: string
  projectId?: string | null
  projectName?: string | null
  comboType?: string
  amount: number
  type: string // 'Сотрудник' | 'Гость'
  // Service type fields
  serviceType?: ServiceType | null
  compensationAmount?: number | null // actual spent amount for past orders
  compensationLimit?: number | null // allocated daily limit for future orders
  restaurantName?: string | null // for compensation transactions
}

export interface CreateGuestOrderRequest {
  orderName: string
  quantity: number
  comboType: ComboType
  projectId: string // Автоматически из проекта пользователя, адрес доставки берётся из проекта
  date: string
}

export interface AssignMealsRequest {
  employeeIds: string[]
  date: string
  comboType: ComboType
  // NOTE: Address comes from each employee's project (immutable)
}

export interface BulkActionRequest {
  orderIds: string[]
  action: 'pause' | 'resume' | 'cancel'
  // NOTE: changeAddress removed - address is immutable per project
}

export interface UpdateSubscriptionRequest {
  comboType?: ComboType
  // NOTE: Address cannot be changed - it comes from employee's project
}

export interface BulkUpdateSubscriptionRequest {
  employeeIds: string[]
  comboType?: ComboType
  // NOTE: Address cannot be changed - it comes from employee's project
}

export interface OrdersResponse {
  items: Order[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export const homeApi = {
  async getDashboard(): Promise<DashboardStats> {
    const response = await apiClient.get<DashboardStats>('/home/dashboard')
    return response.data
  },

  async getOrders(
    page: number = 1,
    pageSize: number = 20,
    search?: string,
    status?: string,
    date?: string,
    projectId?: string,
    type?: string
  ): Promise<OrdersResponse> {
    const params: Record<string, string | number> = { page, pageSize }
    if (search) params.search = search
    if (status) params.status = status
    if (date) params.date = date
    if (projectId) params.projectId = projectId
    if (type) params.type = type

    const response = await apiClient.get<OrdersResponse>('/home/orders', { params })
    return response.data
  },

  async createGuestOrder(data: CreateGuestOrderRequest): Promise<void> {
    await apiClient.post('/home/guest-orders', data)
  },

  async assignMeals(data: AssignMealsRequest): Promise<void> {
    await apiClient.post('/home/assign-meals', data)
  },

  async bulkAction(data: BulkActionRequest): Promise<void> {
    await apiClient.post('/home/bulk-action', data)
  },

  async updateSubscription(employeeId: string, data: UpdateSubscriptionRequest): Promise<void> {
    await apiClient.put(`/home/subscriptions/${employeeId}`, data)
  },

  async bulkUpdateSubscription(data: BulkUpdateSubscriptionRequest): Promise<void> {
    await apiClient.post('/home/subscriptions/bulk', data)
  },

  async getCutoffTime(): Promise<{ time: string }> {
    const response = await apiClient.get<{ time: string }>('/home/cutoff-time')
    return response.data
  },

  async updateCutoffTime(time: string): Promise<void> {
    await apiClient.put('/home/cutoff-time', { time })
  },
}


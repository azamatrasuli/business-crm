import apiClient from './client'

export type ShiftType = 'DAY' | 'NIGHT'
export type ServiceType = 'LUNCH' | 'COMPENSATION'
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0 = Sunday, 1 = Monday, etc.

export interface Employee {
  id: string
  fullName: string
  phone: string
  position: string
  totalBudget: number
  dailyLimit: number
  mealStatus: string
  mealPlan?: string | null
  inviteStatus: string
  isActive: boolean
  creationScenario?: 'new_user' | 'existing_client_user'
  // Project info
  projectId?: string | null
  projectName?: string | null
  // Address from project (immutable)
  addressName?: string | null
  addressFullAddress?: string | null
  // Work schedule
  shiftType?: ShiftType | null
  workingDays?: DayOfWeek[] // e.g., [1, 2, 3, 4, 5] = Mon-Fri
  workStartTime?: string | null // e.g., "09:00"
  workEndTime?: string | null // e.g., "18:00"
  // Service info (attached to employee, not project)
  serviceType?: ServiceType | null
  canSwitchToCompensation?: boolean // false if has active lunch subscription
  canSwitchToLunch?: boolean // false if has active compensation
  switchToCompensationBlockedReason?: string | null // Reason with expiry date
  switchToLunchBlockedReason?: string | null // Reason for blocking
  activeLunchSubscriptionId?: string | null
  activeCompensationId?: string | null
  // Active service summary (for list view)
  lunchSubscription?: {
    id: string
    comboType: string
    startDate: string
    endDate: string
    scheduleType: 'EVERY_DAY' | 'EVERY_OTHER_DAY' | 'CUSTOM'
    customDays?: string[]
    status: string
    totalPrice?: number
    remainingDays?: number
    totalDays?: number
    futureOrdersCount?: number
    completedOrdersCount?: number
  } | null
  compensation?: {
    id: string
    totalBudget: number
    dailyLimit: number
    startDate: string
    endDate: string
    status: string
    usedAmount: number
    carryOver?: boolean
    autoRenew?: boolean
  } | null
}

export interface EmployeeDetail extends Employee {
  email?: string
  budget?: {
    totalBudget: number
    dailyLimit: number
    period: string
    autoRenew: boolean
  } | null
  order?: {
    status: string
    type?: string
  } | null
  // Active subscriptions details (extends base Employee fields)
  lunchSubscription?: {
    id: string
    comboType: string
    startDate: string
    endDate: string
    scheduleType: 'EVERY_DAY' | 'EVERY_OTHER_DAY' | 'CUSTOM'
    customDays?: string[]
    status: string
    totalPrice?: number
    remainingDays?: number
    totalDays?: number
    futureOrdersCount?: number
    completedOrdersCount?: number
  } | null
  compensation?: {
    id: string
    totalBudget: number
    dailyLimit: number
    startDate: string
    endDate: string
    carryOver: boolean
    autoRenew: boolean
    status: string
    usedAmount: number
    spent?: number // alias for usedAmount
  } | null
}

export interface CreateEmployeeRequest {
  fullName: string
  phone: string
  email: string
  position?: string
  projectId?: string // Required by backend
  serviceType?: ServiceType
  shiftType?: ShiftType
  workingDays?: DayOfWeek[]
  workStartTime?: string
  workEndTime?: string
}

export type CreateEmployeeResponse = Employee & {
  creationScenario?: 'new_user' | 'existing_client_user'
}

export interface UpdateEmployeeRequest {
  fullName?: string
  email?: string
  position?: string
  // Service type (attached to employee)
  serviceType?: ServiceType | null
  // Work schedule
  shiftType?: ShiftType | null
  workingDays?: DayOfWeek[]
  workStartTime?: string | null // e.g., "09:00"
  workEndTime?: string | null // e.g., "18:00"
}

export interface UpdateBudgetRequest {
  totalBudget: number
  period: string
  dailyLimit: number
  autoRenew: boolean
}

export interface EmployeesResponse {
  items: Employee[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface EmployeeOrder {
  id: string
  date?: string
  type?: string // Сотрудник / Гость
  status?: string // Активен / На паузе / Завершен / Заморожен
  amount?: number
  // Расширенные поля (как на Dashboard)
  serviceType?: 'LUNCH' | 'COMPENSATION' | null
  // Для ланча
  comboType?: string // Комбо 25 / Комбо 35
  address?: string // Адрес доставки
  scheduleType?: 'EVERY_DAY' | 'EVERY_OTHER_DAY' | 'CUSTOM' | null
  // Для компенсации
  compensationLimit?: number // Дневной лимит
  compensationSpent?: number // Потрачено
  restaurantName?: string // Название ресторана
  // Дополнительно
  subscriptionId?: string
  compensationId?: string
}

export interface EmployeeOrdersResponse {
  items: EmployeeOrder[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export const employeesApi = {
  async getEmployees(
    page: number = 1,
    pageSize: number = 20,
    search?: string,
    status?: string,
    inviteStatus?: string,
    orderStatus?: string,
    minBudget?: number,
    maxBudget?: number,
    hasSubscription?: boolean,
    mealStatus?: string,
    serviceType?: ServiceType
  ): Promise<EmployeesResponse> {
    const params: Record<string, string | number | boolean> = { page, pageSize }
    if (search) params.search = search
    if (status) params.status = status
    if (inviteStatus) params.inviteStatus = inviteStatus
    if (orderStatus) params.orderStatus = orderStatus
    if (minBudget !== undefined) params.minBudget = minBudget
    if (maxBudget !== undefined) params.maxBudget = maxBudget
    if (hasSubscription !== undefined) params.hasSubscription = hasSubscription
    if (mealStatus) params.mealStatus = mealStatus
    if (serviceType) params.serviceType = serviceType

    const response = await apiClient.get<EmployeesResponse>('/employees', { params })
    return response.data
  },

  async getEmployee(id: string): Promise<EmployeeDetail> {
    const response = await apiClient.get<EmployeeDetail>(`/employees/${id}`)
    return response.data
  },

  async createEmployee(data: CreateEmployeeRequest): Promise<CreateEmployeeResponse> {
    const response = await apiClient.post<CreateEmployeeResponse>('/employees', data)
    return response.data
  },

  async updateEmployee(id: string, data: UpdateEmployeeRequest): Promise<Employee> {
    const response = await apiClient.put<Employee>(`/employees/${id}`, data)
    return response.data
  },

  async toggleActivation(id: string): Promise<Employee> {
    const response = await apiClient.patch<Employee>(`/employees/${id}/activate`)
    return response.data
  },

  async updateBudget(id: string, data: UpdateBudgetRequest): Promise<void> {
    await apiClient.put(`/employees/${id}/budget`, data)
  },

  async getEmployeeOrders(
    id: string,
    page: number = 1,
    pageSize: number = 20,
    date?: string,
    status?: string,
    serviceType?: string
  ): Promise<EmployeeOrdersResponse> {
    const params: Record<string, string | number> = { page, pageSize }
    if (date) params.date = date
    if (status) params.status = status
    if (serviceType) params.serviceType = serviceType
    
    const response = await apiClient.get<EmployeeOrdersResponse>(`/employees/${id}/orders`, {
      params,
    })
    return response.data
  },
}


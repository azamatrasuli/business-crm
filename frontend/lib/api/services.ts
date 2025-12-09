import apiClient from './client'
import type { ServiceType, DayOfWeek } from './employees'

// ==================== LUNCH SUBSCRIPTION ====================

export type ScheduleType = 'EVERY_DAY' | 'EVERY_OTHER_DAY' | 'CUSTOM'
export type ComboType = 'Комбо 25' | 'Комбо 35'

export interface LunchSubscription {
  id: string
  employeeId: string
  comboType: ComboType
  startDate: string
  endDate: string
  scheduleType: ScheduleType
  customDays?: string[] // ISO date strings for custom schedule
  addressId?: string
  // Backend returns Russian statuses: "Активна", "Приостановлена", "Завершена"
  status: string
  totalDays: number
  // NOTE: Backend returns 'totalPrice', not 'totalAmount'
  totalPrice: number
  createdAt: string
  updatedAt: string
}

export interface CreateLunchSubscriptionRequest {
  employeeIds: string[] // supports bulk
  comboType: ComboType
  startDate: string
  endDate: string
  scheduleType: ScheduleType
  customDays?: string[]
  addressId?: string
}

export interface UpdateLunchSubscriptionRequest {
  comboType?: ComboType
  scheduleType?: ScheduleType
  customDays?: string[]
  addressId?: string
}

export interface LunchSubscriptionResponse {
  success: boolean
  subscriptions: LunchSubscription[]
  errors?: { employeeId: string; message: string }[]
}

// ==================== COMPENSATION ====================

export interface Compensation {
  id: string
  employeeId: string
  totalBudget: number
  dailyLimit: number
  startDate: string
  endDate: string
  carryOver: boolean
  autoRenew: boolean
  // Backend returns Russian statuses: "Активна", "Приостановлена", "Завершена"
  status: string
  usedAmount: number
  remainingAmount: number
  createdAt: string
  updatedAt: string
}

export interface CreateCompensationRequest {
  employeeIds: string[] // supports bulk
  dailyLimit: number
  startDate: string
  endDate: string
  carryOver?: boolean
  autoRenew?: boolean
}

export interface UpdateCompensationRequest {
  dailyLimit?: number
  carryOver?: boolean
  autoRenew?: boolean
}

export interface CompensationResponse {
  success: boolean
  compensations: Compensation[]
  errors?: { employeeId: string; message: string }[]
}

// ==================== SERVICE CHECK ====================

export interface ServiceAvailability {
  employeeId: string
  employeeName: string
  canAssignLunch: boolean
  canAssignCompensation: boolean
  currentService: ServiceType | null
  currentServiceEndDate?: string
  blockingReason?: string
}

// ==================== API ====================

export const servicesApi = {
  // ----- Lunch Subscriptions -----
  
  async createLunchSubscriptions(data: CreateLunchSubscriptionRequest): Promise<LunchSubscriptionResponse> {
    // Используем bulk endpoint потому что фронтенд отправляет employeeIds как массив
    const response = await apiClient.post<LunchSubscriptionResponse>('/subscriptions/bulk', data)
    return response.data
  },

  async updateLunchSubscription(id: string, data: UpdateLunchSubscriptionRequest): Promise<LunchSubscription> {
    const response = await apiClient.put<LunchSubscription>(`/subscriptions/${id}`, data)
    return response.data
  },

  async getLunchSubscription(id: string): Promise<LunchSubscription> {
    const response = await apiClient.get<LunchSubscription>(`/subscriptions/${id}`)
    return response.data
  },

  async cancelLunchSubscription(id: string): Promise<void> {
    await apiClient.delete(`/subscriptions/${id}`)
  },

  async pauseLunchSubscription(id: string): Promise<LunchSubscription> {
    // NOTE: Backend does not accept dates parameter - use freeze for date-specific pauses
    const response = await apiClient.post<LunchSubscription>(`/subscriptions/${id}/pause`)
    return response.data
  },

  async resumeLunchSubscription(id: string): Promise<LunchSubscription> {
    const response = await apiClient.post<LunchSubscription>(`/subscriptions/${id}/resume`)
    return response.data
  },

  // ----- Compensations -----

  async createCompensations(data: CreateCompensationRequest): Promise<CompensationResponse> {
    const response = await apiClient.post<CompensationResponse>('/compensations', data)
    return response.data
  },

  async updateCompensation(id: string, data: UpdateCompensationRequest): Promise<Compensation> {
    const response = await apiClient.put<Compensation>(`/compensations/${id}`, data)
    return response.data
  },

  async getCompensation(id: string): Promise<Compensation> {
    const response = await apiClient.get<Compensation>(`/compensations/${id}`)
    return response.data
  },

  async getEmployeeCompensation(employeeId: string): Promise<Compensation | null> {
    try {
      const response = await apiClient.get<Compensation>(`/employees/${employeeId}/compensation`)
      return response.data
    } catch {
      return null
    }
  },

  async cancelCompensation(id: string): Promise<void> {
    await apiClient.delete(`/compensations/${id}`)
  },

  // ----- Service Availability Check -----
  // NOTE: This endpoint does NOT exist on backend yet - implement before using!

  async checkServiceAvailability(employeeIds: string[]): Promise<ServiceAvailability[]> {
    // TODO: Backend endpoint /services/check-availability needs to be created
    const response = await apiClient.post<ServiceAvailability[]>('/services/check-availability', { employeeIds })
    return response.data
  },

  // ----- Bulk Operations -----

  async bulkPauseLunch(subscriptionIds: string[]): Promise<void> {
    // NOTE: Backend expects { SubscriptionIds } not { subscriptionIds }
    await apiClient.post('/subscriptions/bulk/pause', { SubscriptionIds: subscriptionIds })
  },

  async bulkResumeLunch(subscriptionIds: string[]): Promise<void> {
    // NOTE: Backend expects { SubscriptionIds } not { subscriptionIds }
    await apiClient.post('/subscriptions/bulk/resume', { SubscriptionIds: subscriptionIds })
  },

  async bulkCancelServices(employeeIds: string[], serviceType: ServiceType): Promise<void> {
    // TODO: Backend endpoint /services/bulk/cancel needs to be created
    await apiClient.post('/services/bulk/cancel', { employeeIds, serviceType })
  },
}


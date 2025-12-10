import apiClient from './client'
import type { ServiceType, DayOfWeek } from './employees'
import { logger } from '@/lib/logger'

// ==================== LUNCH SUBSCRIPTION ====================

export type ScheduleType = 'EVERY_DAY' | 'EVERY_OTHER_DAY' | 'CUSTOM'
export type ComboType = 'Комбо 25' | 'Комбо 35'

/**
 * Lunch subscription status type.
 * Backend returns Russian statuses:
 * - "Активна" - Active (operational, can receive orders)
 * - "Приостановлена" - Paused (temporarily, can be resumed)
 * - "Завершена" - Completed (permanently, cannot be resumed - must create new subscription)
 */
export type LunchSubscriptionStatus = 'Активна' | 'Приостановлена' | 'Завершена'

export interface LunchSubscription {
  id: string
  employeeId: string
  comboType: ComboType
  startDate: string
  endDate: string
  scheduleType: ScheduleType
  customDays?: string[] // ISO date strings for custom schedule

  // Address is now derived from Project (delivery_address_id is deprecated)
  projectId?: string
  projectName?: string
  deliveryAddress?: string

  /**
   * Subscription status (Russian):
   * - "Активна" - Active
   * - "Приостановлена" - Paused (temporary)
   * - "Завершена" - Completed (terminal state)
   */
  status: LunchSubscriptionStatus | string
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
  // NOTE: Address is derived from Employee's Project - no addressId needed
}

export interface UpdateLunchSubscriptionRequest {
  comboType?: ComboType
  scheduleType?: ScheduleType
  customDays?: string[]
  // NOTE: Address is derived from Employee's Project - cannot be changed here
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
    // NOTE: Backend does not accept dates parameter - subscription-level pause only
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
    } catch (error) {
      // Expected for employees without compensation - log for debugging only
      logger.debug('No compensation found for employee', { employeeId, error })
      return null
    }
  },

  async cancelCompensation(id: string): Promise<void> {
    await apiClient.delete(`/compensations/${id}`)
  },

  // ----- Service Availability Check -----

  /**
   * Check service availability for employees.
   * @throws Error - Backend endpoint not implemented yet
   * @deprecated This method is not yet available. Backend endpoint needs to be created first.
   */
  async checkServiceAvailability(_employeeIds: string[]): Promise<ServiceAvailability[]> {
    // FIXME: Backend endpoint /services/check-availability needs to be created
    // When implemented, remove this throw and uncomment the API call below:
    // const response = await apiClient.post<ServiceAvailability[]>('/services/check-availability', { employeeIds: _employeeIds })
    // return response.data
    throw new Error(
      '[API Not Implemented] checkServiceAvailability: Backend endpoint /services/check-availability does not exist. ' +
      'Please implement the backend endpoint before using this method.'
    )
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

  /**
   * Bulk cancel services for employees.
   * @throws Error - Backend endpoint not implemented yet
   * @deprecated This method is not yet available. Backend endpoint needs to be created first.
   */
  async bulkCancelServices(_employeeIds: string[], _serviceType: ServiceType): Promise<void> {
    // FIXME: Backend endpoint /services/bulk/cancel needs to be created
    // When implemented, remove this throw and uncomment the API call below:
    // await apiClient.post('/services/bulk/cancel', { employeeIds: _employeeIds, serviceType: _serviceType })
    throw new Error(
      '[API Not Implemented] bulkCancelServices: Backend endpoint /services/bulk/cancel does not exist. ' +
      'Please implement the backend endpoint before using this method.'
    )
  },
}


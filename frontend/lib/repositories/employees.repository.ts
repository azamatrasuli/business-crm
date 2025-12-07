/**
 * @fileoverview Employees Repository
 * Data access layer for employee entities.
 */

import type { AxiosInstance } from 'axios'
import {
  BaseRepository,
  type PaginationParams,
  type PaginatedResponse,
} from './base.repository'
import type {
  Employee,
  EmployeeDetail,
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  UpdateBudgetRequest,
} from '@/lib/api/employees'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface EmployeesFilterParams extends PaginationParams {
  status?: 'active' | 'inactive' | 'all'
  inviteStatus?: string
  serviceType?: 'LUNCH' | 'COMPENSATION'
  projectId?: string
}

export interface EmployeeOrder {
  id: string
  date: string
  comboType: string
  status: string
  price: number
}

// ═══════════════════════════════════════════════════════════════════════════════
// Repository
// ═══════════════════════════════════════════════════════════════════════════════

export class EmployeesRepository extends BaseRepository<
  Employee,
  CreateEmployeeRequest,
  UpdateEmployeeRequest
> {
  constructor(client: AxiosInstance) {
    super(client, '/employees')
  }

  /**
   * Get detailed employee info
   */
  async getDetail(id: string): Promise<EmployeeDetail> {
    const { data } = await this.client.get<EmployeeDetail>(`${this.endpoint}/${id}`)
    return data
  }

  /**
   * Toggle employee activation status
   */
  async toggleActivation(id: string): Promise<Employee> {
    const { data } = await this.client.patch<Employee>(`${this.endpoint}/${id}/activate`)
    return data
  }

  /**
   * Update employee budget
   */
  async updateBudget(id: string, dto: UpdateBudgetRequest): Promise<void> {
    await this.client.put(`${this.endpoint}/${id}/budget`, dto)
  }

  /**
   * Get employee orders
   */
  async getOrders(
    id: string,
    params?: { startDate?: string; endDate?: string; page?: number; pageSize?: number }
  ): Promise<PaginatedResponse<EmployeeOrder>> {
    const { data } = await this.client.get<PaginatedResponse<EmployeeOrder>>(
      `${this.endpoint}/${id}/orders`,
      { params }
    )
    return data
  }

  /**
   * Search employees by query
   */
  async search(query: string, limit = 10): Promise<Employee[]> {
    const { data } = await this.client.get<PaginatedResponse<Employee>>(this.endpoint, {
      params: { search: query, pageSize: limit },
    })
    return data.items
  }

  /**
   * Build query params with employee-specific filters
   */
  protected override buildQueryParams(
    params?: EmployeesFilterParams
  ): Record<string, unknown> {
    const base = super.buildQueryParams(params)

    if (!params) return base

    if (params.status && params.status !== 'all') {
      base.status = params.status
    }
    if (params.inviteStatus) {
      base.inviteStatus = params.inviteStatus
    }
    if (params.serviceType) {
      base.serviceType = params.serviceType
    }
    if (params.projectId) {
      base.projectId = params.projectId
    }

    return base
  }
}


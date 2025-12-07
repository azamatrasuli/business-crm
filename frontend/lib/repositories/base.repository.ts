/**
 * @fileoverview Base Repository
 * Abstract repository class implementing common CRUD operations.
 * Follows Repository pattern for data access abstraction.
 */

import type { AxiosInstance } from 'axios'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface PaginationParams {
  page?: number
  pageSize?: number
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface Entity {
  id: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// Base Repository
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Abstract base repository with common CRUD operations.
 * Extend this class to create specific repositories.
 *
 * @example
 * class EmployeesRepository extends BaseRepository<Employee, CreateEmployeeDto, UpdateEmployeeDto> {
 *   constructor(client: AxiosInstance) {
 *     super(client, '/employees')
 *   }
 *
 *   async toggleActivation(id: string): Promise<Employee> {
 *     const { data } = await this.client.patch(`${this.endpoint}/${id}/activate`)
 *     return data
 *   }
 * }
 */
export abstract class BaseRepository<
  T extends Entity,
  CreateDto = Partial<T>,
  UpdateDto = Partial<T>,
> {
  constructor(
    protected readonly client: AxiosInstance,
    protected readonly endpoint: string
  ) {}

  /**
   * Fetch paginated list of entities
   */
  async findAll(params?: PaginationParams): Promise<PaginatedResponse<T>> {
    const { data } = await this.client.get<PaginatedResponse<T>>(this.endpoint, {
      params: this.buildQueryParams(params),
    })
    return data
  }

  /**
   * Fetch single entity by ID
   */
  async findById(id: string): Promise<T> {
    const { data } = await this.client.get<T>(`${this.endpoint}/${id}`)
    return data
  }

  /**
   * Create new entity
   */
  async create(dto: CreateDto): Promise<T> {
    const { data } = await this.client.post<T>(this.endpoint, dto)
    return data
  }

  /**
   * Update existing entity
   */
  async update(id: string, dto: UpdateDto): Promise<T> {
    const { data } = await this.client.put<T>(`${this.endpoint}/${id}`, dto)
    return data
  }

  /**
   * Partial update (PATCH)
   */
  async patch(id: string, dto: Partial<UpdateDto>): Promise<T> {
    const { data } = await this.client.patch<T>(`${this.endpoint}/${id}`, dto)
    return data
  }

  /**
   * Delete entity
   */
  async delete(id: string): Promise<void> {
    await this.client.delete(`${this.endpoint}/${id}`)
  }

  /**
   * Check if entity exists
   */
  async exists(id: string): Promise<boolean> {
    try {
      await this.client.head(`${this.endpoint}/${id}`)
      return true
    } catch {
      return false
    }
  }

  /**
   * Build query params from pagination params
   * Override in subclass for custom param mapping
   */
  protected buildQueryParams(params?: PaginationParams): Record<string, unknown> {
    if (!params) return {}

    const queryParams: Record<string, unknown> = {}

    if (params.page !== undefined) queryParams.page = params.page
    if (params.pageSize !== undefined) queryParams.pageSize = params.pageSize
    if (params.search) queryParams.search = params.search
    if (params.sortBy) queryParams.sortBy = params.sortBy
    if (params.sortOrder) queryParams.sortOrder = params.sortOrder

    return queryParams
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Read-Only Repository
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Read-only repository for entities that shouldn't be modified from frontend.
 */
export abstract class ReadOnlyRepository<T extends Entity> {
  constructor(
    protected readonly client: AxiosInstance,
    protected readonly endpoint: string
  ) {}

  async findAll(params?: PaginationParams): Promise<PaginatedResponse<T>> {
    const { data } = await this.client.get<PaginatedResponse<T>>(this.endpoint, {
      params,
    })
    return data
  }

  async findById(id: string): Promise<T> {
    const { data } = await this.client.get<T>(`${this.endpoint}/${id}`)
    return data
  }
}


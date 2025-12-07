/**
 * @fileoverview Repositories barrel export
 * Centralized access to all data repositories.
 */

import apiClient from '@/lib/api/client'

// Base
export {
  BaseRepository,
  ReadOnlyRepository,
  type PaginationParams,
  type PaginatedResponse,
  type Entity,
} from './base.repository'

// Repositories
export { EmployeesRepository, type EmployeesFilterParams } from './employees.repository'

// ═══════════════════════════════════════════════════════════════════════════════
// Singleton instances
// ═══════════════════════════════════════════════════════════════════════════════

import { EmployeesRepository } from './employees.repository'

// Pre-configured repository instances
export const repositories = {
  employees: new EmployeesRepository(apiClient),
} as const

// Shorthand exports for common use
export const employeesRepo = repositories.employees


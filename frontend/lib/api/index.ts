/**
 * @fileoverview API barrel export
 */

// Client
export { default as apiClient, apiCall, parseError, ErrorCodes, type AppError } from './client'

// Context (Dependency Injection)
export { ApiProvider, useApiClient, useApiBaseUrl, useApiFetch } from './api-context'

// Note: Individual API modules should be imported directly to avoid name conflicts
// e.g., import { employeesApi } from '@/lib/api/employees'


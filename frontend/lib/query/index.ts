/**
 * TanStack Query exports
 * Centralized query configuration and utilities
 */

export { getQueryClient, queryKeys, staleTimes } from './query-client'

// Note: Hooks should be imported directly from '@/lib/query/hooks'
// to avoid Turbopack code generation issues with re-exports


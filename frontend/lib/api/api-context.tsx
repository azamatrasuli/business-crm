/**
 * @fileoverview API Context
 * Dependency Injection for API client.
 * Enables easier testing and configuration swapping.
 */

'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { AxiosInstance } from 'axios'
import apiClient from './client'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface ApiContextType {
  client: AxiosInstance
  baseUrl: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// Context
// ═══════════════════════════════════════════════════════════════════════════════

const ApiContext = createContext<ApiContextType | null>(null)

// ═══════════════════════════════════════════════════════════════════════════════
// Provider
// ═══════════════════════════════════════════════════════════════════════════════

interface ApiProviderProps {
  children: ReactNode
  /** Custom client for testing or alternative configurations */
  client?: AxiosInstance
}

/**
 * API Provider - wraps app to provide API client via context.
 * 
 * @example
 * // Default usage (uses singleton client)
 * <ApiProvider>
 *   <App />
 * </ApiProvider>
 * 
 * @example
 * // Testing with mock client
 * <ApiProvider client={mockAxiosInstance}>
 *   <ComponentUnderTest />
 * </ApiProvider>
 */
export function ApiProvider({ children, client = apiClient }: ApiProviderProps) {
  const value = useMemo<ApiContextType>(
    () => ({
      client,
      baseUrl: client.defaults.baseURL || '',
    }),
    [client]
  )

  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>
}

// ═══════════════════════════════════════════════════════════════════════════════
// Hooks
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Hook to access API client from context.
 * 
 * @example
 * function MyComponent() {
 *   const apiClient = useApiClient()
 *   // Use apiClient for requests
 * }
 */
export function useApiClient(): AxiosInstance {
  const context = useContext(ApiContext)
  
  // Fallback to singleton if not in provider (backwards compatibility)
  if (!context) {
    return apiClient
  }
  
  return context.client
}

/**
 * Hook to get API base URL.
 */
export function useApiBaseUrl(): string {
  const context = useContext(ApiContext)
  return context?.baseUrl || apiClient.defaults.baseURL || ''
}

/**
 * Hook to create a configured fetch function.
 * Useful for custom fetch logic with the configured client.
 */
export function useApiFetch() {
  const client = useApiClient()

  return useMemo(
    () => ({
      get: <T,>(url: string, params?: Record<string, unknown>) =>
        client.get<T>(url, { params }).then((r) => r.data),
      
      post: <T,>(url: string, data?: unknown) =>
        client.post<T>(url, data).then((r) => r.data),
      
      put: <T,>(url: string, data?: unknown) =>
        client.put<T>(url, data).then((r) => r.data),
      
      patch: <T,>(url: string, data?: unknown) =>
        client.patch<T>(url, data).then((r) => r.data),
      
      delete: <T,>(url: string) =>
        client.delete<T>(url).then((r) => r.data),
    }),
    [client]
  )
}


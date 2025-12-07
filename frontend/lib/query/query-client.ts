import { QueryClient, defaultShouldDehydrateQuery, isServer } from '@tanstack/react-query'

/**
 * Query client factory with optimal defaults for the application
 * Following TanStack Query best practices
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Stale time: How long data is considered fresh
        // After this time, data will be refetched on next access
        staleTime: 60 * 1000, // 1 minute (default was 0)
        
        // GC time: How long inactive queries stay in cache
        gcTime: 5 * 60 * 1000, // 5 minutes (default)
        
        // Retry configuration
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        
        // Refetch configuration
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        refetchOnMount: true,
        
        // Network mode: always fetch when online
        networkMode: 'online',
      },
      mutations: {
        // Retry failed mutations once
        retry: 1,
        
        // Network mode
        networkMode: 'online',
      },
      dehydrate: {
        // Include pending queries for SSR
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === 'pending',
      },
    },
  })
}

// Browser: single instance for the lifetime of the app
let browserQueryClient: QueryClient | undefined = undefined

/**
 * Get the query client
 * - Server: Creates new instance per request (avoids sharing data between requests)
 * - Client: Returns singleton instance
 */
export function getQueryClient() {
  if (isServer) {
    // Server: always create a new query client
    return makeQueryClient()
  }
  
  // Browser: use singleton pattern
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient()
  }
  
  return browserQueryClient
}

/**
 * Query key factory for consistent key generation
 * Follows hierarchical key pattern for automatic invalidation
 */
export const queryKeys = {
  // Auth
  auth: {
    all: ['auth'] as const,
    session: () => [...queryKeys.auth.all, 'session'] as const,
    admins: (search?: string) => [...queryKeys.auth.all, 'admins', { search }] as const,
  },
  
  // Employees
  employees: {
    all: ['employees'] as const,
    lists: () => [...queryKeys.employees.all, 'list'] as const,
    list: (params: Record<string, unknown>) => [...queryKeys.employees.lists(), params] as const,
    details: () => [...queryKeys.employees.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.employees.details(), id] as const,
    orders: (id: string, params?: Record<string, unknown>) => 
      [...queryKeys.employees.detail(id), 'orders', params] as const,
  },
  
  // Dashboard / Home
  dashboard: {
    all: ['dashboard'] as const,
    stats: () => [...queryKeys.dashboard.all, 'stats'] as const,
    orders: (params: Record<string, unknown>) => [...queryKeys.dashboard.all, 'orders', params] as const,
    cutoffTime: () => [...queryKeys.dashboard.all, 'cutoff'] as const,
  },
  
  // Projects
  projects: {
    all: ['projects'] as const,
    list: () => [...queryKeys.projects.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.projects.all, 'detail', id] as const,
    addresses: (id: string) => [...queryKeys.projects.detail(id), 'addresses'] as const,
  },
  
  // Users
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (params: Record<string, unknown>) => [...queryKeys.users.lists(), params] as const,
    detail: (id: string) => [...queryKeys.users.all, 'detail', id] as const,
  },
  
  // Subscriptions / Meals
  subscriptions: {
    all: ['subscriptions'] as const,
    list: (params: Record<string, unknown>) => [...queryKeys.subscriptions.all, 'list', params] as const,
    detail: (id: string) => [...queryKeys.subscriptions.all, 'detail', id] as const,
    assignments: (employeeId: string, params?: Record<string, unknown>) =>
      [...queryKeys.subscriptions.all, 'assignments', employeeId, params] as const,
    freezeInfo: (employeeId: string) => 
      [...queryKeys.subscriptions.all, 'freezeInfo', employeeId] as const,
  },
  
  // Combos
  combos: {
    all: ['combos'] as const,
    list: () => [...queryKeys.combos.all, 'list'] as const,
  },
} as const

/**
 * Stale time presets for different data types
 */
export const staleTimes = {
  // Static data that rarely changes
  static: Infinity,
  
  // Reference data (combos, categories)
  reference: 5 * 60 * 1000, // 5 minutes
  
  // User profile data
  profile: 2 * 60 * 1000, // 2 minutes
  
  // Dashboard/realtime data
  realtime: 30 * 1000, // 30 seconds
  
  // List data
  list: 60 * 1000, // 1 minute
  
  // Detail data
  detail: 60 * 1000, // 1 minute
} as const


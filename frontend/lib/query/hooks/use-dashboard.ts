'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys, staleTimes } from '../query-client'
import { homeApi, type DashboardStats, type Order, type OrdersResponse, type BulkActionRequest, type CreateGuestOrderRequest } from '@/lib/api/home'
import { toast } from 'sonner'
import { parseError, ErrorCodes } from '@/lib/errors'
import { logger } from '@/lib/logger'

// ============================================================================
// Types
// ============================================================================

export interface OrdersQueryParams {
  page?: number
  pageSize?: number
  search?: string
  date?: string
  status?: string
  type?: string
  projectId?: string
}

// ============================================================================
// Queries
// ============================================================================

/**
 * Hook to fetch dashboard stats
 */
export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.dashboard.stats(),
    queryFn: () => homeApi.getDashboard(),
    staleTime: staleTimes.realtime,
    refetchInterval: 30 * 1000, // Refetch every 30 seconds for real-time data
  })
}

/**
 * Hook to fetch cutoff time
 */
export function useCutoffTime() {
  return useQuery({
    queryKey: queryKeys.dashboard.cutoffTime(),
    queryFn: async () => {
      const result = await homeApi.getCutoffTime()
      return { cutoffTime: result.time }
    },
    staleTime: staleTimes.reference, // Cutoff time rarely changes
  })
}

/**
 * Hook to fetch orders list
 */
export function useOrders(params: OrdersQueryParams = {}) {
  const {
    page = 1,
    pageSize = 20,
    search,
    date,
    status,
    type,
    projectId,
  } = params

  return useQuery({
    queryKey: queryKeys.dashboard.orders({
      page,
      pageSize,
      search,
      date,
      status,
      type,
      projectId,
    }),
    // Note: homeApi.getOrders params order: page, pageSize, search, status, date, projectId, type
    queryFn: () => homeApi.getOrders(page, pageSize, search, status, date, projectId, type),
    staleTime: staleTimes.list,
    placeholderData: (previousData) => previousData,
  })
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Hook for bulk actions on orders
 */
export function useBulkOrderAction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: BulkActionRequest) => homeApi.bulkAction(request),
    onMutate: async ({ orderIds, action }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.dashboard.all })
      
      // We could do optimistic updates here, but the status mappings
      // are complex enough that it's safer to just refetch
      return { orderIds, action }
    },
    onSuccess: (result, { action, orderIds }) => {
      // Invalidate all dashboard queries
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      
      const actionLabels: Record<string, string> = {
        pause: 'поставлены на паузу',
        resume: 'возобновлены',
        cancel: 'отменены',
      }
      
      const label = actionLabels[action] || action
      toast.success(`${orderIds.length} заказ(ов) ${label}`)
    },
    onError: (error, { action }) => {
      const appError = parseError(error)
      logger.error(`Bulk ${action} failed`, error instanceof Error ? error : new Error(appError.message), {
        errorCode: appError.code,
      })
      
      if (appError.code === ErrorCodes.ORDER_CUTOFF_PASSED) {
        toast.error('Время для изменений истекло', {
          description: 'Изменения на сегодня невозможны после времени отсечки',
        })
      } else {
        toast.error(appError.message, { description: appError.action })
      }
    },
  })
}

/**
 * Hook for creating guest order
 */
export function useCreateGuestOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateGuestOrderRequest) => homeApi.createGuestOrder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      toast.success('Гостевой заказ создан')
    },
    onError: (error) => {
      const appError = parseError(error)
      logger.error('Failed to create guest order', error instanceof Error ? error : new Error(appError.message))
      toast.error(appError.message, { description: appError.action })
    },
  })
}

// ============================================================================
// Combined Hook
// ============================================================================

/**
 * Combined hook for home page data
 * Fetches dashboard stats, cutoff time, and orders in parallel
 */
export function useHomeData(ordersParams: OrdersQueryParams = {}) {
  const dashboardQuery = useDashboardStats()
  const cutoffQuery = useCutoffTime()
  const ordersQuery = useOrders(ordersParams)

  return {
    // Dashboard stats
    dashboard: dashboardQuery.data,
    isDashboardLoading: dashboardQuery.isLoading,
    dashboardError: dashboardQuery.error,
    
    // Cutoff time
    cutoffTime: cutoffQuery.data?.cutoffTime ?? null,
    isCutoffLoading: cutoffQuery.isLoading,
    
    // Orders
    orders: ordersQuery.data?.items ?? [],
    total: ordersQuery.data?.total ?? 0,
    currentPage: ordersQuery.data?.page ?? 1,
    totalPages: ordersQuery.data?.totalPages ?? 1,
    isOrdersLoading: ordersQuery.isLoading,
    ordersError: ordersQuery.error,
    
    // Combined loading state
    isLoading: dashboardQuery.isLoading || ordersQuery.isLoading,
    
    // Refetch functions
    refetchDashboard: dashboardQuery.refetch,
    refetchOrders: ordersQuery.refetch,
    refetchAll: () => {
      dashboardQuery.refetch()
      ordersQuery.refetch()
    },
  }
}


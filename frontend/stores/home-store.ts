import { create } from 'zustand'
import {
  homeApi,
  type AssignMealsRequest,
  type BulkActionRequest,
  type BulkUpdateSubscriptionRequest,
  type UpdateSubscriptionRequest,
  type CreateGuestOrderRequest,
  type DashboardStats,
  type Order,
} from '@/lib/api/home'
import type { ActiveFilter } from '@/components/ui/filter-builder'

type StatusFilter = 'all' | 'Активен' | 'На паузе' | 'Завершен'
type TypeFilter = 'all' | 'Сотрудник' | 'Гость'

interface OrdersFilter {
  status: StatusFilter
  date: string | null
  projectId: string
  type: TypeFilter
}

interface HomeState {
  dashboard: DashboardStats | null
  orders: Order[]
  cutoffTime: string | null
  loading: boolean
  error: string | null
  total: number
  currentPage: number
  totalPages: number
  pageSize: number
  search: string
  statusFilter: StatusFilter
  dateFilter: string | null
  projectFilter: string
  activeFilters: ActiveFilter[]
  fetchDashboard: () => Promise<void>
  fetchOrders: (page?: number) => Promise<void>
  fetchCutoffTime: () => Promise<void>
  setSearch: (value: string) => void
  setStatusFilter: (value: StatusFilter) => void
  setDateFilter: (value: string | null) => void
  setProjectFilter: (value: string) => void
  setActiveFilters: (filters: ActiveFilter[]) => void
  resetFilters: () => void
  assignMeals: (data: AssignMealsRequest) => Promise<void>
  createGuestOrder: (data: CreateGuestOrderRequest) => Promise<void>
  bulkAction: (data: BulkActionRequest) => Promise<void>
  updateSubscription: (employeeId: string, data: UpdateSubscriptionRequest) => Promise<void>
  bulkUpdateSubscription: (data: BulkUpdateSubscriptionRequest) => Promise<void>
}

const getErrorMessage = (error: unknown, fallback = 'Произошла ошибка') => {
  if (typeof error === 'string') return error
  
  // Handle Axios errors
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as { response?: { status?: number; data?: { message?: string; error?: { message?: string } } }; message?: string }
    const status = axiosError.response?.status
    
    if (status === 500) {
      return 'Сервер временно недоступен. Пожалуйста, попробуйте позже.'
    }
    if (status === 502 || status === 503 || status === 504) {
      return 'Сервер перезагружается. Подождите 1-2 минуты и обновите страницу.'
    }
    if (status === 401) {
      return 'Сессия истекла. Пожалуйста, войдите заново.'
    }
    if (status === 403) {
      return 'Доступ запрещён'
    }
    if (!axiosError.response) {
      return 'Нет соединения с сервером. Проверьте интернет.'
    }
    
    // Try to get message from response
    const message = axiosError.response.data?.message || axiosError.response.data?.error?.message
    if (message) return message
  }
  
  if (error instanceof Error) {
    if (error.message.includes('Network Error')) {
      return 'Нет соединения с сервером. Проверьте интернет.'
    }
    return error.message
  }
  
  return fallback
}

const normalizeProjectFilter = (value: string) => {
  if (value === 'all') {
    return undefined
  }
  return value
}

// Convert active filters to API params
const parseActiveFilters = (filters: ActiveFilter[]): Partial<OrdersFilter> => {
  const result: Partial<OrdersFilter> = {}
  
  for (const filter of filters) {
    switch (filter.fieldId) {
      case 'status':
        if (filter.value && filter.value !== 'all') {
          result.status = filter.value as StatusFilter
        }
        break
      case 'type':
        if (filter.value && filter.value !== 'all') {
          result.type = filter.value as TypeFilter
        }
        break
      case 'date':
        if (filter.value) {
          result.date = filter.value as string
        }
        break
      case 'projectId':
        if (filter.value && filter.value !== 'all') {
          result.projectId = filter.value as string
        }
        break
    }
  }
  
  return result
}

export const useHomeStore = create<HomeState>((set, get) => ({
  dashboard: null,
  orders: [],
  cutoffTime: null,
  loading: false,
  error: null,
  total: 0,
  currentPage: 1,
  totalPages: 1,
  pageSize: 20,
  search: '',
  statusFilter: 'all',
  dateFilter: null,
  projectFilter: 'all',
  activeFilters: [],

  fetchDashboard: async () => {
    try {
      const dashboard = await homeApi.getDashboard()
      set({ dashboard })
    } catch (error) {
      set({ error: getErrorMessage(error) })
    }
  },

  fetchOrders: async (page = 1) => {
    set({ loading: true, error: null })
    try {
      const { pageSize, search, activeFilters } = get()
      const parsedFilters = parseActiveFilters(activeFilters)
      
      const response = await homeApi.getOrders(
        page,
        pageSize,
        search || undefined,
        parsedFilters.status || undefined,
        parsedFilters.date || undefined,
        normalizeProjectFilter(parsedFilters.projectId || 'all'),
        parsedFilters.type || undefined
      )

      // Enrich orders with serviceType (ensure LUNCH for orders with comboType)
      // Backend now provides demo compensation data with real employee IDs
      const enrichedOrders = response.items.map((order) => ({
        ...order,
        // Set LUNCH for all orders with comboType from backend
        serviceType: order.serviceType || (order.comboType ? 'LUNCH' as const : null),
      }))

      set({
        orders: enrichedOrders,
        total: response.total,
        currentPage: response.page,
        totalPages: response.totalPages,
        loading: false,
      })
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
    }
  },

  fetchCutoffTime: async () => {
    try {
      const response = await homeApi.getCutoffTime()
      set({ cutoffTime: response.time })
    } catch (error) {
      set({ error: getErrorMessage(error) })
    }
  },

  setSearch: (value: string) => {
    set({ search: value })
  },

  setStatusFilter: (value: StatusFilter) => {
    set({ statusFilter: value })
  },

  setDateFilter: (value: string | null) => {
    set({ dateFilter: value })
  },

  setProjectFilter: (value: string) => {
    set({ projectFilter: value })
  },

  setActiveFilters: (filters: ActiveFilter[]) => {
    set({ activeFilters: filters })
  },

  resetFilters: () => {
    set({
      search: '',
      statusFilter: 'all',
      dateFilter: null,
      projectFilter: 'all',
      activeFilters: [],
    })
  },

  assignMeals: async (data: AssignMealsRequest) => {
    await homeApi.assignMeals(data)
    await get().fetchOrders(get().currentPage)
  },

  createGuestOrder: async (data: CreateGuestOrderRequest) => {
    await homeApi.createGuestOrder(data)
    await get().fetchOrders(get().currentPage)
  },

  bulkAction: async (data: BulkActionRequest) => {
    await homeApi.bulkAction(data)
    await get().fetchOrders(get().currentPage)
  },

  updateSubscription: async (employeeId: string, data: UpdateSubscriptionRequest) => {
    await homeApi.updateSubscription(employeeId, data)
    await get().fetchOrders(get().currentPage)
  },

  bulkUpdateSubscription: async (data: BulkUpdateSubscriptionRequest) => {
    await homeApi.bulkUpdateSubscription(data)
    await get().fetchOrders(get().currentPage)
  },
}))


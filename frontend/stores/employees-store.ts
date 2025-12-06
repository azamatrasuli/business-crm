import { create } from 'zustand'
import {
  employeesApi,
  type Employee,
  type EmployeeDetail,
  type CreateEmployeeRequest,
  type UpdateEmployeeRequest,
  type UpdateBudgetRequest,
  type ServiceType,
} from '@/lib/api/employees'
import type { ActiveFilter } from '@/components/ui/filter-builder'

interface EmployeesFilter {
  status: 'all' | 'active' | 'inactive'
  inviteStatus: 'all' | 'Принято' | 'Ожидает' | 'Отклонено'
  mealStatus: 'all' | 'Активен' | 'На паузе' | 'Не заказан'
  minBudget: number | null
  maxBudget: number | null
  hasSubscription: boolean | null
  serviceType: ServiceType | null
}

interface EmployeesState {
  employees: Employee[]
  selectedEmployee: EmployeeDetail | null
  loading: boolean
  error: string | null
  total: number
  currentPage: number
  totalPages: number
  pageSize: number
  searchQuery: string
  filter: EmployeesFilter
  activeFilters: ActiveFilter[]

  // Actions
  fetchEmployees: (page?: number) => Promise<void>
  fetchEmployee: (id: string) => Promise<EmployeeDetail>
  createEmployee: (data: CreateEmployeeRequest) => Promise<Employee>
  updateEmployee: (id: string, data: UpdateEmployeeRequest) => Promise<Employee>
  toggleEmployeeActive: (id: string) => Promise<void>
  updateBudget: (employeeId: string, data: UpdateBudgetRequest) => Promise<void>
  setFilter: (filter: Partial<EmployeesFilter>) => void
  setActiveFilters: (filters: ActiveFilter[]) => void
  setSearchQuery: (query: string) => void
  selectEmployee: (employee: EmployeeDetail | null) => void
  resetFilters: () => void
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

const defaultFilter: EmployeesFilter = {
  status: 'all',
  inviteStatus: 'all',
  mealStatus: 'all',
  minBudget: null,
  maxBudget: null,
  hasSubscription: null,
  serviceType: null,
}

const mapStatusFilter = (status: EmployeesFilter['status']) => {
  if (status === 'active') return 'active'
  if (status === 'inactive') return 'inactive'
  return undefined
}

const mapInviteStatusFilter = (inviteStatus: EmployeesFilter['inviteStatus']) => {
  if (inviteStatus === 'all') return undefined
  return inviteStatus
}

// Convert active filters to API params
const parseActiveFilters = (filters: ActiveFilter[]): Partial<EmployeesFilter> => {
  const result: Partial<EmployeesFilter> = {}
  
  for (const filter of filters) {
    switch (filter.fieldId) {
      case 'status':
        if (filter.value === 'active') result.status = 'active'
        else if (filter.value === 'inactive') result.status = 'inactive'
        break
      case 'inviteStatus':
        if (filter.value && filter.value !== 'all') {
          result.inviteStatus = filter.value as EmployeesFilter['inviteStatus']
        }
        break
      case 'mealStatus':
        if (filter.value && filter.value !== 'all') {
          result.mealStatus = filter.value as EmployeesFilter['mealStatus']
        }
        break
      case 'serviceType':
        if (filter.value && filter.value !== 'all') {
          result.serviceType = filter.value as ServiceType
        }
        break
      case 'totalBudget':
        if (filter.operator === 'gte') {
          result.minBudget = filter.value as number
        } else if (filter.operator === 'lte') {
          result.maxBudget = filter.value as number
        } else if (filter.operator === 'between' && Array.isArray(filter.value)) {
          result.minBudget = filter.value[0]
          result.maxBudget = filter.value[1]
        }
        break
      case 'hasSubscription':
        if (filter.operator === 'is_true') {
          result.hasSubscription = true
        } else if (filter.operator === 'is_false') {
          result.hasSubscription = false
        }
        break
    }
  }
  
  return result
}

export const useEmployeesStore = create<EmployeesState>((set, get) => ({
  employees: [],
  selectedEmployee: null,
  loading: false,
  error: null,
  total: 0,
  currentPage: 1,
  totalPages: 1,
  pageSize: 20,
  searchQuery: '',
  filter: { ...defaultFilter },
  activeFilters: [],

  fetchEmployees: async (page = 1) => {
    set({ loading: true, error: null })

    try {
      const { pageSize, searchQuery, activeFilters } = get()
      const parsedFilters = parseActiveFilters(activeFilters)
      
      const response = await employeesApi.getEmployees(
        page,
        pageSize,
        searchQuery || undefined,
        mapStatusFilter(parsedFilters.status || 'all'),
        mapInviteStatusFilter(parsedFilters.inviteStatus || 'all'),
        undefined,
        parsedFilters.minBudget ?? undefined,
        parsedFilters.maxBudget ?? undefined,
        parsedFilters.hasSubscription ?? undefined,
        parsedFilters.mealStatus !== 'all' ? parsedFilters.mealStatus : undefined,
        parsedFilters.serviceType ?? undefined
      )

      set({
        employees: response.items,
        total: response.total,
        currentPage: response.page,
        totalPages: response.totalPages,
        loading: false,
      })
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
    }
  },

  fetchEmployee: async (id: string) => {
    set({ loading: true, error: null })

    try {
      const employee = await employeesApi.getEmployee(id)
      set({ selectedEmployee: employee, loading: false })
      return employee
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  createEmployee: async (data: CreateEmployeeRequest) => {
    set({ loading: true, error: null })

    try {
      const newEmployee = await employeesApi.createEmployee(data)
      await get().fetchEmployees(get().currentPage)
      set({ loading: false })
      return newEmployee
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  updateEmployee: async (id: string, data: UpdateEmployeeRequest) => {
    set({ loading: true, error: null })

    try {
      const updated = await employeesApi.updateEmployee(id, data)
      await get().fetchEmployees(get().currentPage)
      
      // Also refresh selectedEmployee if it's the same employee
      const { selectedEmployee } = get()
      if (selectedEmployee?.id === id) {
        try {
          const refreshed = await employeesApi.getEmployee(id)
          set({ selectedEmployee: refreshed })
        } catch {
          // Ignore error, list is already refreshed
        }
      }
      
      set({ loading: false })
      return updated
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  toggleEmployeeActive: async (id: string) => {
    set({ loading: true, error: null })

    try {
      await employeesApi.toggleActivation(id)
      await get().fetchEmployees(get().currentPage)
      set({ loading: false })
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  updateBudget: async (employeeId: string, data: UpdateBudgetRequest) => {
    set({ loading: true, error: null })

    try {
      await employeesApi.updateBudget(employeeId, data)
      await get().fetchEmployees(get().currentPage)
      set({ loading: false })
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  setFilter: (filter) => {
    set((state) => ({
      filter: { ...state.filter, ...filter },
    }))
  },

  setActiveFilters: (filters) => {
    set({ activeFilters: filters })
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query })
  },

  selectEmployee: (employee) => {
    set({ selectedEmployee: employee })
  },

  resetFilters: () => {
    set({
      filter: { ...defaultFilter },
      activeFilters: [],
      searchQuery: '',
    })
  },
}))

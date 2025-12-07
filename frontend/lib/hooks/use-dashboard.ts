/**
 * @fileoverview Dashboard hook
 * Centralized hook for dashboard data fetching and state management.
 * Extracted from page.tsx to follow Single Responsibility Principle.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useHomeStore } from '@/stores/home-store'
import { useProjectsStore } from '@/stores/projects-store'
import { useAuthStore } from '@/stores/auth-store'
import { useEmployeesStore } from '@/stores/employees-store'
import type { Order, DashboardStats } from '@/lib/api/home'
import type { ProjectListItem } from '@/lib/api/projects'
import type { Employee } from '@/lib/api/employees'
import type { ActiveFilter } from '@/components/ui/filter-builder'
import { formatISODate, hasCutoffPassed, parseLocalDate } from '@/lib/utils/date'
import { debounce } from 'lodash-es'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface UseDashboardReturn {
  // Data
  dashboard: DashboardStats | null
  orders: Order[]
  cutoffTime: string | null
  projects: ProjectListItem[]
  employees: Employee[]
  projectName: string | null

  // Loading & Error
  isLoading: boolean
  error: string | null

  // Pagination
  total: number
  currentPage: number
  totalPages: number

  // Filters
  search: string
  activeFilters: ActiveFilter[]
  selectedDate: string

  // Computed
  todayIso: string
  displayDate: Date | null
  isTodaySelected: boolean
  hasDateFilter: boolean
  isCutoffLocked: boolean
  budgetDepleted: boolean
  cutoffDisabledReason: string | null
  guestDisabledReason: string | null

  // Actions
  fetchDashboard: () => Promise<void>
  fetchOrders: (page?: number) => Promise<void>
  handleSearchChange: (value: string) => void
  handlePageChange: (page: number) => void
  handleFiltersChange: (filters: ActiveFilter[]) => void
  setDateFilter: (newDate: string) => void
  goToPreviousDay: () => void
  goToNextDay: () => void
  selectDate: (date: Date | undefined) => void
  showAllOrders: () => void
  showToday: () => void
}

// ═══════════════════════════════════════════════════════════════════════════════
// Hook Implementation
// ═══════════════════════════════════════════════════════════════════════════════

export function useDashboard(): UseDashboardReturn {
  const searchParams = useSearchParams()

  // Store state
  const {
    dashboard,
    orders,
    cutoffTime,
    isLoading,
    error,
    total,
    currentPage,
    totalPages,
    search,
    activeFilters,
    fetchDashboard,
    fetchOrders,
    fetchCutoffTime,
    setActiveFilters,
  } = useHomeStore()

  const { fetchProjects, projects } = useProjectsStore()
  const { employees, fetchEmployees } = useEmployeesStore()
  const { projectName } = useAuthStore()

  // Constants
  const todayIso = formatISODate(new Date())

  // Track initial fetch
  const hasFetched = useRef(false)

  // Get selected date from activeFilters (single source of truth)
  const selectedDate = useMemo(() => {
    const dateFilter = activeFilters.find((f) => f.fieldId === 'date')
    return (dateFilter?.value as string) || ''
  }, [activeFilters])

  // Display date for DatePicker
  const displayDate = useMemo(() => {
    if (!selectedDate) return null
    try {
      return parseLocalDate(selectedDate)
    } catch {
      return null
    }
  }, [selectedDate])

  // Computed flags
  const isTodaySelected = Boolean(selectedDate && selectedDate === todayIso)
  const hasDateFilter = Boolean(selectedDate)
  const isCutoffLocked = isTodaySelected && hasCutoffPassed(cutoffTime)
  const budgetDepleted = !dashboard || dashboard.totalBudget <= 0

  // Disabled reasons
  const budgetDisabledReason = budgetDepleted ? 'Недостаточно средств на бюджете проекта' : null
  const cutoffDisabledReason = isCutoffLocked
    ? cutoffTime
      ? `Изменения на сегодня закрыты в ${cutoffTime}`
      : 'Изменения на сегодня закрыты'
    : null
  const guestDisabledReason = budgetDisabledReason || cutoffDisabledReason

  // ─────────────────────────────────────────────────────────────────────────────
  // Initial Data Fetch
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true

    // Set today's date as default filter
    const todayFilter: ActiveFilter = {
      id: `date-${todayIso}`,
      fieldId: 'date',
      operator: 'equals',
      value: todayIso,
    }
    setActiveFilters([todayFilter])

    fetchDashboard()
    fetchCutoffTime()
    fetchProjects()
    fetchEmployees()
    fetchOrders(1)
  }, [fetchDashboard, fetchCutoffTime, fetchProjects, fetchEmployees, fetchOrders, setActiveFilters, todayIso])

  // Handle URL search param
  useEffect(() => {
    const employeeParam = searchParams.get('employee')
    if (employeeParam) {
      useHomeStore.setState({ search: employeeParam })
      fetchOrders(1)
    }
  }, [searchParams, fetchOrders])

  // ─────────────────────────────────────────────────────────────────────────────
  // Search Handler with Debounce
  // ─────────────────────────────────────────────────────────────────────────────

  const debouncedSearch = useMemo(
    () =>
      debounce(() => {
        fetchOrders(1)
      }, 500),
    [fetchOrders]
  )

  const handleSearchChange = useCallback(
    (value: string) => {
      useHomeStore.setState({ search: value })
      debouncedSearch()
    },
    [debouncedSearch]
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // Pagination Handler
  // ─────────────────────────────────────────────────────────────────────────────

  const handlePageChange = useCallback(
    (page: number) => {
      fetchOrders(page)
    },
    [fetchOrders]
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // Filter Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  const handleFiltersChange = useCallback(
    (filters: ActiveFilter[]) => {
      setActiveFilters(filters)
      fetchOrders(1)
    },
    [setActiveFilters, fetchOrders]
  )

  // Date filter helper
  const setDateFilter = useCallback(
    (newDate: string) => {
      const filtersWithoutDate = activeFilters.filter((f) => f.fieldId !== 'date')
      if (newDate) {
        const dateFilter: ActiveFilter = {
          id: `date-${newDate}`,
          fieldId: 'date',
          operator: 'equals',
          value: newDate,
        }
        setActiveFilters([...filtersWithoutDate, dateFilter])
      } else {
        setActiveFilters(filtersWithoutDate)
      }
      fetchOrders(1)
    },
    [activeFilters, setActiveFilters, fetchOrders]
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // Date Navigation
  // ─────────────────────────────────────────────────────────────────────────────

  const goToPreviousDay = useCallback(() => {
    const current = selectedDate ? parseLocalDate(selectedDate) : new Date()
    const prev = new Date(current.getFullYear(), current.getMonth(), current.getDate() - 1, 12, 0, 0)
    setDateFilter(formatISODate(prev))
  }, [selectedDate, setDateFilter])

  const goToNextDay = useCallback(() => {
    const current = selectedDate ? parseLocalDate(selectedDate) : new Date()
    const next = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1, 12, 0, 0)
    setDateFilter(formatISODate(next))
  }, [selectedDate, setDateFilter])

  const selectDate = useCallback(
    (date: Date | undefined) => {
      if (date) {
        setDateFilter(formatISODate(date))
      }
    },
    [setDateFilter]
  )

  const showAllOrders = useCallback(() => {
    setDateFilter('')
  }, [setDateFilter])

  const showToday = useCallback(() => {
    setDateFilter(todayIso)
  }, [setDateFilter, todayIso])

  return {
    // Data
    dashboard,
    orders,
    cutoffTime,
    projects,
    employees,
    projectName,

    // Loading & Error
    isLoading,
    error,

    // Pagination
    total,
    currentPage,
    totalPages,

    // Filters
    search,
    activeFilters,
    selectedDate,

    // Computed
    todayIso,
    displayDate,
    isTodaySelected,
    hasDateFilter,
    isCutoffLocked,
    budgetDepleted,
    cutoffDisabledReason,
    guestDisabledReason,

    // Actions
    fetchDashboard,
    fetchOrders,
    handleSearchChange,
    handlePageChange,
    handleFiltersChange,
    setDateFilter,
    goToPreviousDay,
    goToNextDay,
    selectDate,
    showAllOrders,
    showToday,
  }
}


/**
 * @fileoverview Employees Page Hook
 * Manages employees list data, filtering, and statistics.
 * Extracted from employees/page.tsx to follow Single Responsibility Principle.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useEmployeesStore } from '@/stores/employees-store'
import { useProjectsStore } from '@/stores/projects-store'
import type { Employee } from '@/lib/api/employees'
import type { ActiveFilter } from '@/components/ui/filter-builder'
import { debounce } from 'lodash-es'
import { INVITE_STATUS, ORDER_STATUS } from '@/lib/constants/entity-statuses'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface EmployeesStats {
  // Counts
  totalEmployees: number
  activeEmployees: number
  inactiveEmployees: number

  // Budget
  totalBudget: number
  avgBudget: number
  maxBudget: number

  // Invites
  acceptedInvites: number
  pendingInvites: number
  rejectedInvites: number

  // Meals
  activeMeals: number
  pausedMeals: number
  noMeals: number

  // Service types
  lunchCount: number
  compensationCount: number
  noServiceCount: number

  // Chart data
  statusChartData: Array<{ name: string; value: number; fill: string }>
  inviteChartData: Array<{ name: string; value: number; fill: string }>
  serviceChartData: Array<{ name: string; value: number; fill: string }>
}

export interface UseEmployeesPageReturn {
  // Data
  employees: Employee[]
  projects: Array<{ id: string; name: string }>

  // Loading & Error
  isLoading: boolean
  error: string | null

  // Pagination
  total: number
  currentPage: number
  totalPages: number

  // Filters
  searchQuery: string
  activeFilters: ActiveFilter[]

  // Statistics
  stats: EmployeesStats

  // Actions
  fetchEmployees: (page?: number) => Promise<void>
  handleSearchChange: (value: string) => void
  handleFiltersChange: (filters: ActiveFilter[]) => void
  handlePageChange: (page: number) => void
  toggleEmployeeActive: (id: string) => Promise<void>
  getProjectName: (projectId: string | null | undefined) => string | null
}

// ═══════════════════════════════════════════════════════════════════════════════
// Hook Implementation
// ═══════════════════════════════════════════════════════════════════════════════

export function useEmployeesPage(): UseEmployeesPageReturn {
  const {
    employees,
    isLoading,
    error,
    total,
    currentPage,
    totalPages,
    searchQuery,
    activeFilters,
    fetchEmployees,
    toggleEmployeeActive,
    setSearchQuery,
    setActiveFilters,
  } = useEmployeesStore()

  const { projects, fetchProjects } = useProjectsStore()

  // Track initial fetch
  const hasFetched = useRef(false)

  // ─────────────────────────────────────────────────────────────────────────────
  // Initial Data Fetch
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true
    fetchEmployees(1)
    fetchProjects()
  }, [fetchEmployees, fetchProjects])

  // ─────────────────────────────────────────────────────────────────────────────
  // Project Name Helper
  // ─────────────────────────────────────────────────────────────────────────────

  const getProjectName = useCallback(
    (projectId: string | null | undefined) => {
      if (!projectId) return null
      const project = projects.find((p) => p.id === projectId)
      return project?.name || null
    },
    [projects]
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // Search with Debounce
  // ─────────────────────────────────────────────────────────────────────────────

  const debouncedSearch = useMemo(
    () =>
      debounce(() => {
        fetchEmployees(1)
      }, 500),
    [fetchEmployees]
  )

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value)
      debouncedSearch()
    },
    [setSearchQuery, debouncedSearch]
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // Filters Handler
  // ─────────────────────────────────────────────────────────────────────────────

  const handleFiltersChange = useCallback(
    (filters: ActiveFilter[]) => {
      setActiveFilters(filters)
      fetchEmployees(1)
    },
    [setActiveFilters, fetchEmployees]
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // Pagination Handler
  // ─────────────────────────────────────────────────────────────────────────────

  const handlePageChange = useCallback(
    (page: number) => {
      fetchEmployees(page)
    },
    [fetchEmployees]
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // Statistics Calculation
  // ─────────────────────────────────────────────────────────────────────────────

  const stats = useMemo<EmployeesStats>(() => {
    const totalEmployees = employees.length
    const activeEmployees = employees.filter((e) => e.isActive).length
    const inactiveEmployees = employees.filter((e) => !e.isActive).length

    // Budget stats
    const employeesWithBudget = employees.filter((e) => e.totalBudget && e.totalBudget > 0)
    const totalBudget = employeesWithBudget.reduce((sum, e) => sum + (e.totalBudget || 0), 0)
    const avgBudget = employeesWithBudget.length > 0 ? totalBudget / employeesWithBudget.length : 0
    const maxBudget =
      employeesWithBudget.length > 0
        ? Math.max(...employeesWithBudget.map((e) => e.totalBudget || 0))
        : 0

    // Invite stats
    const acceptedInvites = employees.filter((e) => e.inviteStatus === INVITE_STATUS.ACCEPTED || e.inviteStatus === 'Принято').length
    const pendingInvites = employees.filter((e) => e.inviteStatus === INVITE_STATUS.PENDING || e.inviteStatus === 'Ожидает').length
    const rejectedInvites = employees.filter((e) => e.inviteStatus === INVITE_STATUS.REJECTED || e.inviteStatus === 'Отклонено').length

    // Meal stats
    // 'На паузе' is DEPRECATED, use 'Приостановлен'
    const activeMeals = employees.filter((e) => e.mealStatus === ORDER_STATUS.ACTIVE || e.mealStatus === 'Активен').length
    const pausedMeals = employees.filter((e) => e.mealStatus === ORDER_STATUS.PAUSED || e.mealStatus === 'Приостановлен' || e.mealStatus === 'На паузе').length
    const noMeals = employees.filter(
      (e) => !e.mealStatus || e.mealStatus === 'Не заказан'
    ).length

    // Service type stats
    const lunchCount = employees.filter((e) => e.serviceType === 'LUNCH').length
    const compensationCount = employees.filter((e) => e.serviceType === 'COMPENSATION').length
    const noServiceCount = employees.filter((e) => !e.serviceType).length

    // Chart data
    const statusChartData = [
      { name: 'Активные', value: activeEmployees, fill: '#10b981' },
      { name: 'Неактивные', value: inactiveEmployees, fill: '#94a3b8' },
    ]

    const inviteChartData = [
      { name: INVITE_STATUS.ACCEPTED, value: acceptedInvites, fill: '#10b981' },
      { name: INVITE_STATUS.PENDING, value: pendingInvites, fill: '#f59e0b' },
      { name: INVITE_STATUS.REJECTED, value: rejectedInvites, fill: '#ef4444' },
    ]

    const serviceChartData = [
      { name: 'Ланч', value: lunchCount, fill: '#f59e0b' },
      { name: 'Компенсация', value: compensationCount, fill: '#10b981' },
      { name: 'Не указано', value: noServiceCount, fill: '#94a3b8' },
    ]

    return {
      totalEmployees,
      activeEmployees,
      inactiveEmployees,
      totalBudget,
      avgBudget,
      maxBudget,
      acceptedInvites,
      pendingInvites,
      rejectedInvites,
      activeMeals,
      pausedMeals,
      noMeals,
      lunchCount,
      compensationCount,
      noServiceCount,
      statusChartData,
      inviteChartData,
      serviceChartData,
    }
  }, [employees])

  return {
    // Data
    employees,
    projects,

    // Loading & Error
    isLoading,
    error,

    // Pagination
    total,
    currentPage,
    totalPages,

    // Filters
    searchQuery,
    activeFilters,

    // Statistics
    stats,

    // Actions
    fetchEmployees,
    handleSearchChange,
    handleFiltersChange,
    handlePageChange,
    toggleEmployeeActive,
    getProjectName,
  }
}


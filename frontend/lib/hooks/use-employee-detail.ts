/**
 * @fileoverview Employee Detail Hook
 * Handles employee detail data fetching and computed values.
 * Extracted from employees/[id]/page.tsx to follow Single Responsibility Principle.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEmployeesStore } from '@/stores/employees-store'
import { employeesApi, type EmployeeOrder, type DayOfWeek, type EmployeeDetail } from '@/lib/api/employees'
import { differenceInDays, parseISO, isAfter, getDay } from 'date-fns'
import { getEffectiveWorkingDays, countWorkingDaysInRange } from '@/lib/constants/employee'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface ProgressInfo {
  total: number
  used: number
  percent: number
}

export interface UseEmployeeDetailReturn {
  // Data
  employee: EmployeeDetail | null
  orders: EmployeeOrder[]
  isLoading: boolean
  error: string | null

  // Orders pagination
  ordersLoading: boolean
  ordersPage: number
  ordersTotalPages: number
  ordersTotal: number
  setOrdersPage: (page: number) => void

  // Computed flags
  canEdit: boolean
  hasAcceptedInvite: boolean
  canManageBudget: boolean
  canManageLunch: boolean
  canManageCompensation: boolean
  hasActiveLunch: boolean
  hasActiveCompensation: boolean
  employeeServiceType: 'LUNCH' | 'COMPENSATION' | null

  // Progress info
  lunchProgress: ProgressInfo
  compensationProgress: ProgressInfo
  lunchDaysRemaining: number | null
  compensationDaysRemaining: number | null
  isLunchExpiringSoon: boolean
  isCompensationExpiringSoon: boolean

  // Working days
  workingDays: DayOfWeek[]
  workingDaysText: string
  isWorkingDay: (date: Date) => boolean

  // Filtered orders
  filteredOrders: EmployeeOrder[]
  getOrdersForDate: (date: Date) => EmployeeOrder[]

  // Default tab
  defaultServiceTab: 'lunch' | 'compensation'

  // Actions
  refresh: () => Promise<void>
  loadOrders: () => Promise<void>
}

// Day names in Russian
const DAYS_OF_WEEK_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

// ═══════════════════════════════════════════════════════════════════════════════
// Hook Implementation
// ═══════════════════════════════════════════════════════════════════════════════

export function useEmployeeDetail(employeeId: string): UseEmployeeDetailReturn {
  const {
    selectedEmployee: employee,
    isLoading,
    error,
    fetchEmployee,
  } = useEmployeesStore()

  // Track if we've fetched this employee
  const fetchedIdRef = useRef<string | null>(null)

  // Orders state
  const [orders, setOrders] = useState<EmployeeOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [ordersPage, setOrdersPage] = useState(1)
  const [ordersTotalPages, setOrdersTotalPages] = useState(0)
  const [ordersTotal, setOrdersTotal] = useState(0)

  // ─────────────────────────────────────────────────────────────────────────────
  // Data Fetching
  // ─────────────────────────────────────────────────────────────────────────────

  const loadOrders = useCallback(async () => {
    if (!employeeId) return
    setOrdersLoading(true)
    try {
      const response = await employeesApi.getEmployeeOrders(employeeId, ordersPage, 20)
      setOrders(response.items)
      setOrdersTotalPages(response.totalPages)
      setOrdersTotal(response.total)
    } catch {
      // Error handled by API client
    } finally {
      setOrdersLoading(false)
    }
  }, [employeeId, ordersPage])

  useEffect(() => {
    if (employeeId && fetchedIdRef.current !== employeeId) {
      fetchedIdRef.current = employeeId
      fetchEmployee(employeeId)
    }
  }, [employeeId, fetchEmployee])

  useEffect(() => {
    if (employeeId) {
      loadOrders()
    }
  }, [employeeId, loadOrders])

  const refresh = useCallback(async () => {
    if (employeeId) {
      await fetchEmployee(employeeId)
      await loadOrders()
    }
  }, [employeeId, fetchEmployee, loadOrders])

  // ─────────────────────────────────────────────────────────────────────────────
  // Subscription Data
  // ─────────────────────────────────────────────────────────────────────────────

  const lunchSub = employee?.lunchSubscription ?? null
  const compensation = employee?.compensation ?? null

  // ─────────────────────────────────────────────────────────────────────────────
  // Permission Flags
  // ─────────────────────────────────────────────────────────────────────────────

  const canEdit = Boolean(employee?.isActive)
  const hasAcceptedInvite = employee?.inviteStatus === 'Принято'
  const canManageBudget = Boolean(employee?.isActive && hasAcceptedInvite)

  const hasActiveLunch = Boolean(employee?.activeLunchSubscriptionId)
  const hasActiveCompensation = Boolean(employee?.activeCompensationId)
  const employeeServiceType = (employee?.serviceType as 'LUNCH' | 'COMPENSATION' | null) ?? null

  const canManageLunch = canManageBudget && employeeServiceType !== 'COMPENSATION'
  const canManageCompensation =
    canManageBudget && employeeServiceType !== 'LUNCH' && !hasActiveLunch

  // ─────────────────────────────────────────────────────────────────────────────
  // Working Days (needed for progress calculations)
  // ─────────────────────────────────────────────────────────────────────────────

  const workingDays = useMemo(() => {
    return getEffectiveWorkingDays(employee?.workingDays)
  }, [employee?.workingDays])

  // ─────────────────────────────────────────────────────────────────────────────
  // Progress Calculations
  // ─────────────────────────────────────────────────────────────────────────────

  const lunchProgress = useMemo<ProgressInfo>(() => {
    if (!lunchSub?.startDate || !lunchSub?.endDate) return { total: 0, used: 0, percent: 0 }
    const start = parseISO(lunchSub.startDate)
    const end = parseISO(lunchSub.endDate)
    const today = new Date()
    
    // Use actual working days instead of calendar days
    // workingDays comes from employee settings (or defaults to Mon-Fri)
    const total = countWorkingDaysInRange(workingDays, start, end)
    const used = today > start 
      ? countWorkingDaysInRange(workingDays, start, today > end ? end : today)
      : 0
    const percent = total > 0 ? Math.min((used / total) * 100, 100) : 0
    return { total, used: Math.min(used, total), percent }
  }, [lunchSub, workingDays])

  const compensationProgress = useMemo<ProgressInfo>(() => {
    if (!compensation?.totalBudget) return { total: 0, used: 0, percent: 0 }
    const total = compensation.totalBudget
    const used = compensation.usedAmount || 0
    const percent = total > 0 ? (used / total) * 100 : 0
    return { total, used, percent }
  }, [compensation])

  // ─────────────────────────────────────────────────────────────────────────────
  // Days Remaining
  // ─────────────────────────────────────────────────────────────────────────────

  const lunchDaysRemaining = useMemo(() => {
    if (lunchSub?.endDate) {
      const end = parseISO(lunchSub.endDate)
      const today = new Date()
      if (isAfter(end, today)) {
        return differenceInDays(end, today)
      }
    }
    return null
  }, [lunchSub])

  const compensationDaysRemaining = useMemo(() => {
    if (compensation?.endDate) {
      const end = parseISO(compensation.endDate)
      const today = new Date()
      if (isAfter(end, today)) {
        return differenceInDays(end, today)
      }
    }
    return null
  }, [compensation])

  const isLunchExpiringSoon =
    lunchDaysRemaining !== null && lunchDaysRemaining <= 7 && lunchDaysRemaining > 0
  const isCompensationExpiringSoon =
    compensationDaysRemaining !== null && compensationDaysRemaining <= 7 && compensationDaysRemaining > 0

  // ─────────────────────────────────────────────────────────────────────────────
  // Working Days Text
  // ─────────────────────────────────────────────────────────────────────────────

  const workingDaysText = useMemo(() => {
    if (workingDays.length === 7) return 'Все дни'
    if (workingDays.length === 6) return '6-дневка'
    if (
      workingDays.length === 5 &&
      !workingDays.includes(0 as DayOfWeek) &&
      !workingDays.includes(6 as DayOfWeek)
    ) {
      return '5-дневка (Пн-Пт)'
    }
    return workingDays.map((d) => DAYS_OF_WEEK_SHORT[d]).join(', ')
  }, [workingDays])

  const isWorkingDay = useCallback(
    (date: Date) => {
      const dow = getDay(date) as DayOfWeek
      return workingDays.includes(dow)
    },
    [workingDays]
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // Filtered Orders
  // ─────────────────────────────────────────────────────────────────────────────

  const filteredOrders = useMemo(() => {
    if (employeeServiceType === 'LUNCH') {
      return orders.filter((o) => o.serviceType === 'LUNCH')
    } else if (employeeServiceType === 'COMPENSATION') {
      return orders.filter((o) => o.serviceType === 'COMPENSATION')
    }
    return orders
  }, [orders, employeeServiceType])

  const getOrdersForDate = useCallback(
    (date: Date) => {
      return filteredOrders.filter((o) => {
        if (!o.date) return false
        const orderDate = parseISO(o.date)
        return (
          orderDate.getFullYear() === date.getFullYear() &&
          orderDate.getMonth() === date.getMonth() &&
          orderDate.getDate() === date.getDate()
        )
      })
    },
    [filteredOrders]
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // Default Tab
  // ─────────────────────────────────────────────────────────────────────────────

  const defaultServiceTab = useMemo<'lunch' | 'compensation'>(() => {
    if (hasActiveLunch || employeeServiceType === 'LUNCH') return 'lunch'
    if (hasActiveCompensation || employeeServiceType === 'COMPENSATION') return 'compensation'
    return 'lunch'
  }, [hasActiveLunch, hasActiveCompensation, employeeServiceType])

  return {
    // Data
    employee,
    orders,
    isLoading,
    error,

    // Orders pagination
    ordersLoading,
    ordersPage,
    ordersTotalPages,
    ordersTotal,
    setOrdersPage,

    // Computed flags
    canEdit,
    hasAcceptedInvite,
    canManageBudget,
    canManageLunch,
    canManageCompensation,
    hasActiveLunch,
    hasActiveCompensation,
    employeeServiceType,

    // Progress info
    lunchProgress,
    compensationProgress,
    lunchDaysRemaining,
    compensationDaysRemaining,
    isLunchExpiringSoon,
    isCompensationExpiringSoon,

    // Working days
    workingDays,
    workingDaysText,
    isWorkingDay,

    // Filtered orders
    filteredOrders,
    getOrdersForDate,

    // Default tab
    defaultServiceTab,

    // Actions
    refresh,
    loadOrders,
  }
}


/**
 * @fileoverview Compensation Form Hook
 * Manages multi-step form state for creating/editing compensation subscriptions.
 * Mirrors useLunchSubscriptionForm structure for consistency.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { addDays, differenceInDays } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { employeesApi, type Employee, type EmployeeDetail, type DayOfWeek } from '@/lib/api/employees'
import { servicesApi } from '@/lib/api/services'
import { parseError, ErrorCodes } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { toast } from 'sonner'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface CompensationSummary {
  id: string
  totalBudget: number
  dailyLimit: number
  startDate: string
  endDate: string
  status: string
}

export interface UseCompensationFormProps {
  mode: 'individual' | 'bulk'
  employee?: Employee | EmployeeDetail
  employees?: Employee[]
  existingCompensation?: CompensationSummary | null
  onSuccess?: () => void
}

export interface UseCompensationFormReturn {
  // Step management
  step: number
  setStep: (step: number) => void
  nextStep: () => void
  prevStep: () => void
  canProceed: boolean

  // Form state
  dailyLimit: number
  setDailyLimit: (limit: number) => void
  dateRange: DateRange | undefined
  setDateRange: (range: DateRange | undefined) => void
  carryOver: boolean
  setCarryOver: (value: boolean) => void
  selectedEmployeeIds: string[]
  setSelectedEmployeeIds: (ids: string[]) => void
  searchQuery: string
  setSearchQuery: (query: string) => void

  // Computed values
  isEditing: boolean
  totalDays: number
  totalBudget: number
  totalCost: number

  // Validation
  individualValidation: {
    isValid: boolean
    reason: string | null
  }
  canProceedStep1: boolean
  canProceedStep2: boolean
  canProceedStep3: boolean

  // Employees
  availableEmployees: Employee[]
  filteredEmployees: Employee[]
  isLoadingEmployees: boolean

  // Submission
  isSubmitting: boolean
  handleSubmit: () => Promise<void>
  reset: () => void
}

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

export const COMPENSATION_STEP_LABELS = ['Лимит', 'Период', 'Сотрудники']

export const DEFAULT_DAILY_LIMIT = 50

// ═══════════════════════════════════════════════════════════════════════════════
// Hook Implementation
// ═══════════════════════════════════════════════════════════════════════════════

export function useCompensationForm({
  mode,
  employee,
  employees: propEmployees = [],
  existingCompensation,
  onSuccess,
}: UseCompensationFormProps): UseCompensationFormReturn {
  const isEditing = Boolean(existingCompensation)

  // Step management
  const [step, setStep] = useState(1)

  // Form state
  const [dailyLimit, setDailyLimit] = useState(DEFAULT_DAILY_LIMIT)
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [carryOver, setCarryOver] = useState(true)
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  // Loading/Submission state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [allEmployees, setAllEmployees] = useState<Employee[]>([])
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false)

  // ─────────────────────────────────────────────────────────────────────────────
  // Employee Loading (bulk mode)
  // ─────────────────────────────────────────────────────────────────────────────

  const employees = useMemo(() => {
    if (mode === 'bulk' && allEmployees.length > 0) {
      return allEmployees
    }
    return propEmployees
  }, [mode, allEmployees, propEmployees])

  // ─────────────────────────────────────────────────────────────────────────────
  // Computed Values
  // ─────────────────────────────────────────────────────────────────────────────

  const startDate = dateRange?.from
  const endDate = dateRange?.to
  const totalDays = startDate && endDate ? differenceInDays(endDate, startDate) + 1 : 0

  // Calculate working days (Mon-Fri) in the period
  const workingDays = useMemo(() => {
    if (!startDate || !endDate) return 0
    let count = 0
    let current = new Date(startDate)
    while (current <= endDate) {
      const dow = current.getDay()
      if (dow >= 1 && dow <= 5) count++
      current = addDays(current, 1)
    }
    return count
  }, [startDate, endDate])

  const totalBudget = dailyLimit * workingDays
  const totalCost = totalBudget * (mode === 'bulk' ? selectedEmployeeIds.length : 1)

  // ─────────────────────────────────────────────────────────────────────────────
  // Validation
  // ─────────────────────────────────────────────────────────────────────────────

  const individualValidation = useMemo(() => {
    if (mode !== 'individual' || !employee || isEditing) {
      return { isValid: true, reason: null }
    }

    if (employee.serviceType !== 'COMPENSATION') {
      return {
        isValid: false,
        reason:
          employee.serviceType === 'LUNCH'
            ? 'Сотрудник настроен на обеды, а не на компенсацию. Измените тип услуги в настройках сотрудника.'
            : 'У сотрудника не указан тип услуги. Выберите «Компенсация» в настройках сотрудника.',
      }
    }

    if (employee.activeCompensationId) {
      return {
        isValid: false,
        reason: 'У сотрудника уже есть активная компенсация.',
      }
    }

    return { isValid: true, reason: null }
  }, [mode, employee, isEditing])

  const canProceedStep1 = dailyLimit > 0 && (mode !== 'individual' || individualValidation.isValid)
  const canProceedStep2 = Boolean(startDate && endDate && totalDays >= 5)
  const canProceedStep3 = mode === 'individual' || selectedEmployeeIds.length > 0

  const canProceed = useMemo(() => {
    switch (step) {
      case 1:
        return canProceedStep1
      case 2:
        return canProceedStep2
      case 3:
        return canProceedStep3
      default:
        return false
    }
  }, [step, canProceedStep1, canProceedStep2, canProceedStep3])

  // ─────────────────────────────────────────────────────────────────────────────
  // Employee Filtering
  // ─────────────────────────────────────────────────────────────────────────────

  const availableEmployees = useMemo(
    () =>
      employees.filter((e) => {
        if (!e.isActive) return false
        if (e.inviteStatus !== 'Принято') return false
        if (e.activeCompensationId) return false
        if (e.serviceType !== 'COMPENSATION') return false
        return true
      }),
    [employees]
  )

  const filteredEmployees = useMemo(() => {
    if (!searchQuery) return availableEmployees

    const query = searchQuery.toLowerCase()
    return availableEmployees.filter(
      (e) =>
        e.fullName.toLowerCase().includes(query) ||
        e.phone?.toLowerCase().includes(query)
    )
  }, [availableEmployees, searchQuery])

  // ─────────────────────────────────────────────────────────────────────────────
  // Step Navigation
  // ─────────────────────────────────────────────────────────────────────────────

  const nextStep = useCallback(() => {
    const maxStep = mode === 'individual' ? 2 : 3
    if (canProceed && step < maxStep) {
      setStep(step + 1)
    }
  }, [canProceed, step, mode])

  const prevStep = useCallback(() => {
    if (step > 1) {
      setStep(step - 1)
    }
  }, [step])

  // ─────────────────────────────────────────────────────────────────────────────
  // Form Submission
  // ─────────────────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!startDate || !endDate) return

    setIsSubmitting(true)
    try {
      const employeeIds = mode === 'individual' && employee ? [employee.id] : selectedEmployeeIds

      if (isEditing && existingCompensation) {
        await servicesApi.updateCompensation(existingCompensation.id, {
          dailyLimit,
          carryOver,
        })
        toast.success('Компенсация обновлена')
      } else {
        await servicesApi.createCompensations({
          employeeIds,
          dailyLimit,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          carryOver,
        })
        toast.success(
          employeeIds.length === 1
            ? 'Компенсация создана'
            : `Компенсации созданы для ${employeeIds.length} сотрудников`
        )
      }

      onSuccess?.()
    } catch (error) {
      const appError = parseError(error)
      logger.error(
        'Failed to save compensation',
        error instanceof Error ? error : new Error(appError.message),
        { errorCode: appError.code }
      )

      if (appError.code === ErrorCodes.BUDGET_INSUFFICIENT) {
        toast.error('Недостаточно бюджета', {
          description: 'Пополните бюджет проекта для создания компенсаций',
        })
      } else {
        toast.error(appError.message, { description: appError.action })
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [
    mode,
    employee,
    selectedEmployeeIds,
    isEditing,
    existingCompensation,
    dailyLimit,
    startDate,
    endDate,
    carryOver,
    onSuccess,
  ])

  // ─────────────────────────────────────────────────────────────────────────────
  // Reset Form
  // ─────────────────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    setStep(1)
    setDailyLimit(DEFAULT_DAILY_LIMIT)
    setDateRange(undefined)
    setCarryOver(true)
    setSelectedEmployeeIds(mode === 'individual' && employee ? [employee.id] : [])
    setSearchQuery('')
    setAllEmployees([])
  }, [mode, employee])

  // ─────────────────────────────────────────────────────────────────────────────
  // Load All Employees for Bulk Mode
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (mode !== 'bulk' || isEditing) return

    setIsLoadingEmployees(true)
    setAllEmployees([])
    employeesApi
      .getEmployees(1, 500)
      .then((response) => {
        setAllEmployees(response.items)
      })
      .catch((err) => {
        logger.error(
          'Failed to load employees for bulk dialog',
          err instanceof Error ? err : new Error(String(err))
        )
      })
      .finally(() => {
        setIsLoadingEmployees(false)
      })
  }, [mode, isEditing])

  // ─────────────────────────────────────────────────────────────────────────────
  // Initialize from existing compensation
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (existingCompensation) {
      setDailyLimit(existingCompensation.dailyLimit)
      setDateRange({
        from: new Date(existingCompensation.startDate),
        to: new Date(existingCompensation.endDate),
      })
    }
  }, [existingCompensation])

  return {
    // Step management
    step,
    setStep,
    nextStep,
    prevStep,
    canProceed,

    // Form state
    dailyLimit,
    setDailyLimit,
    dateRange,
    setDateRange,
    carryOver,
    setCarryOver,
    selectedEmployeeIds,
    setSelectedEmployeeIds,
    searchQuery,
    setSearchQuery,

    // Computed values
    isEditing,
    totalDays,
    totalBudget,
    totalCost,

    // Validation
    individualValidation,
    canProceedStep1,
    canProceedStep2,
    canProceedStep3,

    // Employees
    availableEmployees,
    filteredEmployees,
    isLoadingEmployees,

    // Submission
    isSubmitting,
    handleSubmit,
    reset,
  }
}


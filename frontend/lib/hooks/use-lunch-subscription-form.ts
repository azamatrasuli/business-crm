/**
 * @fileoverview Lunch Subscription Form Hook
 * Manages multi-step form state for creating/editing lunch subscriptions.
 * Extracted from manage-lunch-dialog.tsx to follow Single Responsibility Principle.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { addDays, differenceInDays, format } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { employeesApi, type Employee, type EmployeeDetail, type DayOfWeek } from '@/lib/api/employees'
import { servicesApi, type ScheduleType, type ComboType } from '@/lib/api/services'
import { parseError, ErrorCodes } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { toast } from 'sonner'
import { COMBO_OPTIONS_EXTENDED } from '@/lib/config'
import { INVITE_STATUS } from '@/lib/constants/entity-statuses'
import { DEFAULT_WORKING_DAYS, getEffectiveWorkingDays, countWorkingDaysInRange } from '@/lib/constants/employee'
import { useBusinessConfig } from './use-business-config'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface LunchSubscriptionSummary {
  id: string
  comboType: string
  startDate: string
  endDate: string
  scheduleType: ScheduleType
  customDays?: string[]
  status: string
}

interface ComboOption {
  value: ComboType
  price: number
  items: string[]
}

export interface UseLunchSubscriptionFormProps {
  mode: 'individual' | 'bulk'
  employee?: Employee | EmployeeDetail
  employees?: Employee[]
  existingSubscription?: LunchSubscriptionSummary | null
  onSuccess?: () => void
}

export interface UseLunchSubscriptionFormReturn {
  // Step management
  step: number
  setStep: (step: number) => void
  nextStep: () => void
  prevStep: () => void
  canProceed: boolean

  // Form state
  comboType: ComboType
  setComboType: (type: ComboType) => void
  dateRange: DateRange | undefined
  setDateRange: (range: DateRange | undefined) => void
  scheduleType: ScheduleType
  setScheduleType: (type: ScheduleType) => void
  customDates: Date[]
  setCustomDates: (dates: Date[]) => void
  selectedEmployeeIds: string[]
  setSelectedEmployeeIds: (ids: string[]) => void
  searchQuery: string
  setSearchQuery: (query: string) => void
  shiftFilter: 'DAY' | 'NIGHT'
  setShiftFilter: (shift: 'DAY' | 'NIGHT') => void

  // Computed values
  isEditing: boolean
  selectedCombo: ComboOption
  totalDays: number
  calculatedDays: number
  totalPrice: number
  workingDays: DayOfWeek[]

  // Validation
  individualValidation: {
    isValid: boolean
    reason: string | null
    shiftType: 'DAY' | 'NIGHT' | null
    deliveryTime?: string
  }
  canProceedStep1: boolean
  canProceedStep2: boolean
  canProceedStep3: boolean
  canProceedStep4: boolean

  // Employees
  availableEmployees: Employee[]
  filteredEmployees: Employee[]
  isLoadingEmployees: boolean
  
  // Shift filter helpers
  invisibleSelectionCount: number
  visibleSelectionCount: number
  clearInvisibleSelections: () => void

  // Submission
  isSubmitting: boolean
  handleSubmit: () => Promise<void>
  reset: () => void
}

// ═══════════════════════════════════════════════════════════════════════════════
// Constants (from centralized config)
// ═══════════════════════════════════════════════════════════════════════════════

const LUNCH_COMBO_OPTIONS: ComboOption[] = COMBO_OPTIONS_EXTENDED.map(opt => ({
  value: opt.value as ComboType,
  price: opt.price,
  items: [...opt.items],
}))

export const STEP_LABELS = ['Комбо', 'Период', 'График', 'Итого']

// ═══════════════════════════════════════════════════════════════════════════════
// Hook Implementation
// ═══════════════════════════════════════════════════════════════════════════════

export function useLunchSubscriptionForm({
  mode,
  employee,
  employees: propEmployees = [],
  existingSubscription,
  onSuccess,
}: UseLunchSubscriptionFormProps): UseLunchSubscriptionFormReturn {
  const isEditing = Boolean(existingSubscription)

  // Business config for dynamic minDays validation
  const { config: businessConfig } = useBusinessConfig()
  const minSubscriptionDays = businessConfig.subscription.minDays

  // Step management
  const [step, setStep] = useState(1)

  // Form state
  const [comboType, setComboType] = useState<ComboType>('Комбо 25')
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [scheduleType, setScheduleType] = useState<ScheduleType>('EVERY_DAY')
  const [customDates, setCustomDates] = useState<Date[]>([])
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [shiftFilter, setShiftFilter] = useState<'DAY' | 'NIGHT'>('DAY')

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

  const selectedCombo = LUNCH_COMBO_OPTIONS.find((c) => c.value === comboType) || LUNCH_COMBO_OPTIONS[0]
  const startDate = dateRange?.from
  const endDate = dateRange?.to
  const totalDays = startDate && endDate ? differenceInDays(endDate, startDate) + 1 : 0

  const workingDays = useMemo((): DayOfWeek[] => {
    if (mode === 'individual' && employee) {
      return getEffectiveWorkingDays((employee as EmployeeDetail).workingDays)
    }
    return DEFAULT_WORKING_DAYS
  }, [mode, employee])

  // Calculate days for individual mode or as default estimate
  const calculatedDays = useMemo(() => {
    if (!startDate || !endDate) return 0
    if (scheduleType === 'CUSTOM') return customDates.length

    // Use centralized function for accurate calculation
    if (scheduleType === 'EVERY_DAY') {
      return countWorkingDaysInRange(workingDays, startDate, endDate)
    }

    // EVERY_OTHER_DAY: Пн, Ср, Пт
    let count = 0
    let current = new Date(startDate)
    while (current <= endDate) {
      const dow = current.getDay() as DayOfWeek
      if ([1, 3, 5].includes(dow) && workingDays.includes(dow)) count++
      current = addDays(current, 1)
    }
    return count
  }, [startDate, endDate, scheduleType, customDates, workingDays])

  // For bulk mode: calculate total price based on each employee's individual working days
  const bulkCalculatedData = useMemo(() => {
    if (mode !== 'bulk' || !startDate || !endDate || selectedEmployeeIds.length === 0) {
      return { totalDays: 0, totalPrice: 0 }
    }

    let totalDays = 0
    let totalPrice = 0

    for (const empId of selectedEmployeeIds) {
      const emp = employees.find(e => e.id === empId)
      if (!emp) continue

      const empWorkDays = getEffectiveWorkingDays(emp.workingDays)
      let days = 0

      if (scheduleType === 'CUSTOM') {
        days = customDates.length
      } else if (scheduleType === 'EVERY_DAY') {
        days = countWorkingDaysInRange(empWorkDays, startDate, endDate)
      } else {
        // EVERY_OTHER_DAY
        let current = new Date(startDate)
        while (current <= endDate) {
          const dow = current.getDay() as DayOfWeek
          if ([1, 3, 5].includes(dow) && empWorkDays.includes(dow)) days++
          current = addDays(current, 1)
        }
      }

      totalDays += days
      totalPrice += days * selectedCombo.price
    }

    return { totalDays, totalPrice }
  }, [mode, startDate, endDate, selectedEmployeeIds, employees, scheduleType, customDates, selectedCombo.price])

  // Total price: use bulk calculation for bulk mode, simple calculation for individual
  const totalPrice = mode === 'bulk' 
    ? bulkCalculatedData.totalPrice 
    : calculatedDays * selectedCombo.price

  // ─────────────────────────────────────────────────────────────────────────────
  // Validation
  // ─────────────────────────────────────────────────────────────────────────────

  const individualValidation = useMemo(() => {
    if (mode !== 'individual' || !employee || isEditing) {
      return { isValid: true, reason: null, shiftType: null }
    }

    if (employee.serviceType !== 'LUNCH') {
      return {
        isValid: false,
        reason:
          employee.serviceType === 'COMPENSATION'
            ? 'Сотрудник настроен на компенсацию, а не на обеды. Измените тип услуги в настройках сотрудника.'
            : 'У сотрудника не указан тип услуги. Выберите «Обеды» в настройках сотрудника.',
        shiftType: null,
      }
    }

    if (employee.activeLunchSubscriptionId) {
      return {
        isValid: false,
        reason: 'У сотрудника уже есть активная подписка на обеды.',
        shiftType: null,
      }
    }

    const workDays = getEffectiveWorkingDays(employee.workingDays)
    const hasWeekdays = workDays.some((d: number) => d >= 1 && d <= 5)
    if (!hasWeekdays) {
      return {
        isValid: false,
        reason: 'Сотрудник работает только в выходные. Обеды доставляются в рабочие дни (Пн-Пт).',
        shiftType: null,
      }
    }

    const empShift = (employee.shiftType || 'DAY') as 'DAY' | 'NIGHT'
    const deliveryTime = empShift === 'DAY' ? '11:30 — 12:30' : '17:30 — 18:30'

    return { isValid: true, reason: null, shiftType: empShift, deliveryTime }
  }, [mode, employee, isEditing])

  const canProceedStep1 = Boolean(comboType) && (mode !== 'individual' || individualValidation.isValid)
  // FIXED: Use calculated WORKING days, not calendar days
  // Uses dynamic minDays from business config instead of hardcoded value
  const canProceedStep2 = Boolean(startDate && endDate && calculatedDays >= minSubscriptionDays)
  const canProceedStep3 = scheduleType !== 'CUSTOM' || customDates.length > 0
  // canProceedStep4 defined below after visibleSelectionCount

  // ─────────────────────────────────────────────────────────────────────────────
  // Employee Filtering
  // ─────────────────────────────────────────────────────────────────────────────

  const availableEmployees = useMemo(
    () =>
      employees.filter((e) => {
        if (!e.isActive) return false
        if (e.inviteStatus !== INVITE_STATUS.ACCEPTED && e.inviteStatus !== 'Принято') return false
        if (e.activeLunchSubscriptionId) return false
        if (e.serviceType !== 'LUNCH') return false

        const workDays = getEffectiveWorkingDays(e.workingDays)
        const hasWeekdays = workDays.some((d) => d >= 1 && d <= 5)
        if (!hasWeekdays) return false

        return true
      }),
    [employees]
  )

  const filteredEmployees = useMemo(() => {
    let filtered = availableEmployees

    // Filter by shift
    filtered = filtered.filter((e) => {
      const empShift = e.shiftType || 'DAY'
      return empShift === shiftFilter
    })

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (e) =>
          e.fullName.toLowerCase().includes(query) ||
          e.phone?.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [availableEmployees, shiftFilter, searchQuery])

  // ═══════════════════════════════════════════════════════════════
  // IMPROVED: Don't auto-clear selection when filter changes
  // Instead, calculate "invisible" selections for UI warning
  // ═══════════════════════════════════════════════════════════════
  const validEmployeeIdsSet = useMemo(
    () => new Set(filteredEmployees.map(e => e.id)),
    [filteredEmployees]
  )
  
  // Count selected employees that are NOT visible due to current shift filter
  const invisibleSelectionCount = useMemo(() => {
    if (mode !== 'bulk') return 0
    return selectedEmployeeIds.filter(id => !validEmployeeIdsSet.has(id)).length
  }, [mode, selectedEmployeeIds, validEmployeeIdsSet])
  
  // Count selected employees that ARE visible (match current shift filter)
  const visibleSelectionCount = useMemo(() => {
    if (mode !== 'bulk') return 0
    return selectedEmployeeIds.filter(id => validEmployeeIdsSet.has(id)).length
  }, [mode, selectedEmployeeIds, validEmployeeIdsSet])
  
  // Helper to clear only invisible selections (employees from other shift)
  const clearInvisibleSelections = useCallback(() => {
    setSelectedEmployeeIds(prev => prev.filter(id => validEmployeeIdsSet.has(id)))
  }, [validEmployeeIdsSet])

  // FIXED: Use visibleSelectionCount to only count employees matching current shift filter
  // MOVED HERE: After visibleSelectionCount is declared
  const canProceedStep4 = mode === 'individual' || visibleSelectionCount > 0

  const canProceed = useMemo(() => {
    switch (step) {
      case 1:
        return canProceedStep1
      case 2:
        return canProceedStep2
      case 3:
        return canProceedStep3
      case 4:
        return canProceedStep4
      default:
        return false
    }
  }, [step, canProceedStep1, canProceedStep2, canProceedStep3, canProceedStep4])

  // ─────────────────────────────────────────────────────────────────────────────
  // Step Navigation
  // ─────────────────────────────────────────────────────────────────────────────

  const nextStep = useCallback(() => {
    if (canProceed && step < 4) {
      setStep(step + 1)
    }
  }, [canProceed, step])

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
      // CRITICAL: Filter selectedEmployeeIds by current shift filter to avoid sending
      // employees from wrong shift that might still be in selection after filter change
      const employeeIds = mode === 'individual' && employee 
        ? [employee.id] 
        : selectedEmployeeIds.filter(id => validEmployeeIdsSet.has(id))

      // IMPORTANT: Use local date formatting to avoid timezone shift
      const formatDateLocal = (d: Date) => format(d, 'yyyy-MM-dd')
      
      // Backend now properly handles all schedule types:
      // - EVERY_DAY: creates orders for all working days (Mon-Fri or employee's schedule)
      // - EVERY_OTHER_DAY: creates orders only for Mon, Wed, Fri
      // - CUSTOM: creates orders only for specified dates
      const customDaysFormatted = scheduleType === 'CUSTOM' 
        ? customDates.map((d) => formatDateLocal(d)) 
        : undefined
      
      if (isEditing && existingSubscription) {
        await servicesApi.updateLunchSubscription(existingSubscription.id, {
          comboType,
          scheduleType: scheduleType,
          customDays: customDaysFormatted,
        })
        toast.success('Подписка обновлена')
      } else {
        await servicesApi.createLunchSubscriptions({
          employeeIds,
          comboType,
          startDate: formatDateLocal(startDate),
          endDate: formatDateLocal(endDate),
          scheduleType: scheduleType,
          customDays: customDaysFormatted,
        })
        toast.success(
          employeeIds.length === 1
            ? 'Подписка создана'
            : `Подписки созданы для ${employeeIds.length} сотрудников`
        )
      }

      onSuccess?.()
    } catch (error) {
      const appError = parseError(error)
      logger.error(
        'Failed to save lunch subscription',
        error instanceof Error ? error : new Error(appError.message),
        { errorCode: appError.code }
      )

      if (appError.code === ErrorCodes.BUDGET_INSUFFICIENT) {
        toast.error('Недостаточно бюджета', {
          description: 'Пополните бюджет проекта для создания подписок',
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
    existingSubscription,
    comboType,
    startDate,
    endDate,
    scheduleType,
    customDates,
    onSuccess,
  ])

  // ─────────────────────────────────────────────────────────────────────────────
  // Reset Form
  // ─────────────────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    setStep(1)
    setComboType('Комбо 25')
    setDateRange(undefined)
    setScheduleType('EVERY_DAY')
    setCustomDates([])
    setSelectedEmployeeIds(mode === 'individual' && employee ? [employee.id] : [])
    setSearchQuery('')
    setShiftFilter('DAY')
    setAllEmployees([])
  }, [mode, employee])

  // ─────────────────────────────────────────────────────────────────────────────
  // Load All Employees for Bulk Mode
  // ─────────────────────────────────────────────────────────────────────────────

  const loadAllEmployees = useCallback(async () => {
    if (mode !== 'bulk' || isEditing) return

    setIsLoadingEmployees(true)
    setAllEmployees([])
    try {
      const response = await employeesApi.getEmployees(1, 500)
      setAllEmployees(response.items)
    } catch (err) {
      logger.error('Failed to load employees for bulk dialog', err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsLoadingEmployees(false)
    }
  }, [mode, isEditing])

  return {
    // Step management
    step,
    setStep,
    nextStep,
    prevStep,
    canProceed,

    // Form state
    comboType,
    setComboType,
    dateRange,
    setDateRange,
    scheduleType,
    setScheduleType,
    customDates,
    setCustomDates,
    selectedEmployeeIds,
    setSelectedEmployeeIds,
    searchQuery,
    setSearchQuery,
    shiftFilter,
    setShiftFilter,

    // Computed values
    isEditing,
    selectedCombo,
    totalDays,
    calculatedDays,
    totalPrice,
    workingDays,

    // Validation
    individualValidation,
    canProceedStep1,
    canProceedStep2,
    canProceedStep3,
    canProceedStep4,

    // Employees
    availableEmployees,
    filteredEmployees,
    isLoadingEmployees,
    
    // Shift filter helpers
    invisibleSelectionCount,
    visibleSelectionCount,
    clearInvisibleSelections,

    // Submission
    isSubmitting,
    handleSubmit,
    reset,
  }
}


/**
 * @fileoverview Employee Form Hook
 * Manages form state for creating and editing employees.
 * Shared between create-employee-dialog and edit-employee-dialog.
 */

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useEmployeesStore } from '@/stores/employees-store'
import { useProjectsStore } from '@/stores/projects-store'
import type { Employee, EmployeeDetail, DayOfWeek, ShiftType, ServiceType } from '@/lib/api/employees'
import { parseError, ErrorCodes } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { toast } from 'sonner'

// ═══════════════════════════════════════════════════════════════════════════════
// Schema
// ═══════════════════════════════════════════════════════════════════════════════

export const employeeFormSchema = z.object({
  fullName: z.string().min(2, 'ФИО должно быть не менее 2 символов'),
  phone: z
    .string()
    .min(9, 'Телефон должен содержать минимум 9 цифр')
    .regex(/^\+?[\d\s-]+$/, 'Неверный формат телефона'),
  email: z.string().email('Неверный формат email').optional().or(z.literal('')),
  position: z.string().optional(),
  projectId: z.string().optional(),
  serviceType: z.enum(['LUNCH', 'COMPENSATION']).nullable().optional(),
  shiftType: z.enum(['DAY', 'NIGHT']).nullable().optional(),
  workingDays: z.array(z.number().min(0).max(6)).optional(),
  workStartTime: z.string().optional().nullable(),
  workEndTime: z.string().optional().nullable(),
  totalBudget: z.number().min(0).optional(),
  dailyLimit: z.number().min(0).optional(),
})

export type EmployeeFormData = z.infer<typeof employeeFormSchema>

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface UseEmployeeFormProps {
  mode: 'create' | 'edit'
  employee?: Employee | EmployeeDetail | null
  onSuccess?: () => void
  onClose?: () => void
}

export interface UseEmployeeFormReturn {
  // Form
  form: ReturnType<typeof useForm<EmployeeFormData>>

  // State
  isSubmitting: boolean
  step: number
  setStep: (step: number) => void

  // Projects
  projects: Array<{ id: string; name: string }>

  // Computed
  isEditing: boolean
  canSubmit: boolean

  // Actions
  handleSubmit: () => Promise<void>
  reset: () => void
}

// ═══════════════════════════════════════════════════════════════════════════════
// Default Values
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_WORKING_DAYS: DayOfWeek[] = [1, 2, 3, 4, 5]
const DEFAULT_SHIFT_TYPE: ShiftType = 'DAY'
const DEFAULT_WORK_START = '09:00'
const DEFAULT_WORK_END = '18:00'

function getDefaultValues(employee?: Employee | EmployeeDetail | null): EmployeeFormData {
  if (employee) {
    return {
      fullName: employee.fullName || '',
      phone: employee.phone || '',
      email: (employee as EmployeeDetail).email || '',
      position: employee.position || '',
      projectId: employee.projectId || undefined,
      serviceType: employee.serviceType || null,
      shiftType: employee.shiftType || DEFAULT_SHIFT_TYPE,
      workingDays: employee.workingDays || DEFAULT_WORKING_DAYS,
      workStartTime: employee.workStartTime || DEFAULT_WORK_START,
      workEndTime: employee.workEndTime || DEFAULT_WORK_END,
      totalBudget: employee.totalBudget || 0,
      dailyLimit: employee.dailyLimit || 0,
    }
  }

  return {
    fullName: '',
    phone: '',
    email: '',
    position: '',
    projectId: undefined,
    serviceType: null,
    shiftType: DEFAULT_SHIFT_TYPE,
    workingDays: DEFAULT_WORKING_DAYS,
    workStartTime: DEFAULT_WORK_START,
    workEndTime: DEFAULT_WORK_END,
    totalBudget: 0,
    dailyLimit: 0,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Hook Implementation
// ═══════════════════════════════════════════════════════════════════════════════

export function useEmployeeForm({
  mode,
  employee,
  onSuccess,
  onClose,
}: UseEmployeeFormProps): UseEmployeeFormReturn {
  const { createEmployee, updateEmployee } = useEmployeesStore()
  const { projects, fetchProjects } = useProjectsStore()

  const isEditing = mode === 'edit'

  // Form
  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: getDefaultValues(employee),
  })

  // State
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [step, setStep] = useState(1)

  // Load projects on mount
  useEffect(() => {
    if (projects.length === 0) {
      fetchProjects()
    }
  }, [projects.length, fetchProjects])

  // Reset form when employee changes
  useEffect(() => {
    if (employee) {
      form.reset(getDefaultValues(employee))
    }
  }, [employee, form])

  // ─────────────────────────────────────────────────────────────────────────────
  // Computed
  // ─────────────────────────────────────────────────────────────────────────────

  const canSubmit = useMemo(() => {
    const values = form.getValues()
    return Boolean(values.fullName && values.phone)
  }, [form])

  // ─────────────────────────────────────────────────────────────────────────────
  // Submit Handler
  // ─────────────────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    const isValid = await form.trigger()
    if (!isValid) return

    const data = form.getValues()
    setIsSubmitting(true)

    try {
      if (isEditing && employee) {
        await updateEmployee(employee.id, {
          fullName: data.fullName,
          email: data.email || undefined,
          position: data.position || undefined,
          serviceType: data.serviceType as ServiceType | undefined,
          shiftType: data.shiftType as ShiftType | undefined,
          workingDays: data.workingDays as DayOfWeek[] | undefined,
          workStartTime: data.workStartTime || undefined,
          workEndTime: data.workEndTime || undefined,
        })
        toast.success('Сотрудник обновлён')
      } else {
        await createEmployee({
          fullName: data.fullName,
          phone: data.phone,
          email: data.email || '',
          position: data.position || undefined,
          projectId: data.projectId || undefined,
          serviceType: data.serviceType as ServiceType | undefined,
          shiftType: data.shiftType as ShiftType | undefined,
          workingDays: data.workingDays as DayOfWeek[] | undefined,
          workStartTime: data.workStartTime || undefined,
          workEndTime: data.workEndTime || undefined,
        })
        toast.success('Сотрудник создан')
      }

      onSuccess?.()
      onClose?.()
    } catch (error) {
      const appError = parseError(error)
      logger.error(
        'Failed to save employee',
        error instanceof Error ? error : new Error(appError.message),
        { errorCode: appError.code }
      )

      if (appError.code === ErrorCodes.EMP_PHONE_EXISTS) {
        form.setError('phone', { message: 'Телефон уже используется' })
        toast.error('Телефон уже зарегистрирован')
      } else {
        toast.error(appError.message, { description: appError.action })
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [form, isEditing, employee, createEmployee, updateEmployee, onSuccess, onClose])

  // ─────────────────────────────────────────────────────────────────────────────
  // Reset
  // ─────────────────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    form.reset(getDefaultValues(employee))
    setStep(1)
  }, [form, employee])

  return {
    // Form
    form,

    // State
    isSubmitting,
    step,
    setStep,

    // Projects
    projects,

    // Computed
    isEditing,
    canSubmit,

    // Actions
    handleSubmit,
    reset,
  }
}


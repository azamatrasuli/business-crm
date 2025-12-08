/**
 * @fileoverview Guest Order Form Hook
 * Manages form state for creating guest orders.
 * Extracted from guest-order-dialog.tsx to follow Single Responsibility Principle.
 */

import { useState, useMemo, useCallback, useEffect } from 'react'
import { format } from 'date-fns'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useHomeStore } from '@/stores/home-store'
import { useProjectsStore } from '@/stores/projects-store'
import type { ComboType } from '@/lib/api/home'
import { parseError, ErrorCodes } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { toast } from 'sonner'
import { COMBO_OPTIONS_EXTENDED } from '@/lib/config'

// ═══════════════════════════════════════════════════════════════════════════════
// Schema
// ═══════════════════════════════════════════════════════════════════════════════

export const guestOrderFormSchema = z.object({
  orderName: z.string().min(2, 'Имя должно быть не менее 2 символов'),
  quantity: z.number().min(1, 'Количество должно быть не менее 1'),
  comboType: z.enum(['Комбо 25', 'Комбо 35']),
  projectId: z.string().min(1, 'Выберите проект'),
})

export type GuestOrderFormData = z.infer<typeof guestOrderFormSchema>

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface ComboOption {
  value: ComboType
  price: number
  label: string
  items: string[]
}

export interface UseGuestOrderFormProps {
  onSuccess?: () => void
  onClose?: () => void
}

export interface UseGuestOrderFormReturn {
  // Form
  form: ReturnType<typeof useForm<GuestOrderFormData>>

  // State
  isSubmitting: boolean

  // Options
  comboOptions: ComboOption[]
  projects: Array<{ id: string; name: string }>

  // Computed
  selectedCombo: ComboOption | undefined
  canSubmit: boolean

  // Actions
  handleSubmit: () => Promise<void>
  reset: () => void
}

// ═══════════════════════════════════════════════════════════════════════════════
// Constants (from centralized config)
// ═══════════════════════════════════════════════════════════════════════════════

export const GUEST_COMBO_OPTIONS: ComboOption[] = COMBO_OPTIONS_EXTENDED.map(opt => ({
  value: opt.value as ComboType,
  price: opt.price,
  label: opt.label,
  items: [...opt.items],
}))

// ═══════════════════════════════════════════════════════════════════════════════
// Hook Implementation
// ═══════════════════════════════════════════════════════════════════════════════

export function useGuestOrderForm({
  onSuccess,
  onClose,
}: UseGuestOrderFormProps): UseGuestOrderFormReturn {
  const { createGuestOrder, fetchOrders, fetchDashboard } = useHomeStore()
  const { projects, fetchProjects } = useProjectsStore()

  // Form
  const form = useForm<GuestOrderFormData>({
    resolver: zodResolver(guestOrderFormSchema),
    defaultValues: {
      orderName: '',
      quantity: 1,
      comboType: 'Комбо 25',
      projectId: '',
    },
  })

  // State
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Load projects on mount
  useEffect(() => {
    if (projects.length === 0) {
      fetchProjects()
    }
  }, [projects.length, fetchProjects])

  // ─────────────────────────────────────────────────────────────────────────────
  // Computed
  // ─────────────────────────────────────────────────────────────────────────────

  const selectedCombo = useMemo(() => {
    const comboType = form.watch('comboType')
    return GUEST_COMBO_OPTIONS.find((c) => c.value === comboType)
  }, [form])

  const canSubmit = useMemo(() => {
    const values = form.getValues()
    return Boolean(values.orderName && values.comboType && values.projectId && values.quantity > 0)
  }, [form])

  // ─────────────────────────────────────────────────────────────────────────────
  // Submit Handler
  // ─────────────────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    const isValid = await form.trigger()
    if (!isValid) return

    const data = form.getValues()
    setIsSubmitting(true)

    // Get today's date in local format (avoid timezone shift)
    const today = format(new Date(), 'yyyy-MM-dd')

    try {
      await createGuestOrder({
        orderName: data.orderName,
        quantity: data.quantity,
        comboType: data.comboType,
        projectId: data.projectId,
        date: today,
      })

      toast.success('Гостевой заказ создан', {
        description: `${data.orderName} — ${data.comboType} x${data.quantity}`,
      })

      // Refresh data
      fetchOrders()
      fetchDashboard()

      onSuccess?.()
      onClose?.()
    } catch (error) {
      const appError = parseError(error)
      logger.error(
        'Failed to create guest order',
        error instanceof Error ? error : new Error(appError.message),
        { errorCode: appError.code }
      )

      if (appError.code === ErrorCodes.BUDGET_INSUFFICIENT) {
        toast.error('Недостаточно бюджета', {
          description: 'Пополните бюджет проекта для создания заказа',
        })
      } else if (appError.code === ErrorCodes.ORDER_CUTOFF_PASSED) {
        toast.error('Время отсечки прошло', {
          description: 'Гостевые заказы на сегодня больше не принимаются',
        })
      } else {
        toast.error(appError.message, { description: appError.action })
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [form, createGuestOrder, fetchOrders, fetchDashboard, onSuccess, onClose])

  // ─────────────────────────────────────────────────────────────────────────────
  // Reset
  // ─────────────────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    form.reset({
      orderName: '',
      quantity: 1,
      comboType: 'Комбо 25',
      projectId: '',
    })
  }, [form])

  return {
    // Form
    form,

    // State
    isSubmitting,

    // Options
    comboOptions: GUEST_COMBO_OPTIONS,
    projects,

    // Computed
    selectedCombo,
    canSubmit,

    // Actions
    handleSubmit,
    reset,
  }
}


/**
 * @fileoverview Bulk Edit Form Hook
 * Manages bulk order editing form state and actions.
 * Extracted from bulk-edit-dialog.tsx to follow Single Responsibility Principle.
 */

import { useState, useMemo, useCallback } from 'react'
import { toast } from 'sonner'
import { useHomeStore } from '@/stores/home-store'
import type { Order, ComboType } from '@/lib/api/home'
import { freezeOrder } from '@/lib/api/orders'
import { parseError, ErrorCodes } from '@/lib/errors'
import { logger } from '@/lib/logger'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export type BulkAction =
  | 'editCombo' // Изменить комбо
  | 'pause' // Поставить на паузу
  | 'resume' // Возобновить
  | 'freeze' // Заморозить (только сегодня)
  | 'cancel' // Отменить

export interface ActionOption {
  id: BulkAction
  label: string
  description: string
  color: string
  bgColor: string
  available: (orders: Order[], isToday: boolean) => boolean
  getApplicableCount: (orders: Order[]) => number
}

export interface UseBulkEditFormProps {
  selectedOrders: Order[]
  selectedDate: string
  onSuccess?: () => void
}

export interface UseBulkEditFormReturn {
  // State
  step: number
  selectedAction: BulkAction | null
  selectedCombo: ComboType | null
  isExecuting: boolean
  progress: number
  results: Array<{ orderId: string; success: boolean; error?: string }>

  // Computed
  isToday: boolean
  availableActions: ActionOption[]
  applicableOrders: Order[]
  canProceed: boolean

  // Actions
  setStep: (step: number) => void
  setSelectedAction: (action: BulkAction | null) => void
  setSelectedCombo: (combo: ComboType | null) => void
  executeAction: () => Promise<void>
  reset: () => void
}

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

export const ACTION_OPTIONS: ActionOption[] = [
  {
    id: 'editCombo',
    label: 'Изменить комбо',
    description: 'Сменить тип комбо (со след. дня)',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    available: (orders) => orders.some((o) => o.serviceType === 'LUNCH' || !o.serviceType),
    getApplicableCount: (orders) =>
      orders.filter((o) => o.serviceType === 'LUNCH' || !o.serviceType).length,
  },
  {
    id: 'pause',
    label: 'Приостановить подписки',
    description: 'Дни переносятся в конец периода',
    color: 'text-amber-500',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    available: (orders) =>
      orders.some(
        (o) =>
          o.status === 'Активен' && (o.serviceType === 'LUNCH' || !o.serviceType)
      ),
    getApplicableCount: (orders) =>
      orders.filter(
        (o) =>
          o.status === 'Активен' && (o.serviceType === 'LUNCH' || !o.serviceType)
      ).length,
  },
  {
    id: 'resume',
    label: 'Возобновить подписки',
    description: 'Продолжить доставку',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
    available: (orders) =>
      orders.some(
        (o) =>
          o.status === 'На паузе' && (o.serviceType === 'LUNCH' || !o.serviceType)
      ),
    getApplicableCount: (orders) =>
      orders.filter(
        (o) =>
          o.status === 'На паузе' && (o.serviceType === 'LUNCH' || !o.serviceType)
      ).length,
  },
  {
    id: 'freeze',
    label: 'Заморозить на сегодня',
    description: 'День переносится в конец периода',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    available: (orders, isToday) =>
      isToday &&
      orders.some(
        (o) =>
          o.status === 'Активен' && (o.serviceType === 'LUNCH' || !o.serviceType)
      ),
    getApplicableCount: (orders) =>
      orders.filter(
        (o) =>
          o.status === 'Активен' && (o.serviceType === 'LUNCH' || !o.serviceType)
      ).length,
  },
  {
    id: 'cancel',
    label: 'Отменить заказы',
    description: 'Безвозвратно отменить',
    color: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    available: (orders) =>
      orders.some((o) => o.status === 'Активен' || o.status === 'На паузе'),
    getApplicableCount: (orders) =>
      orders.filter((o) => o.status === 'Активен' || o.status === 'На паузе').length,
  },
]

// ═══════════════════════════════════════════════════════════════════════════════
// Hook Implementation
// ═══════════════════════════════════════════════════════════════════════════════

export function useBulkEditForm({
  selectedOrders,
  selectedDate,
  onSuccess,
}: UseBulkEditFormProps): UseBulkEditFormReturn {
  const { bulkAction, bulkUpdateSubscription, fetchOrders } = useHomeStore()

  // State
  const [step, setStep] = useState(1)
  const [selectedAction, setSelectedAction] = useState<BulkAction | null>(null)
  const [selectedCombo, setSelectedCombo] = useState<ComboType | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<
    Array<{ orderId: string; success: boolean; error?: string }>
  >([])

  // ─────────────────────────────────────────────────────────────────────────────
  // Computed Values
  // ─────────────────────────────────────────────────────────────────────────────

  const isToday = useMemo(() => {
    if (!selectedDate) return false
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    return selectedDate === todayStr
  }, [selectedDate])

  const availableActions = useMemo(
    () => ACTION_OPTIONS.filter((a) => a.available(selectedOrders, isToday)),
    [selectedOrders, isToday]
  )

  const applicableOrders = useMemo(() => {
    if (!selectedAction) return selectedOrders

    const actionConfig = ACTION_OPTIONS.find((a) => a.id === selectedAction)
    if (!actionConfig) return selectedOrders

    return selectedOrders.filter((order) => {
      switch (selectedAction) {
        case 'editCombo':
          return order.serviceType === 'LUNCH' || !order.serviceType
        case 'pause':
          return (
            order.status === 'Активен' &&
            (order.serviceType === 'LUNCH' || !order.serviceType)
          )
        case 'resume':
          return (
            order.status === 'На паузе' &&
            (order.serviceType === 'LUNCH' || !order.serviceType)
          )
        case 'freeze':
          return (
            order.status === 'Активен' &&
            (order.serviceType === 'LUNCH' || !order.serviceType)
          )
        case 'cancel':
          return order.status === 'Активен' || order.status === 'На паузе'
        default:
          return false
      }
    })
  }, [selectedOrders, selectedAction])

  const canProceed = useMemo(() => {
    if (step === 1) return selectedAction !== null
    if (step === 2) {
      if (selectedAction === 'editCombo') return selectedCombo !== null
      return true
    }
    return false
  }, [step, selectedAction, selectedCombo])

  // ─────────────────────────────────────────────────────────────────────────────
  // Execute Action
  // ─────────────────────────────────────────────────────────────────────────────

  const executeAction = useCallback(async () => {
    if (!selectedAction || applicableOrders.length === 0) return

    setIsExecuting(true)
    setProgress(0)
    setResults([])

    const newResults: Array<{ orderId: string; success: boolean; error?: string }> = []

    try {
      switch (selectedAction) {
        case 'editCombo':
          if (selectedCombo) {
            await bulkUpdateSubscription({
              employeeIds: applicableOrders
                .filter((o) => o.employeeId)
                .map((o) => o.employeeId!),
              comboType: selectedCombo,
            })
            toast.success(`Комбо изменено для ${applicableOrders.length} заказов`)
          }
          break

        case 'pause':
        case 'resume':
          await bulkAction({
            orderIds: applicableOrders.map((o) => o.id),
            action: selectedAction,
          })
          toast.success(
            selectedAction === 'pause'
              ? `${applicableOrders.length} заказов приостановлено`
              : `${applicableOrders.length} заказов возобновлено`
          )
          break

        case 'freeze':
          // Freeze requires individual API calls via new orders API
          for (let i = 0; i < applicableOrders.length; i++) {
            const order = applicableOrders[i]
            try {
              // Use the order ID directly with the new freeze API
              await freezeOrder(order.id, 'Массовая заморозка')
              newResults.push({ orderId: order.id, success: true })
            } catch (error) {
              const appError = parseError(error)
              newResults.push({ orderId: order.id, success: false, error: appError.message })
            }
            setProgress(Math.round(((i + 1) / applicableOrders.length) * 100))
          }
          setResults(newResults)
          const successCount = newResults.filter((r) => r.success).length
          toast.success(`Заморожено ${successCount} из ${applicableOrders.length} заказов`)
          break

        case 'cancel':
          await bulkAction({
            orderIds: applicableOrders.map((o) => o.id),
            action: 'cancel' as 'pause' | 'resume',
          })
          toast.success(`${applicableOrders.length} заказов отменено`)
          break
      }

      await fetchOrders()
      onSuccess?.()
    } catch (error) {
      const appError = parseError(error)
      logger.error(
        'Bulk action failed',
        error instanceof Error ? error : new Error(appError.message),
        { errorCode: appError.code }
      )

      if (appError.code === ErrorCodes.ORDER_CUTOFF_PASSED) {
        toast.error('Время отсечки прошло', {
          description: 'Изменения на сегодня невозможны',
        })
      } else {
        toast.error(appError.message, { description: appError.action })
      }
    } finally {
      setIsExecuting(false)
      setProgress(100)
    }
  }, [
    selectedAction,
    selectedCombo,
    applicableOrders,
    bulkAction,
    bulkUpdateSubscription,
    fetchOrders,
    onSuccess,
  ])

  // ─────────────────────────────────────────────────────────────────────────────
  // Reset
  // ─────────────────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    setStep(1)
    setSelectedAction(null)
    setSelectedCombo(null)
    setIsExecuting(false)
    setProgress(0)
    setResults([])
  }, [])

  return {
    // State
    step,
    selectedAction,
    selectedCombo,
    isExecuting,
    progress,
    results,

    // Computed
    isToday,
    availableActions,
    applicableOrders,
    canProceed,

    // Actions
    setStep,
    setSelectedAction,
    setSelectedCombo,
    executeAction,
    reset,
  }
}


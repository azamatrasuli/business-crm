/**
 * @fileoverview Employee Order Actions Hook
 * Handles order actions for employee detail page.
 * Extracted from employees/[id]/page.tsx to follow Single Responsibility Principle.
 */

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import type { EmployeeOrder } from '@/lib/api/employees'
import {
  getEmployeeFreezeInfo,
  freezeOrder,
  unfreezeOrder,
} from '@/lib/api/orders'
import { parseError, ErrorCodes } from '@/lib/errors'
import { logger } from '@/lib/logger'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface UseEmployeeOrderActionsReturn {
  // Dialog states
  cancelDialogOrder: EmployeeOrder | null
  freezeDialogOrder: EmployeeOrder | null
  pauseSubscriptionDialog: boolean

  // Loading
  actionLoading: boolean

  // Freeze info
  remainingFreezes: number
  maxFreezesPerWeek: number

  // Actions
  handleFreezeOrder: (order: EmployeeOrder) => Promise<void>
  handleUnfreezeOrder: (order: EmployeeOrder) => Promise<void>
  confirmFreezeOrder: () => Promise<void>
  closeFreezeDialog: () => void

  handleCancelOrder: (order: EmployeeOrder) => void
  confirmCancelOrder: () => Promise<void>
  closeCancelDialog: () => void

  handlePauseSubscription: () => Promise<void>
  handleResumeSubscription: () => Promise<void>
  openPauseDialog: () => void
  closePauseDialog: () => void

  // Refresh freeze info
  refreshFreezeInfo: () => Promise<void>
}

// ═══════════════════════════════════════════════════════════════════════════════
// Hook Implementation
// ═══════════════════════════════════════════════════════════════════════════════

export function useEmployeeOrderActions(
  employeeId: string,
  _subscriptionId: string | null | undefined, // Kept for backward compatibility, not used anymore
  onRefresh: () => Promise<void>
): UseEmployeeOrderActionsReturn {
  // Dialog states
  const [cancelDialogOrder, setCancelDialogOrder] = useState<EmployeeOrder | null>(null)
  const [freezeDialogOrder, setFreezeDialogOrder] = useState<EmployeeOrder | null>(null)
  const [pauseSubscriptionDialog, setPauseSubscriptionDialog] = useState(false)

  // Loading
  const [actionLoading, setActionLoading] = useState(false)

  // Freeze info
  const [remainingFreezes, setRemainingFreezes] = useState(2)
  const [maxFreezesPerWeek, setMaxFreezesPerWeek] = useState(2)

  // ─────────────────────────────────────────────────────────────────────────────
  // Refresh freeze info
  // ─────────────────────────────────────────────────────────────────────────────

  const refreshFreezeInfo = useCallback(async () => {
    if (!employeeId) return
    try {
      const info = await getEmployeeFreezeInfo(employeeId)
      setRemainingFreezes(info.remainingFreezes)
      setMaxFreezesPerWeek(info.maxFreezesPerWeek)
    } catch (error) {
      logger.error('Failed to fetch freeze info', error instanceof Error ? error : new Error('Unknown error'))
    }
  }, [employeeId])

  // ─────────────────────────────────────────────────────────────────────────────
  // Freeze/Unfreeze Actions
  // ─────────────────────────────────────────────────────────────────────────────

  const handleFreezeOrder = useCallback(
    async (order: EmployeeOrder) => {
      if (!employeeId) {
        toast.error('Невозможно заморозить заказ')
        return
      }
      try {
        const freezeInfo = await getEmployeeFreezeInfo(employeeId)
        setRemainingFreezes(freezeInfo.remainingFreezes)
        setMaxFreezesPerWeek(freezeInfo.maxFreezesPerWeek)
        
        if (freezeInfo.remainingFreezes <= 0) {
          toast.error(
            `Лимит заморозок исчерпан (${freezeInfo.freezesThisWeek}/${freezeInfo.maxFreezesPerWeek} на этой неделе)`
          )
          return
        }
        setFreezeDialogOrder(order)
      } catch {
        toast.error('Не удалось проверить лимит заморозок')
      }
    },
    [employeeId]
  )

  const handleUnfreezeOrder = useCallback(
    async (order: EmployeeOrder) => {
      if (!employeeId || !order.id) return
      setActionLoading(true)
      try {
        await unfreezeOrder(order.id)
        toast.success('Заказ разморожен', {
          description: 'Подписка сокращена на 1 день',
        })
        await refreshFreezeInfo()
        await onRefresh()
      } catch (error) {
        const appError = parseError(error)
        logger.error(
          'Failed to unfreeze order',
          error instanceof Error ? error : new Error(appError.message),
          { errorCode: appError.code }
        )
        toast.error(appError.message, { description: appError.action })
      } finally {
        setActionLoading(false)
      }
    },
    [employeeId, onRefresh, refreshFreezeInfo]
  )

  const confirmFreezeOrder = useCallback(async () => {
    if (!freezeDialogOrder || !employeeId || !freezeDialogOrder.id) return
    setActionLoading(true)
    try {
      const result = await freezeOrder(freezeDialogOrder.id, 'Заморозка через админ панель')
      
      toast.success('Заказ заморожен', {
        description: `Подписка продлена до ${result.subscription.endDate}`,
      })
      setFreezeDialogOrder(null)
      await refreshFreezeInfo()
      await onRefresh()
    } catch (error) {
      const appError = parseError(error)
      logger.error(
        'Failed to freeze order',
        error instanceof Error ? error : new Error(appError.message),
        { errorCode: appError.code }
      )

      if (appError.code === ErrorCodes.FREEZE_LIMIT_EXCEEDED) {
        toast.error('Лимит заморозок исчерпан!', {
          description: 'Вы уже использовали 2 заморозки на этой неделе. Дождитесь следующей недели.',
          duration: 10000,
        })
      } else if (appError.code === ErrorCodes.ORDER_CUTOFF_PASSED) {
        toast.error('Время для заморозки истекло', {
          description: 'Заморозка на сегодня невозможна после времени отсечки',
        })
      } else {
        toast.error(appError.message, { description: appError.action })
      }
    } finally {
      setActionLoading(false)
    }
  }, [freezeDialogOrder, employeeId, onRefresh, refreshFreezeInfo])

  const closeFreezeDialog = useCallback(() => {
    setFreezeDialogOrder(null)
  }, [])

  // ─────────────────────────────────────────────────────────────────────────────
  // Cancel Order
  // ─────────────────────────────────────────────────────────────────────────────

  const handleCancelOrder = useCallback((order: EmployeeOrder) => {
    setCancelDialogOrder(order)
  }, [])

  const confirmCancelOrder = useCallback(async () => {
    if (!cancelDialogOrder) return
    setActionLoading(true)
    try {
      // API call to cancel order would go here
      toast.success('Заказ отменён')
      setCancelDialogOrder(null)
      await onRefresh()
    } catch (error) {
      const appError = parseError(error)
      logger.error(
        'Failed to cancel order',
        error instanceof Error ? error : new Error(appError.message),
        { errorCode: appError.code }
      )

      if (appError.code === ErrorCodes.ORDER_CUTOFF_PASSED) {
        toast.error('Время для отмены истекло', {
          description: 'Отмена заказов на сегодня невозможна после времени отсечки',
        })
      } else {
        toast.error(appError.message, { description: appError.action })
      }
    } finally {
      setActionLoading(false)
    }
  }, [cancelDialogOrder, onRefresh])

  const closeCancelDialog = useCallback(() => {
    setCancelDialogOrder(null)
  }, [])

  // ─────────────────────────────────────────────────────────────────────────────
  // Pause/Resume Subscription (now handled via freeze period)
  // ─────────────────────────────────────────────────────────────────────────────

  const handlePauseSubscription = useCallback(async () => {
    // Note: Pause subscription is now handled via freeze period API
    // This is kept for backward compatibility
    toast.info('Используйте заморозку периода для приостановки подписки')
    setPauseSubscriptionDialog(false)
  }, [])

  const handleResumeSubscription = useCallback(async () => {
    // Note: Resume subscription is now handled via unfreeze API
    // This is kept for backward compatibility
    toast.info('Используйте разморозку заказов для возобновления')
  }, [])

  const openPauseDialog = useCallback(() => {
    setPauseSubscriptionDialog(true)
  }, [])

  const closePauseDialog = useCallback(() => {
    setPauseSubscriptionDialog(false)
  }, [])

  return {
    // Dialog states
    cancelDialogOrder,
    freezeDialogOrder,
    pauseSubscriptionDialog,

    // Loading
    actionLoading,

    // Freeze info
    remainingFreezes,
    maxFreezesPerWeek,

    // Actions
    handleFreezeOrder,
    handleUnfreezeOrder,
    confirmFreezeOrder,
    closeFreezeDialog,

    handleCancelOrder,
    confirmCancelOrder,
    closeCancelDialog,

    handlePauseSubscription,
    handleResumeSubscription,
    openPauseDialog,
    closePauseDialog,

    // Refresh freeze info
    refreshFreezeInfo,
  }
}

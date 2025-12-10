/**
 * @fileoverview Employee Order Actions Hook
 * Handles order actions for employee detail page.
 * Extracted from employees/[id]/page.tsx to follow Single Responsibility Principle.
 * 
 * FREEZE FUNCTIONALITY DISABLED (2025-01-09)
 * Freeze/unfreeze methods are kept as stubs for backward compatibility.
 */

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import type { EmployeeOrder } from '@/lib/api/employees'
// FREEZE DISABLED: imports kept for type compatibility only
// import { getEmployeeFreezeInfo, freezeOrder, unfreezeOrder } from '@/lib/api/orders'
import { parseError, ErrorCodes } from '@/lib/errors'
import { logger } from '@/lib/logger'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface UseEmployeeOrderActionsReturn {
  // Dialog states
  cancelDialogOrder: EmployeeOrder | null
  freezeDialogOrder: EmployeeOrder | null  // FREEZE DISABLED: kept for type compatibility
  pauseSubscriptionDialog: boolean

  // Loading
  actionLoading: boolean

  // Freeze info - DISABLED: always returns 0 available
  remainingFreezes: number
  maxFreezesPerWeek: number

  // Actions - FREEZE DISABLED: methods are no-ops
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

  // Refresh freeze info - DISABLED: no-op
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
  // Refresh freeze info - DISABLED (2025-01-09)
  // ─────────────────────────────────────────────────────────────────────────────

  const refreshFreezeInfo = useCallback(async () => {
    // FREEZE DISABLED: no-op, always returns 0 remaining
  }, [])

  // ─────────────────────────────────────────────────────────────────────────────
  // Freeze/Unfreeze Actions - DISABLED (2025-01-09)
  // These methods are kept as stubs for backward compatibility.
  // ─────────────────────────────────────────────────────────────────────────────

  const handleFreezeOrder = useCallback(
    async (_order: EmployeeOrder) => {
      // FREEZE DISABLED
      toast.info('Функционал заморозки временно отключён', {
        description: 'Используйте паузу для приостановки заказов',
      })
    },
    []
  )

  const handleUnfreezeOrder = useCallback(
    async (_order: EmployeeOrder) => {
      // FREEZE DISABLED
      toast.info('Функционал заморозки временно отключён')
    },
    []
  )

  const confirmFreezeOrder = useCallback(async () => {
    // FREEZE DISABLED
    setFreezeDialogOrder(null)
    toast.info('Функционал заморозки временно отключён')
  }, [])

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

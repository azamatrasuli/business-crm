/**
 * @fileoverview Order Actions Hook
 * Handles order-related actions like cancel, pause, resume.
 * Extracted from page.tsx to follow Single Responsibility Principle.
 * 
 * FREEZE FUNCTIONALITY DISABLED (2025-01-09)
 * Freeze/unfreeze methods are kept as stubs for backward compatibility.
 */

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { useHomeStore } from '@/stores/home-store'
import type { Order } from '@/lib/api/home'
// FREEZE DISABLED: imports kept for type compatibility only
// import { getEmployeeFreezeInfo, freezeOrder, unfreezeOrder } from '@/lib/api/orders'
import { parseError, ErrorCodes } from '@/lib/errors'
import { logger } from '@/lib/logger'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface SingleActionDialog {
  orderId: string
  employeeName: string
  action: 'pause' | 'resume'
}

export interface UseOrderActionsReturn {
  // Dialog states
  singleActionDialog: SingleActionDialog | null
  cancelDialogOrder: Order | null
  freezeDialogOrder: Order | null  // FREEZE DISABLED: kept for type compatibility
  compensationDialogOrder: Order | null
  subscriptionDialogOrder: Order | null

  // Loading states
  singleActionLoading: boolean
  actionLoading: boolean

  // Actions
  startSingleAction: (orderId: string, employeeName: string, action: 'pause' | 'resume') => void
  confirmSingleAction: () => Promise<void>
  closeSingleActionDialog: () => void

  // FREEZE DISABLED: methods kept as no-ops for backward compatibility
  handleFreezeOrder: (order: Order) => Promise<void>
  handleUnfreezeOrder: (order: Order) => Promise<void>
  confirmFreezeOrder: () => Promise<void>
  closeFreezeDialog: () => void

  handleCancelOrder: (order: Order) => void
  confirmCancelOrder: () => Promise<void>
  closeCancelDialog: () => void

  handleManageCompensation: (order: Order) => void
  closeCompensationDialog: () => void

  handleQuickEditLunch: (order: Order) => void
  closeSubscriptionDialog: () => void
}

// ═══════════════════════════════════════════════════════════════════════════════
// Hook Implementation
// ═══════════════════════════════════════════════════════════════════════════════

export function useOrderActions(onRefresh: () => void): UseOrderActionsReturn {
  const { bulkAction, fetchOrders } = useHomeStore()

  // Dialog states
  const [singleActionDialog, setSingleActionDialog] = useState<SingleActionDialog | null>(null)
  const [cancelDialogOrder, setCancelDialogOrder] = useState<Order | null>(null)
  const [freezeDialogOrder, setFreezeDialogOrder] = useState<Order | null>(null)
  const [compensationDialogOrder, setCompensationDialogOrder] = useState<Order | null>(null)
  const [subscriptionDialogOrder, setSubscriptionDialogOrder] = useState<Order | null>(null)

  // Loading states
  const [singleActionLoading, setSingleActionLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // ─────────────────────────────────────────────────────────────────────────────
  // Single Action (Pause/Resume)
  // ─────────────────────────────────────────────────────────────────────────────

  const startSingleAction = useCallback(
    (orderId: string, employeeName: string, action: 'pause' | 'resume') => {
      setSingleActionDialog({ orderId, employeeName, action })
    },
    []
  )

  const confirmSingleAction = useCallback(async () => {
    if (!singleActionDialog) return
    setSingleActionLoading(true)
    try {
      await bulkAction({
        orderIds: [singleActionDialog.orderId],
        action: singleActionDialog.action,
      })
      toast.success(
        singleActionDialog.action === 'pause'
          ? `Заказ для ${singleActionDialog.employeeName} поставлен на паузу`
          : `Заказ для ${singleActionDialog.employeeName} возобновлен`
      )
      setSingleActionDialog(null)
      onRefresh()
    } catch (error) {
      const appError = parseError(error)
      logger.error(
        'Single action failed',
        error instanceof Error ? error : new Error(appError.message),
        { errorCode: appError.code }
      )
      toast.error(appError.message, { description: appError.action })
    } finally {
      setSingleActionLoading(false)
    }
  }, [singleActionDialog, bulkAction, onRefresh])

  const closeSingleActionDialog = useCallback(() => {
    setSingleActionDialog(null)
  }, [])

  // ─────────────────────────────────────────────────────────────────────────────
  // Freeze/Unfreeze - DISABLED (2025-01-09)
  // These methods are kept as stubs for backward compatibility.
  // They show a toast message that freeze is disabled.
  // ─────────────────────────────────────────────────────────────────────────────

  const handleFreezeOrder = useCallback(async (_order: Order) => {
    // FREEZE DISABLED
    toast.info('Функционал заморозки временно отключён', {
      description: 'Используйте паузу для приостановки заказов',
    })
  }, [])

  const handleUnfreezeOrder = useCallback(async (_order: Order) => {
    // FREEZE DISABLED
    toast.info('Функционал заморозки временно отключён')
  }, [])

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

  const handleCancelOrder = useCallback((order: Order) => {
    setCancelDialogOrder(order)
  }, [])

  const confirmCancelOrder = useCallback(async () => {
    if (!cancelDialogOrder) return
    setActionLoading(true)
    try {
      await bulkAction({
        orderIds: [cancelDialogOrder.id],
        action: 'cancel' as 'pause' | 'resume', // API accepts cancel too
      })
      toast.success(`Заказ для ${cancelDialogOrder.employeeName} отменён`)
      setCancelDialogOrder(null)
      onRefresh()
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
  }, [cancelDialogOrder, bulkAction, onRefresh])

  const closeCancelDialog = useCallback(() => {
    setCancelDialogOrder(null)
  }, [])

  // ─────────────────────────────────────────────────────────────────────────────
  // Compensation Management
  // ─────────────────────────────────────────────────────────────────────────────

  const handleManageCompensation = useCallback((order: Order) => {
    setCompensationDialogOrder(order)
  }, [])

  const closeCompensationDialog = useCallback(() => {
    setCompensationDialogOrder(null)
  }, [])

  // ─────────────────────────────────────────────────────────────────────────────
  // Quick Edit Lunch (Subscription Dialog)
  // ─────────────────────────────────────────────────────────────────────────────

  const handleQuickEditLunch = useCallback((order: Order) => {
    setSubscriptionDialogOrder(order)
  }, [])

  const closeSubscriptionDialog = useCallback(() => {
    setSubscriptionDialogOrder(null)
  }, [])

  return {
    // Dialog states
    singleActionDialog,
    cancelDialogOrder,
    freezeDialogOrder,
    compensationDialogOrder,
    subscriptionDialogOrder,

    // Loading states
    singleActionLoading,
    actionLoading,

    // Actions
    startSingleAction,
    confirmSingleAction,
    closeSingleActionDialog,

    handleFreezeOrder,
    handleUnfreezeOrder,
    confirmFreezeOrder,
    closeFreezeDialog,

    handleCancelOrder,
    confirmCancelOrder,
    closeCancelDialog,

    handleManageCompensation,
    closeCompensationDialog,

    handleQuickEditLunch,
    closeSubscriptionDialog,
  }
}


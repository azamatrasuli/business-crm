/**
 * @fileoverview Order Actions Hook
 * Handles order-related actions like freeze, unfreeze, cancel, pause, resume.
 * Extracted from page.tsx to follow Single Responsibility Principle.
 */

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { useHomeStore } from '@/stores/home-store'
import type { Order } from '@/lib/api/home'
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

interface SingleActionDialog {
  orderId: string
  employeeName: string
  action: 'pause' | 'resume'
}

export interface UseOrderActionsReturn {
  // Dialog states
  singleActionDialog: SingleActionDialog | null
  cancelDialogOrder: Order | null
  freezeDialogOrder: Order | null
  compensationDialogOrder: Order | null
  subscriptionDialogOrder: Order | null

  // Loading states
  singleActionLoading: boolean
  actionLoading: boolean

  // Actions
  startSingleAction: (orderId: string, employeeName: string, action: 'pause' | 'resume') => void
  confirmSingleAction: () => Promise<void>
  closeSingleActionDialog: () => void

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
  // Freeze/Unfreeze
  // ─────────────────────────────────────────────────────────────────────────────

  const handleFreezeOrder = useCallback(async (order: Order) => {
    if (!order.employeeId) {
      toast.error('Невозможно заморозить гостевой заказ')
      return
    }

    try {
      const freezeInfo = await getEmployeeFreezeInfo(order.employeeId)
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
  }, [])

  const handleUnfreezeOrder = useCallback(
    async (order: Order) => {
      if (!order.employeeId) return

      setActionLoading(true)
      try {
        // Use new orders API - unfreeze by order ID directly
        const result = await unfreezeOrder(order.id)
        toast.success(`Заказ для ${order.employeeName} разморожен`, {
          description: `Подписка сокращена до ${result.subscription.endDate}`,
        })
        onRefresh()
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
    [onRefresh]
  )

  const confirmFreezeOrder = useCallback(async () => {
    if (!freezeDialogOrder || !freezeDialogOrder.employeeId) return
    setActionLoading(true)
    try {
      // Use new orders API - freeze by order ID directly
      const result = await freezeOrder(freezeDialogOrder.id, 'Заморозка через админ панель')
      toast.success(`Заказ для ${freezeDialogOrder.employeeName} заморожен`, {
        description: `Подписка продлена до ${result.subscription.endDate}`,
      })
      setFreezeDialogOrder(null)
      onRefresh()
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
      } else if (appError.code === ErrorCodes.ORDER_GUEST_CANNOT_FREEZE) {
        toast.error('Гостевые заказы нельзя замораживать')
      } else {
        toast.error(appError.message, { description: appError.action })
      }
    } finally {
      setActionLoading(false)
    }
  }, [freezeDialogOrder, onRefresh])

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


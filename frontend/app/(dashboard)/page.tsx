"use client"

import { useEffect, useMemo, useState, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ORDER_STATUS, getOrderStatusConfig } from '@/lib/constants/entity-statuses'
import {
  ORDER_STATUS_OPTIONS,
  ORDER_TYPE_OPTIONS,
  COMBO_TYPE_OPTIONS,
  SERVICE_TYPE_OPTIONS,
  toFilterOptions
} from '@/lib/constants/dictionaries'
import { useHomeStore } from '@/stores/home-store'
import { useProjectsStore } from '@/stores/projects-store'
import { useAuthStore } from '@/stores/auth-store'
import type { Order } from '@/lib/api/home'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FilterBuilder, type FilterField, type ActiveFilter } from '@/components/ui/filter-builder'
import { SortableHeader, useSort, sortData } from '@/components/ui/sortable-header'
import {
  Wallet,
  ShoppingCart,
  Users,
  Search,
  UtensilsCrossed,
  UserPlus,
  PauseCircle,
  PlayCircle,
  ChevronLeft,
  ChevronRight,
  Calendar,
  X,
  Trash2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'
// DropdownMenu imports removed - using inline buttons instead
import { GuestOrderDialog } from '@/components/features/home/guest-order-dialog'
import { BulkEditDialog } from '@/components/features/home/bulk-edit-dialog'
import { EditSubscriptionDialog } from '@/components/features/home/edit-subscription-dialog'
import { EditCompensationDialog } from '@/components/features/home/edit-compensation-dialog'
import { ManageLunchDialog } from '@/components/features/meals/manage-lunch-dialog'
import { ManageCompensationDialog } from '@/components/features/meals/manage-compensation-dialog'
import { DatePicker } from '@/components/ui/date-picker'
import { useEmployeesStore } from '@/stores/employees-store'
import { debounce } from 'lodash-es'
import { format, startOfDay } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { parseError, ErrorCodes } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { isFeatureEnabled } from '@/lib/features.config'
import { FeatureVisible } from '@/components/features/feature-gate'
import { DataTable } from '@/components/ui/data-table'
import type { ColumnDef } from '@tanstack/react-table'
import { Checkbox } from '@/components/ui/checkbox'

// Format date as YYYY-MM-DD in local timezone (not UTC!)
const formatISODate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatOrderDate = (date?: string | null) => {
  if (!date) return '-'
  try {
    return format(new Date(date), 'dd.MM.yyyy')
  } catch {
    return date
  }
}

const hasCutoffPassed = (cutoffTime: string | null) => {
  if (!cutoffTime) return false
  const [hours, minutes] = cutoffTime.split(':').map((part) => Number(part))
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return false
  const now = new Date()
  const cutoff = new Date()
  cutoff.setHours(hours, minutes, 0, 0)
  return now > cutoff
}

function HomePageContent() {
  const searchParams = useSearchParams()
  const {
    dashboard,
    orders,
    cutoffTime,
    isLoading: loading,
    error,
    total,
    currentPage,
    totalPages,
    showAll,
    search,
    activeFilters,
    fetchDashboard,
    fetchOrders,
    fetchCutoffTime,
    bulkAction,
    setActiveFilters,
    setShowAll,
  } = useHomeStore()
  const { fetchProjects, projects } = useProjectsStore()
  const { employees, fetchEmployees } = useEmployeesStore()
  const { projectName } = useAuthStore()
  const [guestOrderOpen, setGuestOrderOpen] = useState(false)
  const [bulkLunchOpen, setBulkLunchOpen] = useState(false)
  const [bulkCompensationOpen, setBulkCompensationOpen] = useState(false)
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const { sortConfig, toggleSort } = useSort<string>()
  const [singleActionDialog, setSingleActionDialog] = useState<{
    orderId: string
    employeeName: string
    action: 'pause' | 'resume'
  } | null>(null)
  const [singleActionLoading, setSingleActionLoading] = useState(false)
  const [subscriptionDialogOrder, setSubscriptionDialogOrder] = useState<Order | null>(null)

  // States for new action dialogs
  const [compensationDialogOrder, setCompensationDialogOrder] = useState<Order | null>(null)
  const [cancelDialogOrder, setCancelDialogOrder] = useState<Order | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Date constants
  const todayIso = formatISODate(new Date())

  // Get selected date from activeFilters (single source of truth)
  const selectedDate = useMemo(() => {
    const dateFilter = activeFilters.find(f => f.fieldId === 'date')
    return (dateFilter?.value as string) || ''
  }, [activeFilters])

  const hasFetched = useRef(false)

  // Initial data fetch + set today's date filter
  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true

    // Set today's date as default filter
    const todayFilter: ActiveFilter = {
      id: `date-${todayIso}`,
      fieldId: 'date',
      operator: 'equals',
      value: todayIso
    }
    setActiveFilters([todayFilter])

    // Pass today's date directly to avoid race condition
    fetchDashboard(todayIso)
    fetchCutoffTime()
    fetchProjects()
    fetchEmployees()
    fetchOrders(1, todayIso)
  }, [fetchDashboard, fetchCutoffTime, fetchProjects, fetchEmployees, fetchOrders, setActiveFilters, todayIso])

  useEffect(() => {
    const employeeParam = searchParams.get('employee')
    if (employeeParam) {
      useHomeStore.setState({ search: employeeParam })
      fetchOrders(1)
    }
  }, [searchParams, fetchOrders])

  useEffect(() => {
    setSelectedOrders((prev) =>
      prev.filter((id) =>
        orders.some((order) => order.id === id && order.type === 'Сотрудник')
      )
    )
  }, [orders])

  const debouncedSearch = debounce(() => {
    // Use selectedDate from current state when searching
    fetchOrders(1, selectedDate || undefined)
  }, 500)

  const handleSearchChange = (value: string) => {
    useHomeStore.setState({ search: value })
    debouncedSearch()
  }

  const handlePageChange = (page: number) => {
    fetchOrders(page, selectedDate || undefined)
  }

  // Sort orders with custom comparators
  const sortedOrders = useMemo(() => {
    return sortData(orders, sortConfig, {
      // Custom comparator for date strings (YYYY-MM-DD format)
      date: (a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0
        const dateB = b.date ? new Date(b.date).getTime() : 0
        return dateA - dateB
      },
      // Custom comparator for status ordering
      // Uses centralized ORDER_STATUS constants (Russian strings)
      status: (a, b) => {
        // Order status priority (higher = more important)
        // Active orders first, then paused, then completed/cancelled
        // NOTE: ORDER_STATUS.COMPLETED = 'Выполнен', ORDER_STATUS.CANCELLED = 'Отменён'
        const order: Record<string, number> = {
          [ORDER_STATUS.ACTIVE]: 4,      // 'Активен'
          [ORDER_STATUS.PAUSED]: 3,      // 'Приостановлен'
          [ORDER_STATUS.COMPLETED]: 2,   // 'Выполнен'
          [ORDER_STATUS.CANCELLED]: 1,   // 'Отменён'
          // Legacy value (different from COMPLETED)
          'Завершен': 2,
        }
        return (order[a.status] || 0) - (order[b.status] || 0)
      },
    })
  }, [orders, sortConfig])

  const employeeOrdersOnPage = useMemo(
    () => sortedOrders.filter((order) => order.type === 'Сотрудник'),
    [sortedOrders]
  )

  const selectedOrderDetails = useMemo(
    () => sortedOrders.filter((order) => selectedOrders.includes(order.id)),
    [sortedOrders, selectedOrders]
  )

  const selectedEmployeeOrders = useMemo(
    () => selectedOrderDetails.filter((order) => order.type === 'Сотрудник'),
    [selectedOrderDetails]
  )

  const displayDate = useMemo(() => {
    if (!selectedDate) return null
    try {
      // Parse as local date, not UTC
      const [year, month, day] = selectedDate.split('-').map(Number)
      return new Date(year, month - 1, day, 12, 0, 0)
    } catch {
      return null
    }
  }, [selectedDate])

  // Parse date string YYYY-MM-DD to local date (not UTC!)
  const parseLocalDate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day, 12, 0, 0) // noon to avoid DST issues
  }

  // Helper to update date filter in activeFilters
  const setDateFilter = useCallback((newDate: string) => {
    const filtersWithoutDate = activeFilters.filter(f => f.fieldId !== 'date')
    if (newDate) {
      const dateFilter: ActiveFilter = {
        id: `date-${newDate}`,
        fieldId: 'date',
        operator: 'equals',
        value: newDate
      }
      setActiveFilters([...filtersWithoutDate, dateFilter])
    } else {
      setActiveFilters(filtersWithoutDate)
    }
    // Pass date directly to avoid race condition with store update
    fetchOrders(1, newDate || undefined)
    fetchDashboard(newDate || undefined)
  }, [activeFilters, setActiveFilters, fetchOrders, fetchDashboard])

  // Date navigation handlers
  const goToPreviousDay = () => {
    const current = selectedDate ? parseLocalDate(selectedDate) : new Date()
    const prev = new Date(current.getFullYear(), current.getMonth(), current.getDate() - 1, 12, 0, 0)
    setDateFilter(formatISODate(prev))
  }

  const goToNextDay = () => {
    const current = selectedDate ? parseLocalDate(selectedDate) : new Date()
    const next = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1, 12, 0, 0)
    setDateFilter(formatISODate(next))
  }

  const selectDate = (date: Date | undefined) => {
    if (date) {
      setDateFilter(formatISODate(date))
    }
  }

  const showAllOrders = () => {
    setDateFilter('')
  }

  const showToday = () => {
    setDateFilter(todayIso)
  }

  const isTodaySelected = Boolean(selectedDate && selectedDate === todayIso)
  const isPastDateSelected = Boolean(selectedDate && selectedDate < todayIso)
  const hasDateFilter = Boolean(selectedDate)
  const isCutoffLocked = isTodaySelected && hasCutoffPassed(cutoffTime)
  const budgetDepleted = !dashboard || dashboard.totalBudget <= 0
  const pastDateDisabledReason = isPastDateSelected ? 'Нельзя создать заказ на прошедшую дату' : null
  const budgetDisabledReason = budgetDepleted ? 'Недостаточно средств на бюджете проекта' : null
  const cutoffDisabledReason = isCutoffLocked
    ? cutoffTime
      ? `Изменения на сегодня закрыты в ${cutoffTime}`
      : 'Изменения на сегодня закрыты'
    : null
  const guestDisabledReason = pastDateDisabledReason || budgetDisabledReason || cutoffDisabledReason

  useEffect(() => {
    if (isCutoffLocked) {
      setSelectedOrders([])
    }
  }, [isCutoffLocked])

  const startSingleAction = useCallback((orderId: string, employeeName: string, action: 'pause' | 'resume') => {
    setSingleActionDialog({ orderId, employeeName, action })
  }, [])

  const handleSelectOrder = useCallback(
    (orderId: string, selectable: boolean, checked: boolean) => {
      if (!selectable || isCutoffLocked) {
        return
      }
      setSelectedOrders((prev) => {
        if (checked) {
          if (prev.includes(orderId)) return prev
          return [...prev, orderId]
        }
        return prev.filter((id) => id !== orderId)
      })
    },
    [isCutoffLocked]
  )

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (isCutoffLocked) {
        return
      }
      if (!checked) {
        setSelectedOrders([])
        return
      }
      setSelectedOrders(employeeOrdersOnPage.map((order) => order.id))
    },
    [employeeOrdersOnPage, isCutoffLocked]
  )

  const getStatusColor = useCallback((status: string) => {
    // Use centralized status config
    const config = getOrderStatusConfig(status)
    return config.variant || 'outline'
  }, [])

  // Handler: Быстрое редактирование ланча из таблицы (комбо/адрес)
  const handleQuickEditLunch = useCallback((order: Order) => {
    // Открываем быстрый диалог редактирования (комбо + адрес)
    setSubscriptionDialogOrder(order)
  }, [])

  // Handler: Управлять компенсацией из заказа
  const handleManageCompensationFromOrder = useCallback((order: Order) => {
    setCompensationDialogOrder(order)
  }, [])

  // Handler: Отменить заказ
  const handleCancelOrder = useCallback((order: Order) => {
    setCancelDialogOrder(order)
  }, [])

  // NOTE: Freeze functionality has been removed from the system.
  // Orders can now only be cancelled, not frozen.

  // Confirm cancel order
  const confirmCancelOrder = useCallback(async () => {
    if (!cancelDialogOrder) return
    setActionLoading(true)
    try {
      await bulkAction({
        orderIds: [cancelDialogOrder.id],
        action: 'cancel',
      })
      toast.success(`Заказ для ${cancelDialogOrder.employeeName} отменён`)
      setCancelDialogOrder(null)
    } catch (error) {
      const appError = parseError(error)
      logger.error('Failed to cancel order', error instanceof Error ? error : new Error(appError.message), {
        errorCode: appError.code,
      })

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
  }, [cancelDialogOrder, bulkAction])


  const columns = useMemo<ColumnDef<Order>[]>(() => [
    {
      id: 'select',
      enableSorting: false,
      enableHiding: false,
      header: () => (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Checkbox
                  checked={
                    employeeOrdersOnPage.length > 0 &&
                    selectedOrders.length === employeeOrdersOnPage.length
                      ? true
                      : selectedOrders.length > 0
                      ? 'indeterminate'
                      : false
                  }
                  onCheckedChange={(checked) => handleSelectAll(checked === true)}
                  disabled={isCutoffLocked || employeeOrdersOnPage.length === 0}
                  aria-label="Выбрать все"
                />
              </span>
            </TooltipTrigger>
            {(isCutoffLocked || employeeOrdersOnPage.length === 0) && (
              <TooltipContent>
                {isCutoffLocked
                  ? cutoffDisabledReason
                  : 'Нет сотрудников в списке'}
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      ),
      cell: ({ row }) => {
        const order = row.original
        const isEmployee = order.type === 'Сотрудник'
        const checkboxDisabled = !isEmployee || isCutoffLocked
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Checkbox
                    checked={selectedOrders.includes(order.id)}
                    onCheckedChange={(checked) =>
                      handleSelectOrder(order.id, isEmployee, checked === true)
                    }
                    disabled={checkboxDisabled}
                    aria-label="Выбрать заказ"
                  />
                </span>
              </TooltipTrigger>
              {checkboxDisabled && (
                <TooltipContent>
                  {isEmployee
                    ? cutoffDisabledReason
                    : 'Массовые действия доступны только для сотрудников'}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        )
      },
    },
    {
      accessorKey: 'employeeName',
      header: () => (
        <SortableHeader
          label="ФИО"
          field="employeeName"
          currentSort={sortConfig}
          onSort={toggleSort}
        />
      ),
      cell: ({ row }) => {
        const order = row.original
        // Гостевые заказы не кликабельны (нет профиля)
        if (order.type === 'Гость' || !order.employeeId) {
          return <div className="font-medium">{order.employeeName}</div>
        }
        return (
          <Link
            href={`/employees/${order.employeeId}`}
            className="font-medium text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {order.employeeName}
          </Link>
        )
      },
    },
    {
      accessorKey: 'employeePhone',
      header: 'Телефон',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.employeePhone ?? '—'}</span>
      ),
    },
    {
      accessorKey: 'date',
      header: () => (
        <SortableHeader
          label="Дата"
          field="date"
          currentSort={sortConfig}
          onSort={toggleSort}
        />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatOrderDate(row.original.date)}</span>
      ),
    },
    {
      accessorKey: 'type',
      header: () => (
        <SortableHeader
          label="Тип"
          field="type"
          currentSort={sortConfig}
          onSort={toggleSort}
        />
      ),
      cell: ({ row }) => {
        const order = row.original
        const isEmployee = order.type === 'Сотрудник'
        return (
          <Badge variant={isEmployee ? 'default' : 'secondary'}>
            {order.type}
          </Badge>
        )
      },
    },
    // Колонка serviceType показывается только если compensation включён
    // (если выключен - все заказы LUNCH, колонка избыточна)
    ...(isFeatureEnabled('compensation') ? [{
      accessorKey: 'serviceType',
      header: () => (
        <SortableHeader
          label="Услуга"
          field="serviceType"
          currentSort={sortConfig}
          onSort={toggleSort}
        />
      ),
      cell: ({ row }: { row: { original: Order } }) => {
        const order = row.original
        if (!order.serviceType) {
          return <span className="text-muted-foreground">—</span>
        }
        return order.serviceType === 'LUNCH' ? (
          <Badge variant="outline" className="gap-1.5 bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
            <UtensilsCrossed className="h-3 w-3" />
            Ланч
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1.5 bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
            <Wallet className="h-3 w-3" />
            Компенсация
          </Badge>
        )
      },
    }] as ColumnDef<Order>[] : []),
    {
      id: 'details',
      header: 'Детали',
      cell: ({ row }) => {
        const order = row.original
        const orderDate = order.date ? new Date(order.date) : null
        const today = startOfDay(new Date())
        const isPastOrder = orderDate && orderDate < today
        const isTodayOrder = orderDate && orderDate.getTime() === today.getTime()
        // Note: future orders handled by default case below

        // LUNCH: показываем комбо и цену
        if (order.serviceType === 'LUNCH' || !order.serviceType) {
          const isEmployee = order.type === 'Сотрудник'
          // Прошлые заказы нельзя редактировать!
          const editDisabled = !isEmployee || isCutoffLocked || Boolean(isPastOrder)

          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-1.5 -ml-1.5 hover:bg-amber-50 dark:hover:bg-amber-950"
                      disabled={editDisabled}
                      onClick={() => {
                        if (editDisabled) return
                        setSubscriptionDialogOrder(order)
                      }}
                    >
                      <div className="flex flex-col items-start gap-0.5">
                        <span className="font-medium text-amber-700 dark:text-amber-400">
                          {order.comboType || 'Комбо'}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {order.amount?.toLocaleString() || 0} TJS
                        </span>
                      </div>
                    </Button>
                  </span>
                </TooltipTrigger>
                {editDisabled && isEmployee && (
                  <TooltipContent>
                    {isPastOrder
                      ? 'Прошлые заказы нельзя редактировать'
                      : cutoffDisabledReason || 'Редактирование недоступно'}
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )
        }

        // COMPENSATION: показываем потрачено/лимит в зависимости от времени
        const limit = order.compensationLimit || 0
        const spent = order.compensationAmount || 0
        const remaining = limit - spent

        // Прошлое: показываем сколько потрачено из лимита
        if (isPastOrder) {
          const percentUsed = limit > 0 ? (spent / limit) * 100 : 0
          return (
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline gap-1.5">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {spent.toLocaleString()} TJS
                </span>
                <span className="text-[10px] text-muted-foreground">
                  из {limit.toLocaleString()}
                </span>
              </div>
              <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${Math.min(percentUsed, 100)}%` }}
                />
              </div>
            </div>
          )
        }

        // Сегодня: показываем текущий расход и остаток
        if (isTodayOrder) {
          return (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-baseline gap-1">
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {spent > 0 ? `${spent.toLocaleString()} TJS` : 'Не использован'}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground">
                {spent > 0 ? `остаток: ${remaining.toLocaleString()} TJS` : `лимит: ${limit.toLocaleString()} TJS`}
              </span>
            </div>
          )
        }

        // Будущее: показываем доступный лимит
        return (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-muted-foreground">
              {limit.toLocaleString()} TJS
            </span>
            <span className="text-[10px] text-muted-foreground">
              дневной лимит
            </span>
          </div>
        )
      },
    },
    {
      id: 'location',
      header: () => (
        <SortableHeader
          label="Локация"
          field="address"
          currentSort={sortConfig}
          onSort={toggleSort}
        />
      ),
      cell: ({ row }) => {
        const order = row.original
        const isEmployee = order.type === 'Сотрудник'
        const isCompensation = order.serviceType === 'COMPENSATION'

        // Проверка на прошлые заказы
        const orderDate = order.date ? new Date(order.date) : null
        const today = startOfDay(new Date())
        const isPastOrder = orderDate && orderDate < today

        // Для компенсаций показываем ресторан (не редактируемый)
        if (isCompensation) {
          const restaurant = order.restaurantName || order.address
          if (!restaurant) {
            return <span className="text-muted-foreground text-sm">—</span>
          }
          return (
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-emerald-600 dark:text-emerald-400">🍽️</span>
              <span className="text-muted-foreground truncate max-w-[150px]" title={restaurant}>
                {restaurant}
              </span>
            </div>
          )
        }

        // Для ланчей показываем адрес (редактируемый, но не для прошлых заказов)
        const addressDisabled = !isEmployee || isCutoffLocked || Boolean(isPastOrder)
        const orderAddress = order.address || 'Адрес не указан'

        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="link"
                    className="h-auto p-0 text-sm"
                    disabled={addressDisabled}
                    onClick={() => {
                      if (addressDisabled) return
                      setSubscriptionDialogOrder(order)
                    }}
                  >
                    <span className="truncate max-w-[150px]" title={orderAddress}>
                      {orderAddress}
                    </span>
                  </Button>
                </span>
              </TooltipTrigger>
              {addressDisabled && (
                <TooltipContent>
                  {isPastOrder
                    ? 'Прошлые заказы нельзя редактировать'
                    : isEmployee
                      ? cutoffDisabledReason || 'Редактирование недоступно'
                      : 'Недоступно для гостевых заказов'}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        )
      },
    },
    {
      accessorKey: 'status',
      header: () => (
        <SortableHeader
          label="Статус"
          field="status"
          currentSort={sortConfig}
          onSort={toggleSort}
        />
      ),
      cell: ({ row }) => {
        const order = row.original
        const config = getOrderStatusConfig(order.status)
        return (
          <Badge variant={config.variant || 'outline'} className={`min-w-[76px] justify-center ${config.className}`}>
            {order.status}
          </Badge>
        )
      },
    },
    {
      id: 'actions',
      header: 'Действия',
      cell: ({ row }) => {
        const order = row.original
        const isEmployee = order.type === 'Сотрудник'
        const isGuest = order.type === 'Гость'
        const isCompensation = order.serviceType === 'COMPENSATION'

        const orderDate = order.date ? new Date(order.date) : null
        const today = startOfDay(new Date())
        const isPastOrder = orderDate && orderDate < today
        const isTodayOrder = orderDate && orderDate.getTime() === today.getTime()
        const isFutureOrder = orderDate && orderDate > today

        // Прошлые заказы — только просмотр (история)
        if (isPastOrder) {
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-muted-foreground text-xs px-2 py-1 bg-muted rounded">История</span>
                </TooltipTrigger>
                <TooltipContent>Прошлые заказы нельзя редактировать</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        }

        // Завершённые заказы (all terminal delivery states)
        const isDeliveredStatus = order.status === ORDER_STATUS.COMPLETED ||
                                   order.status === 'Завершен' ||
                                   order.status === 'Выполнен' ||
                                   order.status === 'Доставлен'  // Legacy
        if (isDeliveredStatus) {
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-emerald-500 text-xs px-2 py-1 bg-emerald-50 dark:bg-emerald-950 rounded">✓ Завершён</span>
                </TooltipTrigger>
                <TooltipContent>Заказ завершён</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        }

        const actionDisabled = isCutoffLocked

        // COMPENSATION заказы - кнопки в ряд
        if (isCompensation) {
          const compIsActive = order.status === ORDER_STATUS.ACTIVE || order.status === 'Активен'
          const compIsPaused = order.status === ORDER_STATUS.PAUSED || order.status === 'Приостановлен'
          const compIsCancelled = order.status === 'Отменён'
          const compIsModifiable = compIsActive || compIsPaused
          const canEdit = !isPastOrder && !isDeliveredStatus && compIsModifiable
          const canCancel = !actionDisabled && (isTodayOrder || isFutureOrder) && compIsModifiable

          return (
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              {/* Управлять компенсацией */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={!compIsModifiable ? "h-8 w-8 text-muted-foreground" : "h-8 w-8 text-emerald-600 hover:text-emerald-700"}
                        disabled={!canEdit}
                        onClick={() => handleManageCompensationFromOrder(order)}
                      >
                        <Wallet className="h-4 w-4" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {compIsCancelled ? 'Компенсация отменена' : (canEdit ? 'Управлять компенсацией' : 'Компенсация завершена')}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Отменить */}
              {canCancel && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleCancelOrder(order)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Отменить компенсацию</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              
              {/* Если отменён - показываем индикатор */}
              {compIsCancelled && (
                <span className="text-xs text-muted-foreground px-2">Отменена</span>
              )}
            </div>
          )
        }

        // Гостевые заказы - кнопки в ряд
        if (isGuest) {
          const guestIsActive = order.status === ORDER_STATUS.ACTIVE || order.status === 'Активен'
          const guestIsPaused = order.status === ORDER_STATUS.PAUSED || order.status === 'Приостановлен' || order.status === 'На паузе'
          const guestIsCancelled = order.status === 'Отменён'
          const guestIsModifiable = guestIsActive || guestIsPaused
          
          return (
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              {/* Пауза / Возобновить */}
              {guestIsActive && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={actionDisabled}
                          onClick={() => startSingleAction(order.id, order.employeeName, 'pause')}
                        >
                          <PauseCircle className="h-4 w-4" />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {actionDisabled ? cutoffDisabledReason : 'Поставить на паузу'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {/* 'На паузе' is DEPRECATED, use 'Приостановлен' */}
              {guestIsPaused && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={actionDisabled}
                          onClick={() => startSingleAction(order.id, order.employeeName, 'resume')}
                        >
                          <PlayCircle className="h-4 w-4" />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {actionDisabled ? cutoffDisabledReason : 'Возобновить'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {/* Отменить - только для Active и Paused */}
              {guestIsModifiable && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          disabled={actionDisabled}
                          onClick={() => handleCancelOrder(order)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {actionDisabled ? cutoffDisabledReason : 'Отменить заказ'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              
              {/* Если отменён - показываем индикатор */}
              {guestIsCancelled && (
                <span className="text-xs text-muted-foreground px-2">Отменён</span>
              )}
            </div>
          )
        }

        // LUNCH для сотрудников — кнопки в ряд как на странице сотрудников
        const isActiveOrder = order.status === ORDER_STATUS.ACTIVE || order.status === 'Активен'
        const isPausedOrder = order.status === ORDER_STATUS.PAUSED || order.status === 'Приостановлен' || order.status === 'На паузе'
        const isCancelledOrder = order.status === 'Отменён'
        const isCompletedOrder = order.status === ORDER_STATUS.COMPLETED || order.status === 'Выполнен'
        const isModifiable = isActiveOrder || isPausedOrder // Active and Paused can be modified/cancelled
        const canEdit = !actionDisabled && isEmployee && isModifiable
        // NOTE: Pause/Resume removed for individual orders - use subscription-level pause instead
        const canCancel = !actionDisabled && isEmployee && isModifiable

        // Tooltip text based on status
        const getEditTooltip = () => {
          if (isCancelledOrder) return 'Заказ отменён'
          if (isCompletedOrder) return 'Заказ выполнен'
          if (canEdit) return 'Управлять обедом'
          if (actionDisabled) return cutoffDisabledReason
          return 'Недоступно'
        }
        const getCancelTooltip = () => {
          if (isCancelledOrder) return 'Заказ отменён'
          if (isCompletedOrder) return 'Заказ выполнен'
          if (canCancel) return 'Отменить заказ'
          if (actionDisabled) return cutoffDisabledReason
          return 'Недоступно'
        }

        return (
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            {/* Управлять обедом */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={!isModifiable ? "h-8 w-8 text-muted-foreground" : "h-8 w-8 text-amber-600 hover:text-amber-700"}
                        disabled={!canEdit}
                        onClick={() => handleQuickEditLunch(order)}
                      >
                        <UtensilsCrossed className="h-4 w-4" />
                      </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{getEditTooltip()}</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Отменить */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={!isModifiable ? "h-8 w-8 text-muted-foreground" : "h-8 w-8 text-destructive hover:text-destructive"}
                      disabled={!canCancel}
                      onClick={() => handleCancelOrder(order)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{getCancelTooltip()}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )
      },
    },
  ], [
    employeeOrdersOnPage,
    selectedOrders,
    handleSelectAll,
    handleSelectOrder,
    isCutoffLocked,
    cutoffDisabledReason,
    getStatusColor,
    startSingleAction,
    sortConfig,
    toggleSort,
    handleQuickEditLunch,
    handleManageCompensationFromOrder,
    handleCancelOrder,
  ])

  const confirmSingleAction = async () => {
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
    } catch (error) {
      const appError = parseError(error)
      logger.error('Single action failed', error instanceof Error ? error : new Error(appError.message), {
        errorCode: appError.code,
      })
      toast.error(appError.message, { description: appError.action })
    } finally {
      setSingleActionLoading(false)
    }
  }

  // Dynamic filter fields based on projects (date is now in the dedicated date picker)
  // Все опции берутся из единого источника: lib/constants/dictionaries.ts
  const orderFilterFields = useMemo<FilterField[]>(() => {
    const projectOptions = Array.isArray(projects) ? projects : []
    const fields: FilterField[] = [
      {
        id: 'status',
        label: 'Статус заказа',
        type: 'select',
        operators: ['equals'],
        options: toFilterOptions(ORDER_STATUS_OPTIONS),
      },
      {
        id: 'type',
        label: 'Тип заказчика',
        type: 'select',
        operators: ['equals'],
        options: toFilterOptions(ORDER_TYPE_OPTIONS),
      },
      {
        id: 'comboType',
        label: 'Тип комбо-обеда',
        type: 'select',
        operators: ['equals'],
        options: toFilterOptions(COMBO_TYPE_OPTIONS),
      },
    ]

    // Add serviceType filter only if compensation feature is enabled
    if (isFeatureEnabled('compensation')) {
      fields.push({
        id: 'serviceType',
        label: 'Тип услуги',
        type: 'select',
        operators: ['equals'],
        options: toFilterOptions(SERVICE_TYPE_OPTIONS),
      })
    }

    // Add project filter (only useful for HQ users with multiple projects)
    // Проекты загружаются динамически из API
    if (projectOptions.length > 1) {
      fields.push({
        id: 'projectId',
        label: 'Локация доставки',
        type: 'select',
        operators: ['equals'],
        options: projectOptions.map((proj) => ({
          value: proj.id,
          label: `${proj.name} — ${proj.addressName || proj.addressFullAddress}`
        })),
      })
    }

    return fields
  }, [projects])

  const handleFiltersChange = useCallback((filters: ActiveFilter[]) => {
    setActiveFilters(filters)
    // Extract date from new filters and pass directly to avoid race condition
    const dateFilter = filters.find(f => f.fieldId === 'date')
    const dateValue = dateFilter?.value as string | undefined
    fetchOrders(1, dateValue)
    fetchDashboard(dateValue)
  }, [setActiveFilters, fetchOrders, fetchDashboard])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {projectName ? `Статистика проекта` : 'Админ панель'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Управление заказами и статистика {projectName ? `проекта "${projectName}"` : 'компании'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setBulkLunchOpen(true)}
            className="flex-1 sm:flex-initial gap-2 text-amber-600 hover:text-amber-700"
          >
            <UtensilsCrossed className="h-4 w-4" />
            Назначить обеды
          </Button>
          <FeatureVisible feature="compensation">
          <Button
            variant="outline"
            onClick={() => setBulkCompensationOpen(true)}
            className="flex-1 sm:flex-initial gap-2 text-emerald-600 hover:text-emerald-700"
          >
            <Wallet className="h-4 w-4" />
            Назначить компенсации
          </Button>
          </FeatureVisible>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex-1 sm:flex-initial">
                  <Button
                    variant="secondary"
                    onClick={() => setGuestOrderOpen(true)}
                    className="gap-2 w-full sm:w-auto"
                    disabled={Boolean(guestDisabledReason)}
                  >
                    <UserPlus className="h-4 w-4" />
                    Гостевой заказ
                    {displayDate && (
                      <span className="text-muted-foreground">· {format(displayDate, 'd MMM', { locale: ru })}</span>
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              {guestDisabledReason && <TooltipContent>{guestDisabledReason}</TooltipContent>}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Dashboard Stats Cards */}
      {dashboard && (
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {/* Баланс */}
          <Card className="relative overflow-hidden border border-emerald-500/20 py-0">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent" />
            <CardContent className="relative p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="rounded bg-emerald-500/10 p-1">
                  <Wallet className="h-3 w-3 text-emerald-500" />
                </div>
                <span className="text-xs text-muted-foreground">Баланс</span>
              </div>
              <p className="text-lg font-bold">{dashboard.totalBudget.toLocaleString()}<span className="text-xs text-muted-foreground font-normal ml-1">TJS</span></p>
              <p className="text-[10px] text-muted-foreground">остаток: {(dashboard.totalBudget - dashboard.forecast).toLocaleString()}</p>
            </CardContent>
          </Card>

          {/* Прогноз расходов */}
          <Card className="relative overflow-hidden border border-red-500/20 py-0">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 via-rose-500/5 to-transparent" />
            <CardContent className="relative p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="rounded bg-red-500/10 p-1">
                  <UtensilsCrossed className="h-3 w-3 text-red-500" />
                </div>
                <span className="text-xs text-muted-foreground">Расходы</span>
              </div>
              <p className="text-lg font-bold">{dashboard.forecast.toLocaleString()}<span className="text-xs text-muted-foreground font-normal ml-1">TJS</span></p>
              <p className="text-[10px] text-muted-foreground">
                {dashboard.totalBudget > 0
                  ? `${((dashboard.forecast / dashboard.totalBudget) * 100).toFixed(0)}% от бюджета`
                  : 'прогноз'
                }
              </p>
            </CardContent>
          </Card>

          {/* Заказы на дату */}
          <Card className="relative overflow-hidden border border-blue-500/20 py-0">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-transparent" />
            <CardContent className="relative p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="rounded bg-blue-500/10 p-1">
                  <ShoppingCart className="h-3 w-3 text-blue-500" />
                </div>
                <span className="text-xs text-muted-foreground">
                  {isTodaySelected ? 'Заказы сегодня' : hasDateFilter ? `Заказы на ${displayDate ? format(displayDate, 'dd.MM') : ''}` : 'Все заказы'}
                </span>
              </div>
              <p className="text-lg font-bold">{dashboard.activeOrders}<span className="text-sm text-muted-foreground font-normal">/{dashboard.totalOrders}</span></p>
              <p className="text-[10px] text-muted-foreground">
                активных
                {isTodaySelected && cutoffTime && !isCutoffLocked && (
                  <span className="text-blue-600 ml-1">• до {cutoffTime}</span>
                )}
                {isTodaySelected && isCutoffLocked && (
                  <span className="text-orange-600 ml-1">• закрыто</span>
                )}
              </p>
            </CardContent>
          </Card>

          {/* Приостановлено */}
          <Card className="relative overflow-hidden border border-orange-500/20 py-0">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-transparent" />
            <CardContent className="relative p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="rounded bg-orange-500/10 p-1">
                  <PauseCircle className="h-3 w-3 text-orange-500" />
                </div>
                <span className="text-xs text-muted-foreground">Приостановлено</span>
              </div>
              <p className="text-lg font-bold">{dashboard.pausedOrders + dashboard.pausedGuestOrders}</p>
              <p className="text-[10px] text-muted-foreground">
                {dashboard.pausedOrders > 0 && `${dashboard.pausedOrders} сотр.`}
                {dashboard.pausedOrders > 0 && dashboard.pausedGuestOrders > 0 && ' + '}
                {dashboard.pausedGuestOrders > 0 && `${dashboard.pausedGuestOrders} гост.`}
                {dashboard.pausedOrders === 0 && dashboard.pausedGuestOrders === 0 && 'заказов'}
              </p>
            </CardContent>
          </Card>

          {/* Отменённые */}
          <Card className="relative overflow-hidden border border-gray-500/20 py-0">
            <div className="absolute inset-0 bg-gradient-to-br from-gray-500/10 via-slate-500/5 to-transparent" />
            <CardContent className="relative p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="rounded bg-gray-500/10 p-1">
                  <X className="h-3 w-3 text-gray-500" />
                </div>
                <span className="text-xs text-muted-foreground">Отменённые</span>
              </div>
              <p className="text-lg font-bold">{dashboard.cancelledOrders ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">заказов</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Date Navigator */}
      <Card className="border-0 shadow-sm py-0">
        <CardContent className="py-3 px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Date Picker with Navigation */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">Заказы на</span>
              </div>

              <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-md hover:bg-background"
                  onClick={(e) => {
                    e.stopPropagation()
                    goToPreviousDay()
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <DatePicker
                  value={displayDate ?? undefined}
                  onChange={selectDate}
                  placeholder="Все даты"
                  className="w-[130px] border-0 bg-background shadow-sm"
                />

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-md hover:bg-background"
                  onClick={(e) => {
                    e.stopPropagation()
                    goToNextDay()
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {!isTodaySelected && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={showToday}
                  className="text-xs"
                >
                  Сегодня
                </Button>
              )}

              {hasDateFilter ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={showAllOrders}
                  className="text-xs text-muted-foreground hover:text-foreground gap-1"
                >
                  <X className="h-3 w-3" />
                  Все заказы
                </Button>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  Показаны все заказы
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px] max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Поиск по сотруднику или адресу..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <FilterBuilder
          fields={orderFilterFields}
          activeFilters={activeFilters}
          onFiltersChange={handleFiltersChange}
        />

        {/* Кнопка редактирования — disabled пока не выбраны заказы */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  onClick={() => setBulkEditOpen(true)}
                  className="gap-2"
                  disabled={selectedOrders.length === 0 || isCutoffLocked}
                >
                  <Users className="h-4 w-4" />
                  {selectedOrders.length > 0
                    ? `Редактировать (${selectedOrders.length})`
                    : 'Выберите заказы'
                  }
                </Button>
              </span>
            </TooltipTrigger>
            {selectedOrders.length === 0 && (
              <TooltipContent>Выберите заказы в таблице для редактирования</TooltipContent>
            )}
            {selectedOrders.length > 0 && isCutoffLocked && (
              <TooltipContent>Время отсечки прошло — редактирование недоступно</TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div>
              <AlertDescription className="font-medium">{error}</AlertDescription>
              <p className="text-sm text-destructive/70 mt-1">
                Если проблема повторяется, обратитесь в поддержку.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchDashboard()}
            className="w-full sm:w-auto flex-shrink-0 border-destructive/30 hover:bg-destructive/10"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Повторить
          </Button>
        </Alert>
      )}

      {/* Orders Table */}
      <DataTable
        columns={columns}
        data={sortedOrders}
        isLoading={loading && orders.length === 0}
        loadingRows={5}
        emptyMessage={
          <div className="p-12 text-center">
            <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Заказы не найдены</h3>
            <p className="text-muted-foreground">
              Начните с назначения обедов сотрудникам
            </p>
          </div>
        }
      />

      {/* Pagination */}
      {(totalPages > 1 || showAll) && (
        <div className="flex items-center justify-between rounded-lg border bg-card px-6 py-4">
          <div className="text-sm text-muted-foreground">
            {showAll 
              ? `Показано все: ${total}`
              : `Показано ${((currentPage - 1) * 20) + 1} - ${Math.min(currentPage * 20, total)} из ${total}`
            }
          </div>
          <div className="flex gap-2">
            {showAll ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAll(false)
                  fetchOrders(1)
                }}
                disabled={loading}
              >
                По страницам
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || loading}
                >
                  Назад
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || loading}
                >
                  Вперед
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAll(true)
                    fetchOrders(1)
                  }}
                  disabled={loading}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Показать все
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Dialogs */}
      <GuestOrderDialog open={guestOrderOpen} onOpenChange={setGuestOrderOpen} />
      <BulkEditDialog
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        selectedOrders={selectedEmployeeOrders}
        selectedDate={selectedDate}
        onSuccess={() => {
          setSelectedOrders([])
          fetchOrders(1)
        }}
      />
      <EditSubscriptionDialog
        open={Boolean(subscriptionDialogOrder)}
        order={subscriptionDialogOrder}
        onOpenChange={(open) => {
          if (!open) {
            setSubscriptionDialogOrder(null)
          }
        }}
      />
      <ManageLunchDialog
        open={bulkLunchOpen}
        onOpenChange={setBulkLunchOpen}
        mode="bulk"
        employees={employees}
        onSuccess={() => {
          fetchOrders(1)
          fetchDashboard()
        }}
      />
      {isFeatureEnabled('compensation') && (
      <ManageCompensationDialog
        open={bulkCompensationOpen}
        onOpenChange={setBulkCompensationOpen}
        mode="bulk"
        employees={employees}
        onSuccess={() => {
          fetchOrders(1)
          fetchDashboard()
        }}
      />
      )}

      <AlertDialog open={singleActionDialog !== null} onOpenChange={(open) => !open && setSingleActionDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {singleActionDialog?.action === 'pause'
                ? `Поставить на паузу заказ для ${singleActionDialog?.employeeName}?`
                : `Возобновить заказ для ${singleActionDialog?.employeeName}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Действие применится к выбранному сотруднику только на текущий отображаемый день.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={singleActionLoading}>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSingleAction} disabled={singleActionLoading}>
              {singleActionDialog?.action === 'pause' ? 'Поставить на паузу' : 'Возобновить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Отменить заказ */}
      <AlertDialog open={cancelDialogOrder !== null} onOpenChange={(open) => !open && setCancelDialogOrder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Отменить заказ для {cancelDialogOrder?.employeeName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {cancelDialogOrder?.serviceType === 'COMPENSATION'
                ? 'Компенсация на этот день будет отменена. Бюджет будет возвращён.'
                : 'Заказ на обед будет отменён. Стоимость будет возвращена на баланс.'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCancelOrder}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Отменить заказ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Быстрое редактирование компенсации из таблицы */}
      {isFeatureEnabled('compensation') && (
      <EditCompensationDialog
        open={Boolean(compensationDialogOrder)}
        onOpenChange={(open) => !open && setCompensationDialogOrder(null)}
        order={compensationDialogOrder}
        onSuccess={() => {
          fetchOrders(1)
          fetchDashboard()
        }}
      />
      )}
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="p-6 text-center">Загрузка...</div>}>
      <HomePageContent />
    </Suspense>
  )
}

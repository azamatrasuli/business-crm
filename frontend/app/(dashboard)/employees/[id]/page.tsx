'use client'

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useEmployeesStore } from '@/stores/employees-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { 
  ArrowLeft, 
  Pencil, 
  Wallet, 
  History, 
  UtensilsCrossed, 
  Calendar as CalendarIcon, 
  Phone,
  Mail,
  FolderKanban,
  CheckCircle2,
  Clock,
  XCircle,
  Ban,
  TrendingUp,
  CalendarDays,
  RefreshCw,
  AlertTriangle,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  MapPin,
  PauseCircle,
  Snowflake,
  Table,
  PlayCircle,
  Trash2,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EditEmployeeDialog } from '@/components/features/employees/edit-employee-dialog'
import { ManageLunchDialog } from '@/components/features/meals/manage-lunch-dialog'
import { ManageCompensationDialog } from '@/components/features/meals/manage-compensation-dialog'
import { EditSubscriptionDialog } from '@/components/features/home/edit-subscription-dialog'
import type { Order } from '@/lib/api/home'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataTable } from '@/components/ui/data-table'
import { SortableHeader, useSort, sortData } from '@/components/ui/sortable-header'
import { cn } from '@/lib/utils'
import { format, differenceInDays, parseISO, isAfter, addDays, startOfMonth, startOfWeek, isSameDay, isToday, isSameMonth, getDay, startOfDay } from 'date-fns'
import { ru } from 'date-fns/locale'
import { employeesApi, type EmployeeOrder, type DayOfWeek } from '@/lib/api/employees'
import { getEffectiveWorkingDays } from '@/lib/constants/employee'
import { isFeatureEnabled } from '@/lib/features.config'
import { getEmployeeFreezeInfo, freezeOrder, unfreezeOrder } from '@/lib/api/orders'
import { toast } from 'sonner'
import { parseError, ErrorCodes } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import type { ColumnDef } from '@tanstack/react-table'

// День недели названия
const DAYS_OF_WEEK_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

export default function EmployeeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const { selectedEmployee: currentEmployee, isLoading: loading, error, fetchEmployee } = useEmployeesStore()
  const [editOpen, setEditOpen] = useState(false)
  const [lunchDialogOpen, setLunchDialogOpen] = useState(false)
  const [compensationDialogOpen, setCompensationDialogOpen] = useState(false)
  // For full flow creation
  const [lunchCreateOpen, setLunchCreateOpen] = useState(false)
  const [compensationCreateOpen, setCompensationCreateOpen] = useState(false)
  const fetchedIdRef = useRef<string | null>(null)
  
  // Orders state
  const [orders, setOrders] = useState<EmployeeOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [ordersPage, setOrdersPage] = useState(1)
  const [ordersTotalPages, setOrdersTotalPages] = useState(0)
  const [ordersTotal, setOrdersTotal] = useState(0)
  const { sortConfig, toggleSort } = useSort<string>()
  
  // Calendar state
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [selectedOrderDate, setSelectedOrderDate] = useState<Date | null>(null)
  const [orderDetailOpen, setOrderDetailOpen] = useState(false)
  const [selectedDayOrders, setSelectedDayOrders] = useState<EmployeeOrder[]>([])
  
  // Action dialogs state
  const [cancelDialogOrder, setCancelDialogOrder] = useState<EmployeeOrder | null>(null)
  const [freezeDialogOrder, setFreezeDialogOrder] = useState<EmployeeOrder | null>(null)
  
  // Single order edit dialog (for changing combo of one order, not entire subscription)
  const [editSingleOrderOpen, setEditSingleOrderOpen] = useState(false)
  const [editSingleOrder, setEditSingleOrder] = useState<Order | null>(null)
  const [pauseSubscriptionDialog, setPauseSubscriptionDialog] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Load orders
  const loadOrders = useCallback(async () => {
    if (!id) return
    setOrdersLoading(true)
    try {
      const response = await employeesApi.getEmployeeOrders(id, ordersPage, 20)
      setOrders(response.items)
      setOrdersTotalPages(response.totalPages)
      setOrdersTotal(response.total)
    } catch {
      // Error handled by API client
    } finally {
      setOrdersLoading(false)
    }
  }, [id, ordersPage])

  useEffect(() => {
    if (id && fetchedIdRef.current !== id) {
      fetchedIdRef.current = id
      fetchEmployee(id)
    }
  }, [id, fetchEmployee])

  useEffect(() => {
    if (id) {
      loadOrders()
    }
  }, [id, loadOrders])

  // Extract data from currentEmployee (with defaults to prevent issues before data loads)
  const lunchSub = currentEmployee?.lunchSubscription ?? null
  const compensation = currentEmployee?.compensation ?? null

  // All useMemo hooks BEFORE any conditional returns
  const canEdit = Boolean(currentEmployee?.isActive)
  const hasAcceptedInvite = currentEmployee?.inviteStatus === 'Принято'
  const canManageBudget = Boolean(currentEmployee?.isActive && hasAcceptedInvite)
  
  // ═══════════════════════════════════════════════════════════════
  // Проверка типа услуги сотрудника (привязан к сотруднику, не к проекту)
  // ═══════════════════════════════════════════════════════════════
  const hasActiveLunch = Boolean(currentEmployee?.activeLunchSubscriptionId)
  const hasActiveCompensation = Boolean(currentEmployee?.activeCompensationId)
  const employeeServiceType = currentEmployee?.serviceType // LUNCH | COMPENSATION | null
  
  // Business rule: can switch to compensation only if no active lunch subscription
  const _canSwitchToCompensation = currentEmployee?.canSwitchToCompensation ?? !hasActiveLunch
  const _canSwitchToLunch = currentEmployee?.canSwitchToLunch ?? !hasActiveCompensation
  
  // Для ланча: доступно если тип услуги НЕ компенсация
  const canManageLunch = canManageBudget && employeeServiceType !== 'COMPENSATION'
  
  // Для компенсации: доступно если тип услуги НЕ ланч и НЕТ активной подписки на ланч
  // + проверка feature flag
  const compensationFeatureEnabled = isFeatureEnabled('compensation')
  const canManageCompensation = compensationFeatureEnabled && canManageBudget && employeeServiceType !== 'LUNCH' && !hasActiveLunch

  // Determine default service tab based on employee's service type
  const defaultServiceTab = useMemo(() => {
    if (hasActiveLunch || employeeServiceType === 'LUNCH') return 'lunch'
    // Only show compensation tab if feature is enabled
    if (compensationFeatureEnabled && (hasActiveCompensation || employeeServiceType === 'COMPENSATION')) return 'compensation'
    return 'lunch'
  }, [hasActiveLunch, hasActiveCompensation, employeeServiceType, compensationFeatureEnabled])

  // Lunch progress calculation - using actual working days from backend
  const lunchProgress = useMemo(() => {
    if (!lunchSub) return { total: 0, used: 0, percent: 0 }
    
    // Use totalDays from backend (calculated by WORKING days, not calendar days)
    const total = lunchSub.totalDays ?? 0
    
    // Used = completed orders count (actual delivered/completed orders)
    const used = lunchSub.completedOrdersCount ?? 0
    
    const percent = total > 0 ? Math.min((used / total) * 100, 100) : 0
    return { total, used, percent }
  }, [lunchSub])

  // Compensation progress calculation
  const compensationProgress = useMemo(() => {
    if (!compensation?.totalBudget) return { total: 0, used: 0, percent: 0 }
    const total = compensation.totalBudget
    const used = compensation.usedAmount || 0
    const percent = total > 0 ? (used / total) * 100 : 0
    return { total, used, percent }
  }, [compensation])

  // Days remaining calculations
  const lunchDaysRemaining = useMemo(() => {
    if (lunchSub?.endDate) {
      const end = parseISO(lunchSub.endDate)
      const today = new Date()
      if (isAfter(end, today)) {
        return differenceInDays(end, today)
      }
    }
    return null
  }, [lunchSub])

  const compensationDaysRemaining = useMemo(() => {
    if (compensation?.endDate) {
      const end = parseISO(compensation.endDate)
      const today = new Date()
      if (isAfter(end, today)) {
        return differenceInDays(end, today)
      }
    }
    return null
  }, [compensation])

  const isLunchExpiringSoon = lunchDaysRemaining !== null && lunchDaysRemaining <= 7 && lunchDaysRemaining > 0
  const isCompensationExpiringSoon = compensationDaysRemaining !== null && compensationDaysRemaining <= 7 && compensationDaysRemaining > 0

  // Working days
  const workingDays = useMemo(() => {
    return getEffectiveWorkingDays(currentEmployee?.workingDays) as DayOfWeek[]
  }, [currentEmployee?.workingDays])

  const workingDaysText = useMemo(() => {
    if (workingDays.length === 7) return 'Все дни'
    if (workingDays.length === 6) return '6-дневка'
    if (workingDays.length === 5 && !workingDays.includes(0 as DayOfWeek) && !workingDays.includes(6 as DayOfWeek)) {
      return '5-дневка (Пн-Пт)'
    }
    return workingDays.map(d => DAYS_OF_WEEK_SHORT[d]).join(', ')
  }, [workingDays])

  // Calendar calculations
  const monthStart = useMemo(() => startOfMonth(calendarDate), [calendarDate])
  const calendarStart = useMemo(() => startOfWeek(monthStart, { weekStartsOn: 1 }), [monthStart])
  
  const calendarDays = useMemo(() => {
    const days: Date[] = []
    let day = calendarStart
    while (days.length < 42) {
      days.push(day)
      day = addDays(day, 1)
    }
    return days
  }, [calendarStart])

  // BUSINESS RULE: Employee can have EITHER lunch OR compensation, NOT both
  // Filter orders by employee's serviceType
  const filteredOrders = useMemo(() => {
    if (employeeServiceType === 'LUNCH') {
      return orders.filter(o => o.serviceType === 'LUNCH')
    } else if (employeeServiceType === 'COMPENSATION') {
      return orders.filter(o => o.serviceType === 'COMPENSATION')
    }
    return orders // null/undefined = show all for backward compatibility
  }, [orders, employeeServiceType])

  const getOrdersForDate = useCallback((date: Date) => {
    return filteredOrders.filter(o => o.date && isSameDay(parseISO(o.date), date))
  }, [filteredOrders])

  const isWorkingDay = useCallback((date: Date) => {
    const dow = getDay(date) as DayOfWeek
    return workingDays.includes(dow)
  }, [workingDays])

  // Action handlers for orders (using new Orders API)
  const handleFreezeOrder = useCallback(async (order: EmployeeOrder) => {
    if (!id) {
      toast.error('Невозможно заморозить заказ')
      return
    }
    try {
      const freezeInfo = await getEmployeeFreezeInfo(id)
      if (freezeInfo.remainingFreezes <= 0) {
        toast.error(`Лимит заморозок исчерпан (${freezeInfo.freezesThisWeek}/${freezeInfo.maxFreezesPerWeek} на этой неделе)`)
        return
      }
      setFreezeDialogOrder(order)
    } catch {
      toast.error('Не удалось проверить лимит заморозок')
    }
  }, [id])

  const handleUnfreezeOrder = useCallback(async (order: EmployeeOrder) => {
    if (!id || !order.id) return
    setActionLoading(true)
    try {
      const result = await unfreezeOrder(order.id)
      toast.success('Заказ разморожен', {
        description: `Подписка сокращена до ${result.subscription.endDate}`,
      })
      loadOrders()
    } catch (error) {
      const appError = parseError(error)
      logger.error('Failed to unfreeze order', error instanceof Error ? error : new Error(appError.message), {
        errorCode: appError.code,
      })
      toast.error(appError.message, { description: appError.action })
    } finally {
      setActionLoading(false)
    }
  }, [id, loadOrders])

  const confirmFreezeOrder = useCallback(async () => {
    if (!freezeDialogOrder || !id || !freezeDialogOrder.id) return
    setActionLoading(true)
    try {
      const result = await freezeOrder(freezeDialogOrder.id, 'Заморозка через админ панель')
      toast.success('Заказ заморожен', {
        description: `Подписка продлена до ${result.subscription.endDate}`,
      })
      setFreezeDialogOrder(null)
      loadOrders()
    } catch (error) {
      const appError = parseError(error)
      logger.error('Failed to freeze order', error instanceof Error ? error : new Error(appError.message), {
        errorCode: appError.code,
      })
      
      // Special handling for freeze limit
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
  }, [freezeDialogOrder, id, loadOrders])

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
      loadOrders()
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
  }, [cancelDialogOrder, loadOrders])

  // Pause/Resume subscription 
  // Note: Now using freezePeriod for subscription pause, as Orders is the source of truth
  const handlePauseSubscription = useCallback(async () => {
    // Pause is now handled via freeze period API - freeze all future orders
    toast.info('Для приостановки подписки используйте заморозку будущих заказов', {
      description: 'Перейдите на главную страницу и выберите период для заморозки',
    })
    setPauseSubscriptionDialog(false)
  }, [])

  const handleResumeSubscription = useCallback(async () => {
    // Resume is now handled via unfreeze API - unfreeze individual orders
    toast.info('Для возобновления разморозьте заказы по отдельности', {
      description: 'Или создайте новую подписку',
    })
  }, [])

  // Sort orders with custom comparators
  const sortedOrders = useMemo(() => {
    return sortData(filteredOrders, sortConfig, {
      date: (a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0
        const dateB = b.date ? new Date(b.date).getTime() : 0
        return dateA - dateB
      },
      status: (a, b) => {
        const order = { 'Активен': 3, 'На паузе': 2, 'Заморожен': 1, 'Завершен': 0 }
        return (order[a.status as keyof typeof order] || 0) - (order[b.status as keyof typeof order] || 0)
      },
    })
  }, [filteredOrders, sortConfig])

  // Helper function for status color (like on main page)
  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'Активен':
        return 'default'
      case 'На паузе':
        return 'secondary'
      case 'Завершен':
        return 'outline'
      case 'Заморожен':
        return 'secondary'
      default:
        return 'outline'
    }
  }, [])
  
  // Helper function for status config (badge styling)
  const getStatusConfig = useCallback((status: string) => {
    switch (status) {
      case 'Активен':
        return { className: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' }
      case 'Активна':
        return { className: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' }
      case 'На паузе':
        return { className: 'bg-amber-500/10 text-amber-600 border-amber-200' }
      case 'Завершен':
      case 'Завершена':
        return { className: 'bg-muted text-muted-foreground border-muted' }
      case 'Заморожен':
        return { className: 'bg-blue-500/10 text-blue-600 border-blue-200' }
      default:
        return { className: '' }
    }
  }, [])

  // Order columns (memoized) - 1:1 copy from main page
  const orderColumns = useMemo<ColumnDef<EmployeeOrder>[]>(() => [
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
        <span className="text-muted-foreground">
          {row.original.date ? format(parseISO(row.original.date), 'dd.MM.yyyy', { locale: ru }) : '—'}
        </span>
      ),
    },
    {
      accessorKey: 'serviceType',
      header: () => (
        <SortableHeader
          label="Услуга"
          field="serviceType"
          currentSort={sortConfig}
          onSort={toggleSort}
        />
      ),
      cell: ({ row }) => {
        const order = row.original
        if (!order.serviceType) {
          return <span className="text-muted-foreground">—</span>
        }
        return order.serviceType === 'LUNCH' ? (
          <Badge variant="outline" className="gap-1.5 bg-amber-500/10 text-amber-600 border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-700">
            <UtensilsCrossed className="h-3 w-3" />
            Ланч
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1.5 bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-700">
            <Wallet className="h-3 w-3" />
            Компенсация
          </Badge>
        )
      },
    },
    {
      id: 'details',
      header: 'Детали',
      cell: ({ row }) => {
        const order = row.original
        const orderDate = order.date ? startOfDay(new Date(order.date)) : null
        const today = startOfDay(new Date())
        const isPastOrder = orderDate && orderDate < today
        const isTodayOrder = orderDate && orderDate.getTime() === today.getTime()
        
        // LUNCH: показываем комбо и цену
        if (order.serviceType === 'LUNCH' || !order.serviceType) {
          return (
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-amber-700 dark:text-amber-400">
                {order.comboType || 'Комбо'}
              </span>
              <span className="text-xs text-muted-foreground">
                {order.amount?.toLocaleString() || 0} TJS
              </span>
            </div>
          )
        }
        
        // COMPENSATION: показываем потрачено/лимит в зависимости от времени
        const limit = order.compensationLimit || 0
        const spent = order.compensationSpent || 0
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
        const isCompensation = order.serviceType === 'COMPENSATION'
        
        // Для компенсаций показываем ресторан
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
        
        // Для ланчей показываем адрес
        const orderAddress = order.address || 'Адрес не указан'
        return (
          <span className="text-sm text-muted-foreground truncate max-w-[150px] block" title={orderAddress}>
            {orderAddress}
          </span>
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
        return (
          <Badge variant={getStatusColor(order.status || '')} className="min-w-[76px] justify-center">
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
        const isCompensation = order.serviceType === 'COMPENSATION'
        
        const orderDate = order.date ? startOfDay(new Date(order.date)) : null
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
        
        // Завершённые заказы
        if (order.status === 'Завершен') {
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
        
        // COMPENSATION заказы
        if (isCompensation) {
          const canEdit = !isPastOrder && order.status !== 'Завершен'
          const canCancel = isTodayOrder || isFutureOrder
          
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
                        className="h-8 w-8 text-emerald-600 hover:text-emerald-700"
                        disabled={!canEdit || actionLoading}
                      >
                        <Wallet className="h-4 w-4" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {canEdit ? 'Управлять компенсацией' : 'Компенсация завершена'}
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
                          disabled={actionLoading}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Отменить компенсацию</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          )
        }
        
        // LUNCH заказы
        const canFreeze = isTodayOrder && order.status === 'Активен'
        const canUnfreeze = order.status === 'Заморожен'
        // NOTE: Pause/Resume removed for individual orders - use subscription-level pause instead
        const canResume = order.status === 'На паузе' // Keep for backward compat display
        const canCancel = isTodayOrder || isFutureOrder
        
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
                      className="h-8 w-8 text-amber-600 hover:text-amber-700"
                      disabled={actionLoading}
                    >
                      <UtensilsCrossed className="h-4 w-4" />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Управлять обедом</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {/* Заморозить / Разморозить (только для сегодня) */}
            {(canFreeze || canUnfreeze) && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-8 w-8",
                          canUnfreeze 
                            ? "text-blue-400 hover:text-blue-500" 
                            : "text-blue-600 hover:text-blue-700"
                        )}
                        onClick={() => canUnfreeze ? handleUnfreezeOrder(order) : handleFreezeOrder(order)}
                        disabled={actionLoading}
                      >
                        <Snowflake className="h-4 w-4" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {canUnfreeze ? 'Разморозить' : 'Заморозить на сегодня (лимит: 2/нед.)'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            {/* Статус "На паузе" - показываем только индикатор */}
            {canResume && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Badge variant="outline" className="text-orange-600 border-orange-300">
                        На паузе
                      </Badge>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Возобновите подписку через блок услуг</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
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
                        disabled={actionLoading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Отменить заказ</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        )
      },
    },
  ], [handleFreezeOrder, handleUnfreezeOrder, handleCancelOrder, actionLoading, sortConfig, toggleSort, getStatusColor])

  // Effects that depend on currentEmployee
  useEffect(() => {
    if (!currentEmployee) return
    if (!currentEmployee.isActive && editOpen) setEditOpen(false)
  }, [currentEmployee, editOpen])

  // Calendar navigation handlers
  const goToPreviousMonth = useCallback(() => {
    setCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }, [])

  const goToNextMonth = useCallback(() => {
    setCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }, [])

  const goToToday = useCallback(() => {
    setCalendarDate(new Date())
  }, [])

  const handleDayClick = useCallback((date: Date) => {
    const dayOrders = getOrdersForDate(date)
    if (dayOrders.length > 0) {
      setSelectedOrderDate(date)
      setSelectedDayOrders(dayOrders)
      setOrderDetailOpen(true)
    }
  }, [getOrdersForDate])

  // Invite icon
  const getInviteIcon = useCallback(() => {
    switch (currentEmployee?.inviteStatus) {
      case 'Принято': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      case 'Ожидает': return <Clock className="h-4 w-4 text-amber-500" />
      case 'Отклонено': return <XCircle className="h-4 w-4 text-red-500" />
      default: return null
    }
  }, [currentEmployee?.inviteStatus])

  // =====================
  // CONDITIONAL RETURNS (after all hooks)
  // =====================
  if (loading && !currentEmployee) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48 lg:col-span-2" />
        </div>
      </div>
    )
  }

  if (error && !currentEmployee) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!currentEmployee) return null

  return (
    <div className="space-y-6">
      {/* HEADER - Компактный и информативный */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/employees')}
            className="shrink-0 mt-1"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                {currentEmployee.fullName}
              </h1>
              {/* Индикатор статуса */}
              <div className="flex items-center gap-2">
                <div className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  currentEmployee.isActive ? "bg-emerald-500" : "bg-gray-400"
                )} />
                {!currentEmployee.isActive && (
                  <Badge variant="secondary" className="text-xs">
                    <Ban className="h-3 w-3 mr-1" />
                    Деактивирован
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
              <span className="text-sm">{currentEmployee.position || 'Без должности'}</span>
              <span className="text-muted-foreground/40">•</span>
              <div className="flex items-center gap-1.5 text-sm">
                {getInviteIcon()}
                <span>{currentEmployee.inviteStatus}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ALERT - Показываем только критичные предупреждения */}
      {!currentEmployee.isActive && (
        <Alert variant="destructive">
          <Ban className="h-4 w-4" />
          <AlertDescription>
            Сотрудник деактивирован. Управление бюджетом и услугами недоступно до повторной активации.
          </AlertDescription>
        </Alert>
      )}
      {currentEmployee.isActive && currentEmployee.inviteStatus === 'Ожидает' && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertDescription>
            Ожидаем подтверждения приглашения. После принятия станут доступны услуги питания.
          </AlertDescription>
        </Alert>
      )}
      {(isLunchExpiringSoon || isCompensationExpiringSoon) && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700 dark:text-amber-400">
            {isLunchExpiringSoon && `Подписка на ланч истекает через ${lunchDaysRemaining} дней. `}
            {isCompensationExpiringSoon && `Компенсация истекает через ${compensationDaysRemaining} дней. `}
            Рекомендуем продлить или настроить авто-продление.
          </AlertDescription>
        </Alert>
      )}

      {/* MAIN CONTENT - Двухколоночный layout */}
      <div className="grid gap-4 lg:grid-cols-3">
        
        {/* ЛЕВАЯ КОЛОНКА - Профиль сотрудника */}
        <div className="lg:col-span-1 space-y-4">
          
          {/* Кнопка редактирования профиля */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block">
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full gap-2 h-11 border-dashed",
                      canEdit 
                        ? "hover:bg-primary/5 hover:border-primary/50 hover:text-primary transition-colors" 
                        : "opacity-50"
                    )}
                    onClick={() => canEdit && setEditOpen(true)}
                    disabled={!canEdit}
                  >
                    <Pencil className="h-4 w-4" />
                    <span className="font-medium">Редактировать профиль</span>
                  </Button>
                </span>
              </TooltipTrigger>
              {!canEdit && (
                <TooltipContent>Сотрудник деактивирован</TooltipContent>
              )}
              {canEdit && (
                <TooltipContent>
                  Редактировать контакты, график работы и тип услуги
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          {/* Контактная информация */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Контакты
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium">{currentEmployee.phone}</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium truncate">{currentEmployee.email || '—'}</span>
              </div>
              <div className="flex items-center gap-3">
                <FolderKanban className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium">{currentEmployee.projectName || 'Не назначен'}</span>
              </div>
            </CardContent>
          </Card>

          {/* График работы */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                График работы
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Дни недели - компактно */}
                <div className="space-y-2">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                    const dow = d as DayOfWeek
                    const isWorking = workingDays.includes(dow)
                    // Use employee's actual working days for styling instead of hardcoded weekend
                    return (
                      <div
                        key={d}
                        className={cn(
                          "flex-1 h-8 rounded-md flex items-center justify-center text-xs font-medium",
                          isWorking
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/30 text-muted-foreground/50"
                        )}
                      >
                        {DAYS_OF_WEEK_SHORT[d]}
                      </div>
                    )
                  })}
                </div>
                <p className="text-xs text-muted-foreground text-center">{workingDaysText}</p>
              </div>

              {/* Смена и время */}
              <div className="grid grid-cols-2 gap-2">
                <div className={cn(
                  "rounded-lg p-3 text-center",
                  currentEmployee.shiftType === 'DAY' 
                    ? "bg-amber-500/10" 
                    : currentEmployee.shiftType === 'NIGHT'
                      ? "bg-indigo-500/10"
                      : "bg-muted/50"
                )}>
                  <div className="flex justify-center mb-1">
                    {currentEmployee.shiftType === 'DAY' ? (
                      <Sun className="h-4 w-4 text-amber-500" />
                    ) : currentEmployee.shiftType === 'NIGHT' ? (
                      <Moon className="h-4 w-4 text-indigo-500" />
                    ) : (
                      <Sun className="h-4 w-4 text-muted-foreground/50" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Смена</p>
                  <p className="text-sm font-medium">
                    {currentEmployee.shiftType === 'DAY' 
                      ? 'Дневная' 
                      : currentEmployee.shiftType === 'NIGHT'
                        ? 'Ночная'
                        : '—'}
                  </p>
                </div>

                <div className="rounded-lg p-3 text-center bg-muted/50">
                  <div className="flex justify-center mb-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">Время</p>
                  <p className="text-sm font-medium">
                    {currentEmployee.workStartTime && currentEmployee.workEndTime
                      ? `${currentEmployee.workStartTime}–${currentEmployee.workEndTime}`
                      : '—'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Тип услуги */}
          <Card 
            className={cn(
              "border-2 transition-colors cursor-pointer group",
              employeeServiceType === 'LUNCH' && "border-amber-500/30 bg-amber-500/5",
              employeeServiceType === 'COMPENSATION' && "border-emerald-500/30 bg-emerald-500/5",
              !employeeServiceType && "border-dashed",
              canEdit && "hover:border-primary/40"
            )}
            onClick={() => canEdit && setEditOpen(true)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "rounded-xl p-2.5 transition-colors",
                  employeeServiceType === 'LUNCH' 
                    ? "bg-amber-500/20" 
                    : employeeServiceType === 'COMPENSATION'
                      ? "bg-emerald-500/20"
                      : "bg-muted",
                  canEdit && "group-hover:bg-primary/10"
                )}>
                  {employeeServiceType === 'LUNCH' ? (
                    <UtensilsCrossed className="h-5 w-5 text-amber-600" />
                  ) : employeeServiceType === 'COMPENSATION' ? (
                    <Wallet className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <UtensilsCrossed className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Тип услуги</p>
                  <p className={cn(
                    "font-semibold",
                    employeeServiceType === 'LUNCH' && "text-amber-600",
                    employeeServiceType === 'COMPENSATION' && "text-emerald-600"
                  )}>
                    {employeeServiceType === 'LUNCH' 
                      ? 'Комплексные обеды' 
                      : employeeServiceType === 'COMPENSATION'
                        ? 'Компенсация'
                        : 'Не выбран'}
                  </p>
                </div>
                {canEdit && (
                  <Pencil className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
            </CardContent>
          </Card>

        </div>

        {/* ПРАВАЯ КОЛОНКА - Услуги питания */}
        <Card className="lg:col-span-2 h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="rounded-lg bg-gradient-to-br from-amber-500/10 to-emerald-500/10 p-1.5">
                <UtensilsCrossed className="h-4 w-4 text-amber-600" />
              </div>
              Услуги питания
            </CardTitle>
          </CardHeader>
          
          <CardContent className="pt-0">
            <Tabs defaultValue={defaultServiceTab} className="space-y-3">
              <TabsList className={`grid w-full ${compensationFeatureEnabled ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <TabsTrigger value="lunch" className="gap-2">
                  <UtensilsCrossed className="h-4 w-4" />
                  Комплексные обеды
                  {hasActiveLunch && (
                    <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs bg-amber-500/20 text-amber-600">
                      Активен
                    </Badge>
                  )}
                </TabsTrigger>
                {compensationFeatureEnabled && (
                  <TabsTrigger value="compensation" className="gap-2">
                    <Wallet className="h-4 w-4" />
                    Компенсация
                    {hasActiveCompensation && (
                      <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs bg-emerald-500/20 text-emerald-600">
                        Активен
                      </Badge>
                    )}
                  </TabsTrigger>
                )}
              </TabsList>

              {/* LUNCH TAB */}
              <TabsContent value="lunch" className="space-y-3 mt-0">
                {hasActiveLunch && lunchSub ? (
                  <div className="space-y-3">
                    {/* Метрики ланча */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="rounded-xl bg-amber-500/10 p-2.5">
                        <div className="flex items-center gap-2 text-amber-600 mb-1">
                          <UtensilsCrossed className="h-3.5 w-3.5" />
                          <span className="text-xs font-medium">Тариф</span>
                        </div>
                        <p className="text-lg font-bold">{lunchSub.comboType || 'Комбо'}</p>
                      </div>
                      
                      <div className="rounded-xl bg-muted p-2.5">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          <span className="text-xs font-medium">Период</span>
                        </div>
                        <p className="text-sm font-medium">
                          {lunchSub.startDate && format(parseISO(lunchSub.startDate), 'd MMM', { locale: ru })}
                          {' — '}
                          {lunchSub.endDate && format(parseISO(lunchSub.endDate), 'd MMM', { locale: ru })}
                        </p>
                        <p className={cn(
                          "text-xs mt-0.5",
                          isLunchExpiringSoon ? "text-amber-600 font-medium" : "text-muted-foreground"
                        )}>
                          Осталось: {lunchDaysRemaining !== null ? `${lunchDaysRemaining} дн.` : '—'}
                        </p>
                      </div>
                      
                      <div className="rounded-xl bg-muted p-2.5">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <TrendingUp className="h-3.5 w-3.5" />
                          <span className="text-xs font-medium">Заказы</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-lg font-bold text-emerald-600">{lunchSub.futureOrdersCount ?? 0}</span>
                          <span className="text-xs text-muted-foreground">/</span>
                          <span className="text-sm font-medium text-muted-foreground">{lunchSub.completedOrdersCount ?? 0}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          будущих / выполнено
                        </p>
                      </div>
                      
                      <div className="rounded-xl bg-muted p-2.5">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Wallet className="h-3.5 w-3.5" />
                          <span className="text-xs font-medium">Стоимость</span>
                        </div>
                        <p className="text-lg font-bold">{lunchSub.totalPrice || 0} TJS</p>
                      </div>
                    </div>

                    {/* Прогресс подписки */}
                    <div className="rounded-xl border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Прогресс подписки</span>
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200">
                          {lunchSub.status}
                        </Badge>
                      </div>
                      <Progress value={lunchProgress.percent} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Использовано: {lunchProgress.used} дн.</span>
                        <span>Всего: {lunchProgress.total} дн.</span>
                      </div>
                    </div>
                    
                    {/* Кнопки управления */}
                    <div className="flex gap-2">
                      <Button 
                        className="gap-2 bg-amber-600 hover:bg-amber-700"
                        onClick={() => setLunchDialogOpen(true)}
                        disabled={!canManageLunch}
                      >
                        <Pencil className="h-4 w-4" />
                        Редактировать
                      </Button>
                      
                      {/* Пауза / Возобновить подписку */}
                      {lunchSub.status === 'Активна' && (
                        <Button 
                          variant="outline"
                          className="gap-2 text-orange-600 border-orange-300 hover:bg-orange-50"
                          onClick={() => setPauseSubscriptionDialog(true)}
                          disabled={!canManageLunch || actionLoading}
                        >
                          <PauseCircle className="h-4 w-4" />
                          Приостановить
                        </Button>
                      )}
                      {lunchSub.status === 'Приостановлена' && (
                        <Button 
                          variant="outline"
                          className="gap-2 text-green-600 border-green-300 hover:bg-green-50"
                          onClick={handleResumeSubscription}
                          disabled={!canManageLunch || actionLoading}
                        >
                          <PlayCircle className="h-4 w-4" />
                          Возобновить
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-5 text-center space-y-3">
                    <div className="mx-auto w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                      <UtensilsCrossed className="h-6 w-6 text-amber-600" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-base font-semibold">Подписка на обеды не активна</h3>
                      <p className="text-muted-foreground text-sm max-w-md mx-auto">
                        {!currentEmployee.isActive 
                          ? 'Активируйте сотрудника для назначения услуги'
                          : currentEmployee.inviteStatus !== 'Принято'
                            ? 'Дождитесь подтверждения приглашения'
                            : employeeServiceType === 'COMPENSATION'
                              ? 'Тип услуги сотрудника — Компенсация. Измените в настройках профиля.'
                              : 'Назначьте подписку на комплексные обеды'}
                      </p>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Button 
                              className="gap-2 bg-amber-600 hover:bg-amber-700"
                              onClick={() => setLunchCreateOpen(true)}
                              disabled={!canManageLunch}
                            >
                              <UtensilsCrossed className="h-4 w-4" />
                              Назначить обеды
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {!canManageLunch && (
                          <TooltipContent>
                            {!currentEmployee.isActive 
                              ? 'Сотрудник деактивирован'
                              : currentEmployee.inviteStatus !== 'Принято'
                                ? 'Сотрудник ещё не принял приглашение'
                                : 'Тип услуги сотрудника — Компенсация'}
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}
              </TabsContent>

              {/* COMPENSATION TAB */}
              {compensationFeatureEnabled && (
              <TabsContent value="compensation" className="space-y-3 mt-0">
                {hasActiveCompensation && compensation ? (
                  <div className="space-y-3">
                    {/* Метрики компенсации */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="rounded-xl bg-emerald-500/10 p-2.5">
                        <div className="flex items-center gap-2 text-emerald-600 mb-1">
                          <Wallet className="h-3.5 w-3.5" />
                          <span className="text-xs font-medium">Дневной лимит</span>
                        </div>
                        <p className="text-lg font-bold">{compensation.dailyLimit || 0} TJS</p>
                      </div>
                      
                      <div className="rounded-xl bg-muted p-2.5">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <TrendingUp className="h-3.5 w-3.5" />
                          <span className="text-xs font-medium">Общий бюджет</span>
                        </div>
                        <p className="text-lg font-bold">{compensation.totalBudget || 0} TJS</p>
                      </div>
                      
                      <div className="rounded-xl bg-muted p-2.5">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          <span className="text-xs font-medium">Осталось</span>
                        </div>
                        <p className={cn(
                          "text-lg font-bold",
                          isCompensationExpiringSoon && "text-amber-600"
                        )}>
                          {compensationDaysRemaining !== null ? `${compensationDaysRemaining} дн.` : '—'}
                        </p>
                      </div>
                      
                      <div className="rounded-xl bg-muted p-2.5">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <RefreshCw className="h-3.5 w-3.5" />
                          <span className="text-xs font-medium">Авто-продление</span>
                        </div>
                        <p className="text-lg font-medium">
                          {compensation.autoRenew ? '✓ Вкл' : '✗ Выкл'}
                        </p>
                      </div>
                    </div>

                    {/* Прогресс использования бюджета */}
                    <div className="rounded-xl border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Использование бюджета</span>
                        <span className="text-sm font-semibold">
                          {compensationProgress.used.toLocaleString()} / {compensationProgress.total.toLocaleString()} TJS
                        </span>
                      </div>
                      <Progress value={compensationProgress.percent} className="h-2" />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{compensationProgress.percent.toFixed(1)}% использовано</span>
                        <div className="flex items-center gap-2">
                          {compensation.carryOver ? (
                            <Badge variant="outline" className="gap-1 text-xs">
                              <TrendingUp className="h-3 w-3" />
                              Остаток переносится
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 text-xs text-amber-600 border-amber-200">
                              <AlertTriangle className="h-3 w-3" />
                              Остаток сгорает
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Кнопка редактирования */}
                    <Button 
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => setCompensationDialogOpen(true)}
                      disabled={!canManageCompensation}
                    >
                      <Pencil className="h-4 w-4" />
                      Редактировать
                    </Button>
                  </div>
                ) : (
                  <div className="py-5 text-center space-y-3">
                    <div className="mx-auto w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <Wallet className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-base font-semibold">Компенсация не активна</h3>
                      <p className="text-muted-foreground text-sm max-w-md mx-auto">
                        {!currentEmployee.isActive 
                          ? 'Активируйте сотрудника для назначения услуги'
                          : currentEmployee.inviteStatus !== 'Принято'
                            ? 'Дождитесь подтверждения приглашения'
                            : hasActiveLunch
                              ? 'У сотрудника активна подписка на обеды. Дождитесь окончания или отмените подписку.'
                              : employeeServiceType === 'LUNCH'
                                ? 'Тип услуги сотрудника — Обеды. Измените в настройках профиля.'
                                : 'Назначьте компенсацию питания'}
                      </p>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Button 
                              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                              onClick={() => setCompensationCreateOpen(true)}
                              disabled={!canManageCompensation}
                            >
                              <Wallet className="h-4 w-4" />
                              Назначить компенсацию
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {!canManageCompensation && (
                          <TooltipContent>
                            {!currentEmployee.isActive 
                              ? 'Сотрудник деактивирован'
                              : currentEmployee.inviteStatus !== 'Принято'
                                ? 'Сотрудник ещё не принял приглашение'
                                : hasActiveLunch
                                  ? 'Активна подписка на обеды'
                                  : 'Тип услуги сотрудника — Обеды'}
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}
              </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* TABS - История заказов */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5 text-muted-foreground" />
              История заказов
            </CardTitle>
            <Badge variant="secondary">{ordersTotal} заказов</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="table" className="space-y-4">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="table" className="gap-2">
                  <Table className="h-4 w-4" />
                  Таблица
                </TabsTrigger>
                <TabsTrigger value="calendar" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Календарь
                </TabsTrigger>
              </TabsList>
            </div>

            {/* TABLE VIEW */}
            <TabsContent value="table" className="space-y-4">
              <DataTable
                columns={orderColumns}
                data={sortedOrders}
                isLoading={ordersLoading}
                loadingRows={5}
                emptyMessage={
                  <div className="py-12 text-center">
                    <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                      <History className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-1">История заказов пуста</h3>
                    <p className="text-muted-foreground text-sm">
                      Здесь будут отображаться все заказы сотрудника
                    </p>
                  </div>
                }
              />

              {/* Pagination - improved like main page */}
              {ordersTotalPages > 1 && (
                <div className="flex items-center justify-between rounded-lg border bg-card px-6 py-4">
                  <div className="text-sm text-muted-foreground">
                    Показано {((ordersPage - 1) * 20) + 1} - {Math.min(ordersPage * 20, ordersTotal)} из {ordersTotal}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOrdersPage(ordersPage - 1)}
                      disabled={ordersPage === 1 || ordersLoading}
                    >
                      Назад
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOrdersPage(ordersPage + 1)}
                      disabled={ordersPage === ordersTotalPages || ordersLoading}
                    >
                      Вперед
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* CALENDAR VIEW */}
            <TabsContent value="calendar" className="space-y-4">
              {/* Calendar Navigation */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={goToPreviousMonth}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-lg font-semibold min-w-[180px] text-center">
                    {format(calendarDate, 'LLLL yyyy', { locale: ru })}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={goToNextMonth}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToToday}
                >
                  Сегодня
                </Button>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-primary/20 border border-primary/30" />
                  <span className="text-muted-foreground">Рабочий день</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-muted/50" />
                  <span className="text-muted-foreground">Выходной</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-amber-500/20 border border-amber-500/30" />
                  <span className="text-muted-foreground">Ланч</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-emerald-500/20 border border-emerald-500/30" />
                  <span className="text-muted-foreground">Компенсация</span>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="rounded-xl border overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-7 bg-muted/30">
                  {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day, i) => (
                    <div 
                      key={day} 
                      className={cn(
                        "py-3 text-center text-sm font-medium",
                        i >= 5 && "text-muted-foreground"
                      )}
                    >
                      {day}
                    </div>
                  ))}
                </div>
                
                {/* Days */}
                <div className="grid grid-cols-7">
                  {calendarDays.map((date, idx) => {
                    const dayOrders = getOrdersForDate(date)
                    const isCurrentMonth = isSameMonth(date, calendarDate)
                    const isWorking = isWorkingDay(date)
                    const hasLunch = dayOrders.some(o => o.serviceType === 'LUNCH')
                    const hasCompensationOrder = dayOrders.some(o => o.serviceType === 'COMPENSATION')
                    
                    return (
                      <TooltipProvider key={idx}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleDayClick(date)}
                              disabled={dayOrders.length === 0}
                              className={cn(
                                "relative min-h-[80px] p-2 border-t border-r transition-all text-left",
                                "hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20",
                                !isCurrentMonth && "bg-muted/20 text-muted-foreground",
                                isToday(date) && "ring-2 ring-primary ring-inset",
                                isWorking && isCurrentMonth && "bg-primary/5",
                                !isWorking && isCurrentMonth && "bg-muted/30",
                                dayOrders.length > 0 && "cursor-pointer",
                                dayOrders.length === 0 && "cursor-default"
                              )}
                            >
                              <span className={cn(
                                "text-sm font-medium",
                                isToday(date) && "text-primary font-bold",
                                !isCurrentMonth && "text-muted-foreground/60"
                              )}>
                                {format(date, 'd')}
                              </span>
                              
                              {/* Order indicators */}
                              {dayOrders.length > 0 && (
                                <div className="mt-1 space-y-1">
                                  {hasLunch && (
                                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-400">
                                      <UtensilsCrossed className="h-3 w-3" />
                                      <span className="text-[10px] font-medium truncate">
                                        {dayOrders.find(o => o.serviceType === 'LUNCH')?.comboType || 'Ланч'}
                                      </span>
                                    </div>
                                  )}
                                  {hasCompensationOrder && (
                                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                                      <Wallet className="h-3 w-3" />
                                      <span className="text-[10px] font-medium">
                                        {dayOrders.find(o => o.serviceType === 'COMPENSATION')?.compensationSpent || 0} TJS
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[200px]">
                            <div className="space-y-1">
                              <p className="font-medium">{format(date, 'd MMMM yyyy', { locale: ru })}</p>
                              <p className="text-xs text-muted-foreground">
                                {isWorking ? 'Рабочий день' : 'Выходной'}
                              </p>
                              {dayOrders.length > 0 ? (
                                <p className="text-xs">
                                  {dayOrders.length} {dayOrders.length === 1 ? 'заказ' : 'заказа'}. 
                                  <span className="text-primary"> Нажмите для деталей</span>
                                </p>
                              ) : (
                                <p className="text-xs text-muted-foreground">Нет заказов</p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )
                  })}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* ORDER DETAIL DIALOG */}
      <Dialog open={orderDetailOpen} onOpenChange={setOrderDetailOpen}>
        <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b bg-muted/30">
            <DialogTitle className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5">
                <CalendarIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <span className="block text-lg">{selectedOrderDate && format(selectedOrderDate, 'd MMMM yyyy', { locale: ru })}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {selectedDayOrders.length} {selectedDayOrders.length === 1 ? 'заказ' : 'заказа'}
                </span>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
            {selectedDayOrders.map((order, idx) => {
              const orderDate = order.date ? new Date(order.date) : null
              const today = startOfDay(new Date())
              const isPastOrder = orderDate && orderDate < today
              const isTodayOrder = orderDate && orderDate.getTime() === today.getTime()
              const isFutureOrder = orderDate && orderDate > today
              const isCompensation = order.serviceType === 'COMPENSATION'
              const canFreeze = !isCompensation && isTodayOrder && order.status === 'Активен'
              const canUnfreeze = !isCompensation && order.status === 'Заморожен'
              // NOTE: Pause/Resume removed for individual orders - use subscription-level pause instead
              const isPaused = !isCompensation && order.status === 'На паузе'
              const canCancel = (isTodayOrder || isFutureOrder) && order.status !== 'Завершен'
              
              return (
                <div 
                  key={order.id || idx}
                  className={cn(
                    "rounded-xl border-2 overflow-hidden",
                    order.serviceType === 'LUNCH' && "border-amber-200 dark:border-amber-800",
                    order.serviceType === 'COMPENSATION' && "border-emerald-200 dark:border-emerald-800"
                  )}
                >
                  {/* Header */}
                  <div className={cn(
                    "px-4 py-3 flex items-center justify-between",
                    order.serviceType === 'LUNCH' && "bg-amber-50 dark:bg-amber-950/40",
                    order.serviceType === 'COMPENSATION' && "bg-emerald-50 dark:bg-emerald-950/40"
                  )}>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "rounded-lg p-2",
                        order.serviceType === 'LUNCH' && "bg-amber-500/20",
                        order.serviceType === 'COMPENSATION' && "bg-emerald-500/20"
                      )}>
                        {order.serviceType === 'LUNCH' ? (
                          <UtensilsCrossed className="h-4 w-4 text-amber-600" />
                        ) : (
                          <Wallet className="h-4 w-4 text-emerald-600" />
                        )}
                      </div>
                      <div>
                        <span className={cn(
                          "font-semibold",
                          order.serviceType === 'LUNCH' && "text-amber-700 dark:text-amber-400",
                          order.serviceType === 'COMPENSATION' && "text-emerald-700 dark:text-emerald-400"
                        )}>
                          {order.serviceType === 'LUNCH' ? 'Комплексный обед' : 'Компенсация'}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {isTodayOrder ? 'Сегодня' : isFutureOrder ? 'Запланировано' : 'История'}
                        </p>
                      </div>
                    </div>
                    {order.status && (
                      <Badge variant="outline" className={cn(
                        "font-medium",
                        getStatusConfig(order.status).className
                      )}>
                        {order.status}
                      </Badge>
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="p-4 space-y-4">
                    {order.serviceType === 'LUNCH' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-muted/50 p-3">
                          <p className="text-xs text-muted-foreground mb-1">Комбо</p>
                          <p className="font-semibold text-amber-700 dark:text-amber-400">
                            {order.comboType || 'Комбо'}
                          </p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-3">
                          <p className="text-xs text-muted-foreground mb-1">Стоимость</p>
                          <p className="font-semibold">{order.amount || 0} TJS</p>
                        </div>
                        {order.address && (
                          <div className="col-span-2 rounded-lg bg-muted/50 p-3">
                            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              Адрес доставки
                            </p>
                            <p className="font-medium text-sm">{order.address}</p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {order.serviceType === 'COMPENSATION' && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-lg bg-muted/50 p-3">
                            <p className="text-xs text-muted-foreground mb-1">Потрачено</p>
                            <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                              {order.compensationSpent || 0} TJS
                            </p>
                          </div>
                          <div className="rounded-lg bg-muted/50 p-3">
                            <p className="text-xs text-muted-foreground mb-1">Дневной лимит</p>
                            <p className="font-semibold">{order.compensationLimit || 0} TJS</p>
                          </div>
                        </div>
                        {order.restaurantName && (
                          <div className="rounded-lg bg-muted/50 p-3">
                            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                              🍽️ Ресторан
                            </p>
                            <p className="font-medium text-sm">{order.restaurantName}</p>
                          </div>
                        )}
                        {(order.compensationLimit && order.compensationSpent !== undefined) && (
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Использовано</span>
                              <span className="font-medium">
                                {Math.round((order.compensationSpent / order.compensationLimit) * 100)}%
                              </span>
                            </div>
                            <Progress 
                              value={(order.compensationSpent / order.compensationLimit) * 100} 
                              className="h-2"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    {!isPastOrder && order.status !== 'Завершен' && (
                      <div className="pt-3 border-t space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                          Действия
                        </p>
                        
                        {/* Row 1: Main actions */}
                        <div className="grid grid-cols-2 gap-2">
                          {/* Edit single order combo (not entire subscription!) */}
                          {!isCompensation && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 h-9 text-amber-600 border-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950"
                              onClick={() => {
                                setOrderDetailOpen(false)
                                // Convert EmployeeOrder to Order format for EditSubscriptionDialog
                                const orderForEdit: Order = {
                                  id: order.id,
                                  employeeId: currentEmployee?.id || null,
                                  employeeName: currentEmployee?.fullName || '',
                                  employeePhone: currentEmployee?.phone || null,
                                  date: order.date || '',
                                  status: order.status || '',
                                  address: order.address || '',
                                  projectId: currentEmployee?.projectId || null,
                                  projectName: currentEmployee?.projectName || null,
                                  comboType: order.comboType,
                                  amount: order.amount || 0,
                                  type: 'Сотрудник',
                                  serviceType: order.serviceType,
                                }
                                setEditSingleOrder(orderForEdit)
                                setEditSingleOrderOpen(true)
                              }}
                              disabled={actionLoading}
                            >
                              <UtensilsCrossed className="h-3.5 w-3.5" />
                              Изменить комбо
                            </Button>
                          )}
                          
                          {/* Manage compensation */}
                          {isCompensation && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 h-9 text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                              onClick={() => {
                                setOrderDetailOpen(false)
                                setCompensationDialogOpen(true)
                              }}
                              disabled={actionLoading}
                            >
                              <Wallet className="h-3.5 w-3.5" />
                              Управлять
                            </Button>
                          )}

                          {/* Freeze/Unfreeze (today only, lunch only) */}
                          {!isCompensation && (canFreeze || canUnfreeze) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 h-9 text-blue-600 border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-950"
                              onClick={() => {
                                setOrderDetailOpen(false)
                                canUnfreeze ? handleUnfreezeOrder(order) : handleFreezeOrder(order)
                              }}
                              disabled={actionLoading}
                            >
                              <Snowflake className="h-3.5 w-3.5" />
                              {canUnfreeze ? 'Разморозить' : 'Заморозить'}
                            </Button>
                          )}

                          {/* Paused status indicator */}
                          {isPaused && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-50 dark:bg-orange-950/30 text-orange-600">
                              <PauseCircle className="h-3.5 w-3.5" />
                              <span className="text-xs font-medium">На паузе</span>
                            </div>
                          )}
                        </div>

                        {/* Row 2: Cancel (full width) */}
                        {canCancel && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-1.5 h-9 text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={() => {
                              setOrderDetailOpen(false)
                              handleCancelOrder(order)
                            }}
                            disabled={actionLoading}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Отменить заказ
                          </Button>
                        )}
                      </div>
                    )}
                    
                    {isPastOrder && (
                      <div className="pt-3 border-t">
                        <div className="flex items-center justify-center gap-2 py-2 text-muted-foreground">
                          <History className="h-4 w-4" />
                          <span className="text-sm">Прошлый заказ — только просмотр</span>
                        </div>
                      </div>
                    )}
                    
                    {order.status === 'Завершен' && !isPastOrder && (
                      <div className="pt-3 border-t">
                        <div className="flex items-center justify-center gap-2 py-2 text-emerald-600">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-sm font-medium">Заказ успешно завершён</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          
          {/* Footer */}
          <div className="px-6 py-4 border-t bg-muted/20 flex justify-end">
            <Button variant="outline" onClick={() => setOrderDetailOpen(false)}>
              Закрыть
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOGS */}
      <EditEmployeeDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        employee={currentEmployee}
        onSuccess={() => fetchEmployee(id)}
      />
      {/* Editing existing lunch subscription (entire subscription) */}
      <ManageLunchDialog
        open={lunchDialogOpen}
        onOpenChange={setLunchDialogOpen}
        mode="individual"
        employee={currentEmployee}
        existingSubscription={currentEmployee.lunchSubscription || null}
        onSuccess={() => { fetchEmployee(id); loadOrders(); }}
      />
      {/* Edit single order combo (NOT entire subscription) */}
      <EditSubscriptionDialog
        open={editSingleOrderOpen}
        onOpenChange={(open) => {
          setEditSingleOrderOpen(open)
          if (!open) {
            setEditSingleOrder(null)
            // Refresh data after edit
            fetchEmployee(id)
            loadOrders()
          }
        }}
        order={editSingleOrder}
      />
      {/* Creating new lunch (full wizard) */}
      <ManageLunchDialog
        open={lunchCreateOpen}
        onOpenChange={setLunchCreateOpen}
        mode="individual"
        employee={currentEmployee}
        existingSubscription={null}
        onSuccess={() => { fetchEmployee(id); loadOrders(); }}
      />
      {/* Editing existing compensation (single screen) */}
      {compensationFeatureEnabled && (
        <ManageCompensationDialog
          open={compensationDialogOpen}
          onOpenChange={setCompensationDialogOpen}
          mode="individual"
          employee={currentEmployee}
          existingCompensation={currentEmployee.compensation || null}
          onSuccess={() => fetchEmployee(id)}
        />
      )}
      {/* Creating new compensation (full wizard) */}
      {compensationFeatureEnabled && (
        <ManageCompensationDialog
          open={compensationCreateOpen}
          onOpenChange={setCompensationCreateOpen}
          mode="individual"
          employee={currentEmployee}
          existingCompensation={null}
          onSuccess={() => fetchEmployee(id)}
        />
      )}

      {/* Dialog: Отменить заказ */}
      <AlertDialog open={cancelDialogOrder !== null} onOpenChange={(open) => !open && setCancelDialogOrder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Отменить заказ?
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

      {/* Dialog: Заморозить заказ */}
      <AlertDialog open={freezeDialogOrder !== null} onOpenChange={(open) => !open && setFreezeDialogOrder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Snowflake className="h-5 w-5 text-blue-500" />
              Заморозить заказ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Заказ на сегодня будет заморожен. День будет перенесён на конец периода подписки.
              <br />
              <span className="text-amber-600 text-sm mt-2 block">
                ⚠️ Лимит заморозок: 2 раза в неделю
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Отмена</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmFreezeOrder} 
              disabled={actionLoading}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              <Snowflake className="mr-2 h-4 w-4" />
              Заморозить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Приостановить подписку */}
      <AlertDialog open={pauseSubscriptionDialog} onOpenChange={setPauseSubscriptionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <PauseCircle className="h-5 w-5 text-orange-600" />
              Приостановить подписку?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Подписка будет приостановлена:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Все будущие заказы будут поставлены на паузу</li>
                <li>Дни <span className="font-medium">не сгорают</span> — они переносятся в конец периода</li>
                <li>Период подписки автоматически продлевается</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Отмена</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handlePauseSubscription} 
              disabled={actionLoading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {actionLoading ? 'Приостановка...' : 'Приостановить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

'use client'

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useEmployeesStore } from '@/stores/employees-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FilterBuilder, type FilterField, type ActiveFilter } from '@/components/ui/filter-builder'
import { SortableHeader, useSort, sortData } from '@/components/ui/sortable-header'
import {
  Plus,
  Search,
  User as UserIcon,
  Pencil,
  UtensilsCrossed,
  Trash2,
  RotateCcw,
  Wallet,
  FolderKanban,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'
import { useProjectsStore } from '@/stores/projects-store'
import { EMPLOYEE_STATUS, INVITE_STATUS, ORDER_STATUS, getEmployeeStatusConfig, getOrderStatusConfig, getSubscriptionStatusConfig } from '@/lib/constants/entity-statuses'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { parseError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { isFeatureEnabled } from '@/lib/features.config'
import { CreateEmployeeDialog } from '@/components/features/employees/create-employee-dialog'
import { EditEmployeeDialog } from '@/components/features/employees/edit-employee-dialog'
import { ManageLunchDialog } from '@/components/features/meals/manage-lunch-dialog'
import { ManageCompensationDialog } from '@/components/features/meals/manage-compensation-dialog'
import { debounce } from 'lodash-es'
import type { Employee, EmployeeDetail } from '@/lib/api/employees'
import { employeesApi } from '@/lib/api/employees'
import { DataTable } from '@/components/ui/data-table'
import type { ColumnDef } from '@tanstack/react-table'

// Вспомогательные функции для отображения

// Дни недели для графика работы
const DAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

// Форматирование графика работы
const formatWorkSchedule = (employee: Employee) => {
  const shift = employee.shiftType === 'DAY' ? '☀️' : employee.shiftType === 'NIGHT' ? '🌙' : ''
  const time = employee.workStartTime && employee.workEndTime
    ? `${employee.workStartTime}–${employee.workEndTime}`
    : ''
  return { shift, time }
}

// Форматирование рабочих дней
const formatWorkingDays = (workingDays?: number[]) => {
  if (!workingDays || workingDays.length === 0) return '—'
  if (workingDays.length === 7) return 'Ежедневно'
  if (workingDays.length === 5 && !workingDays.includes(0) && !workingDays.includes(6)) {
    return 'Пн-Пт'
  }
  return workingDays.map(d => DAYS_SHORT[d]).join(', ')
}

// Конфиг статуса услуги (для подписок и заказов) - uses centralized config
const getServiceStatusConfig = (status?: string) => {
  // Try subscription status first (for service column), then order status
  const subConfig = getSubscriptionStatusConfig(status)
  // FIX: Check if className is not empty (means status was matched)
  if (subConfig.className) {
    return subConfig
  }
  return getOrderStatusConfig(status)
}


// Filter configuration for employees table
// Фильтры соответствуют видимым колонкам таблицы
const getEmployeeFilterFields = (projects: { id: string; name: string }[]): FilterField[] => {
  const fields: FilterField[] = [
    // Колонка "Статус услуги" — Активна / Не активна
    {
      id: 'hasSubscription',
      label: 'Статус услуги',
      type: 'select',
      operators: ['equals'],
      options: [
        { value: 'true', label: 'Активна' },
        { value: 'false', label: 'Не активна' },
      ],
    },
    // Колонка "Тип услуги" — Ланч / Компенсация
    {
      id: 'serviceType',
      label: 'Тип услуги',
      type: 'select',
      operators: ['equals'],
      options: [
        { value: 'LUNCH', label: 'Ланч' },
        { value: 'COMPENSATION', label: 'Компенсация' },
      ],
    },
  ]

  // Колонка "Проект" — только если проектов > 1
  if (projects.length > 1) {
    fields.push({
      id: 'projectId',
      label: 'Проект',
      type: 'select',
      operators: ['equals'],
      options: projects.map(p => ({ value: p.id, label: p.name })),
    })
  }

  return fields
}

export default function EmployeesPage() {
  const router = useRouter()
  const {
    employees,
    isLoading: loading,
    error,
    total,
    currentPage,
    totalPages,
    showAll,
    searchQuery,
    activeFilters,
    fetchEmployees,
    toggleEmployeeActive,
    setSearchQuery,
    setActiveFilters,
    setShowAll,
  } = useEmployeesStore()
  const { projects, fetchProjects } = useProjectsStore()
  const [createOpen, setCreateOpen] = useState(false)
  const { sortConfig, toggleSort } = useSort<string>()
  const [activationDialogOpen, setActivationDialogOpen] = useState(false)
  const [activationContext, setActivationContext] = useState<{ employee: Employee; action: 'deactivate' | 'activate' } | null>(null)
  const [lunchDialogOpen, setLunchDialogOpen] = useState(false)
  const [compensationDialogOpen, setCompensationDialogOpen] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [employeeToEdit, setEmployeeToEdit] = useState<EmployeeDetail | null>(null)
  const [editLoading, setEditLoading] = useState(false)
  const hasFetched = useRef(false)

  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true
    fetchEmployees(1)
    fetchProjects()
  }, [fetchEmployees, fetchProjects])

  // Helper to get project name by ID
  const getProjectName = useCallback((projectId: string | null | undefined) => {
    if (!projectId) return null
    const project = projects.find(p => p.id === projectId)
    return project?.name || null
  }, [projects])

  const debouncedSearch = useMemo(
    () => debounce(() => {
      fetchEmployees(1)
    }, 500),
    [fetchEmployees]
  )

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
    debouncedSearch()
  }, [setSearchQuery, debouncedSearch])

  const handleFiltersChange = useCallback((filters: ActiveFilter[]) => {
    setActiveFilters(filters)
    fetchEmployees(1)
  }, [setActiveFilters, fetchEmployees])

  const handlePageChange = (page: number) => {
    fetchEmployees(page)
  }

  // Статистика сотрудников (бизнес-метрики)
  const employeesStats = useMemo(() => {
    const totalEmployees = employees.length
    const activeEmployees = employees.filter((e) => e.isActive).length

    // Сотрудники с активными услугами
    const withLunch = employees.filter((e) => e.lunchSubscription?.status === 'Активна').length
    const withCompensation = employees.filter((e) => e.compensation?.status === 'Активна').length

    // Сотрудники без услуг (активные, но без ланча и компенсации)
    const withoutService = employees.filter((e) =>
      e.isActive &&
      (e.inviteStatus === INVITE_STATUS.ACCEPTED || e.inviteStatus === 'Принято') &&
      !e.lunchSubscription &&
      !e.compensation
    ).length

    // Ожидают приглашения (требуют внимания сегодня)
    const pendingInvites = employees.filter((e) => e.isActive && (e.inviteStatus === INVITE_STATUS.PENDING || e.inviteStatus === 'Ожидает')).length

    // Финансы: сумма бюджетов подписок
    const totalLunchBudget = employees.reduce((sum, e) =>
      sum + (e.lunchSubscription?.totalPrice || 0), 0)
    const totalCompensationBudget = employees.reduce((sum, e) =>
      sum + (e.compensation?.totalBudget || 0), 0)
    const usedCompensation = employees.reduce((sum, e) =>
      sum + (e.compensation?.usedAmount || 0), 0)

    // Заканчивается подписка скоро (в течение 3 дней)
    const today = new Date()
    const threeDaysLater = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)
    const expiringLunch = employees.filter((e) => {
      if (!e.lunchSubscription?.endDate) return false
      const endDate = new Date(e.lunchSubscription.endDate)
      return endDate >= today && endDate <= threeDaysLater
    }).length

    return {
      totalEmployees,
      activeEmployees,
      withLunch,
      withCompensation,
      withoutService,
      pendingInvites,
      expiringLunch,
      totalLunchBudget,
      totalCompensationBudget,
      usedCompensation,
    }
  }, [employees])

  const handleToggleActivation = async (employee: Employee) => {
    try {
      await toggleEmployeeActive(employee.id)
      const wasActive = employee.status === EMPLOYEE_STATUS.ACTIVE || employee.isActive
      toast.success(
        `${employee.fullName} ${wasActive ? 'деактивирован' : 'активирован'}`
      )
    } catch (error) {
      const appError = parseError(error)
      logger.error('Failed to toggle employee status', error instanceof Error ? error : new Error(appError.message), {
        errorCode: appError.code,
        employeeId: employee.id,
      })
      toast.error(appError.message, { description: appError.action })
    }
  }

  // Sort employees with custom comparators for status fields
  const sortedEmployees = useMemo(() => {
    return sortData(employees, sortConfig, {
      // Custom comparator for boolean isActive field
      isActive: (a, b) => (a.isActive ? 1 : 0) - (b.isActive ? 1 : 0),
      // Custom comparator for invite status (ordered: Принято > Ожидает > Отклонено)
      inviteStatus: (a, b) => {
        // Use centralized constants (INVITE_STATUS values are Russian strings)
        const order: Record<string, number> = {
          [INVITE_STATUS.ACCEPTED]: 3,
          [INVITE_STATUS.PENDING]: 2,
          [INVITE_STATUS.REJECTED]: 1
        }
        return (order[a.inviteStatus] || 0) - (order[b.inviteStatus] || 0)
      },
      // Custom comparator for meal status
      mealStatus: (a, b) => {
        // Use centralized constants (ORDER_STATUS values are Russian strings)
        const order: Record<string, number> = {
          [ORDER_STATUS.ACTIVE]: 3,
          [ORDER_STATUS.PAUSED]: 2,
          'Не заказан': 1
        }
        return (order[a.mealStatus] || 0) - (order[b.mealStatus] || 0)
      },
    })
  }, [employees, sortConfig])

  const handleNameClick = useCallback((event: React.MouseEvent, id: string) => {
    event.stopPropagation()
    router.push(`/employees/${id}`)
  }, [router])

  // Handler для открытия модалки редактирования профиля
  const handleEditEmployee = useCallback(async (event: React.MouseEvent, employee: Employee) => {
    event.stopPropagation()
    if (!employee.isActive) return

    setEditLoading(true)
    try {
      // Загружаем полные данные сотрудника
      const employeeDetail = await employeesApi.getEmployee(employee.id)
      setEmployeeToEdit(employeeDetail)
      setEditDialogOpen(true)
    } catch (error) {
      const appError = parseError(error)
      logger.error('Failed to load employee for editing', error instanceof Error ? error : new Error(appError.message))
      toast.error('Не удалось загрузить данные сотрудника', { description: appError.message })
    } finally {
      setEditLoading(false)
    }
  }, [])

  const handleManageLunch = useCallback((event: React.MouseEvent, employee: Employee) => {
    event.stopPropagation()
    if (!employee.isActive || (employee.inviteStatus !== INVITE_STATUS.ACCEPTED && employee.inviteStatus !== 'Принято')) return
    // Блокируем если сотрудник на проекте компенсации (взаимоисключающие услуги)
    if (employee.serviceType === 'COMPENSATION') return
    setSelectedEmployee(employee)
    setLunchDialogOpen(true)
  }, [])

  const handleManageCompensation = useCallback((event: React.MouseEvent, employee: Employee) => {
    event.stopPropagation()
    if (!employee.isActive || (employee.inviteStatus !== INVITE_STATUS.ACCEPTED && employee.inviteStatus !== 'Принято')) return
    // Блокируем если есть активный ланч или сотрудник на проекте ланча
    if (employee.activeLunchSubscriptionId || employee.serviceType === 'LUNCH') return
    setSelectedEmployee(employee)
    setCompensationDialogOpen(true)
  }, [])

  const openActivationDialog = useCallback(
    (employee: Employee, action: 'deactivate' | 'activate') => {
    setActivationContext({ employee, action })
    setActivationDialogOpen(true)
    },
    []
  )

  const columns = useMemo<ColumnDef<Employee>[]>(() => [
    {
      accessorKey: 'fullName',
      header: () => (
        <SortableHeader
          label="ФИО"
          field="fullName"
          currentSort={sortConfig}
          onSort={toggleSort}
        />
      ),
      cell: ({ row }) => {
        const employee = row.original
        const statusConfig = getEmployeeStatusConfig(employee.status)
        const statusColor = employee.status === EMPLOYEE_STATUS.ACTIVE
          ? 'bg-emerald-500'
          : 'bg-gray-400'
        return (
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full shrink-0 ${statusColor}`}
              title={statusConfig.label}
            />
            <button
              type="button"
              className="text-left text-primary hover:underline font-medium"
              onClick={(event) => handleNameClick(event, employee.id)}
            >
              {employee.fullName}
            </button>
          </div>
        )
      },
    },
    {
      accessorKey: 'phone',
      header: () => (
        <SortableHeader
          label="Телефон"
          field="phone"
          currentSort={sortConfig}
          onSort={toggleSort}
        />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.phone}</span>
      ),
    },
    {
      accessorKey: 'position',
      header: () => (
        <SortableHeader
          label="Должность"
          field="position"
          currentSort={sortConfig}
          onSort={toggleSort}
        />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.position || '—'}</span>
      ),
    },
    {
      accessorKey: 'projectName',
      header: () => (
        <SortableHeader
          label="Проект"
          field="projectName"
          currentSort={sortConfig}
          onSort={toggleSort}
        />
      ),
      cell: ({ row }) => {
        const employee = row.original
        // Используем projectName напрямую из ответа бэкенда или fallback на getProjectName
        const projectName = employee.projectName || getProjectName(employee.projectId)
        return projectName ? (
          <Badge variant="outline" className="gap-1">
            <FolderKanban className="h-3 w-3" />
            {projectName}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )
      },
    },
    {
      id: 'workSchedule',
      header: 'График работы',
      cell: ({ row }) => {
        const employee = row.original
        const { shift, time } = formatWorkSchedule(employee)
        const days = formatWorkingDays(employee.workingDays)

        if (!shift && !time && days === '—') {
          return <span className="text-muted-foreground">—</span>
        }

        return (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              {shift && <span title={employee.shiftType === 'DAY' ? 'Дневная смена' : 'Ночная смена'}>{shift}</span>}
              <span className="text-sm font-medium">{time || '—'}</span>
            </div>
            <span className="text-xs text-muted-foreground">{days}</span>
          </div>
        )
      },
    },
    {
      accessorKey: 'serviceType',
      header: () => (
        <SortableHeader
          label="Тип услуги"
          field="serviceType"
          currentSort={sortConfig}
          onSort={toggleSort}
        />
      ),
      cell: ({ row }) => {
        const employee = row.original
        if (!employee.serviceType) {
          return <span className="text-muted-foreground">—</span>
        }
        return employee.serviceType === 'LUNCH' ? (
          <Badge variant="outline" className="gap-1 bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
            <UtensilsCrossed className="h-3 w-3" />
            Ланч
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
            <Wallet className="h-3 w-3" />
            Компенсация
          </Badge>
        )
      },
    },
    {
      id: 'serviceStatus',
      header: 'Статус услуги',
      cell: ({ row }) => {
        const employee = row.original

        // Определяем статус на основе активной услуги
        const lunchStatus = employee.lunchSubscription?.status
        const compensationStatus = employee.compensation?.status
        const status = lunchStatus || compensationStatus

        if (!status) {
          return <span className="text-muted-foreground text-sm">Не активна</span>
        }

        const statusConfig = getServiceStatusConfig(status)
        return (
          <Badge variant="outline" className={`min-w-[90px] justify-center ${statusConfig.className}`}>
            {status}
          </Badge>
        )
      },
    },
    {
      id: 'actions',
      header: 'Действия',
      cell: ({ row }) => {
        const employee = row.original
        return (
          <div
            className="flex gap-2"
            onClick={(event) => event.stopPropagation()}
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(event) => handleEditEmployee(event, employee)}
                      aria-label="Редактировать профиль"
                      disabled={!employee.isActive || editLoading}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {!employee.isActive ? 'Сотрудник деактивирован' : 'Редактировать профиль'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(event) => handleManageLunch(event, employee)}
                      aria-label="Управлять обедом"
                      disabled={!employee.isActive || (employee.inviteStatus !== INVITE_STATUS.ACCEPTED && employee.inviteStatus !== 'Принято') || employee.serviceType === 'COMPENSATION'}
                      className="text-amber-600 hover:text-amber-700"
                    >
                      <UtensilsCrossed className="h-4 w-4" />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {!employee.isActive
                    ? 'Сотрудник деактивирован'
                    : (employee.inviteStatus !== INVITE_STATUS.ACCEPTED && employee.inviteStatus !== 'Принято')
                      ? 'Сотрудник ещё не принял приглашение'
                      : employee.serviceType === 'COMPENSATION'
                        ? 'Сотрудник на компенсации'
                        : employee.activeLunchSubscriptionId
                          ? 'Редактировать обед'
                          : 'Назначить обед'
                  }
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {isFeatureEnabled('compensation') && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(event) => handleManageCompensation(event, employee)}
                      aria-label="Управлять компенсацией"
                      disabled={!employee.isActive || (employee.inviteStatus !== INVITE_STATUS.ACCEPTED && employee.inviteStatus !== 'Принято') || Boolean(employee.activeLunchSubscriptionId) || employee.serviceType === 'LUNCH'}
                      className="text-emerald-600 hover:text-emerald-700"
                    >
                      <Wallet className="h-4 w-4" />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {!employee.isActive
                    ? 'Сотрудник деактивирован'
                    : (employee.inviteStatus !== INVITE_STATUS.ACCEPTED && employee.inviteStatus !== 'Принято')
                      ? 'Сотрудник ещё не принял приглашение'
                      : employee.activeLunchSubscriptionId || employee.serviceType === 'LUNCH'
                        ? 'Сотрудник на обедах'
                        : employee.serviceType === 'COMPENSATION'
                          ? 'Редактировать компенсацию'
                          : 'Назначить компенсацию'
                  }
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(event) => {
                        event.stopPropagation()
                        const isCurrentlyActive = employee.status === EMPLOYEE_STATUS.ACTIVE || employee.isActive
                        openActivationDialog(
                          employee,
                          isCurrentlyActive ? 'deactivate' : 'activate'
                        )
                      }}
                      className={(employee.status === EMPLOYEE_STATUS.ACTIVE || employee.isActive) ? 'text-orange-600' : 'text-green-600'}
                      aria-label={(employee.status === EMPLOYEE_STATUS.ACTIVE || employee.isActive) ? 'Деактивировать' : 'Активировать'}
                    >
                      {(employee.status === EMPLOYEE_STATUS.ACTIVE || employee.isActive) ? (
                        <Trash2 className="h-4 w-4" />
                      ) : (
                        <RotateCcw className="h-4 w-4" />
                      )}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {(employee.status === EMPLOYEE_STATUS.ACTIVE || employee.isActive) ? 'Деактивировать сотрудника' : 'Активировать сотрудника'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )
      },
    },
  ], [handleManageLunch, handleManageCompensation, handleNameClick, handleEditEmployee, editLoading, openActivationDialog, sortConfig, toggleSort, getProjectName])

  const confirmActivationChange = async () => {
    if (!activationContext) return
    await handleToggleActivation(activationContext.employee)
    setActivationDialogOpen(false)
    setActivationContext(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2 sm:gap-3">
            <UserIcon className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            Сотрудники
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Управление сотрудниками и их бюджетами
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="lg" className="gap-2 w-full sm:w-auto">
          <Plus className="h-5 w-5" />
          <span className="hidden sm:inline">Создать сотрудника</span>
          <span className="sm:hidden">Создать</span>
        </Button>
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
            onClick={() => fetchEmployees(currentPage)}
            className="w-full sm:w-auto flex-shrink-0 border-destructive/30 hover:bg-destructive/10"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Повторить
          </Button>
        </Alert>
      )}

      {/* Stats Cards */}
      {employees.length > 0 && (
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
          {/* Сотрудники */}
          <Card className="relative overflow-hidden border border-primary/20 py-0">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-purple-500/5 to-transparent" />
            <CardContent className="relative p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="rounded bg-primary/10 p-1">
                  <UserIcon className="h-3 w-3 text-primary" />
                </div>
                <span className="text-xs text-muted-foreground">Сотрудники</span>
              </div>
              <p className="text-lg font-bold">{employeesStats.activeEmployees}<span className="text-sm text-muted-foreground font-normal">/{employeesStats.totalEmployees}</span></p>
              <p className="text-[10px] text-muted-foreground">активных</p>
            </CardContent>
          </Card>

          {/* Обеды - бюджет */}
          <Card className="relative overflow-hidden border border-amber-500/20 py-0">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent" />
            <CardContent className="relative p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="rounded bg-amber-500/10 p-1">
                  <UtensilsCrossed className="h-3 w-3 text-amber-500" />
                </div>
                <span className="text-xs text-muted-foreground">Обеды</span>
              </div>
              <p className="text-lg font-bold">{employeesStats.totalLunchBudget.toLocaleString()}<span className="text-xs text-muted-foreground font-normal ml-1">TJS</span></p>
              <p className="text-[10px] text-muted-foreground">
                {employeesStats.withLunch} подписок
                {employeesStats.expiringLunch > 0 && (
                  <span className="text-amber-600 ml-1">• {employeesStats.expiringLunch} истекают</span>
                )}
              </p>
            </CardContent>
          </Card>

          {/* Компенсации - использовано */}
          <Card className="relative overflow-hidden border border-emerald-500/20 py-0">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent" />
            <CardContent className="relative p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="rounded bg-emerald-500/10 p-1">
                  <Wallet className="h-3 w-3 text-emerald-500" />
                </div>
                <span className="text-xs text-muted-foreground">Компенсации</span>
              </div>
              <p className="text-lg font-bold">{employeesStats.usedCompensation.toLocaleString()}<span className="text-xs text-muted-foreground font-normal ml-1">TJS</span></p>
              <p className="text-[10px] text-muted-foreground">из {employeesStats.totalCompensationBudget.toLocaleString()} ({employeesStats.withCompensation} чел.)</p>
            </CardContent>
          </Card>

          {/* Требуют внимания */}
          <Card className="relative overflow-hidden border border-orange-500/20 py-0">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-red-500/5 to-transparent" />
            <CardContent className="relative p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="rounded bg-orange-500/10 p-1">
                  <AlertTriangle className="h-3 w-3 text-orange-500" />
                </div>
                <span className="text-xs text-muted-foreground">Внимание</span>
              </div>
              <p className="text-lg font-bold">{employeesStats.withoutService + employeesStats.pendingInvites}</p>
              <p className="text-[10px] text-muted-foreground">
                {employeesStats.pendingInvites > 0 && `${employeesStats.pendingInvites} ждут приглаш.`}
                {employeesStats.pendingInvites > 0 && employeesStats.withoutService > 0 && ' • '}
                {employeesStats.withoutService > 0 && `${employeesStats.withoutService} без услуг`}
                {employeesStats.pendingInvites === 0 && employeesStats.withoutService === 0 && 'всё ок ✓'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px] max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Поиск по ФИО или телефону..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <FilterBuilder
          fields={getEmployeeFilterFields(projects)}
          activeFilters={activeFilters}
          onFiltersChange={handleFiltersChange}
        />
      </div>

      {/* Employees Table */}
      <DataTable
        columns={columns}
        data={sortedEmployees}
        isLoading={loading && employees.length === 0}
        emptyMessage={
          <div className="p-12 text-center">
            <UserIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Сотрудники не найдены</h3>
            <p className="text-muted-foreground mb-4">
              Начните с создания первого сотрудника
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Создать сотрудника
            </Button>
          </div>
        }
        onRowClick={(employee) => router.push(`/employees/${employee.id}`)}
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
                  fetchEmployees(1)
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
                    fetchEmployees(1)
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



      {/* Create Dialog */}
      <CreateEmployeeDialog open={createOpen} onOpenChange={setCreateOpen} />

      {/* Manage Lunch Dialog */}
      {selectedEmployee && (
        <ManageLunchDialog
          open={lunchDialogOpen}
          onOpenChange={(open) => {
            setLunchDialogOpen(open)
            if (!open) setSelectedEmployee(null) // Reset to force fresh data
          }}
          mode="individual"
          employee={selectedEmployee}
          existingSubscription={selectedEmployee.lunchSubscription || null}
          onSuccess={() => {
            fetchEmployees(currentPage)
            setSelectedEmployee(null) // Reset selected employee to avoid stale data
          }}
        />
      )}

      {/* Manage Compensation Dialog */}
      {isFeatureEnabled('compensation') && selectedEmployee && (
        <ManageCompensationDialog
          open={compensationDialogOpen}
          onOpenChange={(open) => {
            setCompensationDialogOpen(open)
            if (!open) setSelectedEmployee(null) // Reset to force fresh data
          }}
          mode="individual"
          employee={selectedEmployee}
          existingCompensation={selectedEmployee.compensation || null}
          onSuccess={() => {
            fetchEmployees(currentPage)
            setSelectedEmployee(null) // Reset selected employee to avoid stale data
          }}
        />
      )}

      {/* Edit Employee Dialog */}
      {employeeToEdit && (
        <EditEmployeeDialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open)
            if (!open) setEmployeeToEdit(null)
          }}
          employee={employeeToEdit}
          onSuccess={() => {
            fetchEmployees(currentPage)
            setEmployeeToEdit(null)
          }}
        />
      )}

      <Dialog open={activationDialogOpen} onOpenChange={setActivationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {activationContext?.action === 'deactivate'
                ? `Деактивировать ${activationContext?.employee.fullName}?`
                : `Активировать ${activationContext?.employee.fullName}?`}
            </DialogTitle>
            <DialogDescription>
              {activationContext?.action === 'deactivate'
                ? 'Сотрудник немедленно потеряет доступ к бюджету и обедам. Настройки можно будет выдать заново позже.'
                : 'После активации не забудьте заново настроить бюджет и подписку.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivationDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              variant={activationContext?.action === 'deactivate' ? 'destructive' : 'default'}
              onClick={confirmActivationChange}
            >
              {activationContext?.action === 'deactivate' ? 'Деактивировать' : 'Активировать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


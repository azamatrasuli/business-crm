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
import { ManageLunchDialog } from '@/components/features/meals/manage-lunch-dialog'
import { ManageCompensationDialog } from '@/components/features/meals/manage-compensation-dialog'
import { debounce } from 'lodash-es'
import type { Employee } from '@/lib/api/employees'
import { DataTable } from '@/components/ui/data-table'
import type { ColumnDef } from '@tanstack/react-table'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts'

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

// Цвет статуса услуги
const getServiceStatusColor = (status?: string) => {
  switch (status) {
    case 'Активна':
    case 'Активен':
      return 'default'
    case 'Приостановлена':
    case 'На паузе':
      return 'secondary'
    case 'Завершена':
    case 'Завершен':
      return 'outline'
    default:
      return 'outline'
  }
}


// Filter configuration for employees table
const employeeFilterFields: FilterField[] = [
  {
    id: 'status',
    label: 'Статус сотрудника',
    type: 'select',
    operators: ['equals'],
    options: [
      { value: 'active', label: 'Активный' },
      { value: 'inactive', label: 'Деактивирован' },
    ],
  },
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

export default function EmployeesPage() {
  const router = useRouter()
  const {
    employees,
    isLoading: loading,
    error,
    total,
    currentPage,
    totalPages,
    searchQuery,
    activeFilters,
    fetchEmployees,
    toggleEmployeeActive,
    setSearchQuery,
    setActiveFilters,
  } = useEmployeesStore()
  const { projects, fetchProjects } = useProjectsStore()
  const [createOpen, setCreateOpen] = useState(false)
  const { sortConfig, toggleSort } = useSort<string>()
  const [activationDialogOpen, setActivationDialogOpen] = useState(false)
  const [activationContext, setActivationContext] = useState<{ employee: Employee; action: 'deactivate' | 'activate' } | null>(null)
  const [lunchDialogOpen, setLunchDialogOpen] = useState(false)
  const [compensationDialogOpen, setCompensationDialogOpen] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
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

  const debouncedSearch = debounce(() => {
    fetchEmployees(1)
  }, 500)

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    debouncedSearch()
  }

  const handleFiltersChange = useCallback((filters: ActiveFilter[]) => {
    setActiveFilters(filters)
    fetchEmployees(1)
  }, [setActiveFilters, fetchEmployees])

  const handlePageChange = (page: number) => {
    fetchEmployees(page)
  }

  // Статистика сотрудников
  const employeesStats = useMemo(() => {
    const totalEmployees = employees.length
    const activeEmployees = employees.filter((e) => e.isActive).length
    const inactiveEmployees = employees.filter((e) => !e.isActive).length

    // Статистика по бюджетам
    const employeesWithBudget = employees.filter((e) => e.totalBudget && e.totalBudget > 0)
    const totalBudget = employeesWithBudget.reduce((sum, e) => sum + (e.totalBudget || 0), 0)
    const avgBudget = employeesWithBudget.length > 0 ? totalBudget / employeesWithBudget.length : 0
    const maxBudget = employeesWithBudget.length > 0
      ? Math.max(...employeesWithBudget.map((e) => e.totalBudget || 0))
      : 0

    // Статистика по статусам приглашений
    const acceptedInvites = employees.filter((e) => e.inviteStatus === 'Принято').length
    const pendingInvites = employees.filter((e) => e.inviteStatus === 'Ожидает').length
    const rejectedInvites = employees.filter((e) => e.inviteStatus === 'Отклонено').length

    // Статистика по обедам
    const activeMeals = employees.filter((e) => e.mealStatus === 'Активен').length
    const pausedMeals = employees.filter((e) => e.mealStatus === 'На паузе').length
    const noMeals = employees.filter((e) => e.mealStatus === 'Не заказан' || !e.mealStatus).length

    // Процент активных
    const activePercentage = totalEmployees > 0 ? (activeEmployees / totalEmployees) * 100 : 0

    // Процент с принятыми приглашениями
    const acceptedPercentage = totalEmployees > 0 ? (acceptedInvites / totalEmployees) * 100 : 0

    return {
      totalEmployees,
      activeEmployees,
      inactiveEmployees,
      totalBudget,
      avgBudget,
      maxBudget,
      employeesWithBudget: employeesWithBudget.length,
      acceptedInvites,
      pendingInvites,
      rejectedInvites,
      activeMeals,
      pausedMeals,
      noMeals,
      activePercentage,
      acceptedPercentage,
    }
  }, [employees])

  const handleToggleActivation = async (employee: Employee) => {
    try {
      await toggleEmployeeActive(employee.id)
      toast.success(
        `${employee.fullName} ${employee.isActive ? 'деактивирован' : 'активирован'}`
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
        const order = { 'Принято': 3, 'Ожидает': 2, 'Отклонено': 1 }
        return (order[a.inviteStatus as keyof typeof order] || 0) - (order[b.inviteStatus as keyof typeof order] || 0)
      },
      // Custom comparator for meal status
      mealStatus: (a, b) => {
        const order = { 'Активен': 3, 'На паузе': 2, 'Не заказан': 1 }
        return (order[a.mealStatus as keyof typeof order] || 0) - (order[b.mealStatus as keyof typeof order] || 0)
      },
    })
  }, [employees, sortConfig])

  const handleNameClick = useCallback((event: React.MouseEvent, id: string) => {
    event.stopPropagation()
    router.push(`/employees/${id}`)
  }, [router])

  const handleManageLunch = useCallback((event: React.MouseEvent, employee: Employee) => {
    event.stopPropagation()
    if (!employee.isActive || employee.inviteStatus !== 'Принято') return
    // Блокируем если сотрудник на проекте компенсации (взаимоисключающие услуги)
    if (employee.serviceType === 'COMPENSATION') return
    setSelectedEmployee(employee)
    setLunchDialogOpen(true)
  }, [])

  const handleManageCompensation = useCallback((event: React.MouseEvent, employee: Employee) => {
    event.stopPropagation()
    if (!employee.isActive || employee.inviteStatus !== 'Принято') return
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
        return (
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                employee.isActive ? 'bg-emerald-500' : 'bg-gray-400'
              }`}
              title={employee.isActive ? 'Активный' : 'Деактивирован'}
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
          <Badge variant="outline" className="gap-1 bg-amber-500/10 text-amber-600 border-amber-200">
            <UtensilsCrossed className="h-3 w-3" />
            Ланч
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-200">
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
        
        return (
          <Badge variant={getServiceStatusColor(status)} className="min-w-[90px] justify-center">
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
                      onClick={(event) => handleNameClick(event, employee.id)}
                      aria-label="Редактировать профиль"
                      disabled={!employee.isActive}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </span>
                </TooltipTrigger>
                {!employee.isActive && (
                  <TooltipContent>Сотрудник деактивирован</TooltipContent>
                )}
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
                      disabled={!employee.isActive || employee.inviteStatus !== 'Принято' || employee.serviceType === 'COMPENSATION'}
                      className="text-amber-600 hover:text-amber-700"
                    >
                      <UtensilsCrossed className="h-4 w-4" />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {!employee.isActive 
                    ? 'Сотрудник деактивирован' 
                    : employee.inviteStatus !== 'Принято' 
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
                      disabled={!employee.isActive || employee.inviteStatus !== 'Принято' || Boolean(employee.activeLunchSubscriptionId) || employee.serviceType === 'LUNCH'}
                      className="text-emerald-600 hover:text-emerald-700"
                    >
                      <Wallet className="h-4 w-4" />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {!employee.isActive 
                    ? 'Сотрудник деактивирован' 
                    : employee.inviteStatus !== 'Принято' 
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
                        openActivationDialog(
                          employee,
                          employee.isActive ? 'deactivate' : 'activate'
                        )
                      }}
                      className={employee.isActive ? 'text-orange-600' : 'text-green-600'}
                      aria-label={employee.isActive ? 'Деактивировать' : 'Активировать'}
                    >
                      {employee.isActive ? (
                        <Trash2 className="h-4 w-4" />
                      ) : (
                        <RotateCcw className="h-4 w-4" />
                      )}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {employee.isActive ? 'Деактивировать сотрудника' : 'Активировать сотрудника'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )
      },
    },
  ], [handleManageLunch, handleManageCompensation, handleNameClick, openActivationDialog, sortConfig, toggleSort, getProjectName])

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

      {/* Statistics Cards */}
      {employees.length > 0 && (
        <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {/* Общая статистика */}
          <Card className="relative overflow-hidden border-2 border-primary/20">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-purple-500/5" />
            <CardHeader className="relative pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-gradient-to-br from-primary/20 to-purple-500/20 p-1.5 shadow-sm">
                    <UserIcon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold text-foreground">Сотрудники</CardTitle>
                    <p className="text-[10px] text-muted-foreground">Общая статистика</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground">Всего сотрудников</p>
                  <p className="text-lg font-bold mt-0.5">{employeesStats.totalEmployees}</p>
                </div>
                <div className="h-14 w-14">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Активные', value: employeesStats.activeEmployees, fill: '#6528f5' },
                          { name: 'Деактивированные', value: employeesStats.inactiveEmployees, fill: '#c7d2fe' },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={12}
                        outerRadius={20}
                        dataKey="value"
                        startAngle={90}
                        endAngle={-270}
                      >
                        <Cell key="active" fill="#6528f5" />
                        <Cell key="inactive" fill="#c7d2fe" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-1.5">
                  <div className="flex items-center gap-1 mb-0.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <span className="text-[10px] text-muted-foreground">Активных</span>
                  </div>
                  <p className="text-sm font-bold text-primary">{employeesStats.activeEmployees}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {employeesStats.activePercentage.toFixed(0)}%
                  </p>
                </div>
                <div className="rounded-lg border border-slate-500/20 bg-slate-500/5 p-1.5">
                  <div className="flex items-center gap-1 mb-0.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                    <span className="text-[10px] text-muted-foreground">Деактивированных</span>
                  </div>
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-400">{employeesStats.inactiveEmployees}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {((employeesStats.inactiveEmployees / employeesStats.totalEmployees) * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Статистика по бюджетам */}
          <Card className="relative overflow-hidden border-2 border-blue-500/20">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-purple-500/5" />
            <CardHeader className="relative pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20 p-1.5 shadow-sm">
                    <Wallet className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold text-foreground">Бюджеты</CardTitle>
                    <p className="text-[10px] text-muted-foreground">Статистика по бюджетам</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative space-y-2">
              <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] font-medium text-muted-foreground">Общий бюджет</span>
                  <span className="text-sm font-bold">{employeesStats.totalBudget.toLocaleString()} TJS</span>
                </div>
                <div className="h-12 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={[
                        {
                          name: 'Бюджет',
                          Использовано: employeesStats.totalEmployees > 0
                            ? (employeesStats.employeesWithBudget / employeesStats.totalEmployees) * 100
                            : 0,
                        },
                      ]}
                    >
                      <defs>
                        <linearGradient id="employeeBudgetGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity={0.8} />
                        </linearGradient>
                      </defs>
                      <XAxis type="number" domain={[0, 100]} hide />
                      <YAxis dataKey="name" type="category" hide />
                      <Bar dataKey="Использовано" fill="url(#employeeBudgetGradient)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-1.5">
                    <div className="text-[10px] text-muted-foreground mb-0.5">Средний</div>
                    <div className="text-xs font-bold">{employeesStats.avgBudget.toLocaleString()} TJS</div>
                  </div>
                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-1.5">
                    <div className="text-[10px] text-muted-foreground mb-0.5">Максимальный</div>
                    <div className="text-xs font-bold">{employeesStats.maxBudget.toLocaleString()} TJS</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Статусы обедов */}
          <Card className="relative overflow-hidden border-2 border-emerald-500/20">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-green-500/5" />
            <CardHeader className="relative pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 p-1.5 shadow-sm">
                    <UtensilsCrossed className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold text-foreground">Обеды</CardTitle>
                    <p className="text-[10px] text-muted-foreground">Статусы обедов</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground">Активных обедов</p>
                  <p className="text-lg font-bold mt-0.5">{employeesStats.activeMeals}</p>
                </div>
                <div className="h-14 w-14">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Активен', value: employeesStats.activeMeals, fill: '#10b981' },
                          { name: 'На паузе', value: employeesStats.pausedMeals, fill: '#34d399' },
                          { name: 'Не заказан', value: employeesStats.noMeals, fill: '#d1fae5' },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={12}
                        outerRadius={20}
                        dataKey="value"
                        startAngle={90}
                        endAngle={-270}
                      >
                        <Cell key="active" fill="#10b981" />
                        <Cell key="paused" fill="#34d399" />
                        <Cell key="none" fill="#d1fae5" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-1">
                  <div className="text-[10px] text-muted-foreground mb-0.5">Активен</div>
                  <div className="text-xs font-bold">{employeesStats.activeMeals}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {employeesStats.totalEmployees > 0
                      ? ((employeesStats.activeMeals / employeesStats.totalEmployees) * 100).toFixed(0)
                      : 0}
                    %
                  </div>
                </div>
                <div className="rounded-lg border border-teal-500/20 bg-teal-500/5 p-1">
                  <div className="text-[10px] text-muted-foreground mb-0.5">На паузе</div>
                  <div className="text-xs font-bold">{employeesStats.pausedMeals}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {employeesStats.totalEmployees > 0
                      ? ((employeesStats.pausedMeals / employeesStats.totalEmployees) * 100).toFixed(0)
                      : 0}
                    %
                  </div>
                </div>
                <div className="rounded-lg border border-slate-500/20 bg-slate-500/5 p-1">
                  <div className="text-[10px] text-muted-foreground mb-0.5">Не заказан</div>
                  <div className="text-xs font-bold">{employeesStats.noMeals}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {employeesStats.totalEmployees > 0
                      ? ((employeesStats.noMeals / employeesStats.totalEmployees) * 100).toFixed(0)
                      : 0}
                    %
                  </div>
                </div>
              </div>
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
          fields={employeeFilterFields}
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
      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-lg border bg-card px-6 py-4">
          <div className="text-sm text-muted-foreground">
            Показано {((currentPage - 1) * 20) + 1} - {Math.min(currentPage * 20, total)} из {total}
          </div>
          <div className="flex gap-2">
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
          </div>
        </div>
      )}



      {/* Create Dialog */}
      <CreateEmployeeDialog open={createOpen} onOpenChange={setCreateOpen} />

      {/* Manage Lunch Dialog */}
      {selectedEmployee && (
        <ManageLunchDialog
          open={lunchDialogOpen}
          onOpenChange={setLunchDialogOpen}
          mode="individual"
          employee={selectedEmployee}
          existingSubscription={selectedEmployee.lunchSubscription || null}
          onSuccess={() => fetchEmployees(currentPage)}
        />
      )}

      {/* Manage Compensation Dialog */}
      {isFeatureEnabled('compensation') && selectedEmployee && (
        <ManageCompensationDialog
          open={compensationDialogOpen}
          onOpenChange={setCompensationDialogOpen}
          mode="individual"
          employee={selectedEmployee}
          existingCompensation={selectedEmployee.compensation || null}
          onSuccess={() => fetchEmployees(currentPage)}
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


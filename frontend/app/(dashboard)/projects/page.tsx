"use client"

import { useEffect, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useProjectsStore } from "@/stores/projects-store"
import { useAuthStore } from "@/stores/auth-store"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { DataTable } from "@/components/ui/data-table"
import { SortableHeader, useSort, sortData } from "@/components/ui/sortable-header"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  FolderKanban,
  Wallet,
  UtensilsCrossed,
  CreditCard,
  AlertCircle,
  Building2,
  Crown,
  Eye,
  MapPin,
  Users,
  TrendingDown,
  PiggyBank,
} from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"
import type { ProjectListItem } from "@/lib/api/projects"

export default function ProjectsPage() {
  const router = useRouter()
  const { isHeadquarters, isAuthenticated } = useAuthStore()
  const { projects, loading, error, fetchProjects } = useProjectsStore()
  const { sortConfig, toggleSort } = useSort<string>()
  const hasFetched = useRef(false)

  // Redirect non-HQ users away from this page
  useEffect(() => {
    if (isAuthenticated && !isHeadquarters) {
      router.replace('/')
    }
  }, [isAuthenticated, isHeadquarters, router])

  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true
    fetchProjects()
  }, [fetchProjects])

  const sortedProjects = useMemo(() => {
    return sortData(projects, sortConfig)
  }, [projects, sortConfig])

  const stats = useMemo(() => {
    const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0)
    const totalSpent = projects.reduce((sum, p) => sum + (p.spentTotal || 0), 0)
    const totalRemaining = projects.reduce((sum, p) => sum + (p.budgetRemaining || 0), 0)
    const totalEmployees = projects.reduce((sum, p) => sum + (p.employeesCount || 0), 0)
    const totalLunch = projects.reduce((sum, p) => sum + (p.employeesWithLunch || 0), 0)
    const totalCompensation = projects.reduce((sum, p) => sum + (p.employeesWithCompensation || 0), 0)
    const spentLunch = projects.reduce((sum, p) => sum + (p.spentLunch || 0), 0)
    const spentCompensation = projects.reduce((sum, p) => sum + (p.spentCompensation || 0), 0)
    
    return { 
      total: projects.length, 
      totalBudget, 
      totalSpent,
      totalRemaining,
      totalEmployees,
      totalLunch,
      totalCompensation,
      spentLunch,
      spentCompensation,
      budgetUsedPercent: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0
    }
  }, [projects])

  // Format number with thousands separator
  const formatNumber = (num: number) => num.toLocaleString('ru-RU')

  // Get color for budget remaining (green for positive, red for negative/low)
  const getBudgetColor = (remaining: number, budget: number) => {
    const percent = budget > 0 ? (remaining / budget) * 100 : 0
    if (percent < 10) return 'text-red-500'
    if (percent < 30) return 'text-amber-500'
    return 'text-emerald-500'
  }

  const columns = useMemo<ColumnDef<ProjectListItem>[]>(() => [
    {
      accessorKey: 'name',
      header: () => (
        <SortableHeader
          label="Название"
          field="name"
          currentSort={sortConfig}
          onSort={toggleSort}
        />
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2 min-w-[160px]">
          <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="font-medium">{row.original.name}</span>
          {row.original.isHeadquarters && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 gap-0.5">
              <Crown className="h-2.5 w-2.5" />
              HQ
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: 'address',
      header: () => (
        <SortableHeader
          label="Адрес"
          field="addressName"
          currentSort={sortConfig}
          onSort={toggleSort}
        />
      ),
      cell: ({ row }) => (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-start gap-2 max-w-[180px] cursor-help">
                <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <p className="truncate text-sm">{row.original.addressName || 'Не указан'}</p>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[300px]">
              <p className="font-medium">{row.original.addressName}</p>
              {row.original.addressFullAddress && (
                <p className="text-xs text-muted-foreground mt-1">{row.original.addressFullAddress}</p>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ),
    },
    {
      id: 'employees',
      header: () => (
        <SortableHeader
          label="Сотрудники"
          field="employeesCount"
          currentSort={sortConfig}
          onSort={toggleSort}
        />
      ),
      cell: ({ row }) => {
        const { employeesCount, employeesWithLunch, employeesWithCompensation } = row.original
        return (
          <div className="space-y-1.5 min-w-[140px]">
            {/* Total employees */}
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-semibold">{employeesCount}</span>
              <span className="text-xs text-muted-foreground">всего</span>
            </div>
            
            {/* Breakdown by service */}
            <div className="flex flex-wrap gap-1.5">
              {employeesWithLunch > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 gap-1 bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400 cursor-help">
                        <UtensilsCrossed className="h-3 w-3" />
                        {employeesWithLunch}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>Сотрудников на обедах</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {employeesWithCompensation > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 gap-1 bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400 cursor-help">
                        <CreditCard className="h-3 w-3" />
                        {employeesWithCompensation}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>Сотрудников с компенсацией</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {employeesWithLunch === 0 && employeesWithCompensation === 0 && employeesCount > 0 && (
                <span className="text-xs text-muted-foreground">без услуг</span>
              )}
            </div>
          </div>
        )
      },
    },
    {
      id: 'budget',
      header: () => (
        <SortableHeader
          label="Бюджет"
          field="budget"
          currentSort={sortConfig}
          onSort={toggleSort}
        />
      ),
      cell: ({ row }) => {
        const { budget, currencyCode = 'TJS' } = row.original
        return (
          <div className="min-w-[100px]">
            <span className="font-semibold text-primary">
              {formatNumber(budget)}
            </span>
            <span className="text-xs text-muted-foreground ml-1">{currencyCode}</span>
          </div>
        )
      },
    },
    {
      id: 'spending',
      header: () => (
        <SortableHeader
          label="Расходы"
          field="spentTotal"
          currentSort={sortConfig}
          onSort={toggleSort}
        />
      ),
      cell: ({ row }) => {
        const { spentLunch, spentCompensation, spentTotal, currencyCode = 'TJS' } = row.original
        return (
          <div className="space-y-1.5 min-w-[150px]">
            {/* Total spent */}
            <div className="flex items-center gap-1.5">
              <TrendingDown className="h-3.5 w-3.5 text-red-500" />
              <span className="font-semibold">{formatNumber(spentTotal)}</span>
              <span className="text-xs text-muted-foreground">{currencyCode}</span>
            </div>
            
            {/* Breakdown */}
            <div className="flex flex-wrap gap-2 text-xs">
              {spentLunch > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 cursor-help">
                        <UtensilsCrossed className="h-3 w-3" />
                        <span>{formatNumber(spentLunch)}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Расходы на обеды</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {spentCompensation > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 cursor-help">
                        <CreditCard className="h-3 w-3" />
                        <span>{formatNumber(spentCompensation)}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Расходы на компенсацию</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {spentLunch === 0 && spentCompensation === 0 && (
                <span className="text-muted-foreground">нет расходов</span>
              )}
            </div>
          </div>
        )
      },
    },
    {
      id: 'remaining',
      header: () => (
        <SortableHeader
          label="Остаток"
          field="budgetRemaining"
          currentSort={sortConfig}
          onSort={toggleSort}
        />
      ),
      cell: ({ row }) => {
        const { budgetRemaining, budget, currencyCode = 'TJS' } = row.original
        const usedPercent = budget > 0 ? ((budget - budgetRemaining) / budget) * 100 : 0
        const colorClass = getBudgetColor(budgetRemaining, budget)
        
        return (
          <div className="space-y-1.5 min-w-[130px]">
            <div className="flex items-center gap-1.5">
              <PiggyBank className={`h-3.5 w-3.5 ${colorClass}`} />
              <span className={`font-semibold ${colorClass}`}>
                {formatNumber(budgetRemaining)}
              </span>
              <span className="text-xs text-muted-foreground">{currencyCode}</span>
            </div>
            
            {/* Progress bar */}
            <div className="w-full">
              <Progress 
                value={Math.min(usedPercent, 100)} 
                className="h-1.5"
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Использовано {usedPercent.toFixed(0)}%
              </p>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'status',
      header: 'Статус',
      cell: ({ row }) => (
        <Badge variant={row.original.status === 'ACTIVE' ? 'default' : 'secondary'}>
          {row.original.status === 'ACTIVE' ? 'Активен' : 'Неактивен'}
        </Badge>
      ),
    },
  ], [sortConfig, toggleSort])

  // Don't render anything if not HQ
  if (!isHeadquarters) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <FolderKanban className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            Проекты компании
          </h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Просмотр всех проектов (только чтение)
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
        {/* Total Budget */}
        <Card className="relative overflow-hidden border border-emerald-500/20 py-0">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent" />
          <CardContent className="relative p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="rounded bg-emerald-500/10 p-1">
                <Wallet className="h-3 w-3 text-emerald-500" />
              </div>
              <span className="text-xs text-muted-foreground">Общий бюджет</span>
            </div>
            <p className="text-lg font-bold">{formatNumber(stats.totalBudget)}</p>
            <p className="text-[10px] text-muted-foreground">TJS</p>
          </CardContent>
        </Card>

        {/* Total Spent */}
        <Card className="relative overflow-hidden border border-red-500/20 py-0">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 via-rose-500/5 to-transparent" />
          <CardContent className="relative p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="rounded bg-red-500/10 p-1">
                <TrendingDown className="h-3 w-3 text-red-500" />
              </div>
              <span className="text-xs text-muted-foreground">Всего расходов</span>
            </div>
            <p className="text-lg font-bold">{formatNumber(stats.totalSpent)}</p>
            <div className="flex gap-2 text-[10px]">
              <span className="flex items-center gap-0.5 text-amber-600">
                <UtensilsCrossed className="h-2.5 w-2.5" />
                {formatNumber(stats.spentLunch)}
              </span>
              <span className="flex items-center gap-0.5 text-blue-600">
                <CreditCard className="h-2.5 w-2.5" />
                {formatNumber(stats.spentCompensation)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Remaining Budget */}
        <Card className="relative overflow-hidden border border-primary/20 py-0">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-purple-500/5 to-transparent" />
          <CardContent className="relative p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="rounded bg-primary/10 p-1">
                <PiggyBank className="h-3 w-3 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground">Остаток</span>
            </div>
            <p className="text-lg font-bold">{formatNumber(stats.totalRemaining)}</p>
            <p className="text-[10px] text-muted-foreground">
              Использовано {stats.budgetUsedPercent.toFixed(0)}%
            </p>
          </CardContent>
        </Card>

        {/* Employees */}
        <Card className="relative overflow-hidden border border-blue-500/20 py-0">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-transparent" />
          <CardContent className="relative p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="rounded bg-blue-500/10 p-1">
                <Users className="h-3 w-3 text-blue-500" />
              </div>
              <span className="text-xs text-muted-foreground">Сотрудники</span>
            </div>
            <p className="text-lg font-bold">{stats.totalEmployees}</p>
            <div className="flex gap-2 text-[10px]">
              <span className="flex items-center gap-0.5 text-amber-600">
                <UtensilsCrossed className="h-2.5 w-2.5" />
                {stats.totalLunch}
              </span>
              <span className="flex items-center gap-0.5 text-blue-600">
                <CreditCard className="h-2.5 w-2.5" />
                {stats.totalCompensation}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projects Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5 text-primary" />
            Список проектов
          </CardTitle>
          <CardDescription>
            Детальная информация по всем проектам компании
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={sortedProjects}
            isLoading={loading && projects.length === 0}
            loadingRows={3}
            emptyMessage={
              <div className="p-8 text-center">
                <FolderKanban className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Проектов пока нет</h3>
                <p className="text-muted-foreground">
                  В вашей компании еще нет проектов
                </p>
              </div>
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}

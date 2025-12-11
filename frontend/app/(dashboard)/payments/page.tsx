"use client"

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Wallet,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
  Calendar,
  User,
  Users,
  FileText,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  Check,
} from 'lucide-react'
import { useMemo } from 'react'
import { DataTable } from '@/components/ui/data-table'
import type { ColumnDef } from '@tanstack/react-table'
import { FeatureGate } from '@/components/features/feature-gate'
import { useFinancialData } from '@/lib/hooks/use-financial-data'
import {
  type FinancialOperation,
  type StatusFilter,
  type TypeFilter,
  type SortField,
  getOperationTypeLabel,
  getOperationStatusLabel,
} from '@/lib/api/transactions'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Skeleton } from '@/components/ui/skeleton'

export default function PaymentsPage() {
  return (
    <FeatureGate feature="payments">
      <PaymentsContent />
    </FeatureGate>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN CONTENT
// ═══════════════════════════════════════════════════════════════

function PaymentsContent() {
  const {
    summary,
    summaryLoading,
    operations,
    operationsLoading,
    operationsTotal,
    operationsTotalPages,
    statusCounts,
    page,
    pageSize,
    showAll,
    statusFilter,
    typeFilter,
    searchQuery,
    sortField,
    sortDesc,
    hasActiveFilters,
    setPage,
    setShowAll,
    setStatusFilter,
    setTypeFilter,
    setSearchQuery,
    toggleSort,
    resetFilters,
    refresh,
  } = useFinancialData()

  const currency = summary?.currencyCode || 'TJS'
  const isLoading = summaryLoading || operationsLoading

  // Show projected balance only if there are pending operations
  const showProjectedBalance = (summary?.pendingDeduction ?? 0) > 0 || (summary?.pendingIncome ?? 0) > 0

  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* HEADER */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Финансы</h1>
          <p className="text-muted-foreground text-sm">
            {summary?.date ? format(new Date(summary.date), 'd MMMM yyyy', { locale: ru }) : '—'}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refresh()}
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          Обновить
        </Button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BALANCE CARD */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* Current Balance */}
            <div>
              <p className="text-sm text-muted-foreground mb-1">Текущий баланс</p>
              {summaryLoading ? (
                <Skeleton className="h-10 w-40" />
              ) : (
                <p className="text-4xl font-bold tabular-nums">
                  {summary?.balance?.toLocaleString() ?? 0}
                  <span className="text-lg font-normal text-muted-foreground ml-2">{currency}</span>
                </p>
              )}
            </div>

            {/* Pending Operations Summary */}
            {showProjectedBalance && (
              <div className="flex flex-wrap gap-6 pt-4 border-t border-border">
                {/* К поступлению */}
                {(summary?.pendingIncome ?? 0) > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20">
                      <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">К поступлению</p>
                      <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        +{summary?.pendingIncome?.toLocaleString()} {currency}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {summary?.pendingInvoicesCount} {declension(summary?.pendingInvoicesCount ?? 0, ['счёт', 'счёта', 'счетов'])}
                      </p>
                    </div>
                  </div>
                )}

                {/* К списанию */}
                {(summary?.pendingDeduction ?? 0) > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10 dark:bg-amber-500/20">
                      <TrendingDown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">К списанию</p>
                      <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                        −{summary?.pendingDeduction?.toLocaleString()} {currency}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {summary?.pendingOrdersCount} {declension(summary?.pendingOrdersCount ?? 0, ['заказ', 'заказа', 'заказов'])}
                      </p>
                    </div>
                  </div>
                )}

                {/* Projected Balance */}
                <div className="flex items-center gap-3 ml-auto">
                  <div className="p-2 rounded-lg bg-primary/10 dark:bg-primary/20">
                    <Wallet className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">После всех операций</p>
                    {summaryLoading ? (
                      <Skeleton className="h-5 w-24" />
                    ) : (
                      <p className={cn(
                        "text-sm font-semibold tabular-nums",
                        (summary?.projectedBalance ?? 0) < 0 ? "text-red-600 dark:text-red-400" : "text-foreground"
                      )}>
                        {summary?.projectedBalance?.toLocaleString() ?? 0} {currency}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* FILTERS & OPERATIONS TABLE */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        {/* Status Quick-Tabs */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('all')}
            className="gap-2"
          >
            Все
            {statusCounts.all > 0 && (
              <Badge variant={statusFilter === 'all' ? 'secondary' : 'outline'} className="h-5 px-1.5 text-xs">
                {statusCounts.all}
              </Badge>
            )}
          </Button>
          <Button
            variant={statusFilter === 'pending_deduction' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('pending_deduction')}
            className={cn("gap-2", statusFilter !== 'pending_deduction' && "border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10")}
          >
            <Clock className="h-3.5 w-3.5" />
            К списанию
            {statusCounts.pending_deduction > 0 && (
              <Badge variant={statusFilter === 'pending_deduction' ? 'secondary' : 'outline'} className="h-5 px-1.5 text-xs">
                {statusCounts.pending_deduction}
              </Badge>
            )}
          </Button>
          <Button
            variant={statusFilter === 'pending_income' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('pending_income')}
            className={cn("gap-2", statusFilter !== 'pending_income' && "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10")}
          >
            <Clock className="h-3.5 w-3.5" />
            К поступлению
            {statusCounts.pending_income > 0 && (
              <Badge variant={statusFilter === 'pending_income' ? 'secondary' : 'outline'} className="h-5 px-1.5 text-xs">
                {statusCounts.pending_income}
              </Badge>
            )}
          </Button>
          <Button
            variant={statusFilter === 'completed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('completed')}
            className="gap-2"
          >
            <Check className="h-3.5 w-3.5" />
            Выполненные
            {statusCounts.completed > 0 && (
              <Badge variant={statusFilter === 'completed' ? 'secondary' : 'outline'} className="h-5 px-1.5 text-xs">
                {statusCounts.completed}
              </Badge>
            )}
          </Button>
        </div>

        {/* Additional Filters Row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Type Filter - expanded */}
          <Select
            value={typeFilter}
            onValueChange={(val) => setTypeFilter(val as TypeFilter)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Все типы" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все типы операций</SelectItem>
              <SelectItem value="LUNCH_DEDUCTION">
                <div className="flex items-center gap-2">
                  <Users className="h-3 w-3 text-amber-500" />
                  Обеды сотрудников
                </div>
              </SelectItem>
              <SelectItem value="GUEST_ORDER">
                <div className="flex items-center gap-2">
                  <User className="h-3 w-3 text-purple-500" />
                  Гостевые заказы
                </div>
              </SelectItem>
              <SelectItem value="CLIENT_APP_ORDER">
                <div className="flex items-center gap-2">
                  <FileText className="h-3 w-3 text-blue-500" />
                  Заказы из приложения
                </div>
              </SelectItem>
              <SelectItem value="DEPOSIT">
                <div className="flex items-center gap-2">
                  <ArrowDownCircle className="h-3 w-3 text-emerald-500" />
                  Пополнения
                </div>
              </SelectItem>
              <SelectItem value="REFUND">
                <div className="flex items-center gap-2">
                  <ArrowDownCircle className="h-3 w-3 text-blue-500" />
                  Возвраты
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Reset Filters Button */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Сбросить
            </Button>
          )}

          {/* Count indicator */}
          <div className="ml-auto text-sm text-muted-foreground">
            {operationsTotal > 0 && (
              <span>{operationsTotal} {declension(operationsTotal, ['операция', 'операции', 'операций'])}</span>
            )}
          </div>
        </div>

        {/* Operations Table */}
        <OperationsTable
          operations={operations}
          loading={operationsLoading}
          currency={currency}
          page={page}
          pageSize={pageSize}
          showAll={showAll}
          total={operationsTotal}
          totalPages={operationsTotalPages}
          sortField={sortField}
          sortDesc={sortDesc}
          onPageChange={setPage}
          onShowAllChange={setShowAll}
          onToggleSort={toggleSort}
        />
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// OPERATIONS TABLE
// ═══════════════════════════════════════════════════════════════

interface OperationsTableProps {
  operations: FinancialOperation[]
  loading: boolean
  currency: string
  page: number
  pageSize: number
  showAll: boolean
  total: number
  totalPages: number
  sortField: SortField
  sortDesc: boolean
  onPageChange: (page: number) => void
  onShowAllChange: (value: boolean) => void
  onToggleSort: (field: SortField) => void
}

function OperationsTable({
  operations,
  loading,
  currency,
  page,
  pageSize,
  showAll,
  total,
  totalPages,
  sortField,
  sortDesc,
  onPageChange,
  onShowAllChange,
  onToggleSort,
}: OperationsTableProps) {

  const columns = useMemo<ColumnDef<FinancialOperation>[]>(() => [
    {
      accessorKey: 'createdAt',
      header: () => (
        <button
          className="flex items-center gap-1 hover:text-foreground transition-colors"
          onClick={() => onToggleSort('date')}
        >
          Дата
          <ArrowUpDown className={cn(
            "h-3 w-3",
            sortField === 'date' ? "text-foreground" : "text-muted-foreground/50"
          )} />
        </button>
      ),
      size: 130,
      cell: ({ row }) => {
        const op = row.original
        const execDate = op.executionDate ? new Date(op.executionDate) : null
        const createdDate = new Date(op.createdAt)
        const isPending = op.status !== 'COMPLETED'

        return (
          <div className="text-sm space-y-0.5">
            {isPending && execDate ? (
              <>
                <div className="font-medium">{format(execDate, 'd MMM', { locale: ru })} <span className="text-muted-foreground font-normal">ожидается</span></div>
                <div className="text-xs text-muted-foreground">{format(createdDate, 'd MMM', { locale: ru })} назначен</div>
              </>
            ) : (
              <>
                <div className="font-medium">{format(createdDate, 'd MMM', { locale: ru })}</div>
                <div className="text-xs text-muted-foreground">{format(createdDate, 'HH:mm')}</div>
              </>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'status',
      header: () => (
        <button
          className="flex items-center gap-1 hover:text-foreground transition-colors"
          onClick={() => onToggleSort('status')}
        >
          Статус
          <ArrowUpDown className={cn(
            "h-3 w-3",
            sortField === 'status' ? "text-foreground" : "text-muted-foreground/50"
          )} />
        </button>
      ),
      size: 140,
      cell: ({ row }) => {
        const status = row.original.status
        return (
          <StatusBadge status={status} />
        )
      },
    },
    {
      accessorKey: 'type',
      header: () => (
        <button
          className="flex items-center gap-1 hover:text-foreground transition-colors"
          onClick={() => onToggleSort('type')}
        >
          Тип
          <ArrowUpDown className={cn(
            "h-3 w-3",
            sortField === 'type' ? "text-foreground" : "text-muted-foreground/50"
          )} />
        </button>
      ),
      size: 160,
      cell: ({ row }) => {
        const op = row.original
        return (
          <div className="flex items-center gap-2">
            <OperationIcon operation={op} />
            <span className="text-sm font-medium">{getOperationTypeLabel(op.type)}</span>
          </div>
        )
      },
    },
    {
      accessorKey: 'description',
      header: 'Детали',
      cell: ({ row }) => {
        const op = row.original
        return (
          <div className="max-w-[280px]">
            <p className="text-sm truncate" title={op.description}>
              {op.description}
            </p>
            {op.details && (
              <p className="text-xs text-muted-foreground truncate" title={op.details}>
                {op.details}
              </p>
            )}
            {op.itemsCount > 1 && (
              <Badge variant="outline" className="mt-1 text-xs">
                {op.itemsCount} {declension(op.itemsCount, ['позиция', 'позиции', 'позиций'])}
              </Badge>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'amount',
      header: () => (
        <button
          className="flex items-center gap-1 hover:text-foreground transition-colors ml-auto"
          onClick={() => onToggleSort('amount')}
        >
          Сумма
          <ArrowUpDown className={cn(
            "h-3 w-3",
            sortField === 'amount' ? "text-foreground" : "text-muted-foreground/50"
          )} />
        </button>
      ),
      size: 130,
      cell: ({ row }) => {
        const op = row.original
        const amount = Math.abs(op.amount)
        return (
          <div className={cn(
            'text-right font-semibold tabular-nums',
            op.isIncome
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-amber-600 dark:text-amber-400'
          )}>
            {op.isIncome ? '+' : '−'}{amount.toLocaleString()} {currency}
          </div>
        )
      },
    },
  ], [currency, sortField, sortDesc, onToggleSort])

  return (
    <div className="space-y-4">
      <Card>
        <DataTable
          columns={columns}
          data={operations}
          isLoading={loading}
          loadingRows={5}
          emptyMessage={
            <div className="py-12 text-center">
              <Wallet className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Операций пока нет</p>
            </div>
          }
        />
      </Card>

      {/* Pagination */}
      {(totalPages > 1 || showAll) && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {showAll 
              ? `Показано все: ${total}`
              : `${((page - 1) * pageSize) + 1}–${Math.min(page * pageSize, total)} из ${total}`
            }
          </p>
          <div className="flex items-center gap-2">
            {showAll ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onShowAllChange(false)
                  onPageChange(1)
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
                  onClick={() => onPageChange(page - 1)}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium px-2">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(page + 1)}
                  disabled={page >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onShowAllChange(true)}
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
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// HELPER COMPONENTS
// ═══════════════════════════════════════════════════════════════

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'COMPLETED':
      return (
        <Badge variant="secondary" className="gap-1 bg-muted text-muted-foreground">
          <Check className="h-3 w-3" />
          {getOperationStatusLabel(status as any)}
        </Badge>
      )
    case 'PENDING_DEDUCTION':
      return (
        <Badge variant="outline" className="gap-1 border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/5">
          <Clock className="h-3 w-3" />
          {getOperationStatusLabel(status as any)}
        </Badge>
      )
    case 'PENDING_INCOME':
      return (
        <Badge variant="outline" className="gap-1 border-emerald-500/50 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">
          <Clock className="h-3 w-3" />
          {getOperationStatusLabel(status as any)}
        </Badge>
      )
    default:
      return (
        <Badge variant="outline">{status}</Badge>
      )
  }
}

function OperationIcon({ operation }: { operation: FinancialOperation }) {
  const { type, isIncome } = operation

  if (type === 'GUEST_ORDER') {
    return (
      <div className="p-1.5 rounded-md bg-purple-500/10 dark:bg-purple-500/20">
        <User className="h-4 w-4 text-purple-600 dark:text-purple-400" />
      </div>
    )
  }

  if (type === 'LUNCH_DEDUCTION') {
    return (
      <div className="p-1.5 rounded-md bg-amber-500/10 dark:bg-amber-500/20">
        <Users className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      </div>
    )
  }

  if (type === 'DEPOSIT') {
    return (
      <div className="p-1.5 rounded-md bg-emerald-500/10 dark:bg-emerald-500/20">
        <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
      </div>
    )
  }

  if (type === 'REFUND') {
    return (
      <div className="p-1.5 rounded-md bg-blue-500/10 dark:bg-blue-500/20">
        <ArrowDownCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      </div>
    )
  }

  // Default
  return (
    <div className={cn(
      "p-1.5 rounded-md",
      isIncome
        ? "bg-emerald-500/10 dark:bg-emerald-500/20"
        : "bg-amber-500/10 dark:bg-amber-500/20"
    )}>
      {isIncome ? (
        <ArrowDownCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <ArrowUpCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function declension(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100
  const n1 = abs % 10
  if (abs > 10 && abs < 20) return forms[2]
  if (n1 > 1 && n1 < 5) return forms[1]
  if (n1 === 1) return forms[0]
  return forms[2]
}

/**
 * @fileoverview Employee Table Columns
 * Reusable column definitions for employee data tables.
 * Centralizes column logic to avoid duplication across pages.
 */

'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Pencil,
  UtensilsCrossed,
  Wallet,
  Trash2,
  RotateCcw,
} from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import type { Employee } from '@/lib/api/employees'
import {
  formatWorkingDays,
  formatTJS,
  getInviteStatusConfig,
  getServiceTypeConfig,
  getStatusConfig,
  getShiftIcon,
} from '@/lib/utils/format'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface EmployeeColumnActions {
  onEdit?: (employee: Employee) => void
  onManageLunch?: (employee: Employee) => void
  onManageCompensation?: (employee: Employee) => void
  onToggleActive?: (employee: Employee) => void
  getProjectName?: (projectId: string | null | undefined) => string | null
}

// ═══════════════════════════════════════════════════════════════════════════════
// Column Definitions
// ═══════════════════════════════════════════════════════════════════════════════

export function createEmployeeColumns(actions: EmployeeColumnActions = {}): ColumnDef<Employee>[] {
  const columns: ColumnDef<Employee>[] = [
    // Name column with link
    {
      accessorKey: 'fullName',
      header: 'ФИО',
      cell: ({ row }) => (
        <Link
          href={`/employees/${row.original.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.fullName}
        </Link>
      ),
    },

    // Phone
    {
      accessorKey: 'phone',
      header: 'Телефон',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.phone || '—'}</span>
      ),
    },

    // Project
    {
      accessorKey: 'projectId',
      header: 'Проект',
      cell: ({ row }) => {
        const projectName = actions.getProjectName?.(row.original.projectId)
        return (
          <span className="text-muted-foreground text-sm">
            {projectName || '—'}
          </span>
        )
      },
    },

    // Service Type
    {
      accessorKey: 'serviceType',
      header: 'Услуга',
      cell: ({ row }) => {
        const serviceType = row.original.serviceType
        if (!serviceType) {
          return <span className="text-muted-foreground text-sm">—</span>
        }
        const config = getServiceTypeConfig(serviceType)
        return (
          <Badge variant="outline" className={config.className}>
            {config.icon === 'lunch' ? (
              <UtensilsCrossed className="h-3 w-3 mr-1" />
            ) : (
              <Wallet className="h-3 w-3 mr-1" />
            )}
            {config.label}
          </Badge>
        )
      },
    },

    // Budget
    {
      accessorKey: 'totalBudget',
      header: 'Бюджет',
      cell: ({ row }) => (
        <span className="font-medium">{formatTJS(row.original.totalBudget)}</span>
      ),
    },

    // Work Schedule
    {
      id: 'schedule',
      header: 'График',
      cell: ({ row }) => {
        const employee = row.original
        const shiftIcon = getShiftIcon(employee.shiftType)
        const days = formatWorkingDays(employee.workingDays)
        const time =
          employee.workStartTime && employee.workEndTime
            ? `${employee.workStartTime}–${employee.workEndTime}`
            : ''

        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm">
              {shiftIcon} {days}
            </span>
            {time && (
              <span className="text-xs text-muted-foreground">{time}</span>
            )}
          </div>
        )
      },
    },

    // Invite Status
    {
      accessorKey: 'inviteStatus',
      header: 'Приглашение',
      cell: ({ row }) => {
        const config = getInviteStatusConfig(row.original.inviteStatus)
        return (
          <Badge variant={config.variant} className={config.className}>
            {config.label}
          </Badge>
        )
      },
    },

    // Meal Status
    {
      accessorKey: 'mealStatus',
      header: 'Статус',
      cell: ({ row }) => {
        const status = row.original.mealStatus
        if (!status) {
          return <span className="text-muted-foreground text-sm">—</span>
        }
        const config = getStatusConfig(status)
        return (
          <Badge variant="outline" className={config.className}>
            {status}
          </Badge>
        )
      },
    },

    // Actions
    {
      id: 'actions',
      header: 'Действия',
      cell: ({ row }) => {
        const employee = row.original
        const isActive = employee.isActive
        const canManageLunch =
          isActive &&
          employee.inviteStatus === 'Принято' &&
          employee.serviceType !== 'COMPENSATION'
        const canManageCompensation =
          isActive &&
          employee.inviteStatus === 'Принято' &&
          employee.serviceType !== 'LUNCH'

        return (
          <div className="flex gap-1">
            {/* Edit */}
            {actions.onEdit && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => actions.onEdit?.(employee)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Редактировать</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Manage Lunch */}
            {actions.onManageLunch && canManageLunch && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-amber-600 hover:text-amber-700"
                      onClick={() => actions.onManageLunch?.(employee)}
                    >
                      <UtensilsCrossed className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Назначить обеды</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Manage Compensation */}
            {actions.onManageCompensation && canManageCompensation && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-emerald-600 hover:text-emerald-700"
                      onClick={() => actions.onManageCompensation?.(employee)}
                    >
                      <Wallet className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Управлять компенсацией</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Toggle Active */}
            {actions.onToggleActive && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 ${isActive ? 'text-red-600 hover:text-red-700' : 'text-emerald-600 hover:text-emerald-700'}`}
                      onClick={() => actions.onToggleActive?.(employee)}
                    >
                      {isActive ? (
                        <Trash2 className="h-4 w-4" />
                      ) : (
                        <RotateCcw className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isActive ? 'Деактивировать' : 'Активировать'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        )
      },
    },
  ]

  return columns
}


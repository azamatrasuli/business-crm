/**
 * @fileoverview Employee Header Component
 * Displays employee info header with name, status, and action buttons.
 * Extracted from employees/[id]/page.tsx to follow Single Responsibility Principle.
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ArrowLeft, Pencil, Phone, Mail, FolderKanban, CheckCircle2, Clock, XCircle, Ban, Trash2, AlertTriangle } from 'lucide-react'
import type { EmployeeDetail } from '@/lib/api/employees'
import { INVITE_STATUS, getInviteStatusConfig as getCentralizedInviteStatusConfig } from '@/lib/constants/entity-statuses'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface EmployeeHeaderProps {
  employee: EmployeeDetail
  onBack: () => void
  onEdit: () => void
  onHardDelete?: () => Promise<void>
  canEdit: boolean
  isDeleting?: boolean
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Functions - Use centralized status config
// ═══════════════════════════════════════════════════════════════════════════════

function getInviteStatusConfig(status: string | undefined) {
  const config = getCentralizedInviteStatusConfig(status)
  // Add icon based on status
  let icon = Clock
  if (status === INVITE_STATUS.ACCEPTED || status === 'Принято') {
    icon = CheckCircle2
  } else if (status === INVITE_STATUS.REJECTED || status === 'Отклонено') {
    icon = XCircle
  }
  return {
    variant: config.variant,
    className: config.className,
    icon,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════

export function EmployeeHeader({
  employee,
  onBack,
  onEdit,
  onHardDelete,
  canEdit,
  isDeleting = false
}: EmployeeHeaderProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const inviteConfig = getInviteStatusConfig(employee.inviteStatus)
  const InviteIcon = inviteConfig.icon

  const handleHardDelete = async () => {
    if (onHardDelete) {
      await onHardDelete()
      setIsDeleteDialogOpen(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="mt-1">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{employee.fullName}</h1>
            <div className="flex items-center gap-2">
              {/* Active Status */}
              {employee.isActive ? (
                <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Активен
                </Badge>
              ) : (
                <Badge variant="destructive" className="bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400">
                  <Ban className="h-3 w-3 mr-1" />
                  Неактивен
                </Badge>
              )}

              {/* Invite Status */}
              <Badge variant={inviteConfig.variant} className={inviteConfig.className}>
                <InviteIcon className="h-3 w-3 mr-1" />
                {employee.inviteStatus || 'Не приглашён'}
              </Badge>
            </div>
          </div>

          {/* Contact Info */}
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
            {employee.phone && (
              <span className="flex items-center gap-1.5">
                <Phone className="h-4 w-4" />
                {employee.phone}
              </span>
            )}
            {employee.email && (
              <span className="flex items-center gap-1.5">
                <Mail className="h-4 w-4" />
                {employee.email}
              </span>
            )}
            {employee.projectId && (
              <span className="flex items-center gap-1.5">
                <FolderKanban className="h-4 w-4" />
                Проект: {employee.projectId.slice(0, 8)}...
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 self-start sm:self-center">
        {/* Hard Delete Button with Confirmation Dialog */}
        {onHardDelete && (
          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Удалить навсегда
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  Удаление сотрудника
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-3">
                  <p>
                    Вы уверены, что хотите <strong>навсегда удалить</strong> сотрудника{' '}
                    <strong>{employee.fullName}</strong>?
                  </p>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
                    <p className="font-medium mb-2">Будут удалены:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Все данные сотрудника</li>
                      <li>Все заказы сотрудника</li>
                      <li>Подписка на обеды (если есть)</li>
                      <li>Бюджет сотрудника</li>
                    </ul>
                  </div>
                  <p className="font-medium text-red-600">
                    Это действие необратимо!
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Отмена</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleHardDelete}
                  disabled={isDeleting}
                  className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                >
                  {isDeleting ? 'Удаление...' : 'Удалить навсегда'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Edit Button */}
        <Button onClick={onEdit} disabled={!canEdit}>
          <Pencil className="h-4 w-4 mr-2" />
          Редактировать
        </Button>
      </div>
    </div>
  )
}

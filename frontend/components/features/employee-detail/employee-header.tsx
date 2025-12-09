/**
 * @fileoverview Employee Header Component
 * Displays employee info header with name, status, and action buttons.
 * Extracted from employees/[id]/page.tsx to follow Single Responsibility Principle.
 */

'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Pencil, Phone, Mail, FolderKanban, CheckCircle2, Clock, XCircle, Ban } from 'lucide-react'
import type { EmployeeDetail } from '@/lib/api/employees'
import { INVITE_STATUS } from '@/lib/constants/entity-statuses'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface EmployeeHeaderProps {
  employee: EmployeeDetail
  onBack: () => void
  onEdit: () => void
  canEdit: boolean
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════════

function getInviteStatusConfig(status: string | undefined) {
  switch (status) {
    case INVITE_STATUS.ACCEPTED:
    case 'Принято':  // Legacy
      return {
        variant: 'default' as const,
        className: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
        icon: CheckCircle2,
      }
    case INVITE_STATUS.PENDING:
    case 'Ожидает':  // Legacy
      return {
        variant: 'secondary' as const,
        className: 'bg-amber-500/10 text-amber-600 border-amber-200',
        icon: Clock,
      }
    case INVITE_STATUS.REJECTED:
    case 'Отклонено':  // Legacy
      return {
        variant: 'destructive' as const,
        className: 'bg-red-500/10 text-red-600 border-red-200',
        icon: XCircle,
      }
    default:
      return {
        variant: 'outline' as const,
        className: '',
        icon: Clock,
      }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════

export function EmployeeHeader({ employee, onBack, onEdit, canEdit }: EmployeeHeaderProps) {
  const inviteConfig = getInviteStatusConfig(employee.inviteStatus)
  const InviteIcon = inviteConfig.icon

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
                <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Активен
                </Badge>
              ) : (
                <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-200">
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

      {/* Edit Button */}
      <Button onClick={onEdit} disabled={!canEdit} className="self-start sm:self-center">
        <Pencil className="h-4 w-4 mr-2" />
        Редактировать
      </Button>
    </div>
  )
}


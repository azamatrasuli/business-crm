/**
 * @fileoverview Subscription Cards Components
 * Displays lunch and compensation subscription information.
 * Extracted from employees/[id]/page.tsx to follow Single Responsibility Principle.
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  UtensilsCrossed,
  Wallet,
  CalendarDays,
  AlertTriangle,
  PauseCircle,
  PlayCircle,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { EmployeeDetail } from '@/lib/api/employees'
import { getSubscriptionStatusConfig } from '@/lib/constants/entity-statuses'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface ProgressInfo {
  total: number
  used: number
  percent: number
}

interface LunchSubscriptionCardProps {
  subscription: NonNullable<EmployeeDetail['lunchSubscription']>
  progress: ProgressInfo
  daysRemaining: number | null
  isExpiringSoon: boolean
  onManage: () => void
  onPause?: () => void
  onResume?: () => void
  canManage: boolean
}

interface CompensationCardProps {
  compensation: NonNullable<EmployeeDetail['compensation']>
  progress: ProgressInfo
  daysRemaining: number | null
  isExpiringSoon: boolean
  onManage: () => void
  canManage: boolean
}

interface NoSubscriptionCardProps {
  type: 'lunch' | 'compensation'
  onCreate: () => void
  canCreate: boolean
  disabledReason?: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Functions - Use centralized status config
// ═══════════════════════════════════════════════════════════════════════════════

function getStatusConfig(status: string) {
  // Use centralized subscription status config
  const config = getSubscriptionStatusConfig(status)
  return { className: config.className }
}

/**
 * Check if subscription is completed (terminal state).
 */
function isSubscriptionCompleted(status?: string): boolean {
  return status === 'Завершена' || status === 'Завершен'
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    return format(parseISO(dateStr), 'dd MMMM yyyy', { locale: ru })
  } catch {
    return dateStr
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Lunch Subscription Card
// ═══════════════════════════════════════════════════════════════════════════════

export function LunchSubscriptionCard({
  subscription,
  progress,
  daysRemaining,
  isExpiringSoon,
  onManage,
  onPause,
  onResume,
  canManage,
}: LunchSubscriptionCardProps) {
  const statusConfig = getStatusConfig(subscription.status || '')
  // Check for paused status (+ DEPRECATED legacy 'На паузе')
  const isPaused = subscription.status === 'Приостановлена' || subscription.status === 'На паузе'
  // Check for active status (both Russian variants)
  const isActive = subscription.status === 'Активна' || subscription.status === 'Активен'
  // Check for completed status (terminal - cannot be resumed)
  const isCompleted = isSubscriptionCompleted(subscription.status)

  return (
    <Card className="border-2 border-amber-500/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <UtensilsCrossed className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Подписка на обеды</CardTitle>
              <p className="text-xs text-muted-foreground">
                {subscription.comboType || 'Комбо'} · {subscription.totalPrice?.toLocaleString() || 0} TJS
              </p>
            </div>
          </div>
          <Badge variant="outline" className={statusConfig.className}>
            {subscription.status || 'Неизвестно'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Прогресс</span>
            <span className="font-medium">
              {progress.used} / {progress.total} дней
            </span>
          </div>
          <Progress value={progress.percent} className="h-2" />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Начало</span>
            <p className="font-medium">{formatDate(subscription.startDate)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Окончание</span>
            <p className="font-medium">{formatDate(subscription.endDate)}</p>
          </div>
        </div>

        {/* Days remaining warning */}
        {isExpiringSoon && daysRemaining !== null && (
          <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Осталось {daysRemaining} {daysRemaining === 1 ? 'день' : daysRemaining < 5 ? 'дня' : 'дней'}
            </AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={onManage}
            disabled={!canManage || isCompleted}
            className="flex-1 bg-amber-600 hover:bg-amber-700"
          >
            <CalendarDays className="h-4 w-4 mr-2" />
            {isCompleted ? 'Завершена' : 'Управлять'}
          </Button>
          {/* Show pause button only for active subscriptions (not completed) */}
          {isActive && !isCompleted && onPause && (
            <Button variant="outline" onClick={onPause} disabled={!canManage}>
              <PauseCircle className="h-4 w-4" />
            </Button>
          )}
          {/* Show resume button only for paused (not completed) subscriptions */}
          {isPaused && !isCompleted && onResume && (
            <Button variant="outline" onClick={onResume} disabled={!canManage}>
              <PlayCircle className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Compensation Card
// ═══════════════════════════════════════════════════════════════════════════════

export function CompensationCard({
  compensation,
  progress,
  daysRemaining,
  isExpiringSoon,
  onManage,
  canManage,
}: CompensationCardProps) {
  const statusConfig = getStatusConfig(compensation.status || '')

  return (
    <Card className="border-2 border-emerald-500/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <Wallet className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Компенсация</CardTitle>
              <p className="text-xs text-muted-foreground">
                Лимит: {compensation.dailyLimit?.toLocaleString() || 0} TJS/день
              </p>
            </div>
          </div>
          <Badge variant="outline" className={statusConfig.className}>
            {compensation.status || 'Активна'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Budget Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Использовано</span>
            <span className="font-medium">
              {progress.used.toLocaleString()} / {progress.total.toLocaleString()} TJS
            </span>
          </div>
          <Progress value={progress.percent} className="h-2" />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Начало</span>
            <p className="font-medium">{formatDate(compensation.startDate)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Окончание</span>
            <p className="font-medium">{formatDate(compensation.endDate)}</p>
          </div>
        </div>

        {/* Days remaining warning */}
        {isExpiringSoon && daysRemaining !== null && (
          <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Осталось {daysRemaining} {daysRemaining === 1 ? 'день' : daysRemaining < 5 ? 'дня' : 'дней'}
            </AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        <Button
          onClick={onManage}
          disabled={!canManage}
          className="w-full bg-emerald-600 hover:bg-emerald-700"
        >
          <Wallet className="h-4 w-4 mr-2" />
          Управлять
        </Button>
      </CardContent>
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// No Subscription Card
// ═══════════════════════════════════════════════════════════════════════════════

export function NoSubscriptionCard({ type, onCreate, canCreate, disabledReason }: NoSubscriptionCardProps) {
  const isLunch = type === 'lunch'
  const Icon = isLunch ? UtensilsCrossed : Wallet
  const title = isLunch ? 'Подписка на обеды' : 'Компенсация'
  const description = isLunch
    ? 'У сотрудника нет активной подписки на обеды'
    : 'У сотрудника нет настроенной компенсации'
  const buttonText = isLunch ? 'Назначить обеды' : 'Настроить компенсацию'
  const colorClass = isLunch ? 'amber' : 'emerald'

  return (
    <Card className={cn('border-2 border-dashed', `border-${colorClass}-500/20`)}>
      <CardContent className="py-8 text-center">
        <div className={cn('rounded-full p-4 w-16 h-16 mx-auto mb-4', `bg-${colorClass}-500/10`)}>
          <Icon className={cn('h-8 w-8', `text-${colorClass}-600`)} />
        </div>
        <h3 className="font-semibold mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        <Button
          onClick={onCreate}
          disabled={!canCreate}
          variant="outline"
          className={cn(
            isLunch
              ? 'border-amber-200 text-amber-600 hover:bg-amber-50'
              : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
          )}
        >
          <Icon className="h-4 w-4 mr-2" />
          {buttonText}
        </Button>
        {!canCreate && disabledReason && (
          <p className="text-xs text-muted-foreground mt-2">{disabledReason}</p>
        )}
      </CardContent>
    </Card>
  )
}


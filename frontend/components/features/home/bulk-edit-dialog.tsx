'use client'

import { useState, useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useHomeStore } from '@/stores/home-store'
import { parseError, ErrorCodes } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { formatISODate } from '@/lib/utils/date'
import { ORDER_STATUS } from '@/lib/constants/entity-statuses'
import {
  Users,
  UtensilsCrossed,
  PauseCircle,
  PlayCircle,
  Snowflake,
  Trash2,
  Loader2,
  Check,
  AlertTriangle,
  Info,
  Building2,
  ChevronDown,
  ChevronUp,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
// ScrollArea removed - not currently used
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import type { Order, ComboType, BulkActionRequest } from '@/lib/api/home'
import { COMBO_METADATA, COMBO_TYPES } from '@/lib/combos'
import { freezeOrder } from '@/lib/api/orders'

type BulkAction = 
  | 'editCombo'      // Изменить комбо
  | 'pause'          // Поставить на паузу
  | 'resume'         // Возобновить
  | 'freeze'         // Заморозить (только сегодня)
  | 'cancel'         // Отменить

interface ActionOption {
  id: BulkAction
  label: string
  description: string
  icon: React.ReactNode
  color: string
  bgColor: string
  available: (orders: Order[], isToday: boolean) => boolean
  getApplicableCount: (orders: Order[]) => number
}

const ACTION_OPTIONS: ActionOption[] = [
  {
    id: 'editCombo',
    label: 'Изменить комбо',
    description: 'Сменить тип комбо для выбранных заказов',
    icon: <UtensilsCrossed className="h-5 w-5" />,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    available: (orders) => orders.some(o => o.serviceType === 'LUNCH' || !o.serviceType),
    getApplicableCount: (orders) => orders.filter(o => o.serviceType === 'LUNCH' || !o.serviceType).length,
  },
  {
    id: 'pause',
    label: 'Приостановить подписки',
    description: 'Временная остановка доставки',
    icon: <PauseCircle className="h-5 w-5" />,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    available: (orders) => orders.some(o => (o.status === ORDER_STATUS.ACTIVE || o.status === 'Активен') && (o.serviceType === 'LUNCH' || !o.serviceType)),
    getApplicableCount: (orders) => orders.filter(o => (o.status === ORDER_STATUS.ACTIVE || o.status === 'Активен') && (o.serviceType === 'LUNCH' || !o.serviceType)).length,
  },
  {
    id: 'resume',
    label: 'Возобновить подписки',
    description: 'Возобновить приостановленные подписки',
    icon: <PlayCircle className="h-5 w-5" />,
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    // 'На паузе' is DEPRECATED, use 'Приостановлен'
    available: (orders) => orders.some(o => (o.status === ORDER_STATUS.PAUSED || o.status === 'Приостановлен' || o.status === 'На паузе') && (o.serviceType === 'LUNCH' || !o.serviceType)),
    getApplicableCount: (orders) => orders.filter(o => (o.status === ORDER_STATUS.PAUSED || o.status === 'Приостановлен' || o.status === 'На паузе') && (o.serviceType === 'LUNCH' || !o.serviceType)).length,
  },
  {
    id: 'freeze',
    label: 'Заморозить на сегодня',
    description: 'День перенесётся в конец',
    icon: <Snowflake className="h-5 w-5" />,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50 dark:bg-cyan-950/30',
    available: (orders, isToday) => isToday && orders.some(o => o.status === ORDER_STATUS.ACTIVE || o.status === 'Активен'),
    getApplicableCount: (orders) => orders.filter(o => o.status === ORDER_STATUS.ACTIVE || o.status === 'Активен').length,
  },
  {
    id: 'cancel',
    label: 'Отменить заказы',
    description: 'Безвозвратная отмена',
    icon: <Trash2 className="h-5 w-5" />,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    available: () => true,
    getApplicableCount: (orders) => orders.length,
  },
]

interface BulkEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedOrders: Order[]
  selectedDate?: string // ISO date
  onSuccess?: () => void
}

export function BulkEditDialog({
  open,
  onOpenChange,
  selectedOrders,
  selectedDate,
  onSuccess,
}: BulkEditDialogProps) {
  const { bulkAction } = useHomeStore()
  const [selectedAction, setSelectedAction] = useState<BulkAction | null>(null)
  const [comboType, setComboType] = useState<ComboType>('Комбо 25')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [freezeProgress, setFreezeProgress] = useState(0)
  const [showEmployeeList, setShowEmployeeList] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  // Проверяем сегодняшняя ли это дата
  const isToday = useMemo(() => {
    if (!selectedDate) return false
    const today = formatISODate(new Date())
    return selectedDate === today
  }, [selectedDate])

  // Форматируем дату
  const dateFormatted = useMemo(() => {
    if (!selectedDate) return ''
    const date = new Date(selectedDate)
    return format(date, 'EEEE, d MMMM', { locale: ru }).replace(/^./, c => c.toUpperCase())
  }, [selectedDate])

  // Фильтруем доступные действия
  const availableActions = useMemo(() => {
    return ACTION_OPTIONS.filter(action => action.available(selectedOrders, isToday))
  }, [selectedOrders, isToday])

  // Статистика по выбранным
  const stats = useMemo(() => {
    const lunch = selectedOrders.filter(o => o.serviceType === 'LUNCH' || !o.serviceType).length
    const compensation = selectedOrders.filter(o => o.serviceType === 'COMPENSATION').length
    const active = selectedOrders.filter(o => o.status === ORDER_STATUS.ACTIVE || o.status === 'Активен').length
    // 'На паузе' is DEPRECATED, use 'Приостановлен'
    const paused = selectedOrders.filter(o => o.status === ORDER_STATUS.PAUSED || o.status === 'Приостановлен' || o.status === 'На паузе').length
    
    // Группировка по комбо
    const byCombo = selectedOrders.reduce((acc, o) => {
      const combo = o.comboType || 'Нет'
      acc[combo] = (acc[combo] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    // Группировка по проектам
    const byProject = selectedOrders.reduce((acc, o) => {
      const project = o.projectName || 'Без проекта'
      acc[project] = (acc[project] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    return { lunch, compensation, active, paused, total: selectedOrders.length, byCombo, byProject }
  }, [selectedOrders])

  // Получаем информацию о текущем действии
  const currentAction = useMemo(() => {
    return ACTION_OPTIONS.find(a => a.id === selectedAction)
  }, [selectedAction])

  // Сколько заказов будет затронуто выбранным действием
  const applicableCount = useMemo(() => {
    if (!currentAction) return 0
    return currentAction.getApplicableCount(selectedOrders)
  }, [currentAction, selectedOrders])

  // Предупреждения для текущего действия
  const warnings = useMemo(() => {
    const result: string[] = []
    
    if (selectedAction === 'editCombo') {
      if (stats.compensation > 0) {
        result.push(`${stats.compensation} сотр. с компенсацией не будут затронуты`)
      }
      const sameCombo = selectedOrders.filter(o => o.comboType === comboType).length
      if (sameCombo > 0) {
        result.push(`${sameCombo} уже имеют выбранный тип комбо`)
      }
    }
    
    if (selectedAction === 'pause' && stats.paused > 0) {
      result.push(`${stats.paused} уже на паузе — пропущены`)
    }
    
    if (selectedAction === 'resume' && stats.active > 0) {
      result.push(`${stats.active} уже активны — пропущены`)
    }
    
    return result
  }, [selectedAction, stats, comboType, selectedOrders])

  useEffect(() => {
    if (open) {
      setSelectedAction(null)
      setComboType('Комбо 25')
      setFreezeProgress(0)
      setShowEmployeeList(false)
      setConfirmCancel(false)
    }
  }, [open])

  const handleSubmit = async () => {
    if (!selectedAction) return
    
    // Для отмены требуем подтверждения
    if (selectedAction === 'cancel' && !confirmCancel) {
      setConfirmCancel(true)
      return
    }

    setIsSubmitting(true)
    try {
      const orderIds = selectedOrders.map(o => o.id)
      const employeeIds = [...new Set(selectedOrders.map(o => o.employeeId).filter(Boolean))] as string[]

      switch (selectedAction) {
        case 'editCombo': {
          // Фильтруем только ланч-заказы
          const lunchOrders = selectedOrders.filter(o => o.serviceType === 'LUNCH' || !o.serviceType)
          
          if (lunchOrders.length === 0) {
            toast.error('Нет ланч-заказов для изменения')
            return
          }
          
          // Меняем комбо только для выбранных заказов, а не всей подписки
          const request: BulkActionRequest = {
            orderIds: lunchOrders.map(o => o.id),
            action: 'changecombo',
            comboType,
          }
          await bulkAction(request)
          toast.success(`Комбо изменено для ${lunchOrders.length} заказов`)
          break
        }

        case 'pause': {
          // Pause subscriptions via bulk action
          const lunchOrders = selectedOrders.filter(o => 
            (o.status === ORDER_STATUS.ACTIVE || o.status === 'Активен') && 
            (o.serviceType === 'LUNCH' || !o.serviceType) &&
            o.employeeId
          )
          if (lunchOrders.length === 0) {
            toast.info('Нет активных ланч-заказов для приостановки')
            return
          }
          
          // Use bulk action API
          const request: BulkActionRequest = { 
            orderIds: lunchOrders.map(o => o.id), 
            action: 'pause' 
          }
          await bulkAction(request)
          toast.success(`Приостановлено: ${lunchOrders.length} заказов`, {
            description: 'Заказы временно приостановлены',
          })
          break
        }
        
        case 'resume': {
          // Resume subscriptions
          // 'На паузе' is DEPRECATED, use 'Приостановлен'
          const pausedOrders = selectedOrders.filter(o => 
            (o.status === ORDER_STATUS.PAUSED || o.status === 'Приостановлен' || o.status === 'На паузе') &&
            (o.serviceType === 'LUNCH' || !o.serviceType)
          )
          if (pausedOrders.length === 0) {
            toast.info('Нет приостановленных заказов для возобновления')
            return
          }
          
          // Fallback: use bulk action for backward compatibility
          const request: BulkActionRequest = { 
            orderIds: pausedOrders.map(o => o.id), 
            action: 'resume' 
          }
          await bulkAction(request)
          toast.success(`Возобновлено: ${pausedOrders.length} заказов`)
          break
        }

        case 'freeze': {
          // Freeze orders using new Orders API
          const activeOrders = selectedOrders.filter(o => (o.status === ORDER_STATUS.ACTIVE || o.status === 'Активен') && o.employeeId)
          if (activeOrders.length === 0) {
            toast.info('Нет активных заказов для заморозки')
            return
          }
          
          let successCount = 0
          let errorCount = 0
          
          for (let i = 0; i < activeOrders.length; i++) {
            const order = activeOrders[i]
            setFreezeProgress(Math.round(((i + 1) / activeOrders.length) * 100))
            
            try {
              // Use new orders API - freeze by order ID directly
              await freezeOrder(order.id, 'Массовая заморозка')
              successCount++
            } catch {
              errorCount++
            }
          }
          
          if (successCount > 0) {
            toast.success(`Заморожено: ${successCount} заказов`, {
              description: 'Подписки продлены, дни перенесены в конец периода',
            })
          }
          if (errorCount > 0) {
            toast.error(`Не удалось заморозить: ${errorCount}`, {
              description: 'Возможно превышен лимит заморозок (2 в неделю)',
            })
          }
          break
        }

        case 'cancel': {
          const request: BulkActionRequest = { orderIds, action: 'cancel' as any }
          await bulkAction(request)
          toast.success(`Отменено: ${orderIds.length} заказов`, {
            description: 'Стоимость возвращена на баланс',
          })
          break
        }
      }

      onSuccess?.()
      onOpenChange(false)
    } catch (error) {
      const appError = parseError(error)
      logger.error('Bulk action failed', error instanceof Error ? error : new Error(appError.message), {
        errorCode: appError.code,
      })
      
      if (appError.code === ErrorCodes.FREEZE_LIMIT_EXCEEDED) {
        toast.error('Лимит заморозок исчерпан', {
          description: 'Вы использовали 2 заморозки на этой неделе. Дождитесь следующей недели.',
          duration: 10000,
        })
      } else if (appError.code === ErrorCodes.ORDER_CUTOFF_PASSED) {
        toast.error('Время для изменений истекло', {
          description: 'Изменения на сегодня можно вносить до указанного времени',
        })
      } else {
        toast.error(appError.message, { description: appError.action })
      }
    } finally {
      setIsSubmitting(false)
      setFreezeProgress(0)
      setConfirmCancel(false)
    }
  }

  // Проверка что можно отправить форму
  const canSubmit = useMemo(() => {
    if (!selectedAction) return false
    if (applicableCount === 0) return false
    return true
  }, [selectedAction, applicableCount])

  // Текст кнопки
  const submitButtonText = useMemo(() => {
    if (isSubmitting) {
      if (selectedAction === 'freeze' && freezeProgress > 0) {
        return `Заморозка... ${freezeProgress}%`
      }
      return 'Выполнение...'
    }
    if (selectedAction === 'cancel') {
      return confirmCancel ? 'Подтвердить отмену' : 'Отменить заказы'
    }
    if (!selectedAction) return 'Выберите действие'
    return `Применить к ${applicableCount}`
  }, [isSubmitting, selectedAction, confirmCancel, applicableCount, freezeProgress])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Массовое редактирование
          </DialogTitle>
          <DialogDescription>
            {dateFormatted} • Выбрано {selectedOrders.length} заказов
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4 overflow-y-auto flex-1">
          {/* Статистика выбранных */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="gap-1">
              <Users className="h-3 w-3" />
              Всего: {stats.total}
            </Badge>
            {stats.lunch > 0 && (
              <Badge variant="outline" className="gap-1 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
                <UtensilsCrossed className="h-3 w-3" />
                Ланч: {stats.lunch}
              </Badge>
            )}
            {stats.compensation > 0 && (
              <Badge variant="outline" className="gap-1 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800">
                💳 Компенсация: {stats.compensation}
              </Badge>
            )}
            {stats.active > 0 && (
              <Badge variant="outline" className="gap-1 bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800">
                ✓ Активных: {stats.active}
              </Badge>
            )}
            {stats.paused > 0 && (
              <Badge variant="outline" className="gap-1 bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800">
                ⏸ Приостановлено: {stats.paused}
              </Badge>
            )}
          </div>

          {/* Проекты */}
          {Object.keys(stats.byProject).length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(stats.byProject).map(([project, count]) => (
                <Badge key={project} variant="outline" className="gap-1 text-xs">
                  <Building2 className="h-3 w-3" />
                  {project}: {count}
                </Badge>
              ))}
            </div>
          )}

          <Separator />

          {/* Выбор действия */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Выберите действие</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {availableActions.map(action => {
                const count = action.getApplicableCount(selectedOrders)
                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => {
                      setSelectedAction(action.id)
                      setConfirmCancel(false)
                    }}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all",
                      "hover:border-primary/50",
                      selectedAction === action.id
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    <div className={cn("p-2 rounded-md", action.bgColor, action.color)}>
                      {action.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm flex items-center gap-2">
                        {action.label}
                        {selectedAction === action.id && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{action.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Применимо к: <span className="font-medium">{count}</span> из {stats.total}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
            
            {availableActions.length === 0 && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Нет доступных действий для выбранных заказов
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Предупреждения */}
          {warnings.length > 0 && selectedAction && (
            <Alert className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
              <Info className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                {warnings.map((w, i) => (
                  <div key={i}>• {w}</div>
                ))}
              </AlertDescription>
            </Alert>
          )}

          {/* Дополнительные параметры в зависимости от действия */}
          {selectedAction === 'editCombo' && (
            <div className="space-y-3 pt-2">
              <Separator />
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Выберите тип комбо</Label>
                {/* Текущие комбо */}
                <div className="flex gap-1">
                  {Object.entries(stats.byCombo).map(([combo, count]) => (
                    <Badge key={combo} variant="outline" className="text-[10px]">
                      {combo}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
              <RadioGroup
                value={comboType}
                onValueChange={(v) => setComboType(v as ComboType)}
                className="grid grid-cols-1 gap-2"
              >
                {COMBO_TYPES.map((combo) => {
                  const data = COMBO_METADATA[combo]
                  const currentCount = stats.byCombo[combo] || 0
                  return (
                    <label
                      key={combo}
                      htmlFor={`bulk-edit-${combo}`}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all",
                        comboType === combo 
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20" 
                          : "hover:bg-muted/50"
                      )}
                    >
                      <RadioGroupItem value={combo} id={`bulk-edit-${combo}`} />
                      <div className="flex-1">
                        <p className="font-medium flex items-center gap-2">
                          <span>{data.icon}</span>
                          {data.title}
                          {currentCount > 0 && (
                            <Badge variant="secondary" className="text-[10px]">
                              Уже у {currentCount}
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {data.features.join(' • ')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">{data.price} ₸</p>
                      </div>
                    </label>
                  )
                })}
              </RadioGroup>
              
              <Alert className="bg-muted/50">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Изменение применится <span className="font-medium">к выбранным заказам</span>.
                  Для изменения всей подписки используйте «Управлять обедами».
                </AlertDescription>
              </Alert>
            </div>
          )}

          {selectedAction === 'pause' && (
            <Alert className="mt-2 border-orange-500/30 bg-orange-50/50 dark:bg-orange-950/20">
              <PauseCircle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800 dark:text-orange-200">
                <ul className="list-disc list-inside space-y-1">
                  <li>Заказы будут временно приостановлены</li>
                  <li><span className="font-medium">Внимание:</span> приостановленные дни НЕ переносятся</li>
                  <li>Для переноса дней используйте «Заморозить»</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {selectedAction === 'resume' && (
            <Alert className="mt-2 border-green-500/30 bg-green-50/50 dark:bg-green-950/20">
              <PlayCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                <ul className="list-disc list-inside space-y-1">
                  <li>Приостановленные заказы будут возобновлены</li>
                  <li>Доставка продолжится по расписанию</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {selectedAction === 'cancel' && (
            <div className="space-y-3">
              <Alert variant="destructive" className="mt-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Внимание! Это действие необратимо</AlertTitle>
                <AlertDescription>
                  Будет отменено <span className="font-bold">{selectedOrders.length}</span> заказов.
                  Стоимость будет возвращена на баланс компании.
                </AlertDescription>
              </Alert>
              
              {confirmCancel && (
                <Alert className="border-destructive/50 bg-destructive/10">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <AlertDescription className="text-destructive font-medium">
                    Нажмите ещё раз для подтверждения отмены
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {selectedAction === 'freeze' && (
            <div className="space-y-3">
              <Alert className="mt-2 border-cyan-500/30 bg-cyan-50/50 dark:bg-cyan-950/20">
                <Snowflake className="h-4 w-4 text-cyan-600" />
                <AlertDescription className="text-cyan-800 dark:text-cyan-200">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Заморозка переносит день на конец периода подписки</li>
                    <li>Лимит: <span className="font-medium">2 заморозки в неделю</span> на сотрудника</li>
                    <li>Заморозка возможна только для <span className="font-medium">сегодняшних</span> заказов</li>
                  </ul>
                </AlertDescription>
              </Alert>
              
              {isSubmitting && freezeProgress > 0 && (
                <div className="space-y-2">
                  <Progress value={freezeProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    Обработка: {freezeProgress}%
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Таблица выбранных заказов (идентична главной) */}
          <div className="space-y-2 pt-2">
            <Separator />
            <button
              type="button"
              onClick={() => setShowEmployeeList(!showEmployeeList)}
              className="flex items-center justify-between w-full py-1 text-left"
            >
              <Label className="text-sm font-medium cursor-pointer">
                Выбранные заказы ({selectedOrders.length})
              </Label>
              {showEmployeeList ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            
            {showEmployeeList && (
              <div className="h-[380px] rounded-lg border overflow-auto">
                <table className="w-full text-sm min-w-[900px]">
                  <thead className="sticky top-0 bg-muted/95 backdrop-blur-sm border-b z-10">
                    <tr>
                      <th className="text-left px-3 py-2.5 font-medium whitespace-nowrap">ФИО</th>
                      <th className="text-left px-3 py-2.5 font-medium whitespace-nowrap">Телефон</th>
                      <th className="text-left px-3 py-2.5 font-medium whitespace-nowrap">Дата</th>
                      <th className="text-left px-3 py-2.5 font-medium whitespace-nowrap">Тип</th>
                      <th className="text-left px-3 py-2.5 font-medium whitespace-nowrap">Услуга</th>
                      <th className="text-left px-3 py-2.5 font-medium whitespace-nowrap">Детали</th>
                      <th className="text-left px-3 py-2.5 font-medium whitespace-nowrap">Локация</th>
                      <th className="text-left px-3 py-2.5 font-medium whitespace-nowrap">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrders.map(order => (
                      <tr key={order.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="font-medium">{order.employeeName}</span>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                          {order.employeePhone || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                          {order.date ? format(new Date(order.date), 'd MMM', { locale: ru }) : '—'}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <Badge variant={order.type === 'Сотрудник' ? 'default' : 'secondary'}>
                            {order.type}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {order.serviceType === 'LUNCH' || !order.serviceType ? (
                            <Badge variant="outline" className="gap-1.5 bg-amber-500/10 text-amber-600 border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-700">
                              <UtensilsCrossed className="h-3 w-3" />
                              Ланч
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1.5 bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-700">
                              <Wallet className="h-3 w-3" />
                              Компенсация
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-amber-700 dark:text-amber-400">
                              {order.comboType || `${order.compensationLimit || 0} TJS`}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {order.amount?.toLocaleString() || 0} TJS
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-muted-foreground truncate max-w-[150px] block" title={order.address || order.projectName || undefined}>
                            {order.address || order.projectName || '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <Badge
                            variant={(order.status === ORDER_STATUS.ACTIVE || order.status === 'Активен') ? 'default' : 'secondary'}
                            className="min-w-[76px] justify-center"
                          >
                            {order.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter className="flex-shrink-0 border-t pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className={cn(
              "min-w-[140px]",
              selectedAction === 'cancel' && "bg-destructive hover:bg-destructive/90",
              confirmCancel && "animate-pulse"
            )}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {submitButtonText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { isAxiosError } from 'axios'
import { Loader2, Wallet, Calculator, Flame, ArrowRightLeft, RefreshCw, TrendingUp } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { servicesApi } from '@/lib/api/services'
import type { Order } from '@/lib/api/home'

const DAILY_LIMIT_PRESETS = [50, 75, 100, 150]

interface EditCompensationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: Order | null
  onSuccess?: () => void
}

export function EditCompensationDialog({ 
  open, 
  onOpenChange, 
  order,
  onSuccess 
}: EditCompensationDialogProps) {
  const [dailyLimit, setDailyLimit] = useState('100')
  const [carryOver, setCarryOver] = useState(false)
  const [autoRenew, setAutoRenew] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [compensationData, setCompensationData] = useState<{
    id: string
    dailyLimit: number
    totalBudget: number
    usedAmount: number
    startDate: string
    endDate: string
    carryOver: boolean
    autoRenew: boolean
  } | null>(null)

  // Загружаем данные о компенсации при открытии
  useEffect(() => {
    if (open && order?.employeeId) {
      setLoading(true)
      servicesApi.getEmployeeCompensation(order.employeeId)
        .then((data) => {
          if (data) {
            setCompensationData(data)
            setDailyLimit(data.dailyLimit.toString())
            setCarryOver(data.carryOver || false)
            setAutoRenew(data.autoRenew || false)
          }
        })
        .catch(() => {
          // Если нет компенсации, используем дефолты
          setCompensationData(null)
          setDailyLimit((order.compensationLimit || 100).toString())
        })
        .finally(() => setLoading(false))
    }
  }, [open, order])

  const dailyLimitNum = parseFloat(dailyLimit) || 0
  const currentLimit = compensationData?.dailyLimit || order?.compensationLimit || 0
  const usedAmount = compensationData?.usedAmount || order?.compensationAmount || 0
  const remainingToday = currentLimit - usedAmount

  // Проверяем что изменилось
  const limitChanged = dailyLimitNum !== currentLimit
  const carryOverChanged = carryOver !== (compensationData?.carryOver || false)
  const autoRenewChanged = autoRenew !== (compensationData?.autoRenew || false)
  const hasChanges = limitChanged || carryOverChanged || autoRenewChanged

  const handleSubmit = async () => {
    if (!compensationData?.id) {
      toast.error('Компенсация не найдена')
      return
    }

    if (!hasChanges) {
      toast.info('Нет изменений для сохранения')
      return
    }

    setIsSubmitting(true)
    try {
      await servicesApi.updateCompensation(compensationData.id, {
        dailyLimit: dailyLimitNum,
        carryOver,
        autoRenew,
      })
      toast.success('Компенсация обновлена')
      onSuccess?.()
      onOpenChange(false)
    } catch (error) {
      const message = isAxiosError(error)
        ? error.response?.data?.message
        : (error as Error)?.message
      toast.error(message || 'Ошибка при сохранении')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!order) return null

  // Форматируем даты
  const orderDateFormatted = order.date 
    ? format(new Date(order.date), 'EEEE, d MMMM', { locale: ru }).replace(/^./, (c) => c.toUpperCase())
    : ''
  
  const periodFormatted = compensationData 
    ? `${format(new Date(compensationData.startDate), 'd MMM', { locale: ru })} — ${format(new Date(compensationData.endDate), 'd MMM', { locale: ru })}`
    : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Wallet className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <DialogTitle>Редактировать компенсацию</DialogTitle>
              <DialogDescription>
                {order.employeeName} — {orderDateFormatted}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Текущий статус */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">Сегодня использовано</span>
                  {periodFormatted && (
                    <Badge variant="outline" className="text-xs">
                      {periodFormatted}
                    </Badge>
                  )}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-emerald-600">
                    {usedAmount.toLocaleString()} TJS
                  </span>
                  <span className="text-muted-foreground">
                    из {currentLimit.toLocaleString()} TJS
                  </span>
                </div>
                {remainingToday > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Остаток на сегодня: <span className="font-medium text-emerald-600">{remainingToday.toLocaleString()} TJS</span>
                  </p>
                )}
              </div>

              <Separator />

              {/* Дневной лимит */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-emerald-600" />
                  Дневной лимит
                </Label>
                <div className="grid grid-cols-4 gap-2">
                  {DAILY_LIMIT_PRESETS.map(val => (
                    <Button
                      key={val}
                      type="button"
                      size="sm"
                      variant={dailyLimit === val.toString() ? 'default' : 'outline'}
                      onClick={() => setDailyLimit(val.toString())}
                      className={cn(
                        dailyLimit === val.toString() && 'bg-emerald-600 hover:bg-emerald-700'
                      )}
                    >
                      {val} TJS
                    </Button>
                  ))}
                </div>
                <div className="relative">
                  <Input
                    type="number"
                    value={dailyLimit}
                    onChange={e => setDailyLimit(e.target.value)}
                    placeholder="Другая сумма"
                    min={1}
                    className="pr-16"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    TJS/день
                  </span>
                </div>
                {limitChanged && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Изменение вступит в силу немедленно
                  </p>
                )}
              </div>

              <Separator />

              {/* Остаток дневного лимита */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Неиспользованный остаток</Label>
                <RadioGroup 
                  value={carryOver ? 'carry' : 'burn'} 
                  onValueChange={(v) => setCarryOver(v === 'carry')}
                  className="grid grid-cols-2 gap-2"
                >
                  <Label className={cn(
                    'flex items-center gap-2 rounded-lg border-2 p-3 cursor-pointer transition-all text-sm',
                    !carryOver ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-border'
                  )}>
                    <RadioGroupItem value="burn" className="sr-only" />
                    <Flame className={cn('h-4 w-4', !carryOver ? 'text-emerald-600' : 'text-muted-foreground')} />
                    <span>Сгорает</span>
                  </Label>
                  <Label className={cn(
                    'flex items-center gap-2 rounded-lg border-2 p-3 cursor-pointer transition-all text-sm',
                    carryOver ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-border'
                  )}>
                    <RadioGroupItem value="carry" className="sr-only" />
                    <ArrowRightLeft className={cn('h-4 w-4', carryOver ? 'text-emerald-600' : 'text-muted-foreground')} />
                    <span>Переносится</span>
                  </Label>
                </RadioGroup>
              </div>

              {/* Автопродление */}
              <Label className={cn(
                'flex items-center justify-between rounded-lg border-2 p-3 cursor-pointer transition-all',
                autoRenew ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-border'
              )}>
                <div className="flex items-center gap-2">
                  <RefreshCw className={cn('h-4 w-4', autoRenew ? 'text-emerald-600' : 'text-muted-foreground')} />
                  <span className="text-sm font-medium">Автопродление</span>
                </div>
                <Checkbox 
                  checked={autoRenew} 
                  onCheckedChange={(checked) => setAutoRenew(checked === true)}
                  className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                />
              </Label>

              {!compensationData && (
                <Alert>
                  <AlertDescription className="text-sm">
                    Нет активной компенсации для этого сотрудника. 
                    Используйте полную форму для назначения.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </DialogBody>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!hasChanges || isSubmitting || !compensationData || loading}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Сохранение...
              </>
            ) : (
              'Сохранить'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


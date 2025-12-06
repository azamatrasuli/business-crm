'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useHomeStore } from '@/stores/home-store'
import { useProjectsStore } from '@/stores/projects-store'
import { useAuthStore } from '@/stores/auth-store'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
// Select removed - project is now auto-detected from user's JWT
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import type { ComboType, CreateGuestOrderRequest } from '@/lib/api/home'
import { COMBO_METADATA, COMBO_TYPES, getComboPrice } from '@/lib/combos'
import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { parseError, ErrorCodes } from '@/lib/errors'
import { logger } from '@/lib/logger'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

const formSchema = z.object({
  orderName: z.string().min(1, 'Обязательное поле'),
  quantity: z.number().int('Количество должно быть целым числом').min(1, 'Количество должно быть не меньше 1'),
  comboType: z.enum(['Комбо 25', 'Комбо 35'], { message: 'Выберите тип комбо' }),
  date: z.string().min(1),
})

type FormValues = z.infer<typeof formSchema>

interface GuestOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const todayIso = new Date().toISOString().split('T')[0]

const hasCutoffPassed = (cutoffTime: string | null) => {
  if (!cutoffTime) return false
  const [hours, minutes] = cutoffTime.split(':').map((part) => Number(part))
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return false
  const now = new Date()
  const cutoff = new Date()
  cutoff.setHours(hours, minutes, 0, 0)
  return now > cutoff
}

const getDisplayDate = (isoDate?: string) => {
  if (isoDate) {
    try {
      return parseISO(isoDate)
    } catch {
      // ignore
    }
  }
  const date = new Date()
  if (date.getDay() === 0 || date.getDay() === 6) {
    const next = new Date(date)
    do {
      next.setDate(next.getDate() + 1)
    } while (next.getDay() === 0 || next.getDay() === 6)
    return next
  }
  return date
}

export function GuestOrderDialog({ open, onOpenChange }: GuestOrderDialogProps) {
  const {
    createGuestOrder,
    dashboard,
    dateFilter,
    cutoffTime,
  } = useHomeStore()
  const { projects, fetchProjects } = useProjectsStore()
  const { projectId: userProjectId, projectName: userProjectName } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingData, setPendingData] = useState<CreateGuestOrderRequest | null>(null)

  const orderDateIso = dateFilter || todayIso
  const orderDate = useMemo(() => getDisplayDate(orderDateIso), [orderDateIso])
  const orderDateLabel = useMemo(
    () =>
      format(orderDate, 'EEEE, d MMMM', { locale: ru }).replace(
        /^./,
        (char) => char.toUpperCase()
      ),
    [orderDate]
  )

  // Get the user's project info - address will be taken automatically from the project
  const userProject = useMemo(
    () => projects?.find((p) => p.id === userProjectId) || null,
    [projects, userProjectId]
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      orderName: '',
      quantity: 1,
      comboType: 'Комбо 25',
      date: orderDateIso,
    },
  })

  const comboType = form.watch('comboType')
  const quantity = form.watch('quantity')
  const totalCost = quantity > 0 ? quantity * getComboPrice(comboType) : 0
  const remainingBudget = (dashboard?.totalBudget ?? 0) - totalCost
  const budgetInsufficient = remainingBudget < 0
  const isTodaySelected = orderDateIso === todayIso
  const isCutoffLocked = isTodaySelected && hasCutoffPassed(cutoffTime || null)
  const cutoffDisabledReason = isCutoffLocked
    ? cutoffTime
      ? `Изменения на сегодня закрыты в ${cutoffTime}`
      : 'Изменения на сегодня закрыты'
    : null
  const budgetDisabledReason = budgetInsufficient
    ? 'Недостаточно средств на бюджете компании'
    : null
  const submissionDisabledReason = budgetDisabledReason || cutoffDisabledReason
  const canSubmit =
    !loading &&
    !!userProjectId &&
    !submissionDisabledReason &&
    !budgetInsufficient &&
    quantity > 0

  useEffect(() => {
    if (open) {
      fetchProjects()
    }
  }, [open, fetchProjects])

  useEffect(() => {
    if (open) {
      form.reset({
        orderName: '',
        quantity: 1,
        comboType: 'Комбо 25',
        date: orderDateIso,
      })
      setPendingData(null)
      setConfirmOpen(false)
    }
  }, [open, orderDateIso, form])

  const handleSubmitForm = (data: FormValues) => {
    if (budgetInsufficient) {
      form.setError('quantity', {
        message: 'Недостаточно средств на бюджете компании',
      })
      return
    }
    if (submissionDisabledReason) {
      toast.error(submissionDisabledReason)
      return
    }
    if (!userProjectId) {
      toast.error('Проект не найден', {
        description: 'Вы не привязаны к проекту. Обратитесь к администратору.',
      })
      return
    }
    // projectId берётся автоматически из JWT claims на бэкенде
    const request: CreateGuestOrderRequest = {
      orderName: data.orderName,
      quantity: data.quantity,
      comboType: data.comboType,
      projectId: userProjectId, // Автоматически из проекта пользователя
      date: data.date,
    }
    setPendingData(request)
    setConfirmOpen(true)
  }

  const confirmGuestOrder = async () => {
    if (!pendingData) return
    setLoading(true)
    try {
      await createGuestOrder(pendingData)
      toast.success('Гостевой заказ создан')
      form.reset({
        orderName: '',
        quantity: 1,
        comboType: 'Комбо 25',
        date: orderDateIso,
      })
      setConfirmOpen(false)
      onOpenChange(false)
    } catch (error) {
      const appError = parseError(error)
      logger.error('Failed to create guest order', error instanceof Error ? error : new Error(appError.message), {
        errorCode: appError.code,
      })
      
      // Handle specific errors
      if (appError.code === ErrorCodes.ORDER_CUTOFF_PASSED) {
        toast.error('Время для создания заказов истекло', {
          description: 'Заказы на сегодня можно создавать до указанного времени отсечки',
          duration: 8000,
        })
      } else if (appError.code === ErrorCodes.BUDGET_INSUFFICIENT) {
        toast.error('Недостаточно бюджета', {
          description: 'Обратитесь к администратору для пополнения',
        })
      } else {
        toast.error(appError.message, { description: appError.action })
      }
    } finally {
      setLoading(false)
      setPendingData(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl w-[95vw] h-[90vh] flex flex-col">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmitForm)} className="flex flex-col flex-1 min-h-0">
            <DialogHeader>
              <DialogTitle>Создать гостевой заказ</DialogTitle>
              <DialogDescription>
                Заказ будет выполнен на {orderDateLabel}. Списание средств невозвратно.
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-4">
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="orderName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Название заказа *</FormLabel>
                      <FormControl>
                        <Input id="orderName" placeholder="Гости из Банка" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Количество *</FormLabel>
                        <FormControl>
                          <Input
                            id="quantity"
                            type="number"
                            min={1}
                            value={field.value ?? 1}
                            onChange={(event) =>
                              field.onChange(parseInt(event.target.value) || 1)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="comboType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Тип комбо *</FormLabel>
                        <FormControl>
                          <RadioGroup
                            value={field.value}
                            onValueChange={(value) => field.onChange(value as ComboType)}
                            className="gap-2"
                          >
                            {COMBO_TYPES.map((combo) => {
                              const data = COMBO_METADATA[combo]
                              const isSelected = field.value === combo
                              return (
                                <Label
                                  key={combo}
                                  htmlFor={`guest-combo-${combo}`}
                                  className={cn(
                                    'flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition',
                                    isSelected
                                      ? 'border-primary bg-primary/10 text-primary'
                                      : 'border-border bg-card/80 hover:border-primary/40 hover:bg-card'
                                  )}
                                >
                                  <RadioGroupItem id={`guest-combo-${combo}`} value={combo} />
                                  <div className="space-y-1">
                                    <p className="font-semibold flex items-center gap-2">
                                      <span className="text-lg">{data.icon}</span>
                                      {data.title}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {data.features.join(' • ')}
                                    </p>
                                  </div>
                                </Label>
                              )
                            })}
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Адрес доставки автоматически берётся из проекта */}
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <Label className="text-sm font-medium">Адрес доставки</Label>
                  {userProject ? (
                    <div className="mt-1.5 space-y-1">
                      <p className="font-semibold">{userProject.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {userProject.addressFullAddress || userProject.addressName || 'Адрес не указан'}
                      </p>
                    </div>
                  ) : userProjectName ? (
                    <div className="mt-1.5">
                      <p className="font-semibold">{userProjectName}</p>
                      <p className="text-sm text-muted-foreground">
                        Адрес будет взят из настроек проекта
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1.5 text-sm text-destructive">
                      Вы не привязаны к проекту. Обратитесь к администратору.
                    </p>
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="hidden">
                      <FormControl>
                        <input type="hidden" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                  <div className="flex flex-col gap-1">
                    <span>
                      Итого будет списано:{' '}
                      <Badge variant="secondary">{totalCost} TJS</Badge>
                    </span>
                    <span>
                      Остаток после списания:{' '}
                      <Badge variant={remainingBudget >= 0 ? 'outline' : 'destructive'}>
                        {Math.max(0, remainingBudget)} TJS
                      </Badge>
                    </span>
                    <span>Гостевые заказы нельзя отменить или вернуть средства.</span>
                  </div>
                </div>
              </div>
            </DialogBody>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {submissionDisabledReason
                  ? submissionDisabledReason
                  : loading
                    ? 'Создание...'
                    : 'Создать заказ'}
              </Button>
            </DialogFooter>
          </form>
        </Form>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Списать {totalCost} TJS?</AlertDialogTitle>
              <AlertDialogDescription>
                Будет создано {pendingData?.quantity ?? quantity} заказ(ов) «
                {pendingData?.orderName ?? form.getValues('orderName')}» по {comboType}. Средства
                списываются сразу и не подлежат возврату. Остаток после списания:{' '}
                {Math.max(0, remainingBudget)} TJS.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction onClick={confirmGuestOrder}>
                Да, списать {totalCost} TJS
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  )
}


'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useEmployeesStore } from '@/stores/employees-store'
import { parseError, ErrorCodes, applyFieldErrors } from '@/lib/errors'
import { logger } from '@/lib/logger'
import {
  DAYS_OF_WEEK,
  WORKING_DAYS_PRESETS,
  TIME_REGEX,
  toggleWorkingDay,
  getEffectiveWorkingDays,
} from '@/lib/constants'
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { Sun, Moon, Calendar, Clock, UtensilsCrossed, Wallet, AlertTriangle, Info, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isFeatureEnabled, getBlockedReason } from '@/lib/features.config'
import type { EmployeeDetail, UpdateEmployeeRequest, DayOfWeek } from '@/lib/api/employees'

const formSchema = z.object({
  fullName: z.string().min(1, 'Обязательное поле'),
  email: z.string().email('Некорректный email').optional().or(z.literal('')),
  position: z.string().optional(),
  // Service type
  serviceType: z.enum(['LUNCH', 'COMPENSATION']).nullable().optional(),
  // Work schedule
  shiftType: z.enum(['DAY', 'NIGHT']).nullable().optional(),
  workingDays: z.array(z.number()).optional(),
  workStartTime: z.string().regex(TIME_REGEX, 'Формат: ЧЧ:ММ').optional().or(z.literal('')),
  workEndTime: z.string().regex(TIME_REGEX, 'Формат: ЧЧ:ММ').optional().or(z.literal('')),
})

type FormValues = z.infer<typeof formSchema>

interface EditEmployeeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: EmployeeDetail
  onSuccess?: () => void
}

export function EditEmployeeDialog({
  open,
  onOpenChange,
  employee,
  onSuccess,
}: EditEmployeeDialogProps) {
  const { updateEmployee } = useEmployeesStore()
  const [loading, setLoading] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: employee.fullName,
      email: employee.email || '',
      position: employee.position || '',
      serviceType: employee.serviceType || null,
      shiftType: employee.shiftType || null,
      workingDays: getEffectiveWorkingDays(employee.workingDays),
      workStartTime: employee.workStartTime || '',
      workEndTime: employee.workEndTime || '',
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        fullName: employee.fullName,
        email: employee.email || '',
        position: employee.position || '',
        serviceType: employee.serviceType || null,
        shiftType: employee.shiftType || null,
        workingDays: getEffectiveWorkingDays(employee.workingDays),
        workStartTime: employee.workStartTime || '',
        workEndTime: employee.workEndTime || '',
      })
    }
  }, [open, employee, form])

  const workingDays = form.watch('workingDays') || []
  const shiftType = form.watch('shiftType')
  const serviceType = form.watch('serviceType')

  // Business rules for service type switching
  const hasActiveLunch = Boolean(employee.activeLunchSubscriptionId)
  const hasActiveCompensation = Boolean(employee.activeCompensationId)
  const canSwitchToCompensation = employee.canSwitchToCompensation ?? !hasActiveLunch
  const canSwitchToLunch = employee.canSwitchToLunch ?? !hasActiveCompensation

  const toggleDay = (day: DayOfWeek) => {
    const current = (form.getValues('workingDays') || []) as DayOfWeek[]
    form.setValue('workingDays', toggleWorkingDay(current, day))
  }

  const applyPreset = (days: DayOfWeek[]) => {
    form.setValue('workingDays', days)
  }

  const onSubmit = async (data: FormValues) => {
    // Validate service type switch
    if (data.serviceType === 'COMPENSATION' && !canSwitchToCompensation) {
      toast.error('Невозможно переключиться на Компенсацию: у сотрудника активная подписка на обеды')
      return
    }
    if (data.serviceType === 'LUNCH' && !canSwitchToLunch) {
      toast.error('Невозможно переключиться на Обеды: у сотрудника активная компенсация')
      return
    }

    setLoading(true)
    try {
      const request: UpdateEmployeeRequest = {
        fullName: data.fullName,
        email: data.email || undefined,
        position: data.position || undefined,
        // Only send serviceType if it's actually set (not null/undefined)
        serviceType: data.serviceType || undefined,
        shiftType: data.shiftType || undefined,
        workingDays: data.workingDays as DayOfWeek[] | undefined,
        workStartTime: data.workStartTime || undefined,
        workEndTime: data.workEndTime || undefined,
      }

      console.log('[EditEmployee] Sending request:', request)

      await updateEmployee(employee.id, request)
      toast.success('Сотрудник успешно обновлен')
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      const appError = parseError(error)

      logger.error('Failed to update employee', error instanceof Error ? error : new Error(appError.message), {
        errorCode: appError.code,
        employeeId: employee.id,
        fieldErrors: appError.fieldErrors,
      })

      // Handle multiple field errors at once
      if (appError.isMultiValidationError) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hasFieldErrors = applyFieldErrors(appError, form.setError as any)
        if (!hasFieldErrors) {
          toast.error(appError.message, { description: appError.action })
        }
        return
      }

      // Handle single field errors (backwards compatibility)
      switch (appError.code) {
        case ErrorCodes.EMP_SERVICE_TYPE_SWITCH_BLOCKED:
          form.setError('serviceType', { message: appError.message })
          toast.error(appError.message, {
            description: 'Дождитесь окончания подписки или отмените её',
            duration: 8000,
          })
          break
        case ErrorCodes.EMP_EMAIL_EXISTS:
        case ErrorCodes.EMP_EMAIL_DELETED:
        case ErrorCodes.EMP_INVALID_EMAIL_FORMAT:
          form.setError('email', { message: appError.message })
          break
        default:
          // Note: phone is not editable in this dialog
          toast.error(appError.message, {
            description: appError.action,
          })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg flex flex-col">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <DialogHeader>
              <DialogTitle>Редактировать сотрудника</DialogTitle>
              <DialogDescription>
                    {employee.fullName}
                  </DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-6">

              {/* ═══════════════════════════════════════════════════════════════ */}
              {/* СЕКЦИЯ 1: Личные данные */}
              {/* ═══════════════════════════════════════════════════════════════ */}
                <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  <h4 className="font-medium">Личные данные</h4>
                </div>

                <div className="grid gap-4">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ФИО</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="position"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Должность</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  </div>
                </section>

              {/* ═══════════════════════════════════════════════════════════════ */}
              {/* СЕКЦИЯ 2: Рабочий график */}
              {/* ═══════════════════════════════════════════════════════════════ */}
              <section className="space-y-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <h4 className="font-medium">Рабочий график</h4>
                </div>

                {/* Тип смены и время в одной строке */}
                <div className="grid grid-cols-3 gap-3">
                  <FormField
                    control={form.control}
                    name="shiftType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Тип смены</FormLabel>
                        <Select
                          value={field.value || 'none'}
                          onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Выберите" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">
                              <span className="text-muted-foreground">Не указано</span>
                            </SelectItem>
                            <SelectItem value="DAY">
                              <div className="flex items-center gap-2">
                                <Sun className="h-4 w-4 text-amber-500" />
                                Дневная
                              </div>
                            </SelectItem>
                            <SelectItem value="NIGHT">
                              <div className="flex items-center gap-2">
                                <Moon className="h-4 w-4 text-indigo-500" />
                                Ночная
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="workStartTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Начало
                        </FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="workEndTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Конец
                        </FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Рабочие дни */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Рабочие дни</Label>
                    <div className="flex gap-1">
                      {WORKING_DAYS_PRESETS.map((preset) => (
                        <Button
                          key={preset.label}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 text-xs px-2"
                          onClick={() => applyPreset(preset.days)}
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-1">
                    {DAYS_OF_WEEK.map((day) => {
                      const isSelected = workingDays.includes(day.value)
                      const isWeekend = day.value === 0 || day.value === 6
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => toggleDay(day.value)}
                          className={cn(
                            "flex-1 py-2 rounded-lg text-sm font-medium transition-all border-2",
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary"
                              : isWeekend
                                ? "bg-muted/50 text-muted-foreground border-transparent hover:border-muted-foreground/20"
                                : "bg-background text-foreground border-transparent hover:border-primary/30"
                          )}
                        >
                          {day.shortLabel}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </section>

              {/* ═══════════════════════════════════════════════════════════════ */}
              {/* СЕКЦИЯ 3: Тип услуги питания */}
              {/* ═══════════════════════════════════════════════════════════════ */}
              <section className="space-y-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <UtensilsCrossed className="h-4 w-4 text-primary" />
                  <h4 className="font-medium">Тип услуги питания</h4>
                </div>

                <FormField
                  control={form.control}
                  name="serviceType"
                    render={({ field }) => (
                      <FormItem>
                        <div className="grid grid-cols-2 gap-3">
                        {/* LUNCH Card */}
                        <button
                          type="button"
                          onClick={() => canSwitchToLunch && field.onChange(field.value === 'LUNCH' ? null : 'LUNCH')}
                          disabled={!canSwitchToLunch && field.value !== 'LUNCH'}
                          className={cn(
                            "relative flex items-center gap-3 rounded-xl border-2 p-3 transition-all text-left",
                            field.value === 'LUNCH'
                              ? "border-amber-500 bg-amber-500/10"
                              : canSwitchToLunch
                                ? "border-muted hover:border-amber-300 hover:bg-amber-50/50 dark:hover:bg-amber-950/20"
                                : "border-muted bg-muted/30 cursor-not-allowed opacity-60"
                          )}
                        >
                            <div className={cn(
                            "rounded-lg p-2 transition-colors shrink-0",
                            field.value === 'LUNCH' ? "bg-amber-500/20" : "bg-muted"
                          )}>
                            <UtensilsCrossed className={cn(
                              "h-5 w-5",
                              field.value === 'LUNCH' ? "text-amber-600" : "text-muted-foreground"
                            )} />
                          </div>
                          <div>
                            <p className={cn(
                              "font-medium text-sm",
                              field.value === 'LUNCH' ? "text-amber-700 dark:text-amber-400" : ""
                            )}>
                              Комплексные обеды
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Доставка готовых обедов
                            </p>
                          </div>
                          {field.value === 'LUNCH' && (
                            <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-amber-500" />
                          )}
                        </button>

                        {/* COMPENSATION Card */}
                        {(() => {
                          const isCompensationFeatureEnabled = isFeatureEnabled('compensation')
                          const blockedReason = getBlockedReason('compensation')
                          // Can select compensation only if feature is enabled AND business rules allow it
                          const canSelectCompensation = isCompensationFeatureEnabled && canSwitchToCompensation

                          return (
                            <button
                              type="button"
                              onClick={() => canSelectCompensation && field.onChange(field.value === 'COMPENSATION' ? null : 'COMPENSATION')}
                              disabled={!canSelectCompensation && field.value !== 'COMPENSATION'}
                              title={!isCompensationFeatureEnabled ? blockedReason || undefined : undefined}
                              className={cn(
                                "relative flex items-center gap-3 rounded-xl border-2 p-3 transition-all text-left",
                                !isCompensationFeatureEnabled && "opacity-50 cursor-not-allowed",
                                field.value === 'COMPENSATION'
                                  ? "border-emerald-500 bg-emerald-500/10"
                                  : canSelectCompensation
                                    ? "border-muted hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20"
                                    : "border-muted bg-muted/30 cursor-not-allowed opacity-60"
                              )}
                            >
                              <div className={cn(
                                "rounded-lg p-2 transition-colors shrink-0",
                                field.value === 'COMPENSATION' ? "bg-emerald-500/20" : "bg-muted"
                              )}>
                                <Wallet className={cn(
                                  "h-5 w-5",
                                  field.value === 'COMPENSATION' ? "text-emerald-600" : "text-muted-foreground"
                                )} />
                              </div>
                              <div>
                                <p className={cn(
                                  "font-medium text-sm",
                                  field.value === 'COMPENSATION' ? "text-emerald-700 dark:text-emerald-400" : ""
                                )}>
                                  Компенсация
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {isCompensationFeatureEnabled ? 'Денежная компенсация' : 'Скоро'}
                                </p>
                              </div>
                              {field.value === 'COMPENSATION' && (
                                <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-emerald-500" />
                              )}
                            </button>
                          )
                        })()}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Warning about active subscription */}
                  {!canSwitchToCompensation && employee.switchToCompensationBlockedReason && (
                    <Alert className="border-amber-500/50 bg-amber-500/10">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-700 dark:text-amber-400 text-sm">
                        {employee.switchToCompensationBlockedReason}
                      </AlertDescription>
                    </Alert>
                  )}
                  {!canSwitchToCompensation && !employee.switchToCompensationBlockedReason && hasActiveLunch && (
                    <Alert className="border-amber-500/50 bg-amber-500/10">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-700 dark:text-amber-400 text-sm">
                        <strong>Активная подписка на обеды.</strong> Переход на компенсацию возможен только после завершения или отмены подписки.
                      </AlertDescription>
                    </Alert>
                  )}
                  {!canSwitchToLunch && employee.switchToLunchBlockedReason && (
                    <Alert className="border-emerald-500/50 bg-emerald-500/10">
                      <Info className="h-4 w-4 text-emerald-600" />
                      <AlertDescription className="text-emerald-700 dark:text-emerald-400 text-sm">
                        {employee.switchToLunchBlockedReason}
                      </AlertDescription>
                    </Alert>
                  )}
                  {!canSwitchToLunch && !employee.switchToLunchBlockedReason && hasActiveCompensation && (
                    <Alert className="border-emerald-500/50 bg-emerald-500/10">
                      <Info className="h-4 w-4 text-emerald-600" />
                      <AlertDescription className="text-emerald-700 dark:text-emerald-400 text-sm">
                        <strong>Активная компенсация.</strong> Переход на обеды возможен только после завершения компенсации.
                      </AlertDescription>
                    </Alert>
                  )}
                </section>

            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Отмена
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Сохранение...' : 'Сохранить'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

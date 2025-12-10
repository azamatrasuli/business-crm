'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useEmployeesStore } from '@/stores/employees-store'
import { useAuthStore } from '@/stores/auth-store'
import { parseError, ErrorCodes, applyFieldErrors } from '@/lib/errors'
import { logger } from '@/lib/logger'
import {
  DAYS_OF_WEEK,
  WORKING_DAYS_PRESETS,
  PHONE_REGEX,
  TIME_REGEX,
  toggleWorkingDay,
  DEFAULT_WORKING_DAYS,
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Sun, Moon, Calendar, UtensilsCrossed, Wallet, Clock, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isFeatureEnabled, getBlockedReason } from '@/lib/features.config'
import type { CreateEmployeeRequest, ShiftType, DayOfWeek, ServiceType } from '@/lib/api/employees'

const formSchema = z.object({
  // Личные данные - все обязательные
  fullName: z.string().trim().min(1, 'Обязательное поле'),
  phone: z
    .string()
    .trim()
    .min(1, 'Обязательное поле')
    .regex(PHONE_REGEX, 'Введите корректный номер телефона'),
  email: z.string().trim().email('Некорректный email').optional().or(z.literal('')),
  position: z.string().trim().min(1, 'Обязательное поле'),

  // Рабочий график - все обязательные
  shiftType: z.enum(['DAY', 'NIGHT'], { message: 'Выберите тип смены' }),
  workStartTime: z.string().min(1, 'Обязательное поле').regex(TIME_REGEX, 'Формат: ЧЧ:ММ'),
  workEndTime: z.string().min(1, 'Обязательное поле').regex(TIME_REGEX, 'Формат: ЧЧ:ММ'),
  workingDays: z.array(z.number()).min(1, 'Выберите хотя бы один день'),

  // Тип услуги - опционально
  serviceType: z.enum(['LUNCH', 'COMPENSATION']).nullable().optional(),
})

type FormValues = z.infer<typeof formSchema>

interface CreateEmployeeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateEmployeeDialog({ open, onOpenChange }: CreateEmployeeDialogProps) {
  const { createEmployee } = useEmployeesStore()
  const { projectId } = useAuthStore()
  const [loading, setLoading] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      email: '',
      position: '',
      shiftType: 'DAY',
      workStartTime: '09:00',
      workEndTime: '18:00',
      workingDays: DEFAULT_WORKING_DAYS,
      serviceType: null,
    },
  })

  const workingDays = form.watch('workingDays') || []

  const toggleDay = (day: DayOfWeek) => {
    const current = (form.getValues('workingDays') || []) as DayOfWeek[]
    form.setValue('workingDays', toggleWorkingDay(current, day, 1))
  }

  const applyPreset = (days: DayOfWeek[]) => {
    form.setValue('workingDays', days)
  }

  const onSubmit = async (data: FormValues) => {
    if (!projectId) {
      toast.error('Не удалось определить проект. Пожалуйста, перезайдите в систему.')
      return
    }

    setLoading(true)
    try {
      const request: CreateEmployeeRequest = {
        fullName: data.fullName,
        phone: data.phone,
        email: data.email || undefined,
        position: data.position,
        projectId, // Required by backend
        serviceType: data.serviceType as ServiceType | undefined,
        shiftType: data.shiftType as ShiftType,
        workingDays: data.workingDays as DayOfWeek[],
        workStartTime: data.workStartTime,
        workEndTime: data.workEndTime,
      }
      await createEmployee(request)

      // NOTE: Invite functionality is planned for Client Web launch (Phase 2)
      // This will include: email invites, budget allocation, and employee self-service
      // See: docs/roadmap/client-web.md for details
      toast.success('Сотрудник успешно создан')

      form.reset()
      onOpenChange(false)
    } catch (error) {
      const appError = parseError(error)

      logger.error('Failed to create employee', error instanceof Error ? error : new Error(appError.message), {
        errorCode: appError.code,
        fieldErrors: appError.fieldErrors,
      })

      // Handle multiple field errors at once
      if (appError.isMultiValidationError) {
        const hasFieldErrors = applyFieldErrors(appError, form.setError)
        if (!hasFieldErrors) {
          toast.error(appError.message, { description: appError.action })
        }
        return
      }

      // Handle single field errors (backwards compatibility)
      switch (appError.code) {
        case ErrorCodes.EMP_PHONE_EXISTS:
        case ErrorCodes.EMP_PHONE_DELETED:
        case ErrorCodes.EMP_INVALID_PHONE_FORMAT:
          form.setError('phone', { message: appError.message })
          break
        case ErrorCodes.EMP_EMAIL_EXISTS:
        case ErrorCodes.EMP_EMAIL_DELETED:
        case ErrorCodes.EMP_INVALID_EMAIL_FORMAT:
          form.setError('email', { message: appError.message })
          break
        case ErrorCodes.PROJ_NOT_FOUND:
          toast.error('Проект не найден', {
            description: 'Пожалуйста, перезайдите в систему',
          })
          break
        default:
          // Show toast for other errors
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
              <DialogTitle>Создать сотрудника</DialogTitle>
              <DialogDescription>
                Заполните обязательные поля для создания нового сотрудника
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
                  <span className="text-xs text-muted-foreground ml-auto">Email опционален</span>
                </div>

                <div className="grid gap-4">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ФИО</FormLabel>
                        <FormControl>
                          <Input placeholder="Иванов Иван Иванович" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Телефон (Логин)</FormLabel>
                          <FormControl>
                            <Input placeholder="+992901234567" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="user@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="position"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Должность</FormLabel>
                        <FormControl>
                          <Input placeholder="Разработчик, Дизайнер, Менеджер..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </section>

              {/* ═══════════════════════════════════════════════════════════════ */}
              {/* СЕКЦИЯ 2: Рабочий график */}
              {/* ═══════════════════════════════════════════════════════════════ */}
              <section className="space-y-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <h4 className="font-medium">Рабочий график</h4>
                  <span className="text-xs text-muted-foreground ml-auto">Все поля обязательны</span>
                </div>

                {/* Тип смены и время в одной строке */}
                <div className="grid grid-cols-3 gap-3">
                  <FormField
                    control={form.control}
                    name="shiftType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Тип смены</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Выберите" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
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
                      // Use actual working days from form to determine styling
                      // Non-selected days are shown as "dimmed" instead of hardcoding weekends
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => toggleDay(day.value)}
                          className={cn(
                            "flex-1 py-2 rounded-lg text-sm font-medium transition-all border-2",
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted/50 text-muted-foreground border-transparent hover:border-primary/30"
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
              {/* СЕКЦИЯ 3: Тип услуги питания (опционально) */}
              {/* ═══════════════════════════════════════════════════════════════ */}
              <section className="space-y-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <UtensilsCrossed className="h-4 w-4 text-primary" />
                  <h4 className="font-medium">Тип услуги питания</h4>
                  <span className="text-xs text-amber-600 ml-auto">Опционально</span>
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
                          onClick={() => field.onChange(field.value === 'LUNCH' ? null : 'LUNCH')}
                          className={cn(
                            "relative flex items-center gap-3 rounded-xl border-2 p-3 transition-all text-left",
                            field.value === 'LUNCH'
                              ? "border-amber-500 bg-amber-500/10"
                              : "border-muted hover:border-amber-300 hover:bg-amber-50/50 dark:hover:bg-amber-950/20"
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
                          const isCompensationEnabled = isFeatureEnabled('compensation')
                          const blockedReason = getBlockedReason('compensation')

                          return (
                            <button
                              type="button"
                              disabled={!isCompensationEnabled}
                              onClick={() => isCompensationEnabled && field.onChange(field.value === 'COMPENSATION' ? null : 'COMPENSATION')}
                              title={blockedReason || undefined}
                              className={cn(
                                "relative flex items-center gap-3 rounded-xl border-2 p-3 transition-all text-left",
                                !isCompensationEnabled && "opacity-50 cursor-not-allowed",
                                field.value === 'COMPENSATION'
                                  ? "border-emerald-500 bg-emerald-500/10"
                                  : isCompensationEnabled
                                    ? "border-muted hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20"
                                    : "border-muted"
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
                                  {isCompensationEnabled ? 'Денежная компенсация' : 'Скоро'}
                                </p>
                              </div>
                              {field.value === 'COMPENSATION' && (
                                <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-emerald-500" />
                              )}
                            </button>
                          )
                        })()}
                      </div>
                      <p className="text-xs text-muted-foreground text-center mt-2">
                        Можно назначить позже через профиль сотрудника
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </section>

            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Отмена
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Создание...' : 'Создать сотрудника'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

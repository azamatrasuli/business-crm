'use client'

import { useState, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useHomeStore } from '@/stores/home-store'
import { useEmployeesStore } from '@/stores/employees-store'
import { isAxiosError } from 'axios'
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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { toast } from 'sonner'
import type { AssignMealsRequest, ComboType } from '@/lib/api/home'
import { COMBO_METADATA, COMBO_TYPES } from '@/lib/combos'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

const isWeekend = (date: Date) => {
  const day = date.getDay()
  return day === 0 || day === 6
}

const getNextWorkingDay = (date: Date) => {
  const next = new Date(date)
  do {
    next.setDate(next.getDate() + 1)
  } while (isWeekend(next))
  return next
}

const formSchema = z.object({
  employeeIds: z.array(z.string()).min(1, 'Выберите хотя бы одного сотрудника'),
  date: z.string().min(1, 'Обязательное поле'),
  comboType: z.enum(['Комбо 25', 'Комбо 35'], { message: 'Выберите тип комбо' }),
  // NOTE: Address comes from each employee's project (immutable)
})

type FormValues = z.infer<typeof formSchema>

interface AssignMealsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AssignMealsDialog({ open, onOpenChange }: AssignMealsDialogProps) {
  const { assignMeals } = useHomeStore()
  const { employees, fetchEmployees } = useEmployeesStore()
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const nextWorkingDay = useMemo(() => getNextWorkingDay(new Date()), [])
  const nextWorkingDayIso = useMemo(
    () => nextWorkingDay.toISOString().split('T')[0],
    [nextWorkingDay]
  )
  const nextWorkingDayLabel = useMemo(
    () =>
      format(nextWorkingDay, 'EEEE, d MMMM', { locale: ru })
        .replace(/^./, (char) => char.toUpperCase()),
    [nextWorkingDay]
  )

  // Only show employees eligible for lunch assignment:
  // 1. Active with accepted invitation
  // 2. Has a project (for delivery address)
  // 3. ServiceType is LUNCH (configured for lunch service)
  // 4. Day shift (lunch is delivered during the day)
  // 5. Has weekday working days
  const eligibleEmployees = useMemo(
    () => employees.filter((employee) => {
      // Basic requirements
      if (!employee.isActive) return false
      if (employee.inviteStatus !== 'Принято') return false
      if (!employee.projectId) return false // Must have a project for address
      
      // ServiceType must be LUNCH
      if (employee.serviceType !== 'LUNCH') return false
      
      // Night shift is incompatible with lunch
      if (employee.shiftType === 'NIGHT') return false
      
      // Must have at least one weekday in working days (Mon-Fri)
      const workDays = employee.workingDays || [1, 2, 3, 4, 5]
      const hasWeekdays = workDays.some(d => d >= 1 && d <= 5)
      if (!hasWeekdays) return false
      
      return true
    }),
    [employees]
  )

  const filteredEmployees = useMemo(() => {
    if (!searchTerm) return eligibleEmployees
    const term = searchTerm.toLowerCase()
    return eligibleEmployees.filter(
      (employee) =>
        employee.fullName.toLowerCase().includes(term) ||
        employee.phone.toLowerCase().includes(term)
    )
  }, [eligibleEmployees, searchTerm])

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employeeIds: [],
      date: nextWorkingDayIso,
      comboType: 'Комбо 25',
    },
  })

  const selectedEmployees = form.watch('employeeIds')

  useEffect(() => {
    if (open) {
      fetchEmployees()
      setSearchTerm('')
    }
  }, [open, fetchEmployees])

  useEffect(() => {
    if (open) {
      form.reset({
        employeeIds: [],
        date: nextWorkingDayIso,
        comboType: 'Комбо 25',
      })
    }
  }, [open, nextWorkingDayIso, form])

  const handleEmployeeToggle = (employeeId: string) => {
    const current = form.getValues('employeeIds')
    const nextValue = current.includes(employeeId)
      ? current.filter((id) => id !== employeeId)
      : [...current, employeeId]
    form.setValue('employeeIds', nextValue, { shouldValidate: true })
  }

  const handleSelectAll = () => {
    if (selectedEmployees.length === filteredEmployees.length) {
      form.setValue('employeeIds', [], { shouldValidate: true })
    } else {
      const allIds = filteredEmployees.map((employee) => employee.id)
      form.setValue('employeeIds', allIds, { shouldValidate: true })
    }
  }

  const onSubmit = async (data: FormValues) => {
    setLoading(true)
    try {
      const request: AssignMealsRequest = {
        employeeIds: data.employeeIds,
        date: data.date,
        comboType: data.comboType,
        // NOTE: Address comes from each employee's project (immutable)
      }
      await assignMeals(request)
      toast.success('Обеды успешно назначены')
      onOpenChange(false)
    } catch (error) {
      const message = isAxiosError(error)
        ? error.response?.data?.message
        : (error as Error)?.message
      toast.error(message || 'Ошибка при назначении обедов')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] h-[95vh] flex flex-col">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <DialogHeader>
              <DialogTitle>Назначить обеды</DialogTitle>
              <DialogDescription>
                Выберите сотрудников и назначьте им обеды на выбранную дату
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-4">
              <Alert>
                <AlertDescription>
                  Все назначения вступят в силу <strong>{nextWorkingDayLabel}</strong> (следующий рабочий день).
                </AlertDescription>
              </Alert>

              <input type="hidden" {...form.register('date')} />

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
                        className="grid grid-cols-1 gap-2"
                      >
                        {COMBO_TYPES.map((combo) => {
                          const data = COMBO_METADATA[combo]
                          return (
                            <label
                              key={combo}
                              htmlFor={combo}
                              className="flex cursor-pointer items-center gap-3 rounded-lg border p-3"
                            >
                              <RadioGroupItem value={combo} id={combo} />
                              <div className="flex-1">
                                <p className="font-medium flex items-center gap-2">
                                  <span>{data.icon}</span>
                                  {data.title}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {data.features.join(' • ')}
                                </p>
                              </div>
                            </label>
                          )
                        })}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* NOTE: Address is taken from each employee's project (immutable) */}
              <Alert className="bg-muted/50">
                <AlertDescription className="text-sm">
                  💡 Адрес доставки берётся из проекта каждого сотрудника автоматически.
                </AlertDescription>
              </Alert>

              <FormField
                control={form.control}
                name="employeeIds"
                render={() => (
                  <FormItem className="space-y-3 min-h-0 flex flex-col">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <FormLabel>Сотрудники *</FormLabel>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Поиск по ФИО или телефону"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="h-9 w-48"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleSelectAll}
                          disabled={filteredEmployees.length === 0}
                        >
                          {selectedEmployees.length === filteredEmployees.length ? 'Снять все' : 'Выбрать все'}
                        </Button>
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Найдено сотрудников: {filteredEmployees.length}. Выбрано: {selectedEmployees.length}.
                    </div>

                    <div className="border rounded-lg p-4 flex-1 min-h-[360px] max-h-[520px] overflow-y-auto">
                      {filteredEmployees.length === 0 ? (
                        <div className="text-sm text-muted-foreground space-y-2 py-8 text-center">
                          <p className="font-medium">
                            {eligibleEmployees.length === 0
                              ? (() => {
                                  const activeAccepted = employees.filter(e => e.isActive && e.inviteStatus === 'Принято')
                                  if (activeAccepted.length === 0) return 'Нет активных сотрудников с принятыми приглашениями'
                                  const withProject = activeAccepted.filter(e => e.projectId)
                                  if (withProject.length === 0) return 'Нет сотрудников с назначенным проектом'
                                  const lunchType = withProject.filter(e => e.serviceType === 'LUNCH')
                                  if (lunchType.length === 0) return 'Нет сотрудников с типом услуги «Обеды»'
                                  const dayShift = lunchType.filter(e => e.shiftType !== 'NIGHT')
                                  if (dayShift.length === 0) return 'Все сотрудники с обедами работают в ночную смену'
                                  return 'Нет подходящих сотрудников для назначения обедов'
                                })()
                              : 'По запросу ничего не найдено.'}
                          </p>
                          {eligibleEmployees.length === 0 && employees.length > 0 && (
                            <p className="text-xs text-muted-foreground/70">
                              Всего: {employees.filter(e => e.isActive).length} активных, 
                              {' '}{employees.filter(e => e.serviceType === 'LUNCH').length} с типом «Обеды»
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {filteredEmployees.map((employee) => (
                            <div
                              key={employee.id}
                              className="flex items-start space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                            >
                              <Checkbox
                                id={`employee-${employee.id}`}
                                checked={selectedEmployees.includes(employee.id)}
                                onCheckedChange={() => handleEmployeeToggle(employee.id)}
                                className="mt-1"
                              />
                              <label
                                htmlFor={`employee-${employee.id}`}
                                className="text-sm font-normal cursor-pointer flex-1"
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium">{employee.fullName}</p>
                                    <p className="text-xs text-muted-foreground">{employee.phone}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {employee.mealStatus === 'Активен'
                                        ? `Текущая подписка: ${employee.mealPlan || 'не указана'}`
                                        : 'Подписка не назначена'}
                                    </p>
                                    {employee.projectName && (
                                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                                        📍 {employee.projectName}
                                      </p>
                                    )}
                                  </div>
                                  {employee.mealStatus === 'Активен' && employee.mealPlan && (
                                    <Badge variant="outline" className="flex-shrink-0">
                                      {employee.mealPlan}
                                    </Badge>
                                  )}
                                </div>
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
              <Button
                type="submit"
                disabled={
                  loading ||
                  filteredEmployees.length === 0 ||
                  selectedEmployees.length === 0
                }
              >
                {loading ? 'Назначение...' : 'Назначить обеды'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}


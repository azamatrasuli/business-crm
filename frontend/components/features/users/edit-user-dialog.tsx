'use client'

import { useState, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useUsersStore } from '@/stores/users-store'
import { parseError, ErrorCodes } from '@/lib/errors'
import { logger } from '@/lib/logger'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { toast } from 'sonner'
import type { User, UpdateUserRequest } from '@/lib/api/users'

const phoneRegex = /^\+?[0-9]{9,15}$/

const formSchema = z.object({
  fullName: z.string().trim().min(1, 'Обязательное поле'),
  phone: z
    .string()
    .trim()
    .min(1, 'Обязательное поле')
    .regex(phoneRegex, 'Введите корректный номер телефона'),
  email: z.string().trim().email('Некорректный email'),
  role: z.string().trim().min(1, 'Обязательное поле'),
  status: z.string().trim().min(1, 'Обязательное поле'),
  permissions: z.array(z.string()).min(1, 'Выберите хотя бы одну страницу'),
})

type FormValues = z.infer<typeof formSchema>

interface EditUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User
}

const routeLabels: Record<string, string> = {
  home: 'Главная',
  employees: 'Сотрудники',
  payments: 'Оплаты',
  analytics: 'Аналитика',
  news: 'Новости',
  partners: 'Партнеры',
}

const EditUserDialogComponent = ({ open, onOpenChange, user }: EditUserDialogProps) => {
  const { updateUser, availableRoutes, fetchAvailableRoutes, fetchUser } = useUsersStore()
  const [loading, setLoading] = useState(false)
  const [initialPhone, setInitialPhone] = useState(user.phone)
  const selectableRoutes = useMemo(
    () => (availableRoutes || []).filter((route) => route !== 'users'),
    [availableRoutes]
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      role: user.role,
      status: user.status,
      permissions: user.permissions || [],
    },
  })

  useEffect(() => {
    let isMounted = true
    const load = async () => {
      fetchAvailableRoutes()
      try {
        const freshUser = await fetchUser(user.id)
        if (!isMounted) return
        form.reset({
          fullName: freshUser.fullName,
          phone: freshUser.phone,
          email: freshUser.email,
          role: freshUser.role,
          status: freshUser.status,
          permissions: freshUser.permissions || [],
        })
        setInitialPhone(freshUser.phone)
      } catch (error) {
        const appError = parseError(error)
        logger.error('Failed to load user', error instanceof Error ? error : new Error(appError.message))
        toast.error(appError.message)
      }
    }

    if (open) {
      load()
    } else {
      form.reset({
        fullName: user.fullName,
        phone: user.phone,
        email: user.email,
        role: user.role,
        status: user.status,
        permissions: user.permissions || [],
      })
      setInitialPhone(user.phone)
    }

    return () => {
      isMounted = false
    }
  }, [open, user, fetchUser, fetchAvailableRoutes, form])

  const onSubmit = async (data: FormValues) => {
    setLoading(true)
    logger.action('UpdateUserAttempt', { userId: user.id })
    
    try {
      const request: UpdateUserRequest = {
        fullName: data.fullName,
        phone: data.phone,
        email: data.email,
        role: data.role,
        status: data.status,
        permissions: data.permissions,
      }
      await updateUser(user.id, request)
      
      logger.info('User updated successfully', { userId: user.id })
      toast.success('Пользователь успешно обновлен')
      if (data.phone !== initialPhone) {
        toast.message('Пользователю отправлено уведомление о смене логина')
      }
      onOpenChange(false)
    } catch (error) {
      const appError = parseError(error)
      
      logger.error('Update user failed', error instanceof Error ? error : new Error(appError.message), {
        errorCode: appError.code,
        userId: user.id,
      })

      // Map specific errors to form fields
      switch (appError.code) {
        case ErrorCodes.USER_PHONE_EXISTS:
        case ErrorCodes.USER_INVALID_PHONE_FORMAT:
          form.setError('phone', { type: 'manual', message: appError.message })
          break
        case ErrorCodes.USER_EMAIL_EXISTS:
        case ErrorCodes.USER_INVALID_EMAIL_FORMAT:
          form.setError('email', { type: 'manual', message: appError.message })
          break
        default:
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
      <DialogContent className="max-w-2xl h-[95vh] flex flex-col">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <DialogHeader>
              <DialogTitle>Редактировать пользователя</DialogTitle>
              <DialogDescription>Измените данные пользователя</DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-4">
              <div className="space-y-6">
                <div>
                  <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wide">
                    Данные пользователя
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Обновите контактные данные и статус. Заблокированный пользователь не сможет войти.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ФИО *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Номер телефона *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Роль *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel>Статус *</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите статус" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Активный">Активный</SelectItem>
                            <SelectItem value="Заблокирован">Заблокирован</SelectItem>
                            <SelectItem value="Не активный">Не активный</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="permissions"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <div>
                        <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wide">
                          Доступ к страницам
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Права выбираются только для клиентских страниц. Раздел&nbsp;
                          <span className="font-medium">«Пользователи»</span> всегда остаётся у Admin.
                        </p>
                        <FormLabel className="text-base">Права доступа *</FormLabel>
                      </div>
                      {selectableRoutes.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3 border rounded-lg p-4">
                          {selectableRoutes.map((route) => {
                            const currentValue = field.value ?? []
                            const checked = currentValue.includes(route)
                            return (
                              <div key={route} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`edit-permission-${route}`}
                                  checked={checked}
                                  onCheckedChange={(checkedValue) => {
                                    const nextValue =
                                      checkedValue === true
                                        ? [...currentValue, route]
                                        : currentValue.filter((p) => p !== route)
                                    field.onChange(nextValue)
                                  }}
                                />
                                <Label
                                  htmlFor={`edit-permission-${route}`}
                                  className="text-sm font-normal cursor-pointer"
                                >
                                  {routeLabels[route] || route}
                                </Label>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground border rounded-lg p-4">
                          Нет доступных страниц для назначения.
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Отмена
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Сохранение...' : 'Сохранить изменения'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export { EditUserDialogComponent as EditUserDialog }


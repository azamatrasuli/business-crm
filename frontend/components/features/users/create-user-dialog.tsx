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
import { ScrollArea } from '@/components/ui/scroll-area'
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
import type { CreateUserRequest } from '@/lib/api/users'

const phoneRegex = /^\+?[0-9]{9,15}$/

const formSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Обязательное поле'),
    phone: z
      .string()
      .trim()
      .min(1, 'Обязательное поле')
      .regex(phoneRegex, 'Введите корректный номер телефона'),
    email: z.string().trim().email('Некорректный email'),
    role: z.string().trim().min(1, 'Обязательное поле'),
    password: z.string().min(6, 'Минимум 6 символов'),
    confirmPassword: z.string(),
    permissions: z.array(z.string()).min(1, 'Выберите хотя бы одну страницу'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  })

type FormValues = z.infer<typeof formSchema>

interface CreateUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const routeLabels: Record<string, string> = {
  home: 'Главная',
  employees: 'Сотрудники',
  payments: 'Оплаты',
  analytics: 'Аналитика',
  news: 'Новости',
  partners: 'Партнеры',
}

const CreateUserDialogComponent = ({ open, onOpenChange }: CreateUserDialogProps) => {
  const { createUser, availableRoutes, fetchAvailableRoutes } = useUsersStore()
  const [loading, setLoading] = useState(false)
  const selectableRoutes = useMemo(
    () => (availableRoutes || []).filter((route) => route !== 'users'),
    [availableRoutes]
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      email: '',
      role: '',
      password: '',
      confirmPassword: '',
      permissions: [],
    },
  })

  useEffect(() => {
    if (open) {
      fetchAvailableRoutes()
    } else {
      form.reset()
    }
  }, [open, fetchAvailableRoutes, form])

  const onSubmit = async (data: FormValues) => {
    setLoading(true)
    logger.action('CreateUserAttempt', { phone: data.phone.substring(0, 6) + '...' })
    
    try {
      const request: CreateUserRequest = {
        fullName: data.fullName,
        phone: data.phone,
        email: data.email,
        role: data.role,
        password: data.password,
        permissions: data.permissions,
      }
      await createUser(request)
      
      logger.info('User created successfully')
      toast.success('Пользователь успешно создан')
      toast.message('Новый аккаунт получит статус "Не активный" до первого входа')
      form.reset()
      onOpenChange(false)
    } catch (error) {
      const appError = parseError(error)
      
      logger.error('Create user failed', error instanceof Error ? error : new Error(appError.message), {
        errorCode: appError.code,
      })

      // Map specific errors to form fields
      switch (appError.code) {
        case ErrorCodes.USER_PHONE_EXISTS:
        case ErrorCodes.USER_INVALID_PHONE_FORMAT:
          form.setError('phone', { type: 'manual', message: appError.message })
          break
        case ErrorCodes.USER_EMAIL_EXISTS:
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
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <DialogHeader>
              <DialogTitle>Создать пользователя</DialogTitle>
              <DialogDescription>
                Заполните форму для создания нового пользователя
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-4">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-6">
                  <div>
                    <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wide">
                      Данные пользователя
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Заполните профиль и временный пароль, который пользователь сменит при первом
                      входе.
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
                            <Input placeholder="Иванов Иван Иванович" {...field} />
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
                            <Input placeholder="+992901234567" {...field} />
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
                            <Input type="email" placeholder="user@example.com" {...field} />
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
                            <Input placeholder="Admin, Manager, etc." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Пароль *</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Минимум 6 символов" {...field} />
                          </FormControl>
                          <FormDescription>
                            Это временный пароль. Пользователь поменяет его при первом входе.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Подтвердите пароль *</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Повторите пароль" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="permissions"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <div className="space-y-2">
                          <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wide">
                            Доступ к страницам
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Выберите хотя бы одну страницу. Раздел&nbsp;
                            <span className="font-medium">«Пользователи»</span> недоступен для
                            делегирования.
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
                                    id={`permission-${route}`}
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
                                    htmlFor={`permission-${route}`}
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
              </ScrollArea>
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Отмена
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Создание...' : 'Создать пользователя'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export { CreateUserDialogComponent as CreateUserDialog }


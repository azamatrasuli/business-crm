'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useAuthStore } from '@/stores/auth-store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { UserCircle, Mail, Phone, Shield, Lock, Building2, Crown, UtensilsCrossed, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { parseError } from '@/lib/errors'

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Обязательное поле'),
    newPassword: z.string().min(6, 'Минимум 6 символов'),
    confirmPassword: z.string().min(6, 'Минимум 6 символов'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  })

export default function ProfilePage() {
  const { user, changePassword, projectName, isHeadquarters } = useAuthStore()
  const [passwordLoading, setPasswordLoading] = useState(false)
  const isInitialLogin = user?.status === 'Не активный'

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  const handlePasswordSubmit = async (data: z.infer<typeof passwordSchema>) => {
    setPasswordLoading(true)
    try {
      await changePassword(data.currentPassword, data.newPassword)
      toast.success('Пароль успешно изменен')
      passwordForm.reset()
    } catch (error: unknown) {
      const appError = parseError(error)
      toast.error(appError.message, { description: appError.action })
    } finally {
      setPasswordLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertDescription>Пользователь не найден. Пожалуйста, войдите снова.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <UserCircle className="h-8 w-8 text-primary" />
          Мой профиль
        </h1>
        <p className="text-muted-foreground mt-1">
          Управление личными данными и настройками
        </p>
      </div>
      {isInitialLogin && (
        <Alert>
          <AlertDescription>
            Для завершения активации аккаунта укажите постоянный пароль.
          </AlertDescription>
        </Alert>
      )}

      {/* Profile Info */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Личная информация</CardTitle>
            <CardDescription>Основные данные профиля</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">ФИО</Label>
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md border">
                <UserCircle className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{user.fullName}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">Email</Label>
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md border">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{user.email || '—'}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">Номер телефона</Label>
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md border">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{user.phone}</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground pt-2 border-t">
              Для изменения личных данных обратитесь в Yalla CRM
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Права доступа</CardTitle>
            <CardDescription>Текущие разрешения в системе</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Роль</Label>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <Badge variant="default" className="text-base px-3 py-1">
                  {user.role}
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Статус</Label>
              <Badge variant={user.status === 'Активный' ? 'default' : 'secondary'}>
                {user.status}
              </Badge>
            </div>

            <div className="space-y-2">
              <Label>Права доступа</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {user.permissions && user.permissions.length > 0 ? (
                  user.permissions.map((permission) => (
                    <Badge key={permission} variant="outline">
                      {permission}
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Нет прав доступа</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* My Project Card */}
      {projectName && (
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-purple-500/5 to-violet-500/5" />
          <CardHeader className="relative">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Мой проект
                </CardTitle>
                <CardDescription>Информация о вашем проекте</CardDescription>
              </div>
              {isHeadquarters && (
                <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  <Crown className="h-3 w-3" />
                  Головной офис
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Название проекта</Label>
                <p className="font-medium flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  {projectName}
                </p>
              </div>
              
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Тип услуги</Label>
                <p className="font-medium flex items-center gap-2">
                  <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
                  Комплексные обеды
                </p>
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground mt-4 pt-4 border-t">
              Для изменения настроек проекта обратитесь к администратору
            </p>
          </CardContent>
        </Card>
      )}

      {/* Security Card */}
      <Card>
        <CardHeader>
          <CardTitle>Безопасность</CardTitle>
          <CardDescription>Управление паролем и безопасностью</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isInitialLogin ? (
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-4">
                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Текущий пароль</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                          <Input
                            type="password"
                            placeholder="Временный пароль"
                            className="pl-10"
                            disabled={passwordLoading}
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Новый пароль</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                          <Input
                            type="password"
                            placeholder="Минимум 6 символов"
                            className="pl-10"
                            disabled={passwordLoading}
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Подтвердите пароль</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                          <Input
                            type="password"
                            className="pl-10"
                            disabled={passwordLoading}
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={passwordLoading}>
                  {passwordLoading ? 'Изменяем...' : 'Изменить пароль'}
                </Button>
              </form>
            </Form>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Если вы забыли пароль, вы можете сбросить его и установить новый.
              </p>
              <Button variant="outline" asChild>
                <Link href="/forgot-password">Я не помню пароль</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


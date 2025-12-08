'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Phone, Lock, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { parseError, ErrorCodes, isRetryableError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { isFeatureEnabled } from '@/lib/features.config'

export default function LoginPage() {
  const router = useRouter()
  const { login, isLoading } = useAuthStore()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [errorAction, setErrorAction] = useState('')
  const [canRetry, setCanRetry] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setErrorAction('')
    setCanRetry(false)

    if (!phone || !password) {
      setError('Заполните все поля')
      return
    }

    logger.action('LoginAttempt', { phone: phone.substring(0, 6) + '...' })

    try {
      const loggedInUser = await login(phone, password)
      
      logger.info('Login successful', { userId: loggedInUser.id })
      toast.success('Успешный вход!')
      
      if (loggedInUser.status === 'Не активный') {
        toast.info('Пожалуйста, смените временный пароль')
        router.push('/profile')
      } else {
        router.push('/')
        router.refresh()
      }
    } catch (err: unknown) {
      const appError = parseError(err)
      
      logger.error('Login failed', err instanceof Error ? err : new Error(appError.message), {
        errorCode: appError.code,
        phone: phone.substring(0, 6) + '...',
      })

      setError(appError.message)
      setErrorAction(appError.action ?? '')
      setCanRetry(isRetryableError(appError))

      // Show toast with appropriate styling based on error type
      if (appError.code === ErrorCodes.AUTH_USER_BLOCKED) {
        toast.error(appError.message, {
          description: appError.action,
          duration: 10000,
        })
      } else if (appError.isNetworkError) {
        toast.error('Ошибка сети', {
          description: 'Проверьте подключение к интернету',
        })
      }
    }
  }

  const handleRetry = () => {
    setCanRetry(false)
    handleSubmit(new Event('submit') as unknown as React.FormEvent)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <Card className="w-full max-w-md shadow-2xl border-2">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <span className="text-2xl font-bold text-primary-foreground">Y</span>
          </div>
          <CardTitle className="text-3xl font-bold">Yalla Business Admin</CardTitle>
          <CardDescription className="text-base">
            Войдите в систему для управления
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive" className="animate-in fade-in-50">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="ml-2">
                  <div className="font-medium">{error}</div>
                  {errorAction && (
                    <div className="text-sm opacity-90 mt-1">{errorAction}</div>
                  )}
                  {canRetry && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                      onClick={handleRetry}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Повторить
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="phone">Номер телефона</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+992901234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-10"
                  disabled={isLoading}
                  required
                  aria-invalid={!!error}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Введите пароль"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  disabled={isLoading}
                  required
                  aria-invalid={!!error}
                />
              </div>
              {isFeatureEnabled('passwordReset') && (
                <div className="text-right">
                  <Button variant="link" className="px-0" asChild>
                    <Link href="/forgot-password">Забыли пароль?</Link>
                  </Button>
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-11 text-base font-semibold"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Вход...
                </>
              ) : (
                'Войти'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

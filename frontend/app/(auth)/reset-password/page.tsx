'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Lock, ArrowLeft, AlertCircle, RefreshCw } from 'lucide-react'
import { authApi } from '@/lib/api/auth'
import { toast } from 'sonner'
import { parseError, isRetryableError } from '@/lib/errors'
import { logger } from '@/lib/logger'

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [errorAction, setErrorAction] = useState('')
  const [canRetry, setCanRetry] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setErrorAction('')
    setCanRetry(false)

    if (password !== confirmPassword) {
      setError('Пароли не совпадают')
      setErrorAction('Убедитесь, что оба пароля идентичны')
      return
    }

    if (!token) {
      setError('Отсутствует токен для сброса пароля')
      setErrorAction('Попробуйте запросить ссылку заново')
      return
    }

    logger.action('ResetPasswordAttempt')
    setLoading(true)
    
    try {
      await authApi.resetPassword({ token, password })
      logger.info('Password reset successful')
      toast.success('Пароль успешно обновлен')
      router.push('/login')
    } catch (err: unknown) {
      const appError = parseError(err)
      
      logger.error('Password reset failed', err instanceof Error ? err : new Error(appError.message), {
        errorCode: appError.code,
      })
      
      setError(appError.message)
      setErrorAction(appError.action ?? '')
      setCanRetry(isRetryableError(appError))
      toast.error(appError.message)
    } finally {
      setLoading(false)
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
          <CardTitle className="text-3xl font-bold">Новый пароль</CardTitle>
          <CardDescription className="text-base">
            Придумайте новый пароль для входа в систему
          </CardDescription>
        </CardHeader>
        <CardContent>
          {token ? (
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
                <Label htmlFor="password">Новый пароль</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Минимум 6 символов"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    minLength={6}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Подтвердите пароль</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Повторите пароль"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10"
                    minLength={6}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={loading}>
                {loading ? 'Сохраняем...' : 'Сохранить пароль'}
              </Button>

              <Button type="button" variant="ghost" asChild className="w-full">
                <Link href="/login">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Вернуться к входу
                </Link>
              </Button>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <Alert variant="destructive">
                <AlertDescription>Токен для сброса пароля не найден.</AlertDescription>
              </Alert>
              <Button asChild className="w-full">
                <Link href="/forgot-password">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Запросить ссылку ещё раз
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Загрузка...</div>}>
      <ResetPasswordContent />
    </Suspense>
  )
}

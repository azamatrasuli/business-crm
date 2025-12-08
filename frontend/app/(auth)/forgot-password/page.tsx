'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'
import { authApi } from '@/lib/api/auth'
import { toast } from 'sonner'
import { parseError, isRetryableError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { isFeatureEnabled } from '@/lib/features.config'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [errorAction, setErrorAction] = useState('')
  const [canRetry, setCanRetry] = useState(false)

  // Redirect if feature is disabled
  useEffect(() => {
    if (!isFeatureEnabled('passwordReset')) {
      router.replace('/login')
    }
  }, [router])

  // Don't render if feature is disabled (avoids content flash)
  if (!isFeatureEnabled('passwordReset')) {
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setErrorAction('')
    setCanRetry(false)
    setLoading(true)
    
    logger.action('ForgotPasswordAttempt', { email: email.split('@')[0] + '@...' })
    
    try {
      await authApi.forgotPassword({ email })
      setSuccess(true)
      logger.info('Password reset email sent', { email: email.split('@')[0] + '@...' })
      toast.success('Мы отправили письмо со ссылкой на сброс пароля')
    } catch (err: unknown) {
      const appError = parseError(err)
      
      logger.error('Forgot password failed', err instanceof Error ? err : new Error(appError.message), {
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
          <CardTitle className="text-3xl font-bold">Сброс пароля</CardTitle>
          <CardDescription className="text-base">
            Укажите email, который привязан к вашему профилю
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="space-y-4 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
              <p className="text-lg font-semibold">
                Если такой email существует, мы отправили на него письмо с инструкциями.
              </p>
              <Button asChild className="w-full">
                <Link href="/login">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Вернуться к входу
                </Link>
              </Button>
            </div>
          ) : (
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
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={loading}>
                {loading ? 'Отправляем...' : 'Отправить письмо'}
              </Button>

              <Button type="button" variant="ghost" asChild className="w-full">
                <Link href="/login">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Вернуться к входу
                </Link>
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


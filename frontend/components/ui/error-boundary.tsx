'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from './button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card'
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react'
import { logger } from '@/lib/logger'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  /** Show detailed error info in development */
  showDetails?: boolean
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

/**
 * Error Boundary component for graceful error handling
 * Catches JavaScript errors in child component tree and displays fallback UI
 * 
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo })

    // Log to our logger
    logger.error('Error caught by ErrorBoundary', error, {
      componentStack: errorInfo.componentStack || 'N/A',
    })

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo)

    // In production, you might want to send to error tracking service
    // Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  handleRefresh = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      const isDev = process.env.NODE_ENV === 'development'
      const showDetails = this.props.showDetails ?? isDev

      // Default error UI
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <Card className="w-full max-w-lg shadow-lg border-destructive/20">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle className="text-xl">Произошла ошибка</CardTitle>
              <CardDescription className="text-base">
                Что-то пошло не так. Пожалуйста, попробуйте обновить страницу.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Error details (development only by default) */}
              {showDetails && this.state.error && (
                <div className="rounded-lg bg-muted p-4 text-sm">
                  <div className="flex items-center gap-2 text-destructive font-medium mb-2">
                    <Bug className="h-4 w-4" />
                    Детали ошибки
                  </div>
                  <code className="block text-xs text-muted-foreground break-all whitespace-pre-wrap">
                    {this.state.error.message}
                  </code>
                  {this.state.errorInfo?.componentStack && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                        Стек компонентов
                      </summary>
                      <pre className="mt-2 text-xs text-muted-foreground overflow-auto max-h-40">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={this.handleReset}
                  className="flex-1"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Попробовать снова
                </Button>
                <Button
                  variant="outline"
                  onClick={this.handleRefresh}
                  className="flex-1"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Обновить страницу
                </Button>
                <Button
                  onClick={this.handleGoHome}
                  className="flex-1"
                >
                  <Home className="h-4 w-4 mr-2" />
                  На главную
                </Button>
              </div>

              {/* Support info */}
              <p className="text-xs text-center text-muted-foreground">
                Если проблема повторяется, обратитесь в поддержку
              </p>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Simple error fallback component for quick use
 */
export function ErrorFallback({ 
  error, 
  resetErrorBoundary 
}: { 
  error: Error
  resetErrorBoundary: () => void 
}) {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center">
      <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
      <h2 className="text-lg font-semibold mb-2">Ошибка загрузки</h2>
      <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
      <Button onClick={resetErrorBoundary}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Попробовать снова
      </Button>
    </div>
  )
}


'use client'

import { useEffect, useState, Suspense, type ReactNode } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'

interface AuthProviderProps {
  children: ReactNode
}

function AuthProviderContent({ children }: AuthProviderProps) {
  const [isReady, setIsReady] = useState(false)
  const { initialize, isLoading, logout } = useAuthStore()
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const handleInit = async () => {
      // Check for logout parameter
      if (searchParams.get('logout') === 'true') {
        await logout()
        router.replace('/login')
        return
      }
      
      // Initialize auth state on mount
      await initialize()
      setIsReady(true)
    }
    
    handleInit()
  }, [initialize, logout, searchParams, router])

  // Show loading state while initializing
  if (!isReady || isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

const LoadingFallback = () => (
  <div className="flex h-screen w-screen items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">Загрузка...</p>
    </div>
  </div>
)

export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AuthProviderContent>{children}</AuthProviderContent>
    </Suspense>
  )
}


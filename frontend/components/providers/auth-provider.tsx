'use client'

import { useEffect, Suspense, type ReactNode } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'

interface AuthProviderProps {
  children: ReactNode
}

function AuthProviderContent({ children }: AuthProviderProps) {
  const { initialize, isInitializing, logout, _hasHydrated } = useAuthStore()
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    // Wait for Zustand to hydrate from localStorage before initializing
    // This is critical for Safari which may not have cookies due to ITP
    if (!_hasHydrated) {
      return
    }

    const handleInit = async () => {
      // Check for logout parameter
      if (searchParams.get('logout') === 'true') {
        await logout()
        router.replace('/login')
        return
      }

      // Initialize auth state after hydration is complete
      await initialize()
    }

    handleInit()
  }, [initialize, logout, searchParams, router, _hasHydrated])

  // Show loading state while waiting for hydration or initialization
  // This ensures we don't flash incorrect auth state on Safari
  if (!_hasHydrated || isInitializing) {
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


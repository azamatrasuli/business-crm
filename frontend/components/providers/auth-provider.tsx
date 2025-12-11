'use client'

import { useEffect, useState, Suspense, type ReactNode } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'

interface AuthProviderProps {
  children: ReactNode
}

function AuthProviderContent({ children }: AuthProviderProps) {
  const { initialize, isInitializing, logout, _hasHydrated } = useAuthStore()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [hydrationChecked, setHydrationChecked] = useState(false)

  // Ensure hydration completes - fallback if onRehydrateStorage doesn't fire
  useEffect(() => {
    // Check if persist API is available and use it
    const checkHydration = () => {
      const store = useAuthStore
      if (store.persist?.hasHydrated?.()) {
        if (!_hasHydrated) {
          useAuthStore.setState({ _hasHydrated: true })
        }
        setHydrationChecked(true)
        return true
      }
      return false
    }

    // Try immediately
    if (checkHydration()) return

    // Set up listener for when hydration finishes
    const unsub = useAuthStore.persist?.onFinishHydration?.(() => {
      useAuthStore.setState({ _hasHydrated: true })
      setHydrationChecked(true)
    })

    // Fallback timeout - if hydration doesn't happen in 2s, proceed anyway
    const timeout = setTimeout(() => {
      if (!hydrationChecked) {
        console.warn('Hydration timeout - proceeding without persisted state')
        useAuthStore.setState({ _hasHydrated: true })
        setHydrationChecked(true)
      }
    }, 2000)

    return () => {
      unsub?.()
      clearTimeout(timeout)
    }
  }, [_hasHydrated, hydrationChecked])

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
  const isReady = _hasHydrated || hydrationChecked
  if (!isReady || isInitializing) {
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


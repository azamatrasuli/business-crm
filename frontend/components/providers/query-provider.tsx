'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { getQueryClient } from '@/lib/query'
import type { ReactNode } from 'react'

interface QueryProviderProps {
  children: ReactNode
}

/**
 * React Query Provider
 * Wraps the app with QueryClientProvider and DevTools
 */
export function QueryProvider({ children }: QueryProviderProps) {
  // NOTE: Cannot useState here because this runs on server during hydration.
  // getQueryClient() handles the singleton pattern correctly.
  const queryClient = getQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools 
          initialIsOpen={false} 
          buttonPosition="bottom-left"
        />
      )}
    </QueryClientProvider>
  )
}


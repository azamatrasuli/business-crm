'use client'

import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { ImpersonateBanner } from '@/components/layout/impersonate-banner'
import { Toaster } from '@/components/ui/sonner'
import { ErrorBoundary } from '@/components/ui/error-boundary'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full bg-muted/20 overflow-hidden">
      {/* Sidebar Navigation - Hidden on mobile */}
      <nav 
        id="main-nav" 
        aria-label="Основная навигация"
        className="hidden lg:flex h-full"
      >
        <Sidebar />
      </nav>
      
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Impersonation warning banner */}
        <ImpersonateBanner />
        
        {/* Header with mobile menu */}
        <Header />
        
        {/* Main content area */}
        <main 
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto p-4 sm:p-6 focus:outline-none"
          role="main"
          aria-label="Основное содержимое"
        >
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>
      
      {/* Toast notifications */}
      <Toaster 
        position="top-right" 
        richColors 
        closeButton
        toastOptions={{
          // Ensure toasts are accessible
          classNames: {
            toast: 'group',
            title: 'font-medium',
            description: 'text-sm',
          },
        }}
      />
      
      {/* Live region for screen reader announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        id="announcer"
      />
    </div>
  )
}


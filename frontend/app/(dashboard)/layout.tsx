'use client'

import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { ImpersonateBanner } from '@/components/layout/impersonate-banner'
import { Toaster } from '@/components/ui/sonner'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full bg-muted/20 overflow-hidden">
      <div className="hidden lg:flex h-full">
        <Sidebar />
      </div>
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <ImpersonateBanner />
        <Header />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
      <Toaster position="top-right" richColors />
    </div>
  )
}


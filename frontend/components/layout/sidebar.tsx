'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import { UserCircle, LogOut, ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { menuItems, type MenuItem } from './sidebar-data'
import { isFeatureEnabled, getBlockedReason } from '@/lib/features.config'
import { toast } from 'sonner'

function NavButton({
  item,
  isActive,
  isCollapsed,
}: {
  item: MenuItem
  isActive: boolean
  isCollapsed: boolean
}) {
  // Проверяем доступна ли фича
  const featureEnabled = item.feature ? isFeatureEnabled(item.feature) : true
  const blockedReason = item.feature ? getBlockedReason(item.feature) : null
  
  // Обработчик клика для заблокированных фич
  const handleBlockedClick = (e: React.MouseEvent) => {
    if (!featureEnabled) {
      e.preventDefault()
      toast.info(blockedReason || 'Функционал будет доступен в следующем обновлении', {
        description: 'Следите за обновлениями!',
        icon: <Lock className="h-4 w-4" />,
      })
    }
  }
  
  const button = (
    <Button
      asChild={featureEnabled}
      variant={isActive && featureEnabled ? 'secondary' : 'ghost'}
      onClick={!featureEnabled ? handleBlockedClick : undefined}
      className={cn(
        'w-full h-11 text-sm transition-colors relative',
        isCollapsed ? 'justify-center px-0' : 'justify-start gap-3',
        isActive && featureEnabled 
          ? 'bg-primary/10 text-primary' 
          : featureEnabled 
            ? 'text-muted-foreground hover:text-foreground'
            : 'text-muted-foreground/50 cursor-not-allowed hover:bg-transparent'
      )}
    >
      {featureEnabled ? (
      <Link
        href={item.href}
        aria-label={item.label}
        className={cn('flex w-full items-center gap-3', isCollapsed && 'justify-center gap-0')}
      >
        <item.icon className="h-5 w-5 shrink-0" />
        {!isCollapsed && <span className="truncate">{item.label}</span>}
      </Link>
      ) : (
        <div className={cn('flex w-full items-center gap-3', isCollapsed && 'justify-center gap-0')}>
          <item.icon className="h-5 w-5 shrink-0 opacity-50" />
          {!isCollapsed && (
            <>
              <span className="truncate opacity-50">{item.label}</span>
              <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 h-5 border-dashed">
                Скоро
              </Badge>
            </>
          )}
        </div>
      )}
    </Button>
  )

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right">
          {item.label}
          {!featureEnabled && <span className="text-muted-foreground ml-1">(Скоро)</span>}
        </TooltipContent>
      </Tooltip>
    )
  }

  return button
}

function ActionButton({
  icon: Icon,
  label,
  href,
  onClick,
  isCollapsed,
  destructive = false,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  href?: string
  onClick?: () => void
  isCollapsed: boolean
  destructive?: boolean
}) {
  const content = (
    <Button
      asChild={Boolean(href)}
      variant="ghost"
      onClick={href ? undefined : onClick}
      className={cn(
        'w-full h-11 text-sm',
        isCollapsed ? 'justify-center px-0' : 'justify-start gap-3',
        destructive ? 'text-destructive hover:text-destructive' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {href ? (
        <Link href={href} aria-label={label}>
          <Icon className="h-5 w-5" />
          {!isCollapsed && <span>{label}</span>}
        </Link>
      ) : (
        <>
          <Icon className="h-5 w-5" />
          {!isCollapsed && <span>{label}</span>}
        </>
      )}
    </Button>
  )

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    )
  }

  return content
}

export function Sidebar() {
  const pathname = usePathname()
  const { user, hasPermission, logout, isHeadquarters } = useAuthStore()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const rafId = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(rafId)
  }, [])

  const handleLogout = async () => {
    await logout()
    window.location.href = '/login'
  }

  const canAccessUsers = user?.role === 'Admin' || user?.role === 'Superadmin'

  const visibleItems = menuItems.filter((item) => {
    // Projects page is only visible for headquarters admins
    if (item.permission === 'projects') {
      return isHeadquarters && (hasPermission(item.permission) || hasPermission('*'))
    }
    if (item.permission === 'users') {
      return canAccessUsers
    }
    return hasPermission(item.permission) || hasPermission('*')
  })

  const itemsToRender = visibleItems

  // Предотвращаем гидратацию до монтирования на клиенте
  if (!mounted) {
    return (
      <div
        className={cn(
          'relative hidden lg:flex h-screen flex-col border-r bg-card text-card-foreground transition-all duration-300',
          'w-64'
        )}
      >
        <div className="flex h-16 shrink-0 items-center border-b px-4 justify-between">
          <div className="flex items-center gap-3 flex-1 overflow-hidden min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-semibold">
              <span className="text-lg">Y</span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden px-3">
              <span className="text-base font-semibold truncate">Yalla Admin</span>
              <span className="text-xs text-muted-foreground truncate">{user?.email || ''}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Свернуть меню"
            disabled
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <nav className="p-4 space-y-1">
            <div className="text-sm text-muted-foreground">Загрузка...</div>
          </nav>
        </ScrollArea>
        <div className="border-t p-4 shrink-0">
          <div className="space-y-2 rounded-xl border border-border/60 bg-card/80 p-3">
            <div className="h-11" />
            <div className="h-11" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative hidden lg:flex h-screen flex-col border-r bg-card text-card-foreground transition-all duration-300',
        isCollapsed ? 'w-[80px]' : 'w-64'
      )}
    >
      <div className={cn("flex h-16 shrink-0 items-center border-b px-4", isCollapsed ? "justify-center" : "justify-between")}>
        {isCollapsed ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="h-12 w-12 shrink-0 text-foreground hover:text-foreground hover:bg-primary/10 rounded-lg"
            aria-label="Раскрыть меню"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        ) : (
          <>
            <div className="flex items-center gap-3 flex-1 overflow-hidden min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-semibold">
                <span className="text-lg">Y</span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col overflow-hidden px-3">
                <span className="text-base font-semibold truncate">Yalla Admin</span>
                <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed((prev) => !prev)}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Свернуть меню"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <nav className="p-4 space-y-1" suppressHydrationWarning>
          {itemsToRender.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Доступные разделы появятся после назначения прав
            </div>
          ) : (
            itemsToRender.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <NavButton
                  key={item.href}
                  item={item}
                  isActive={isActive}
                  isCollapsed={isCollapsed}
                />
              )
            })
          )}
        </nav>
      </ScrollArea>

      <div className="border-t p-4 shrink-0">
        <div
          className={cn(
            'space-y-2 rounded-xl border border-border/60 bg-card/80 p-3',
            isCollapsed && 'flex flex-col items-center space-y-2'
          )}
        >
          <ActionButton
            icon={UserCircle}
            label="Мой профиль"
            href="/profile"
            isCollapsed={isCollapsed}
          />
          <ActionButton
            icon={LogOut}
            label="Выйти"
            onClick={handleLogout}
            isCollapsed={isCollapsed}
            destructive
          />
        </div>
      </div>
    </div>
  )
}


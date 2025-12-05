"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, LogOut, UserCircle, X } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/auth-store"
import { menuItems } from "./sidebar-data"

export function MobileSidebar() {
  const pathname = usePathname()
  const { user, hasPermission, logout } = useAuthStore()

  const canAccessUsers = user?.role === "Admin" || user?.role === "Superadmin"

  const visibleItems = menuItems.filter((item) => {
    if (item.permission === "users") {
      return canAccessUsers
    }
    return hasPermission(item.permission) || hasPermission("*")
  })

  const handleLogout = async () => {
    await logout()
    window.location.href = "/login"
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Открыть меню</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 flex flex-col">
        <SheetTitle className="sr-only">Меню навигации</SheetTitle>
        <div className="flex h-16 items-center justify-between border-b px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-semibold">
              Y
            </div>
            <div className="flex flex-col">
              <span className="text-base font-semibold">Yalla Admin</span>
              <span className="text-xs text-muted-foreground">{user?.email}</span>
            </div>
          </div>
          <SheetClose asChild>
            <Button variant="ghost" size="icon" className="shrink-0">
              <X className="h-5 w-5" />
              <span className="sr-only">Закрыть меню</span>
            </Button>
          </SheetClose>
        </div>
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-1">
            {visibleItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
              return (
                <SheetClose key={item.href} asChild>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start gap-3 text-sm transition-all duration-200",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    asChild
                  >
                    <Link href={item.href}>
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </Button>
                </SheetClose>
              )
            })}
          </nav>
        </ScrollArea>
        <div className="border-t p-4 space-y-2">
          <SheetClose asChild>
            <Button variant="ghost" className="w-full justify-start gap-3 transition-all duration-200" asChild>
              <Link href="/profile">
                <UserCircle className="h-4 w-4" />
                Мой профиль
              </Link>
            </Button>
          </SheetClose>
          <Button variant="ghost" className="w-full justify-start gap-3 text-destructive transition-all duration-200" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Выйти
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}


"use client"

import { useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { useCompanySelectorStore } from '@/stores/company-selector-store'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { Badge } from '@/components/ui/badge'
import { UserCircle, LogOut, Building2, Crown, ChevronDown, Briefcase } from 'lucide-react'
import { MobileSidebar } from './mobile-sidebar'

export function Header() {
  const { user, logout, projectName, isHeadquarters } = useAuthStore()
  const { 
    companies, 
    selectedCompanyId, 
    selectedCompanyName,
    isLoadingCompanies,
    fetchCompanies, 
    setSelectedCompany 
  } = useCompanySelectorStore()
  
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  
  // Fetch companies for SUPER_ADMIN
  useEffect(() => {
    if (isSuperAdmin && companies.length === 0) {
      fetchCompanies()
    }
  }, [isSuperAdmin, companies.length, fetchCompanies])

  const handleLogout = async () => {
    await logout()
    window.location.href = '/login'
  }

  const initials = user?.fullName
    ? user.fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U'

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="flex h-16 w-full items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-4">
          <MobileSidebar />
          <h1 className="hidden md:block text-lg font-semibold text-foreground lg:text-xl">Yalla Business Admin</h1>
          {/* Company selector for SUPER_ADMIN */}
          {isSuperAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="hidden sm:flex items-center gap-2 h-9">
                  <Briefcase className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium truncate max-w-[150px]">
                    {selectedCompanyName || 'Все компании'}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64" align="start">
                <DropdownMenuLabel className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-amber-500" />
                  Выбор компании
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isLoadingCompanies ? (
                  <DropdownMenuItem disabled>Загрузка...</DropdownMenuItem>
                ) : companies.length === 0 ? (
                  <DropdownMenuItem disabled>Нет компаний</DropdownMenuItem>
                ) : (
                  companies.map((company) => (
                    <DropdownMenuItem 
                      key={company.id}
                      onClick={() => setSelectedCompany(company.id, company.name)}
                      className="flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{company.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {company.employeesCount} сотр. • {company.budget.toLocaleString()} TJS
                        </span>
                      </div>
                      {selectedCompanyId === company.id && (
                        <Badge variant="secondary" className="ml-2">✓</Badge>
                      )}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          {/* Project name badge */}
          {projectName && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-muted/30">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium truncate max-w-[200px]">{projectName}</span>
              {isHeadquarters && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 gap-0.5">
                  <Crown className="h-2.5 w-2.5" />
                  HQ
                </Badge>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.fullName}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href="/profile" className="flex items-center cursor-pointer">
                  <UserCircle className="mr-2 h-4 w-4" />
                  <span>Мой профиль</span>
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Выйти</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

